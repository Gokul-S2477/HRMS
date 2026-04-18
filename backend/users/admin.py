from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Access Control",
            {
                "fields": (
                    "role",
                    "account_status",
                    "display_name",
                    "employee_profile",
                    "managed_by",
                    "must_change_password",
                    "can_use_chat",
                    "last_seen_at",
                )
            },
        ),
    )
    list_display = UserAdmin.list_display + (
        "role",
        "account_status",
        "employee_profile",
        "managed_by",
        "can_use_chat",
    )
    list_filter = UserAdmin.list_filter + ("role", "account_status", "can_use_chat")
    search_fields = UserAdmin.search_fields + ("display_name", "employee_profile__emp_code")
