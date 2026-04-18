from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from types import SimpleNamespace
from urllib.parse import parse_qs

from asgiref.sync import async_to_sync, sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication

from coredata.workflow_services import create_notification

from .models import ChatMessage, ChatParticipant, ChatThread
from .serializers import ChatMessageSerializer, ChatThreadSerializer, ChatUserSerializer

try:
    from redis.asyncio import from_url as redis_from_url
except ImportError:  # pragma: no cover - optional production dependency
    redis_from_url = None


logger = logging.getLogger(__name__)
User = get_user_model()


def _serializer_context(user):
    return {"request": SimpleNamespace(user=user)}


class RedisEventRelay:
    def __init__(self, url: str, prefix: str, origin: str):
        self.url = url
        self.prefix = prefix
        self.origin = origin
        self._listener_task: asyncio.Task | None = None
        self._listener_lock = asyncio.Lock()
        self._publisher = None

    def _channel_name(self, user_id: int) -> str:
        return f"{self.prefix}:user:{user_id}"

    def _parse_user_id(self, channel: str | bytes | None) -> int | None:
        if not channel:
            return None
        if isinstance(channel, bytes):
            channel = channel.decode()
        try:
            return int(str(channel).rsplit(":", 1)[-1])
        except (TypeError, ValueError):
            return None

    async def _get_publisher(self):
        if self._publisher is None:
            self._publisher = redis_from_url(self.url, decode_responses=True)
        return self._publisher

    async def publish_user_event(self, user_id: int, event: dict):
        publisher = await self._get_publisher()
        payload = json.dumps({"origin": self.origin, "event": event}, default=str)
        await publisher.publish(self._channel_name(user_id), payload)

    async def ensure_listener(self, dispatcher):
        if self._listener_task and not self._listener_task.done():
            return
        async with self._listener_lock:
            if self._listener_task and not self._listener_task.done():
                return
            self._listener_task = asyncio.create_task(self._listen_forever(dispatcher))

    async def _listen_forever(self, dispatcher):
        pattern = f"{self.prefix}:user:*"
        while True:
            pubsub = None
            client = None
            try:
                client = redis_from_url(self.url, decode_responses=True)
                pubsub = client.pubsub()
                await pubsub.psubscribe(pattern)
                logger.info("Chat Redis relay subscribed to %s", pattern)
                async for message in pubsub.listen():
                    if message.get("type") != "pmessage":
                        continue
                    payload = message.get("data")
                    if not payload:
                        continue
                    try:
                        envelope = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    if envelope.get("origin") == self.origin:
                        continue
                    user_id = self._parse_user_id(message.get("channel"))
                    if user_id is None:
                        continue
                    await dispatcher(user_id, envelope.get("event") or {})
            except asyncio.CancelledError:
                raise
            except Exception:  # pragma: no cover - depends on optional infra
                logger.exception("Chat Redis relay listener dropped; retrying with fallback delay.")
                await asyncio.sleep(2)
            finally:
                if pubsub is not None:
                    await pubsub.close()
                if client is not None:
                    await client.close()


def create_event_relay() -> RedisEventRelay | None:
    backend = str(getattr(settings, "CHAT_REALTIME_BACKEND", "memory") or "memory").lower()
    redis_url = str(getattr(settings, "CHAT_REDIS_URL", "") or "").strip()
    prefix = str(getattr(settings, "CHAT_REALTIME_CHANNEL_PREFIX", "hrms-chat") or "hrms-chat").strip()
    origin = str(getattr(settings, "CHAT_REALTIME_PROCESS_ID", "hrms-dev") or "hrms-dev").strip()

    if backend != "redis":
        return None
    if not redis_url:
        logger.warning("CHAT_REALTIME_BACKEND is set to redis, but CHAT_REDIS_URL/REDIS_URL is missing. Falling back to in-memory relay.")
        return None
    if redis_from_url is None:
        logger.warning("Redis chat backend requested but the redis package is not installed. Falling back to in-memory relay.")
        return None
    return RedisEventRelay(redis_url, prefix, origin)


class ChatRealtimeHub:
    def __init__(self):
        self._user_connections: dict[int, set["ChatSocketConnection"]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._relay = create_event_relay()
        self.backend_name = "redis" if self._relay else "memory"

    async def _send_local_to_user(self, user_id: int, event: dict):
        async with self._lock:
            targets = list(self._user_connections.get(user_id, set()))
        if not targets:
            return
        await asyncio.gather(*(target.send_event(event) for target in targets), return_exceptions=True)

    async def register(self, connection: "ChatSocketConnection"):
        async with self._lock:
            self._user_connections[connection.user_id].add(connection)
        if self._relay:
            await self._relay.ensure_listener(self._send_local_to_user)

    async def unregister(self, connection: "ChatSocketConnection"):
        async with self._lock:
            connections = self._user_connections.get(connection.user_id, set())
            connections.discard(connection)
            if not connections:
                self._user_connections.pop(connection.user_id, None)

    async def send_to_user(self, user_id: int, event: dict):
        await self._send_local_to_user(user_id, event)
        if self._relay:
            try:
                await self._relay.publish_user_event(user_id, event)
            except Exception:  # pragma: no cover - depends on optional infra
                logger.exception("Unable to relay chat event for user %s through Redis.", user_id)


hub = ChatRealtimeHub()


@sync_to_async
def authenticate_socket_user(raw_token: str | None):
    if not raw_token:
        return None
    authentication = JWTAuthentication()
    try:
        validated = authentication.get_validated_token(raw_token)
        user = authentication.get_user(validated)
    except Exception:
        return None
    if not getattr(user, "is_active", False):
        return None
    if getattr(user, "account_status", "") == getattr(User, "STATUS_BLOCKED", "blocked"):
        return None
    if not getattr(user, "can_use_chat", False):
        return None
    return user


@sync_to_async
def touch_presence(user_id: int):
    user = User.objects.get(pk=user_id)
    user.last_seen_at = timezone.now()
    user.save(update_fields=["last_seen_at"])
    return ChatUserSerializer(user).data


@sync_to_async
def clear_typing_for_user(user_id: int):
    thread_ids = list(
        ChatParticipant.objects.filter(user_id=user_id, typing_at__isnull=False).values_list("thread_id", flat=True)
    )
    ChatParticipant.objects.filter(user_id=user_id, typing_at__isnull=False).update(typing_at=None)
    return [str(thread_id) for thread_id in thread_ids]


@sync_to_async
def get_presence_audience_ids(user_id: int):
    participant_ids = ChatParticipant.objects.filter(thread__memberships__user_id=user_id).exclude(
        user_id=user_id
    )
    return list(set(participant_ids.values_list("user_id", flat=True)))


@sync_to_async
def build_presence_event(subject_user_id: int, status: str):
    user = User.objects.get(pk=subject_user_id)
    return {
        "type": "presence.updated",
        "status": status,
        "presence": ChatUserSerializer(user).data,
    }


@sync_to_async
def get_thread_participant_ids(thread_id: str):
    return list(ChatParticipant.objects.filter(thread_id=thread_id).values_list("user_id", flat=True))


@sync_to_async
def build_thread_event(thread_id: str, viewer_id: int, event_type: str, actor_id=None, message_id=None):
    thread = (
        ChatThread.objects.prefetch_related("memberships__user", "messages__sender")
        .distinct()
        .get(pk=thread_id)
    )
    viewer = User.objects.get(pk=viewer_id)
    payload = {
        "type": event_type,
        "threadId": str(thread.id),
        "actorId": actor_id,
        "thread": ChatThreadSerializer(thread, context=_serializer_context(viewer)).data,
    }
    if message_id:
        message = ChatMessage.objects.select_related("sender", "thread").get(pk=message_id)
        payload["message"] = ChatMessageSerializer(message, context=_serializer_context(viewer)).data
    return payload


@sync_to_async
def mark_thread_read_sync(thread_id: str, user_id: int):
    updated = ChatParticipant.objects.filter(thread_id=thread_id, user_id=user_id).update(
        last_read_at=timezone.now(),
        typing_at=None,
    )
    return bool(updated)


@sync_to_async
def update_typing_sync(thread_id: str, user_id: int, is_typing: bool):
    updated = ChatParticipant.objects.filter(thread_id=thread_id, user_id=user_id).update(
        typing_at=timezone.now() if is_typing else None
    )
    return bool(updated)


@sync_to_async
def create_message_sync(thread_id: str, user_id: int, body: str):
    thread = (
        ChatThread.objects.prefetch_related("memberships__user")
        .distinct()
        .get(pk=thread_id, memberships__user_id=user_id)
    )
    sender = User.objects.get(pk=user_id)
    message = ChatMessage.objects.create(thread=thread, sender=sender, body=body)
    thread.last_message_at = timezone.now()
    thread.save(update_fields=["last_message_at", "updated_at"])
    ChatParticipant.objects.filter(thread=thread, user=sender).update(
        last_read_at=timezone.now(),
        typing_at=None,
    )
    for membership in thread.memberships.select_related("user").exclude(user=sender):
        create_notification(
            membership.user,
            title=f"New message from {sender.get_display_name()}",
            body=(message.body or "")[:140],
            actor=sender,
            notification_type="chat_message",
            target_url=f"/application/chat?thread={thread.id}",
            reference_type="chat-thread",
            reference_id=str(thread.id),
        )
    return str(thread.id), str(message.id)


async def broadcast_presence_update(user_id: int, status: str):
    audience_ids = await get_presence_audience_ids(user_id)
    if not audience_ids:
        return
    event = await build_presence_event(user_id, status)
    await asyncio.gather(*(hub.send_to_user(audience_id, event) for audience_id in audience_ids), return_exceptions=True)


async def _broadcast_thread_event(thread_id: str, event_type: str, actor_id=None, message_id=None):
    participant_ids = await get_thread_participant_ids(thread_id)
    if not participant_ids:
        return
    events = await asyncio.gather(
        *(build_thread_event(thread_id, participant_id, event_type, actor_id=actor_id, message_id=message_id) for participant_id in participant_ids)
    )
    await asyncio.gather(
        *(hub.send_to_user(participant_id, event) for participant_id, event in zip(participant_ids, events)),
        return_exceptions=True,
    )


def broadcast_thread_event(thread_id: str, event_type: str, actor_id=None, message_id=None):
    async_to_sync(_broadcast_thread_event)(thread_id, event_type, actor_id=actor_id, message_id=message_id)


class ChatSocketConnection:
    def __init__(self, scope, receive, send, user):
        self.scope = scope
        self.receive = receive
        self.send = send
        self.user = user
        self.user_id = user.id
        self.closed = False

    async def send_event(self, event: dict):
        if self.closed:
            return
        await self.send(
            {
                "type": "websocket.send",
                "text": json.dumps(event, default=str),
            }
        )

    async def run(self):
        await self.send({"type": "websocket.accept"})
        await hub.register(self)
        await touch_presence(self.user_id)
        await self.send_event(
            {
                "type": "connected",
                "transport": "websocket",
                "realtimeBackend": hub.backend_name,
                "userId": self.user_id,
                "serverTime": timezone.now().isoformat(),
            }
        )
        await broadcast_presence_update(self.user_id, "online")

        try:
            while True:
                message = await self.receive()
                event_type = message.get("type")
                if event_type == "websocket.disconnect":
                    break
                if event_type != "websocket.receive":
                    continue
                payload = message.get("text")
                if not payload:
                    continue
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    await self.send_event({"type": "error", "detail": "Invalid socket payload."})
                    continue
                await self.handle_event(data)
        finally:
            self.closed = True
            await hub.unregister(self)
            cleared_threads = await clear_typing_for_user(self.user_id)
            for thread_id in cleared_threads:
                await _broadcast_thread_event(thread_id, "typing.updated", actor_id=self.user_id)
            await touch_presence(self.user_id)
            await broadcast_presence_update(self.user_id, "offline")

    async def handle_event(self, data: dict):
        action = data.get("type")
        if action == "ping":
            await touch_presence(self.user_id)
            await self.send_event({"type": "pong", "serverTime": timezone.now().isoformat()})
            return

        thread_id = str(data.get("threadId") or "").strip()

        if action == "typing":
            if not thread_id:
                return
            if await update_typing_sync(thread_id, self.user_id, bool(data.get("typing", True))):
                await touch_presence(self.user_id)
                await _broadcast_thread_event(thread_id, "typing.updated", actor_id=self.user_id)
            return

        if action == "mark_read":
            if not thread_id:
                return
            if await mark_thread_read_sync(thread_id, self.user_id):
                await touch_presence(self.user_id)
                await _broadcast_thread_event(thread_id, "read.updated", actor_id=self.user_id)
            return

        if action == "message.send":
            body = str(data.get("body") or "").strip()
            if not thread_id or not body:
                await self.send_event({"type": "error", "detail": "Thread and message body are required."})
                return
            try:
                saved_thread_id, message_id = await create_message_sync(thread_id, self.user_id, body)
            except Exception:
                await self.send_event({"type": "error", "detail": "Unable to deliver the message."})
                return
            await touch_presence(self.user_id)
            await _broadcast_thread_event(saved_thread_id, "message.created", actor_id=self.user_id, message_id=message_id)
            return


class ChatWebSocketApplication:
    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if not path.startswith("/ws/chat/"):
            await send({"type": "websocket.close", "code": 4404})
            return

        query_string = (scope.get("query_string") or b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]
        user = await authenticate_socket_user(token)
        if not user:
            await send({"type": "websocket.close", "code": 4401})
            return

        connection = ChatSocketConnection(scope, receive, send, user)
        await connection.run()


chat_websocket_application = ChatWebSocketApplication()
