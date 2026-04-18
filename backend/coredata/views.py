from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import is_employee, resolve_role

from .access import (
    role_can_access_resource,
    resource_uses_employee_scope,
    resource_uses_ticket_scope,
)
from .models import Resource
from .serializers import ResourceSerializer
from .workflow_services import cleanup_resource_artifacts, sync_generic_resource


def extract_payload(data):
    payload = data.get("data", data) if isinstance(data, dict) else data
    if hasattr(payload, "dict"):
        return payload.dict()
    return dict(payload)


class ResourceAccessMixin:
    permission_classes = [IsAuthenticated]

    def get_resource_type(self):
        return self.kwargs["resource_type"]

    def get_action_name(self):
        method = self.request.method.upper()
        if method in {"GET", "HEAD", "OPTIONS"}:
            return "read"
        if method == "POST":
            return "create"
        if method in {"PUT", "PATCH"}:
            return "update"
        if method == "DELETE":
            return "delete"
        return "read"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        resource_type = self.get_resource_type()
        action_name = self.get_action_name()
        if not role_can_access_resource(request.user, resource_type, action_name):
            self.permission_denied(
                request,
                message=f"Your role cannot {action_name} records in this module.",
            )

    def scope_queryset(self, qs):
        user = self.request.user
        resource_type = self.get_resource_type()

        if is_employee(user) and resource_uses_employee_scope(resource_type):
            employee_id = getattr(user, "employee_profile_id", None)
            if not employee_id:
                return qs.none()
            allowed_ids = [
                resource.id
                for resource in qs
                if str(resource.data.get("employee_id") or "") == str(employee_id)
            ]
            return qs.filter(id__in=allowed_ids)

        if is_employee(user) and resource_uses_ticket_scope(resource_type):
            employee_id = getattr(user, "employee_profile_id", None)
            allowed_ids = [
                resource.id
                for resource in qs
                if str(resource.data.get("employee_id") or "") == str(employee_id)
                or str(resource.data.get("requester_email") or "").lower()
                == str(user.email or "").lower()
            ]
            return qs.filter(id__in=allowed_ids)

        return qs


class ResourceListCreateView(ResourceAccessMixin, generics.ListCreateAPIView):
    serializer_class = ResourceSerializer

    def get_queryset(self):
        qs = Resource.objects.filter(resource_type=self.get_resource_type())
        return self.scope_queryset(qs)

    def create(self, request, *args, **kwargs):
        resource_type = self.get_resource_type()
        user = request.user
        payload = extract_payload(request.data)
        employee = getattr(user, "employee_profile", None)

        if is_employee(user) and resource_type == "leave-employee":
            if not employee:
                return Response(
                    {"detail": "Employee login is not linked to an employee record."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload["employee_id"] = employee.id
            payload["employee_name"] = f"{employee.first_name} {employee.last_name or ''}".strip()
            payload["status"] = "Pending"
            payload["requested_on"] = payload.get("requested_on") or timezone.now().date().isoformat()
            payload["requested_by"] = user.get_display_name()
            payload["requester_email"] = user.email
            payload["notice_timing"] = ""
            payload["approval_note"] = ""
            payload["approved_by"] = ""
            payload["approved_role"] = ""
            payload["approved_at"] = ""
            payload["reviewed_by"] = ""
            payload["reviewed_role"] = ""
            payload["reviewed_at"] = ""
            payload["approval_context"] = ""

        if is_employee(user) and resource_type == "tickets":
            if employee:
                payload["employee_id"] = employee.id
                payload["requested_by"] = f"{employee.first_name} {employee.last_name or ''}".strip()
            payload["requester_email"] = user.email
            payload["status"] = "Open"
            payload["comments"] = payload.get("comments") or []

        serializer = self.get_serializer(data={"data": payload})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(resource_type=resource_type)
        sync_generic_resource(instance, actor=user)
        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED, headers=headers)


class ResourceDetailView(ResourceAccessMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ResourceSerializer
    lookup_field = "id"

    def get_queryset(self):
        qs = Resource.objects.filter(resource_type=self.get_resource_type())
        return self.scope_queryset(qs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        payload = extract_payload(request.data)
        merged_data = dict(instance.data or {})
        merged_data.update(payload)

        if instance.resource_type == "leave-employee":
            reviewed_at = timezone.now().isoformat()
            reviewed_by = request.user.get_display_name()
            reviewed_role = resolve_role(request.user) or getattr(request.user, "role", "hr")

            merged_data["reviewed_by"] = reviewed_by
            merged_data["reviewed_role"] = reviewed_role
            merged_data["reviewed_at"] = reviewed_at

            notice_timing = merged_data.get("notice_timing") or ""
            if notice_timing == "Pre-informed" and not merged_data.get("approval_context"):
                merged_data["approval_context"] = "Applied before leave"
            elif notice_timing == "Post-informed" and not merged_data.get("approval_context"):
                merged_data["approval_context"] = "Reported after leave"

            if merged_data.get("status") == "Approved":
                merged_data["approved_by"] = reviewed_by
                merged_data["approved_role"] = reviewed_role
                merged_data["approved_at"] = reviewed_at
            elif merged_data.get("status") == "Rejected":
                merged_data["approved_by"] = ""
                merged_data["approved_role"] = ""
                merged_data["approved_at"] = ""

        serializer = self.get_serializer(instance, data={"data": merged_data}, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        sync_generic_resource(updated, actor=request.user)
        return Response(self.get_serializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        cleanup_resource_artifacts(instance)
        return super().destroy(request, *args, **kwargs)

