import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatThread(models.Model):
    TYPE_DIRECT = "direct"
    TYPE_GROUP = "group"
    THREAD_TYPE_CHOICES = ((TYPE_DIRECT, "Direct"), (TYPE_GROUP, "Group"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, blank=True)
    thread_type = models.CharField(max_length=20, choices=THREAD_TYPE_CHOICES, default=TYPE_DIRECT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_threads")
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, through="ChatParticipant", related_name="chat_threads")
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-updated_at"]

    def __str__(self) -> str:
        return self.title or f"Chat {self.pk}"


class ChatParticipant(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_memberships")
    last_read_at = models.DateTimeField(null=True, blank=True)
    typing_at = models.DateTimeField(null=True, blank=True)
    is_muted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("thread", "user")
        ordering = ["-is_pinned", "joined_at"]

    def __str__(self) -> str:
        return f"{self.user} in {self.thread}"


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_chat_messages")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.sender} -> {self.thread_id}"
