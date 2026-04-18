from django.contrib import admin

from .models import ChatMessage, ChatParticipant, ChatThread


@admin.register(ChatThread)
class ChatThreadAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "thread_type", "created_by", "last_message_at")
    search_fields = ("title", "created_by__username", "created_by__email")


@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    list_display = ("thread", "user", "last_read_at", "is_pinned", "is_muted")
    search_fields = ("thread__title", "user__username", "user__email")


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("thread", "sender", "created_at")
    search_fields = ("thread__title", "sender__username", "body")
