from rest_framework.permissions import BasePermission

from .models import CustomUser


SUPER_ADMIN_ROLES = {CustomUser.ROLE_SUPER_ADMIN, CustomUser.ROLE_ADMIN}
HR_ROLES = SUPER_ADMIN_ROLES | {CustomUser.ROLE_HR}
EMPLOYEE_ROLES = {CustomUser.ROLE_EMPLOYEE}
STAKEHOLDER_ROLES = {CustomUser.ROLE_STAKEHOLDER}


def resolve_role(user) -> str | None:
    if not getattr(user, "is_authenticated", False):
        return None
    if getattr(user, "is_superuser", False):
        return CustomUser.ROLE_SUPER_ADMIN
    role = getattr(user, "role", None) or CustomUser.ROLE_EMPLOYEE
    if role in SUPER_ADMIN_ROLES:
        return CustomUser.ROLE_SUPER_ADMIN
    return role


def is_super_admin(user) -> bool:
    return resolve_role(user) == CustomUser.ROLE_SUPER_ADMIN


def is_hr_or_above(user) -> bool:
    return resolve_role(user) in {CustomUser.ROLE_SUPER_ADMIN, CustomUser.ROLE_HR}


def is_employee(user) -> bool:
    return resolve_role(user) == CustomUser.ROLE_EMPLOYEE


def is_stakeholder(user) -> bool:
    return resolve_role(user) == CustomUser.ROLE_STAKEHOLDER


def can_manage_user(manager, target) -> bool:
    if not getattr(manager, "is_authenticated", False):
        return False
    if is_super_admin(manager):
        return True
    if not is_hr_or_above(manager):
        return False
    target_role = resolve_role(target)
    return target_role == CustomUser.ROLE_EMPLOYEE


class IsHROrAbove(BasePermission):
    def has_permission(self, request, view):
        return is_hr_or_above(request.user)


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_super_admin(request.user)
