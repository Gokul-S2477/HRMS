from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import ChatMessage, ChatParticipant, ChatThread

User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    effective_role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "role",
            "effective_role",
            "employee_profile_id",
            "last_seen_at",
        ]

    def get_display_name(self, obj):
        return obj.get_display_name()


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ["id", "thread", "sender", "body", "created_at", "updated_at", "is_mine"]
        read_only_fields = ["id", "thread", "sender", "created_at", "updated_at", "is_mine"]

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)


class ChatThreadSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    latest_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    display_title = serializers.SerializerMethodField()
    typing_users = serializers.SerializerMethodField()
    read_receipts = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = [
            "id",
            "title",
            "display_title",
            "thread_type",
            "participants",
            "latest_message",
            "unread_count",
            "typing_users",
            "read_receipts",
            "last_message_at",
            "created_at",
            "updated_at",
        ]

    def get_participants(self, obj):
        users = [membership.user for membership in obj.memberships.select_related("user")]
        return ChatUserSerializer(users, many=True).data

    def get_latest_message(self, obj):
        latest = obj.messages.order_by("-created_at").first()
        if not latest:
            return None
        return ChatMessageSerializer(latest, context=self.context).data

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        membership = obj.memberships.filter(user=request.user).first()
        if not membership or not membership.last_read_at:
            return obj.messages.exclude(sender=request.user).count()
        return obj.messages.filter(created_at__gt=membership.last_read_at).exclude(sender=request.user).count()

    def get_display_title(self, obj):
        request = self.context.get("request")
        if obj.title:
            return obj.title
        if not request or not request.user.is_authenticated:
            return "Conversation"
        others = [
            membership.user.get_display_name()
            for membership in obj.memberships.select_related("user")
            if membership.user_id != request.user.id
        ]
        return ", ".join(others) or "Personal chat"

    def get_typing_users(self, obj):
        request = self.context.get("request")
        threshold = timezone.now() - timezone.timedelta(seconds=12)
        memberships = obj.memberships.select_related("user").filter(typing_at__gte=threshold)
        if request and request.user.is_authenticated:
            memberships = memberships.exclude(user=request.user)
        return ChatUserSerializer([membership.user for membership in memberships], many=True).data

    def get_read_receipts(self, obj):
        request = self.context.get("request")
        memberships = obj.memberships.select_related("user").exclude(last_read_at__isnull=True)
        if request and request.user.is_authenticated:
            memberships = memberships.exclude(user=request.user)
        return [
            {
                "user_id": membership.user_id,
                "display_name": membership.user.get_display_name(),
                "last_read_at": membership.last_read_at,
            }
            for membership in memberships
        ]


class ChatThreadWriteSerializer(serializers.Serializer):
    participant_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    title = serializers.CharField(required=False, allow_blank=True)
    thread_type = serializers.ChoiceField(choices=ChatThread.THREAD_TYPE_CHOICES, required=False)
    initial_message = serializers.CharField(required=False, allow_blank=True)

    def validate_participant_ids(self, value):
        ids = sorted({int(item) for item in value})
        users = list(User.objects.filter(id__in=ids, is_active=True, can_use_chat=True))
        if len(users) != len(ids):
            raise serializers.ValidationError("One or more selected participants are unavailable for chat.")
        return ids

    def create(self, validated_data):
        request = self.context["request"]
        participant_ids = set(validated_data["participant_ids"])
        participant_ids.add(request.user.id)
        thread_type = validated_data.get("thread_type") or (
            ChatThread.TYPE_DIRECT if len(participant_ids) == 2 else ChatThread.TYPE_GROUP
        )

        if thread_type == ChatThread.TYPE_DIRECT and len(participant_ids) == 2:
            direct_threads = ChatThread.objects.filter(thread_type=ChatThread.TYPE_DIRECT)
            for thread in direct_threads:
                thread_participant_ids = set(thread.memberships.values_list("user_id", flat=True))
                if thread_participant_ids == participant_ids:
                    initial_message = validated_data.get("initial_message")
                    if initial_message:
                        ChatMessage.objects.create(thread=thread, sender=request.user, body=initial_message)
                        thread.last_message_at = timezone.now()
                        thread.save(update_fields=["last_message_at", "updated_at"])
                    return thread

        thread = ChatThread.objects.create(
            created_by=request.user,
            title=validated_data.get("title", ""),
            thread_type=thread_type,
        )
        memberships = [
            ChatParticipant(thread=thread, user_id=user_id, last_read_at=timezone.now() if user_id == request.user.id else None)
            for user_id in participant_ids
        ]
        ChatParticipant.objects.bulk_create(memberships)

        initial_message = validated_data.get("initial_message")
        if initial_message:
            ChatMessage.objects.create(thread=thread, sender=request.user, body=initial_message)
            thread.last_message_at = timezone.now()
            thread.save(update_fields=["last_message_at", "updated_at"])
        return thread


class ChatContactSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    effective_role = serializers.CharField(read_only=True)
    active_thread_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "role",
            "effective_role",
            "employee_profile_id",
            "active_thread_id",
            "last_seen_at",
        ]

    def get_display_name(self, obj):
        return obj.get_display_name()

    def get_active_thread_id(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        thread = ChatThread.objects.filter(thread_type=ChatThread.TYPE_DIRECT, memberships__user=request.user).filter(memberships__user=obj).first()
        return str(thread.id) if thread else None


class ChatMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField()

    def create(self, validated_data):
        thread = self.context["thread"]
        user = self.context["request"].user
        message = ChatMessage.objects.create(thread=thread, sender=user, body=validated_data["body"])
        thread.last_message_at = timezone.now()
        thread.save(update_fields=["last_message_at", "updated_at"])
        ChatParticipant.objects.filter(thread=thread, user=user).update(last_read_at=timezone.now(), typing_at=None)
        return message
