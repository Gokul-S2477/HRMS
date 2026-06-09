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

        if is_employee(user) and resource_type == "profile-update-requests":
            if not employee:
                return Response(
                    {"detail": "Employee login is not linked to an employee record."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload["employee_id"] = employee.id
            payload["employee_name"] = f"{employee.first_name} {employee.last_name or ''}".strip()
            payload["status"] = "Pending"
            payload["requested_on"] = payload.get("requested_on") or timezone.now().date().isoformat()
            payload["requested_by"] = user.get_display_name() or user.email
            payload["requester_email"] = user.email
            payload["comments"] = ""

        if is_employee(user) and resource_type == "attendance-employee":
            if not employee:
                return Response(
                    {"detail": "Employee login is not linked to an employee record."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Check for double clock-in
            today_date = timezone.now().date().isoformat()
            existing = Resource.objects.filter(resource_type="attendance-employee").all()
            today_exists = False
            for res in existing:
                if str(res.data.get("employee_id") or "") == str(employee.id) and res.data.get("date") == today_date:
                    today_exists = True
                    break
            
            if today_exists:
                return Response(
                    {"detail": "You have already clocked in for today."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Query shift roster to get the assigned shift code
            shift_code = "General"
            roster_res = Resource.objects.filter(resource_type="shift-roster").all()
            for r in roster_res:
                r_data = r.data or {}
                if str(r_data.get("employee_id")) == str(employee.id):
                    assignments = r_data.get("assignments") or {}
                    if today_date in assignments:
                        shift_code = assignments[today_date]
                        break
            
            # Load ShiftDefinition
            from .workflow_models import ShiftDefinition
            shift_def = ShiftDefinition.objects.filter(code=shift_code).first()
            start_time_str = "09:00"
            grace_in = 15
            if shift_def:
                start_time_str = shift_def.start_time.strftime("%H:%M")
                grace_in = shift_def.grace_in_minutes
            
            check_in_str = timezone.now().strftime("%H:%M")
            payload["employee_id"] = employee.id
            payload["employee_name"] = f"{employee.first_name} {employee.last_name or ''}".strip()
            payload["department"] = employee.department.name if employee.department else ""
            payload["designation"] = employee.designation.title if employee.designation else ""
            payload["date"] = today_date
            payload["check_in"] = check_in_str
            payload["check_out"] = ""
            payload["shift"] = shift_code
            payload["work_mode"] = payload.get("work_mode") or "Office"
            payload["remarks"] = payload.get("remarks") or ""
            
            # Calculate punctuality based on grace period
            def parse_minutes(t_str):
                try:
                    parts = t_str.split(":")
                    return int(parts[0]) * 60 + int(parts[1])
                except Exception:
                    return 0
            
            in_min = parse_minutes(check_in_str)
            start_min = parse_minutes(start_time_str)
            
            if in_min > start_min + grace_in:
                payload["status"] = "Late"
                payload["punctuality"] = "Late"
            else:
                payload["status"] = "Present"
                payload["punctuality"] = "On time"
            
            client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if client_ip:
                client_ip = client_ip.split(',')[0].strip()
            payload["ip_address"] = client_ip
            
            # Geofence & IP discrepancy check
            from .models import Resource
            settings_res = Resource.objects.filter(resource_type="attendance-settings").first()
            settings_data = settings_res.data if settings_res else {}
            
            allowed_lat = settings_data.get("latitude") or 12.9716
            allowed_lon = settings_data.get("longitude") or 77.5946
            allowed_radius = settings_data.get("radius") or 5000  # meters
            allowed_ips = settings_data.get("ip_ranges") or ["127.0.0.1", "192.168.1.", "10.0.0."]
            
            emp_lat = payload.get("latitude")
            emp_lon = payload.get("longitude")
            
            discrepancies = []
            
            if payload.get("work_mode") == "Office":
                if emp_lat is not None and emp_lon is not None:
                    try:
                        lat_val = float(emp_lat)
                        lon_val = float(emp_lon)
                        
                        import math
                        R = 6371000.0  # Earth radius in meters
                        phi1 = math.radians(allowed_lat)
                        phi2 = math.radians(lat_val)
                        delta_phi = math.radians(lat_val - allowed_lat)
                        delta_lambda = math.radians(lon_val - allowed_lon)
                        
                        a = math.sin(delta_phi / 2.0) ** 2 + \
                            math.cos(phi1) * math.cos(phi2) * \
                            math.sin(delta_lambda / 2.0) ** 2
                        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
                        distance = R * c
                        
                        if distance > allowed_radius:
                            discrepancies.append(f"Geofence breach: employee is {round(distance, 1)}m away (max {allowed_radius}m)")
                    except Exception as e:
                        discrepancies.append(f"Invalid GPS data: {str(e)}")
                else:
                    discrepancies.append("GPS coordinates not provided for Office work mode")
                
                if client_ip:
                    ip_match = False
                    for allowed_ip in allowed_ips:
                        if client_ip.startswith(allowed_ip):
                            ip_match = True
                            break
                    if not ip_match:
                        discrepancies.append(f"Untrusted network IP: {client_ip}")
                else:
                    discrepancies.append("Unable to verify client network IP")
            
            if discrepancies:
                payload["discrepancy"] = True
                payload["discrepancy_reasons"] = discrepancies
            else:
                payload["discrepancy"] = False
                payload["discrepancy_reasons"] = []

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

        if instance.resource_type == "attendance-employee" and is_employee(request.user):
            old_data = dict(instance.data or {})
            merged_data["employee_id"] = old_data.get("employee_id")
            merged_data["employee_name"] = old_data.get("employee_name")
            merged_data["date"] = old_data.get("date")
            merged_data["check_in"] = old_data.get("check_in")
            
            action = payload.get("action")
            if action == "break_start":
                breaks = old_data.get("breaks") or []
                breaks.append({
                    "start": timezone.now().strftime("%H:%M"),
                    "end": ""
                })
                merged_data["breaks"] = breaks
                merged_data["on_break"] = True
            elif action == "break_end":
                breaks = old_data.get("breaks") or []
                if breaks and not breaks[-1].get("end"):
                    breaks[-1]["end"] = timezone.now().strftime("%H:%M")
                merged_data["breaks"] = breaks
                merged_data["on_break"] = False
            else:
                # Default is clock out
                merged_data["check_out"] = timezone.now().strftime("%H:%M")
                
                # Soft log IP address on checkout
                client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
                if client_ip:
                    client_ip = client_ip.split(',')[0].strip()
                merged_data["ip_address_out"] = client_ip
                
                # End any active breaks
                breaks = old_data.get("breaks") or []
                if breaks and not breaks[-1].get("end"):
                    breaks[-1]["end"] = merged_data["check_out"]
                merged_data["breaks"] = breaks
                merged_data["on_break"] = False

                # Calculate work hours in backend
                def parse_time(t_str):
                    try:
                        parts = t_str.split(":")
                        return int(parts[0]) + int(parts[1]) / 60.0
                    except Exception:
                        return 0.0

                in_val = parse_time(merged_data.get("check_in"))
                out_val = parse_time(merged_data.get("check_out"))
                diff = out_val - in_val
                
                # Deduct break hours
                break_hours = 0.0
                for b in breaks:
                    if b.get("start") and b.get("end"):
                        b_in = parse_time(b.get("start"))
                        b_out = parse_time(b.get("end"))
                        b_diff = b_out - b_in
                        if b_diff > 0:
                            break_hours += b_diff
                
                net_diff = diff - break_hours
                merged_data["work_hours"] = round(net_diff if net_diff > 0 else 0.0, 2)
                merged_data["break_hours"] = round(break_hours, 2)
                
                # Check early exit based on shift definition
                shift_code = old_data.get("shift") or "General"
                from .workflow_models import ShiftDefinition
                shift_def = ShiftDefinition.objects.filter(code=shift_code).first()
                end_time_str = "18:00"
                grace_out = 15
                if shift_def:
                    end_time_str = shift_def.end_time.strftime("%H:%M")
                    grace_out = shift_def.grace_out_minutes
                
                def parse_minutes(t_str):
                    try:
                        parts = t_str.split(":")
                        return int(parts[0]) * 60 + int(parts[1])
                    except Exception:
                        return 0

                out_min = parse_minutes(merged_data.get("check_out"))
                end_min = parse_minutes(end_time_str)
                
                current_punc = merged_data.get("punctuality") or "On time"
                if out_min < end_min - grace_out:
                    if current_punc == "Late":
                        merged_data["punctuality"] = "Late & Early exit"
                    else:
                        merged_data["punctuality"] = "Early exit"

        serializer = self.get_serializer(instance, data={"data": merged_data}, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        sync_generic_resource(updated, actor=request.user)
        return Response(self.get_serializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        cleanup_resource_artifacts(instance)
        return super().destroy(request, *args, **kwargs)

