from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    ROLE_SUPER_ADMIN = "super_admin"
    ROLE_ADMIN = "admin"
    ROLE_HR = "hr"
    ROLE_EMPLOYEE = "employee"
    ROLE_STAKEHOLDER = "stakeholder"

    STATUS_ACTIVE = "active"
    STATUS_BLOCKED = "blocked"
    STATUS_INVITED = "invited"

    ROLE_CHOICES = (
        (ROLE_SUPER_ADMIN, "Super Admin"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_HR, "HR"),
        (ROLE_EMPLOYEE, "Employee"),
        (ROLE_STAKEHOLDER, "Stakeholder"),
    )
    ACCOUNT_STATUS_CHOICES = (
        (STATUS_ACTIVE, "Active"),
        (STATUS_BLOCKED, "Blocked"),
        (STATUS_INVITED, "Invited"),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_EMPLOYEE,
        db_index=True,
    )
    account_status = models.CharField(
        max_length=20,
        choices=ACCOUNT_STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True,
    )
    display_name = models.CharField(max_length=200, blank=True)
    employee_profile = models.OneToOneField(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_account",
    )
    managed_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_accounts",
    )
    must_change_password = models.BooleanField(default=False)
    can_use_chat = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["username"]

    @property
    def effective_role(self) -> str:
        if self.is_superuser or self.role in {self.ROLE_SUPER_ADMIN, self.ROLE_ADMIN}:
            return self.ROLE_SUPER_ADMIN
        return self.role

    @property
    def is_hr_or_above(self) -> bool:
        return self.effective_role in {self.ROLE_SUPER_ADMIN, self.ROLE_HR}

    def get_display_name(self) -> str:
        if self.display_name:
            return self.display_name
        full_name = f"{self.first_name} {self.last_name}".strip()
        if full_name:
            return full_name
        if self.employee_profile_id:
            employee = self.employee_profile
            return f"{employee.first_name} {employee.last_name or ''}".strip()
        return self.username

    def __str__(self) -> str:
        return self.get_display_name()
