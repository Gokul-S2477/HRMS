from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import is_employee, is_hr_or_above, is_super_admin
from coredata.workflow_services import create_notification
from .realtime import broadcast_thread_event

from .models import ChatParticipant, ChatThread
from .serializers import (
    ChatContactSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatThreadSerializer,
    ChatThreadWriteSerializer,
)

User = get_user_model()


class ChatThreadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ChatThread.objects.prefetch_related("memberships__user", "messages__sender").all()

    def get_serializer_class(self):
        if self.action == "create":
            return ChatThreadWriteSerializer
        return ChatThreadSerializer

    def _touch_presence(self, user):
        user.last_seen_at = timezone.now()
        user.save(update_fields=["last_seen_at"])

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset.filter(memberships__user=user).distinct()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(messages__body__icontains=search)
                | Q(memberships__user__first_name__icontains=search)
                | Q(memberships__user__last_name__icontains=search)
                | Q(memberships__user__username__icontains=search)
            ).distinct()
        return qs.order_by("-last_message_at")

    def list(self, request, *args, **kwargs):
        if not request.user.can_use_chat:
            return Response({"detail": "Chat is disabled for this account."}, status=status.HTTP_403_FORBIDDEN)
        self._touch_presence(request.user)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not request.user.can_use_chat:
            return Response({"detail": "Chat is disabled for this account."}, status=status.HTTP_403_FORBIDDEN)
        self._touch_presence(request.user)
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        thread = serializer.save()
        broadcast_thread_event(str(thread.id), "thread.updated", actor_id=request.user.id)
        return Response(ChatThreadSerializer(thread, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def contacts(self, request):
        self._touch_presence(request.user)
        qs = User.objects.filter(is_active=True, can_use_chat=True).exclude(pk=request.user.pk)
        if is_employee(request.user):
            qs = qs.filter(role__in=[User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN])
        elif is_hr_or_above(request.user):
            qs = qs.filter(role__in=[User.ROLE_EMPLOYEE, User.ROLE_HR, User.ROLE_STAKEHOLDER, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN])
        elif is_super_admin(request.user):
            qs = qs.exclude(role=User.ROLE_EMPLOYEE)
        serializer = ChatContactSerializer(qs.order_by("first_name", "username"), many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        thread = self.get_object()
        if not request.user.can_use_chat:
            return Response({"detail": "Chat is disabled for this account."}, status=status.HTTP_403_FORBIDDEN)
        self._touch_presence(request.user)

        if request.method == "GET":
            messages = thread.messages.select_related("sender").all()
            ChatParticipant.objects.filter(thread=thread, user=request.user).update(last_read_at=timezone.now(), typing_at=None)
            broadcast_thread_event(str(thread.id), "read.updated", actor_id=request.user.id)
            serializer = ChatMessageSerializer(messages, many=True, context={"request": request})
            return Response(serializer.data)

        serializer = ChatMessageCreateSerializer(data=request.data, context={"request": request, "thread": thread})
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        for membership in thread.memberships.select_related("user").exclude(user=request.user):
            create_notification(
                membership.user,
                title=f"New message from {request.user.get_display_name()}",
                body=(message.body or "")[:140],
                actor=request.user,
                notification_type="chat_message",
                target_url=f"/application/chat?thread={thread.id}",
                reference_type="chat-thread",
                reference_id=str(thread.id),
            )
        broadcast_thread_event(str(thread.id), "message.created", actor_id=request.user.id, message_id=str(message.id))
        return Response(ChatMessageSerializer(message, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        thread = self.get_object()
        self._touch_presence(request.user)
        ChatParticipant.objects.filter(thread=thread, user=request.user).update(last_read_at=timezone.now(), typing_at=None)
        broadcast_thread_event(str(thread.id), "read.updated", actor_id=request.user.id)
        return Response({"status": "ok"})

    @action(detail=True, methods=["post"])
    def typing(self, request, pk=None):
        thread = self.get_object()
        is_typing = bool(request.data.get("typing", True))
        ChatParticipant.objects.filter(thread=thread, user=request.user).update(
            typing_at=timezone.now() if is_typing else None
        )
        self._touch_presence(request.user)
        broadcast_thread_event(str(thread.id), "typing.updated", actor_id=request.user.id)
        return Response({"status": "ok", "typing": is_typing})
