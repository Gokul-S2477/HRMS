from __future__ import annotations

from datetime import datetime, time as datetime_time, timedelta
import secrets
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from employees.models import Employee, SalaryRevision, EmployeeTransfer
from payroll.models import EmployeeLoan, LoanInstallment
from users.permissions import is_employee, is_hr_or_above, is_stakeholder, resolve_role

from .models import (
    ApplicantAccount,
    ApplicantLoginCode,
    ApplicantSession,
    AssetAssignment,
    AssetCategory,
    AuditLog,
    DocumentCategory,
    EmployeeDocument,
    CandidateTimelineEvent,
    JobApplication,
    ProductivityNote,
    ProductivityTodo,
    RecruitmentInterview,
    ReminderEvent,
    LeaveBalance,
    LeaveLedgerEntry,
    Notification,
    OnboardingRecord,
    OnboardingTask,
    OnboardingTemplate,
    OffboardingCase,
    OvertimeEntry,
    RecruitmentCandidate,
    RecruitmentJob,
    RecruitmentReferral,
    Resource,
    ShiftDefinition,
    TimesheetEntry,
    ExpenseClaim,
    DocumentEsign,
    DocumentSignature,
    AttendanceRecord,
    TrainingProgram,
    TrainingEnrollment,
    ReviewCycle,
    PerformanceReview,
    ReviewGoal,
    ReviewFeedback,
    PeerFeedback,
    Announcement,
    DisciplinaryAction,
)
from .workflow_serializers import (
    ApplicantAccountSerializer,
    AssetAssignmentSerializer,
    AssetCategorySerializer,
    AuditLogSerializer,
    DocumentCategorySerializer,
    EmployeeDocumentSerializer,
    CandidateTimelineEventSerializer,
    JobApplicationSerializer,
    ProductivityNoteSerializer,
    ProductivityTodoSerializer,
    RecruitmentInterviewSerializer,
    ReminderEventSerializer,
    LeaveBalanceSerializer,
    LeaveLedgerEntrySerializer,
    NotificationSerializer,
    OnboardingRecordSerializer,
    OnboardingTaskSerializer,
    OnboardingTemplateSerializer,
    OffboardingCaseSerializer,
    OvertimeEntrySerializer,
    RecruitmentCandidateSerializer,
    RecruitmentJobSerializer,
    RecruitmentReferralSerializer,
    ShiftDefinitionSerializer,
    TimesheetEntrySerializer,
    ExpenseClaimSerializer,
    DocumentEsignSerializer,
    DocumentSignatureSerializer,
    AttendanceRecordSerializer,
    SalaryRevisionSerializer,
    EmployeeTransferSerializer,
    EmployeeLoanSerializer,
    LoanInstallmentSerializer,
    TrainingProgramSerializer,
    TrainingEnrollmentSerializer,
    ReviewCycleSerializer,
    PerformanceReviewSerializer,
    ReviewGoalSerializer,
    ReviewFeedbackSerializer,
    PeerFeedbackSerializer,
    AnnouncementSerializer,
    DisciplinaryActionSerializer,
)
from .workflow_services import (
    create_audit_log,
    create_notification,
    ensure_onboarding_record,
    ensure_onboarding_tasks,
    issue_applicant_login_code,
    issue_applicant_session,
    notify_roles,
    record_candidate_timeline,
    sync_candidate_employee_link,
    sync_candidate_from_application,
    sync_generic_resource,
    sync_interview_employee_link,
    update_application_stage_from_candidate,
)

User = get_user_model()



def decimal_value(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def time_to_minutes(value):
    if not value:
        return None
    if isinstance(value, str):
        try:
            parts = value.split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return None
    return value.hour * 60 + value.minute


def calculate_timesheet_metrics(entry: TimesheetEntry, shift: ShiftDefinition | None):
    start_minutes = time_to_minutes(entry.start_time)
    end_minutes = time_to_minutes(entry.end_time)
    break_minutes = int(entry.break_minutes or 0)
    if start_minutes is None or end_minutes is None or end_minutes <= start_minutes:
        return Decimal("0"), 0, 0, Decimal("0")

    worked_minutes = max(end_minutes - start_minutes - break_minutes, 0)
    worked_hours = Decimal(str(round(worked_minutes / 60, 2)))

    late_minutes = 0
    early_exit_minutes = 0
    standard_hours = decimal_value(shift.standard_hours if shift else 8)

    if shift:
        scheduled_start = time_to_minutes(shift.start_time)
        scheduled_end = time_to_minutes(shift.end_time)
        grace_in = int(shift.grace_in_minutes or 0)
        grace_out = int(shift.grace_out_minutes or 0)
        late_minutes = max(start_minutes - scheduled_start - grace_in, 0)
        early_exit_minutes = max(scheduled_end - end_minutes - grace_out, 0)
        standard_hours = decimal_value(shift.standard_hours)

    payroll_impact_hours = min(worked_hours, standard_hours)
    return worked_hours, late_minutes, early_exit_minutes, payroll_impact_hours


def compute_overtime_amount(employee: Employee, hours: Decimal) -> Decimal:
    monthly_salary = decimal_value(employee.salary)
    if monthly_salary <= 0 or hours <= 0:
        return Decimal("0")
    hourly_rate = monthly_salary / Decimal("26") / Decimal("8")
    return (hourly_rate * Decimal("1.5") * hours).quantize(Decimal("0.01"))


class HROrEmployeeScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    employee_field = "employee_id"
    employee_can_write = False

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_employee(user):
            employee_id = getattr(user, "employee_profile_id", None)
            if not employee_id:
                return qs.none()
            return qs.filter(**{self.employee_field: employee_id})
        # HR/Admin: allow filtering by employee query param
        emp_filter = self.request.query_params.get("employee")
        if emp_filter:
            qs = qs.filter(employee_id=emp_filter)
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return
        if is_hr_or_above(request.user):
            return
        if self.employee_can_write:
            return
        self.permission_denied(request, message="You are not allowed to modify these records.")


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notification.objects.select_related("actor", "recipient").all()

    def get_queryset(self):
        qs = self.queryset.filter(recipient=self.request.user)
        unread = self.request.query_params.get("unread")
        if unread == "yes":
            qs = qs.filter(is_read=False)
        type_filter = self.request.query_params.get("type")
        if type_filter:
            qs = qs.filter(notification_type=type_filter)
        return qs

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"status": "ok"})


class LeaveBalanceViewSet(HROrEmployeeScopedViewSet):
    serializer_class = LeaveBalanceSerializer
    queryset = LeaveBalance.objects.select_related("employee", "employee__department", "employee__designation").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR or the employee can view leave balances.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change leave balances.")

    @action(detail=False, methods=["get"], url_path="my-summary")
    def my_summary(self, request):
        """
        Task 2.6 — Returns all leave types + current year balance + pending requests
        for the logged-in employee in one response.
        """
        employee_id = getattr(request.user, "employee_profile_id", None)
        if not employee_id:
            return Response({"detail": "User is not linked to an employee profile."}, status=status.HTTP_400_BAD_REQUEST)

        balances = LeaveBalance.objects.filter(employee_id=employee_id, year=timezone.now().year)

        # Fetch pending requests from Resource model for leave-employee
        from coredata.models import Resource
        pending_leaves = Resource.objects.filter(resource_type="leave-employee")

        pending_count = 0
        pending_list = []
        for r in pending_leaves:
            data = r.data or {}
            if str(data.get("employee_id")) == str(employee_id) and data.get("status") == "Pending":
                pending_count += 1
                pending_list.append({
                    "id": r.id,
                    "leave_type": data.get("leave_type"),
                    "from_date": data.get("from_date"),
                    "to_date": data.get("to_date"),
                    "days": data.get("days"),
                    "reason": data.get("reason"),
                })

        serializer = self.get_serializer(balances, many=True)
        return Response({
            "balances": serializer.data,
            "pending_requests_count": pending_count,
            "pending_requests": pending_list,
        })

    @action(detail=False, methods=["get"], url_path="my-history")
    def my_history(self, request):
        """
        Task 2.6 — Returns all approved/rejected leave requests for the logged-in employee.
        """
        employee_id = getattr(request.user, "employee_profile_id", None)
        if not employee_id:
            return Response({"detail": "User is not linked to an employee profile."}, status=status.HTTP_400_BAD_REQUEST)

        from coredata.models import Resource
        leaves = Resource.objects.filter(resource_type="leave-employee")
        history = []
        for r in leaves:
            data = r.data or {}
            if str(data.get("employee_id")) == str(employee_id) and data.get("status") in {"Approved", "Rejected"}:
                history.append({
                    "id": r.id,
                    "leave_type": data.get("leave_type"),
                    "from_date": data.get("from_date"),
                    "to_date": data.get("to_date"),
                    "days": data.get("days"),
                    "reason": data.get("reason"),
                    "status": data.get("status"),
                    "approved_by": data.get("approved_by"),
                    "approved_at": data.get("approved_at"),
                    "reviewed_by": data.get("reviewed_by"),
                    "reviewed_at": data.get("reviewed_at"),
                })
        return Response(history)



class LeaveLedgerViewSet(HROrEmployeeScopedViewSet):
    serializer_class = LeaveLedgerEntrySerializer
    queryset = LeaveLedgerEntry.objects.select_related("employee", "balance", "created_by").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR or the employee can view leave ledger entries.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change leave ledger entries.")


class AttendanceRecordViewSet(HROrEmployeeScopedViewSet):
    serializer_class = AttendanceRecordSerializer
    queryset = AttendanceRecord.objects.select_related("employee", "employee__department", "employee__designation").all()
    employee_can_write = True

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        status_filter = params.get("status")
        date_from = params.get("date_from")
        date_to = params.get("date_to")
        employee_id = params.get("employee_id")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if date_from:
            qs = qs.filter(work_date__gte=date_from)
        if date_to:
            qs = qs.filter(work_date__lte=date_to)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        return qs.order_by("-work_date", "employee__first_name")

    def perform_create(self, serializer):
        import math
        user = self.request.user
        data = self.request.data
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]

        if is_employee(user):
            employee = getattr(user, "employee_profile", None)
            if not employee:
                raise serializers.ValidationError("Employee login is not linked to an employee profile.")
        else:
            employee_id = data.get("employee_id") or data.get("employee")
            if not employee_id:
                raise serializers.ValidationError("employee_id is required.")
            employee = Employee.objects.get(pk=employee_id)

        local_now = timezone.localtime(timezone.now())
        work_date = data.get("date") or data.get("work_date") or local_now.date()
        if isinstance(work_date, str):
            work_date = datetime.strptime(work_date, "%Y-%m-%d").date()

        # Check for double clock-in
        if AttendanceRecord.objects.filter(employee=employee, work_date=work_date).exists():
            raise serializers.ValidationError("You have already clocked in for today.")

        # Get shift definitions and roster
        today_date_str = work_date.isoformat()
        shift_code = data.get("shift") or "General"

        roster_res = Resource.objects.filter(resource_type="shift-roster").all()
        for r in roster_res:
            r_data = r.data or {}
            if str(r_data.get("employee_id")) == str(employee.id):
                assignments = r_data.get("assignments") or {}
                if today_date_str in assignments:
                    shift_code = assignments[today_date_str]
                    break

        shift_def = ShiftDefinition.objects.filter(code=shift_code).first()
        start_time_str = "09:00"
        grace_in = 15
        if shift_def:
            start_time_str = shift_def.start_time.strftime("%H:%M")
            grace_in = shift_def.grace_in_minutes

        check_in_time = local_now.time()
        check_in_str = check_in_time.strftime("%H:%M")

        # Punctuality check
        def parse_minutes(t_str):
            try:
                parts = t_str.split(":")
                return int(parts[0]) * 60 + int(parts[1])
            except Exception:
                return 0

        in_min = parse_minutes(check_in_str)
        start_min = parse_minutes(start_time_str)

        status_val = data.get("status") or "Present"
        punctuality = "On time"
        if status_val == "Late" or in_min > start_min + grace_in:
            status_val = "Late"
            punctuality = "Late"

        client_ip = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', ''))
        if client_ip:
            client_ip = client_ip.split(',')[0].strip()

        # Geofencing
        work_mode = data.get("work_mode") or "Office"
        emp_lat = data.get("latitude") or data.get("check_in_lat")
        emp_lng = data.get("longitude") or data.get("check_in_lng")

        discrepancy = False
        discrepancy_reasons = []

        if work_mode == "Office":
            settings_res = Resource.objects.filter(resource_type="attendance-settings").first()
            settings_data = settings_res.data if settings_res else {}

            allowed_lat = settings_data.get("latitude") or 12.9716
            allowed_lon = settings_data.get("longitude") or 77.5946
            allowed_radius = settings_data.get("radius") or 5000  # meters
            allowed_ips = settings_data.get("ip_ranges") or ["127.0.0.1", "192.168.1.", "10.0.0."]

            if emp_lat is not None and emp_lng is not None:
                try:
                    lat_val = float(emp_lat)
                    lon_val = float(emp_lng)

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
                        discrepancy = True
                        discrepancy_reasons.append(f"Geofence breach: employee is {round(distance, 1)}m away (max {allowed_radius}m)")
                except Exception as e:
                    discrepancy = True
                    discrepancy_reasons.append(f"Invalid GPS data: {str(e)}")
            else:
                discrepancy = True
                discrepancy_reasons.append("GPS coordinates not provided for Office work mode")

            if client_ip:
                ip_match = False
                for allowed_ip in allowed_ips:
                    if client_ip.startswith(allowed_ip):
                        ip_match = True
                        break
                if not ip_match:
                    discrepancy = True
                    discrepancy_reasons.append(f"Untrusted network IP: {client_ip}")

        instance = serializer.save(
            employee=employee,
            work_date=work_date,
            check_in_time=check_in_time,
            check_in_lat=emp_lat,
            check_in_lng=emp_lng,
            check_in_ip=client_ip,
            status=status_val,
            work_mode=work_mode,
            shift=shift_code,
            punctuality=punctuality,
            discrepancy=discrepancy,
            discrepancy_reasons=discrepancy_reasons,
            notes=data.get("notes", ""),
        )

        create_audit_log(
            actor=user,
            scope="attendance",
            action="attendance_clock_in",
            target_type="attendance_record",
            target_id=str(instance.id),
            summary=f"Clocked in employee {employee.first_name} for date {work_date}",
            metadata={"punctuality": punctuality, "discrepancy": discrepancy},
        )

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()

        data = self.request.data
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]

        action = data.get("action")
        check_out = data.get("check_out")

        local_now = timezone.localtime(timezone.now())

        if action == "break_start":
            breaks = list(instance.breaks or [])
            breaks.append({
                "start": local_now.strftime("%H:%M"),
                "end": ""
            })
            instance.breaks = breaks
            instance.on_break = True
            instance.save()
            create_audit_log(
                actor=user,
                scope="attendance",
                action="break_start",
                target_type="attendance_record",
                target_id=str(instance.id),
                summary=f"Employee {instance.employee.first_name} went on break",
            )
        elif action == "break_end":
            breaks = list(instance.breaks or [])
            if breaks and not breaks[-1].get("end"):
                breaks[-1]["end"] = local_now.strftime("%H:%M")
            instance.breaks = breaks
            instance.on_break = False
            instance.save()
            create_audit_log(
                actor=user,
                scope="attendance",
                action="break_end",
                target_type="attendance_record",
                target_id=str(instance.id),
                summary=f"Employee {instance.employee.first_name} returned from break",
            )
        elif check_out == "force_server_time" or action == "clock_out" or check_out:
            check_out_time = local_now.time()
            instance.check_out_time = check_out_time

            client_ip = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', ''))
            if client_ip:
                client_ip = client_ip.split(',')[0].strip()
            instance.check_out_ip = client_ip

            emp_lat = data.get("latitude") or data.get("check_out_lat")
            emp_lng = data.get("longitude") or data.get("check_out_lng")
            if emp_lat:
                instance.check_out_lat = emp_lat
            if emp_lng:
                instance.check_out_lng = emp_lng

            breaks = list(instance.breaks or [])
            if breaks and not breaks[-1].get("end"):
                breaks[-1]["end"] = check_out_time.strftime("%H:%M")
            instance.breaks = breaks
            instance.on_break = False

            def parse_time_to_hours(t):
                if isinstance(t, str):
                    try:
                        parts = t.split(":")
                        return int(parts[0]) + int(parts[1]) / 60.0
                    except Exception:
                        return 0.0
                elif hasattr(t, "hour"):
                    return t.hour + t.minute / 60.0
                return 0.0

            in_val = parse_time_to_hours(instance.check_in_time)
            out_val = parse_time_to_hours(check_out_time)
            diff = out_val - in_val

            break_hours = 0.0
            for b in breaks:
                if b.get("start") and b.get("end"):
                    b_in = parse_time_to_hours(b.get("start"))
                    b_out = parse_time_to_hours(b.get("end"))
                    b_diff = b_out - b_in
                    if b_diff > 0:
                        break_hours += b_diff

            net_diff = diff - break_hours
            instance.total_hours = Decimal(str(round(net_diff if net_diff > 0 else 0.0, 2)))
            instance.break_hours = Decimal(str(round(break_hours, 2)))

            shift_code = instance.shift or "General"
            shift_def = ShiftDefinition.objects.filter(code=shift_code).first()
            end_time_str = "18:00"
            grace_out = 15
            if shift_def:
                end_time_str = shift_def.start_time.strftime("%H:%M")
                grace_out = shift_def.grace_out_minutes

            def parse_minutes(t):
                if isinstance(t, str):
                    try:
                        parts = t.split(":")
                        return int(parts[0]) * 60 + int(parts[1])
                    except Exception:
                        return 0
                elif hasattr(t, "hour"):
                    return t.hour * 60 + t.minute
                return 0

            out_min = parse_minutes(check_out_time)
            end_min = parse_minutes(end_time_str)

            current_punc = instance.punctuality or "On time"
            if out_min < end_min - grace_out:
                if current_punc == "Late":
                    instance.punctuality = "Late & Early exit"
                else:
                    instance.punctuality = "Early exit"

            instance.save()
            create_audit_log(
                actor=user,
                scope="attendance",
                action="attendance_clock_out",
                target_type="attendance_record",
                target_id=str(instance.id),
                summary=f"Clocked out employee {instance.employee.first_name} for date {instance.work_date}",
            )
        else:
            serializer.save()


class ShiftDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftDefinitionSerializer
    permission_classes = [IsAuthenticated]
    queryset = ShiftDefinition.objects.all().order_by("name")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR and employees can view shift rules.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage shift rules.")


class TimesheetEntryViewSet(HROrEmployeeScopedViewSet):
    serializer_class = TimesheetEntrySerializer
    queryset = TimesheetEntry.objects.select_related(
        "employee",
        "employee__department",
        "employee__designation",
        "shift",
        "submitted_by",
        "approved_by",
    ).all()
    employee_can_write = True

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (is_hr_or_above(request.user) or is_employee(request.user)):
            self.permission_denied(request, message="Only HR and employees can access timesheets.")

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by("-work_date", "-updated_at")

    def perform_create(self, serializer):
        employee = serializer.validated_data.get("employee")
        if is_employee(self.request.user):
            employee = getattr(self.request.user, "employee_profile", None)
            if not employee:
                raise serializers.ValidationError("Employee login is not linked to an employee profile.")
        shift = serializer.validated_data.get("shift")
        record = serializer.save(employee=employee, submitted_by=self.request.user)
        worked_hours, late_minutes, early_exit_minutes, payroll_impact_hours = calculate_timesheet_metrics(record, shift)
        record.hours_worked = worked_hours
        record.late_minutes = late_minutes
        record.early_exit_minutes = early_exit_minutes
        record.payroll_impact_hours = payroll_impact_hours
        if is_employee(self.request.user):
            record.status = TimesheetEntry.STATUS_SUBMITTED if record.status != TimesheetEntry.STATUS_DRAFT else TimesheetEntry.STATUS_DRAFT
        record.save()
        create_notification(
            recipient=self.request.user,
            title="Timesheet saved",
            body=f"Timesheet for {record.work_date} was recorded successfully.",
            actor=self.request.user,
            notification_type="timesheet",
            target_url="/timesheets",
            reference_type="timesheet",
            reference_id=str(record.id),
        )
        if is_employee(self.request.user):
            notify_roles(
                {User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
                title=f"Timesheet submitted by {employee.first_name}",
                body=f"{employee.first_name} logged {record.hours_worked}h on {record.work_date}.",
                actor=self.request.user,
                notification_type="timesheet_submitted",
                target_url="/timesheets",
                reference_type="timesheet",
                reference_id=str(record.id),
            )

    def perform_update(self, serializer):
        instance = serializer.save()
        shift = serializer.validated_data.get("shift", instance.shift)
        worked_hours, late_minutes, early_exit_minutes, payroll_impact_hours = calculate_timesheet_metrics(instance, shift)
        instance.hours_worked = worked_hours
        instance.late_minutes = late_minutes
        instance.early_exit_minutes = early_exit_minutes
        instance.payroll_impact_hours = payroll_impact_hours
        if is_employee(self.request.user) and instance.status != TimesheetEntry.STATUS_DRAFT:
            instance.status = TimesheetEntry.STATUS_SUBMITTED
        if is_hr_or_above(self.request.user) and instance.status == TimesheetEntry.STATUS_APPROVED:
            instance.approved_by = self.request.user
            instance.approved_at = timezone.now()
            if getattr(instance.employee, "user_account", None):
                create_notification(
                    instance.employee.user_account,
                    title="Timesheet approved",
                    body=f"Your timesheet for {instance.work_date} was approved.",
                    actor=self.request.user,
                    notification_type="timesheet_approved",
                    target_url="/timesheets",
                    reference_type="timesheet",
                    reference_id=str(instance.id),
                )
        instance.save()


class OvertimeEntryViewSet(HROrEmployeeScopedViewSet):
    serializer_class = OvertimeEntrySerializer
    queryset = OvertimeEntry.objects.select_related("employee", "employee__department", "employee__designation", "approved_by", "linked_timesheet").all()
    employee_can_write = True

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (is_hr_or_above(request.user) or is_employee(request.user)):
            self.permission_denied(request, message="Only HR and employees can access overtime entries.")

    def perform_create(self, serializer):
        employee = serializer.validated_data.get("employee")
        if is_employee(self.request.user):
            employee = getattr(self.request.user, "employee_profile", None)
            if not employee:
                raise serializers.ValidationError("Employee login is not linked to an employee profile.")
        instance = serializer.save(employee=employee)
        if is_employee(self.request.user):
            instance.status = OvertimeEntry.STATUS_REQUESTED
        instance.payroll_amount = compute_overtime_amount(instance.employee, decimal_value(instance.hours))
        instance.save(update_fields=["status", "payroll_amount", "updated_at"])
        notify_user = instance.employee.user_account if getattr(instance.employee, "user_account", None) else None
        if notify_user:
            create_notification(
                notify_user,
                title="Overtime request saved",
                body=f"Overtime request for {instance.work_date} is now {instance.status}.",
                actor=self.request.user,
                notification_type="overtime",
                target_url="/overtime",
                reference_type="overtime",
                reference_id=str(instance.id),
            )
        if is_employee(self.request.user):
            notify_roles(
                {User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
                title=f"Overtime request from {employee.first_name}",
                body=f"{employee.first_name} requested {instance.hours}h of overtime for {instance.work_date}.",
                actor=self.request.user,
                notification_type="overtime_requested",
                target_url="/overtime",
                reference_type="overtime",
                reference_id=str(instance.id),
            )

    def perform_update(self, serializer):
        instance = serializer.save()
        if is_employee(self.request.user):
            instance.status = OvertimeEntry.STATUS_REQUESTED
        instance.payroll_amount = compute_overtime_amount(instance.employee, decimal_value(instance.hours))
        if is_hr_or_above(self.request.user) and instance.status in {OvertimeEntry.STATUS_APPROVED, OvertimeEntry.STATUS_PAID}:
            instance.approved_by = self.request.user
            instance.approved_at = timezone.now()
            if getattr(instance.employee, "user_account", None):
                create_notification(
                    instance.employee.user_account,
                    title=f"Overtime {instance.status}",
                    body=f"Your overtime request for {instance.work_date} is now {instance.status}.",
                    actor=self.request.user,
                    notification_type="overtime_review",
                    target_url="/overtime",
                    reference_type="overtime",
                    reference_id=str(instance.id),
                )
        instance.save()


class AssetCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = AssetCategorySerializer
    permission_classes = [IsAuthenticated]
    queryset = AssetCategory.objects.all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage asset categories.")


class AssetAssignmentViewSet(HROrEmployeeScopedViewSet):
    serializer_class = AssetAssignmentSerializer
    queryset = AssetAssignment.objects.select_related("category", "assigned_to", "assigned_to__department", "assigned_to__designation", "issued_by", "updated_by").all()
    employee_field = "assigned_to_id"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR and employees can view asset assignments.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage assets.")

    def perform_create(self, serializer):
        serializer.save(issued_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]
    queryset = DocumentCategory.objects.all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR and employees can view document categories.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage document categories.")


class EmployeeDocumentViewSet(HROrEmployeeScopedViewSet):
    serializer_class = EmployeeDocumentSerializer
    queryset = EmployeeDocument.objects.select_related(
        "employee",
        "employee__department",
        "employee__designation",
        "category",
        "uploaded_by",
        "verified_by",
    ).all()
    employee_can_write = True

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (is_hr_or_above(request.user) or is_employee(request.user)):
            self.permission_denied(request, message="Only HR and employees can access employee documents.")

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        status_filter = params.get("status")
        category_id = params.get("category") or params.get("category_id")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs.order_by("employee__first_name", "title", "-updated_at")

    def perform_create(self, serializer):
        employee = serializer.validated_data.get("employee")
        if is_employee(self.request.user):
            employee = getattr(self.request.user, "employee_profile", None)
            if not employee:
                raise serializers.ValidationError("Employee login is not linked to an employee profile.")
        instance = serializer.save(employee=employee, uploaded_by=self.request.user)
        if is_employee(self.request.user):
            instance.status = EmployeeDocument.STATUS_PENDING
            instance.verified_by = None
            instance.verified_at = None
            instance.save(update_fields=["status", "verified_by", "verified_at", "updated_at"])
            notify_roles(
                {User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
                title=f"Document uploaded by {employee.first_name}",
                body=f"{employee.first_name} added {instance.title} for review.",
                actor=self.request.user,
                notification_type="document_uploaded",
                target_url="/employee-documents",
                reference_type="employee-document",
                reference_id=str(instance.id),
            )
        create_audit_log(
            actor=self.request.user,
            scope="documents",
            action="document_created",
            target_type="employee_document",
            target_id=str(instance.id),
            summary=f"Created employee document {instance.title}",
            metadata={"employee_id": instance.employee_id, "status": instance.status},
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        if is_employee(self.request.user):
            instance.status = EmployeeDocument.STATUS_PENDING
            instance.verified_by = None
            instance.verified_at = None
            instance.save(update_fields=["status", "verified_by", "verified_at", "updated_at"])
        elif instance.status == EmployeeDocument.STATUS_VERIFIED:
            instance.verified_by = self.request.user
            instance.verified_at = timezone.now()
            instance.save(update_fields=["verified_by", "verified_at", "updated_at"])
            if getattr(instance.employee, "user_account", None):
                create_notification(
                    instance.employee.user_account,
                    title="Document verified",
                    body=f"{instance.title} was verified by {self.request.user.get_display_name()}.",
                    actor=self.request.user,
                    notification_type="document_verified",
                    target_url="/employee-documents",
                    reference_type="employee-document",
                    reference_id=str(instance.id),
                )
        create_audit_log(
            actor=self.request.user,
            scope="documents",
            action="document_updated",
            target_type="employee_document",
            target_id=str(instance.id),
            summary=f"Updated employee document {instance.title}",
            metadata={"employee_id": instance.employee_id, "status": instance.status},
        )


class EmployeeDocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    from rest_framework.parsers import MultiPartParser, FormParser
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        import os
        from django.core.files.storage import FileSystemStorage
        from django.conf import settings as django_settings
        from rest_framework import serializers

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Size Validation (10MB max)
        if file_obj.size > 10 * 1024 * 1024:
            return Response({"detail": "File size exceeds 10MB limit."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. File Type Validation (PDF, JPG, PNG, DOCX only)
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in {".pdf", ".jpg", ".jpeg", ".png", ".docx"}:
            return Response(
                {"detail": "Invalid file type. Only PDF, JPG, PNG, and DOCX are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Get employee profile
        employee_id = request.data.get("employee") or request.data.get("employee_id")
        from employees.models import Employee

        if is_employee(request.user):
            employee = getattr(request.user, "employee_profile", None)
            if not employee:
                return Response(
                    {"detail": "User is not linked to an employee profile."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if not employee_id:
                return Response({"detail": "employee_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                employee = Employee.objects.get(pk=employee_id)
            except Employee.DoesNotExist:
                return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # 4. Save file to media/employee_documents/{employee_id}/
        storage_dir = os.path.join("employee_documents", str(employee.id))
        absolute_dir = os.path.join(django_settings.MEDIA_ROOT, storage_dir)
        os.makedirs(absolute_dir, exist_ok=True)

        fs = FileSystemStorage(location=absolute_dir)
        filename = fs.save(file_obj.name, file_obj)
        relative_url = f"{django_settings.MEDIA_URL}{storage_dir}/{filename}".replace("\\", "/")

        # 5. Create or Update EmployeeDocument
        category_id = request.data.get("category") or request.data.get("category_id")
        title = request.data.get("title") or file_obj.name
        document_number = request.data.get("document_number", "")
        issued_on = request.data.get("issued_on") or None
        expires_on = request.data.get("expires_on") or None
        notes = request.data.get("notes", "")

        document_id = request.data.get("id") or request.data.get("document_id")
        if document_id:
            try:
                doc = EmployeeDocument.objects.get(pk=document_id, employee=employee)
                doc.title = title
                doc.category_id = category_id
                doc.document_url = relative_url
                doc.file_name = filename
                doc.document_number = document_number
                doc.issued_on = issued_on
                doc.expires_on = expires_on
                doc.notes = notes
                if is_employee(request.user):
                    doc.status = EmployeeDocument.STATUS_PENDING
                doc.save()
            except EmployeeDocument.DoesNotExist:
                return Response({"detail": "Document not found to update."}, status=status.HTTP_404_NOT_FOUND)
        else:
            doc = EmployeeDocument.objects.create(
                employee=employee,
                category_id=category_id,
                title=title,
                document_url=relative_url,
                file_name=filename,
                document_number=document_number,
                issued_on=issued_on,
                expires_on=expires_on,
                notes=notes,
                uploaded_by=request.user,
                status=EmployeeDocument.STATUS_PENDING,
            )

        # Sync/notify if employee uploaded
        if is_employee(request.user):
            from coredata.workflow_services import notify_roles
            notify_roles(
                {User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
                title=f"Document uploaded by {employee.first_name}",
                body=f"{employee.first_name} added {doc.title} for review.",
                actor=request.user,
                notification_type="document_uploaded",
                target_url="/employee-documents",
                reference_type="employee-document",
                reference_id=str(doc.id),
            )

        create_audit_log(
            actor=request.user,
            scope="documents",
            action="document_created" if not document_id else "document_updated",
            target_type="employee_document",
            target_id=str(doc.id),
            summary=f"Uploaded employee document {doc.title}",
            metadata={"employee_id": doc.employee_id, "status": doc.status},
        )

        serializer = EmployeeDocumentSerializer(doc, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OnboardingTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = OnboardingTemplateSerializer
    permission_classes = [IsAuthenticated]
    queryset = OnboardingTemplate.objects.select_related("created_by").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_stakeholder(request.user)):
                self.permission_denied(request, message="Only HR and stakeholders can view onboarding templates.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage onboarding templates.")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="onboarding",
            action="template_created",
            target_type="onboarding_template",
            target_id=str(instance.id),
            summary=f"Created onboarding template {instance.name}",
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        create_audit_log(
            actor=self.request.user,
            scope="onboarding",
            action="template_updated",
            target_type="onboarding_template",
            target_id=str(instance.id),
            summary=f"Updated onboarding template {instance.name}",
        )


class OnboardingRecordViewSet(viewsets.ModelViewSet):
    serializer_class = OnboardingRecordSerializer
    permission_classes = [IsAuthenticated]
    queryset = OnboardingRecord.objects.select_related(
        "employee",
        "employee__department",
        "employee__designation",
        "candidate",
        "candidate__job",
        "template",
        "owner",
    ).prefetch_related("tasks").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_stakeholder(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR, stakeholders, and employees can view onboarding records.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage onboarding records.")

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if is_employee(user):
            employee_id = getattr(user, "employee_profile_id", None)
            if not employee_id:
                return qs.none()
            qs = qs.filter(employee_id=employee_id)
        params = self.request.query_params
        status_filter = params.get("status")
        owner = params.get("owner")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if owner:
            qs = qs.filter(Q(owner__username__icontains=owner) | Q(owner__email__icontains=owner))
        return qs.order_by("-updated_at", "title")

    def perform_create(self, serializer):
        instance = serializer.save(owner=serializer.validated_data.get("owner") or self.request.user)
        ensure_onboarding_tasks(instance, actor=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="onboarding",
            action="record_created",
            target_type="onboarding_record",
            target_id=str(instance.id),
            summary=f"Created onboarding record {instance.title}",
        )
        if instance.employee and getattr(instance.employee, "user_account", None):
            create_notification(
                instance.employee.user_account,
                title="Onboarding plan created",
                body=f"Your onboarding plan '{instance.title}' is now available.",
                actor=self.request.user,
                notification_type="onboarding",
                target_url="/onboarding/desk",
                reference_type="onboarding",
                reference_id=str(instance.id),
            )

    def perform_update(self, serializer):
        instance = serializer.save()
        ensure_onboarding_tasks(instance, actor=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="onboarding",
            action="record_updated",
            target_type="onboarding_record",
            target_id=str(instance.id),
            summary=f"Updated onboarding record {instance.title}",
            metadata={"status": instance.status, "progress": instance.progress_percentage},
        )

    @action(detail=True, methods=["post"])
    def sync_tasks(self, request, pk=None):
        record = self.get_object()
        ensure_onboarding_tasks(record, actor=request.user, reset_missing=True)
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        record = self.get_object()
        record.status = OnboardingRecord.STATUS_COMPLETED
        record.completed_on = timezone.now().date()
        record.progress_percentage = 100
        record.save(update_fields=["status", "completed_on", "progress_percentage", "updated_at"])
        create_audit_log(
            actor=request.user,
            scope="onboarding",
            action="record_completed",
            target_type="onboarding_record",
            target_id=str(record.id),
            summary=f"Completed onboarding record {record.title}",
        )
        return Response(self.get_serializer(record).data)


class OnboardingTaskViewSet(viewsets.ModelViewSet):
    serializer_class = OnboardingTaskSerializer
    permission_classes = [IsAuthenticated]
    queryset = OnboardingTask.objects.select_related(
        "record",
        "record__employee",
        "record__candidate",
        "assigned_to",
        "completed_by",
    ).all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not (is_hr_or_above(request.user) or is_stakeholder(request.user) or is_employee(request.user)):
                self.permission_denied(request, message="Only HR, stakeholders, and employees can view onboarding tasks.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage onboarding tasks.")

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if is_employee(user):
            employee_id = getattr(user, "employee_profile_id", None)
            if not employee_id:
                return qs.none()
            qs = qs.filter(record__employee_id=employee_id)
        record_id = self.request.query_params.get("record") or self.request.query_params.get("record_id")
        status_filter = self.request.query_params.get("status")
        if record_id:
            qs = qs.filter(record_id=record_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by("sort_order", "due_date", "title")

    def perform_create(self, serializer):
        instance = serializer.save()
        ensure_onboarding_tasks(instance.record, actor=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="onboarding",
            action="task_created",
            target_type="onboarding_task",
            target_id=str(instance.id),
            summary=f"Added onboarding task {instance.title}",
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == OnboardingTask.STATUS_COMPLETED and not instance.completed_at:
            instance.completed_by = self.request.user
            instance.completed_at = timezone.now()
            instance.save(update_fields=["completed_by", "completed_at", "updated_at"])
        ensure_onboarding_tasks(instance.record, actor=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="onboarding",
            action="task_updated",
            target_type="onboarding_task",
            target_id=str(instance.id),
            summary=f"Updated onboarding task {instance.title}",
            metadata={"status": instance.status},
        )

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.status = OnboardingTask.STATUS_COMPLETED
        task.completed_by = request.user
        task.completed_at = timezone.now()
        task.save(update_fields=["status", "completed_by", "completed_at", "updated_at"])
        ensure_onboarding_tasks(task.record, actor=request.user)
        return Response(self.get_serializer(task).data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    queryset = AuditLog.objects.select_related("actor_user").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (is_hr_or_above(request.user) or is_stakeholder(request.user)):
            self.permission_denied(request, message="Only HR, stakeholders, and super admins can view audit logs.")

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        scope = params.get("scope")
        action_name = params.get("action")
        search = params.get("search")
        if scope:
            qs = qs.filter(scope=scope)
        if action_name:
            qs = qs.filter(action=action_name)
        if search:
            qs = qs.filter(
                Q(summary__icontains=search)
                | Q(actor_email__icontains=search)
                | Q(target_type__icontains=search)
                | Q(target_id__icontains=search)
            )
        return qs.order_by("-created_at")


class OffboardingCaseViewSet(viewsets.ModelViewSet):
    serializer_class = OffboardingCaseSerializer
    permission_classes = [IsAuthenticated]
    queryset = OffboardingCase.objects.select_related("employee", "employee__department", "employee__designation", "approved_by", "settlement").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage offboarding cases.")

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == OffboardingCase.STATUS_COMPLETED and not instance.completed_at:
            instance.completed_at = timezone.now()
            instance.save(update_fields=["completed_at", "updated_at"])
        if instance.status in {OffboardingCase.STATUS_APPROVED, OffboardingCase.STATUS_COMPLETED}:
            from payroll.services import ensure_final_settlement

            ensure_final_settlement(instance, self.request.user)

    @action(detail=True, methods=["get"])
    def settlement(self, request, pk=None):
        case = self.get_object()
        from payroll.serializers import FinalSettlementSerializer
        from payroll.services import ensure_final_settlement

        settlement = getattr(case, "settlement", None) or ensure_final_settlement(case, request.user)
        return Response(FinalSettlementSerializer(settlement).data)


def can_view_recruitment(user):
    return is_hr_or_above(user) or is_stakeholder(user)


def can_use_productivity_apps(user):
    return is_hr_or_above(user) or is_stakeholder(user)


class RecruitmentJobViewSet(viewsets.ModelViewSet):
    serializer_class = RecruitmentJobSerializer
    permission_classes = [IsAuthenticated]
    queryset = RecruitmentJob.objects.annotate(applications_count=Count("applications")).all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not can_view_recruitment(request.user):
                self.permission_denied(request, message="Only HR, stakeholders, and super admins can view recruitment jobs.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage recruitment jobs.")

    def get_queryset(self):
        qs = self.queryset
        status_filter = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        public_filter = self.request.query_params.get("is_public")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if public_filter in {"true", "false"}:
            qs = qs.filter(is_public=public_filter == "true")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(department_name__icontains=search)
                | Q(location__icontains=search)
                | Q(city__icontains=search)
                | Q(state__icontains=search)
                | Q(hiring_manager__icontains=search)
            )
        return qs.order_by("-updated_at", "title")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="job_created",
            target_type="recruitment_job",
            target_id=str(instance.id),
            summary=f"Created recruitment job {instance.title}",
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="job_updated",
            target_type="recruitment_job",
            target_id=str(instance.id),
            summary=f"Updated recruitment job {instance.title}",
        )


class RecruitmentCandidateViewSet(viewsets.ModelViewSet):
    serializer_class = RecruitmentCandidateSerializer
    permission_classes = [IsAuthenticated]
    queryset = RecruitmentCandidate.objects.select_related("job", "created_by", "applicant", "employee").prefetch_related("timeline_events", "interviews").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not can_view_recruitment(request.user):
                self.permission_denied(request, message="Only HR, stakeholders, and super admins can view candidates.")
            return
        if self.action == "contact":
            if not can_view_recruitment(request.user):
                self.permission_denied(request, message="Only HR, stakeholders, and super admins can log candidate contact.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage candidates.")

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        stage_filter = params.get("stage")
        job_id = params.get("job") or params.get("job_id")
        source = params.get("source")
        owner = params.get("owner")
        employee_id = params.get("employee") or params.get("employee_id")
        search = params.get("search")
        if stage_filter:
            qs = qs.filter(stage=stage_filter)
        if job_id:
            qs = qs.filter(job_id=job_id)
        if source:
            qs = qs.filter(Q(source__icontains=source) | Q(application_source__icontains=source))
        if owner:
            qs = qs.filter(owner_name__icontains=owner)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(whatsapp__icontains=search)
                | Q(job__title__icontains=search)
                | Q(owner_name__icontains=search)
            )
        return qs.order_by("-updated_at", "first_name", "last_name")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, stage_updated_at=timezone.now())
        sync_candidate_employee_link(instance)
        record_candidate_timeline(
            instance,
            event_type=CandidateTimelineEvent.EVENT_APPLIED,
            title="Candidate added to pipeline",
            description="Internal recruitment desk created a new candidate record.",
            stage=instance.stage,
            actor=self.request.user,
        )
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="candidate_created",
            target_type="candidate",
            target_id=str(instance.id),
            summary=f"Added candidate {instance.first_name} {instance.last_name}".strip(),
        )

    def perform_update(self, serializer):
        previous = self.get_object()
        previous_stage = previous.stage
        instance = serializer.save()
        sync_candidate_employee_link(instance)
        if instance.stage != previous_stage:
            instance.stage_updated_at = timezone.now()
            instance.save(update_fields=["stage_updated_at", "updated_at"])
            record_candidate_timeline(
                instance,
                event_type=CandidateTimelineEvent.EVENT_STAGE,
                title=f"Stage moved to {instance.stage.replace('_', ' ').title()}",
                description=f"Pipeline updated by {self.request.user.get_display_name()}.",
                stage=instance.stage,
                actor=self.request.user,
                application=getattr(instance, "application_record", None),
            )
            update_application_stage_from_candidate(instance)
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="candidate_updated",
            target_type="candidate",
            target_id=str(instance.id),
            summary=f"Updated candidate {instance.first_name} {instance.last_name}".strip(),
            metadata={"stage": instance.stage},
        )

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        candidate = self.get_object()
        events = candidate.timeline_events.all()[:40]
        return Response(CandidateTimelineEventSerializer(events, many=True).data)

    @action(detail=True, methods=["get"])
    def interviews(self, request, pk=None):
        candidate = self.get_object()
        interviews = candidate.interviews.select_related("job", "employee", "taken_by", "created_by", "updated_by").all()[:20]
        return Response(RecruitmentInterviewSerializer(interviews, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def contact(self, request, pk=None):
        candidate = self.get_object()
        channel = str(request.data.get("channel") or candidate.preferred_contact_channel or "email").lower()
        note = request.data.get("note") or request.data.get("outcome") or "Candidate contacted."
        candidate.last_contacted_at = timezone.now()
        candidate.preferred_contact_channel = channel
        candidate.save(update_fields=["last_contacted_at", "preferred_contact_channel", "updated_at"])
        record_candidate_timeline(
            candidate,
            event_type=CandidateTimelineEvent.EVENT_CONTACT,
            title=f"Candidate contacted via {channel.title()}",
            description=str(note),
            stage=candidate.stage,
            channel=channel,
            actor=request.user,
            application=getattr(candidate, "application_record", None),
        )
        create_audit_log(
            actor=request.user,
            scope="recruitment",
            action="candidate_contacted",
            target_type="candidate",
            target_id=str(candidate.id),
            summary=f"Logged {channel} outreach for {candidate.first_name} {candidate.last_name}".strip(),
            metadata={"channel": channel},
        )
        return Response(self.get_serializer(candidate).data)

    @action(detail=True, methods=["post"])
    def progress(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can progress candidates.")
        candidate = self.get_object()
        next_stage = str(request.data.get("stage") or "").strip().lower()
        valid_stages = {choice[0] for choice in RecruitmentCandidate.STAGE_CHOICES}
        if next_stage not in valid_stages:
            return Response({"detail": "Select a valid stage."}, status=status.HTTP_400_BAD_REQUEST)
        note = request.data.get("note") or "Recruitment stage updated."
        candidate.stage = next_stage
        candidate.stage_updated_at = timezone.now()
        candidate.owner_name = request.data.get("owner_name") or candidate.owner_name
        candidate.save(update_fields=["stage", "stage_updated_at", "owner_name", "updated_at"])
        update_application_stage_from_candidate(candidate)
        record_candidate_timeline(
            candidate,
            event_type=CandidateTimelineEvent.EVENT_STAGE,
            title=f"Stage moved to {next_stage.replace('_', ' ').title()}",
            description=str(note),
            stage=next_stage,
            actor=request.user,
            application=getattr(candidate, "application_record", None),
        )
        create_audit_log(
            actor=request.user,
            scope="recruitment",
            action="candidate_progressed",
            target_type="candidate",
            target_id=str(candidate.id),
            summary=f"Progressed candidate {candidate.first_name} {candidate.last_name} to {next_stage}",
            metadata={"stage": next_stage},
        )
        return Response(self.get_serializer(candidate).data)


class RecruitmentInterviewViewSet(viewsets.ModelViewSet):
    serializer_class = RecruitmentInterviewSerializer
    permission_classes = [IsAuthenticated]
    queryset = RecruitmentInterview.objects.select_related(
        "candidate",
        "candidate__job",
        "candidate__employee",
        "application",
        "job",
        "employee",
        "taken_by",
        "created_by",
        "updated_by",
    ).all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not can_view_recruitment(request.user):
            self.permission_denied(request, message="Only HR, stakeholders, and super admins can access interviews.")

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        candidate_id = params.get("candidate") or params.get("candidate_id")
        job_id = params.get("job") or params.get("job_id")
        employee_id = params.get("employee") or params.get("employee_id")
        status_filter = params.get("status")
        decision = params.get("decision")
        interview_type = params.get("interview_type")
        taken_by = params.get("taken_by") or params.get("interviewer")
        search = params.get("search")
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        if job_id:
            qs = qs.filter(job_id=job_id)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if decision:
            qs = qs.filter(decision=decision)
        if interview_type:
            qs = qs.filter(interview_type=interview_type)
        if taken_by:
            qs = qs.filter(Q(taken_by__display_name__icontains=taken_by) | Q(taken_by__username__icontains=taken_by) | Q(taken_by_role__icontains=taken_by))
        if search:
            qs = qs.filter(
                Q(round_name__icontains=search)
                | Q(candidate__first_name__icontains=search)
                | Q(candidate__last_name__icontains=search)
                | Q(candidate__email__icontains=search)
                | Q(job__title__icontains=search)
                | Q(feedback_summary__icontains=search)
                | Q(strengths__icontains=search)
                | Q(concerns__icontains=search)
                | Q(negotiation_notes__icontains=search)
            )
        return qs.order_by("-scheduled_for", "-updated_at")

    def perform_create(self, serializer):
        candidate = serializer.validated_data["candidate"]
        sync_candidate_employee_link(candidate)
        interviewer = serializer.validated_data.get("taken_by") or self.request.user
        interview = serializer.save(
            application=serializer.validated_data.get("application") or getattr(candidate, "application_record", None),
            job=serializer.validated_data.get("job") or candidate.job,
            employee=serializer.validated_data.get("employee") or candidate.employee,
            taken_by=interviewer,
            taken_by_role=resolve_role(interviewer) or getattr(interviewer, "role", "hr"),
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        sync_interview_employee_link(interview)
        if interview.status == RecruitmentInterview.STATUS_COMPLETED and interview.completed_at is None:
            interview.completed_at = timezone.now()
            interview.save(update_fields=["completed_at", "updated_at"])
        if candidate.stage not in {RecruitmentCandidate.STAGE_JOINED, RecruitmentCandidate.STAGE_REJECTED, RecruitmentCandidate.STAGE_OFFER}:
            candidate.stage = RecruitmentCandidate.STAGE_INTERVIEW
            candidate.stage_updated_at = timezone.now()
            candidate.save(update_fields=["stage", "stage_updated_at", "updated_at"])
            update_application_stage_from_candidate(candidate)
        when_label = interview.completed_at or interview.scheduled_for
        record_candidate_timeline(
            candidate,
            event_type=CandidateTimelineEvent.EVENT_INTERVIEW,
            title=f"{(interview.round_name or interview.get_interview_type_display()).strip()} interview logged",
            description=interview.feedback_summary or interview.next_step or "Interview details saved.",
            stage=candidate.stage,
            actor=self.request.user,
            application=interview.application,
            metadata={
                "decision": interview.decision,
                "status": interview.status,
                "scheduled_for": when_label.isoformat() if when_label else "",
                "taken_by_role": interview.taken_by_role,
            },
        )
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="interview_created",
            target_type="recruitment_interview",
            target_id=str(interview.id),
            summary=f"Logged {interview.round_name or interview.interview_type} interview for {candidate.first_name} {candidate.last_name}".strip(),
            metadata={"candidate_id": candidate.id, "decision": interview.decision, "status": interview.status},
        )
        notify_roles(
            {"super_admin", "hr", "stakeholder"},
            title=f"Interview updated for {candidate.first_name} {candidate.last_name}".strip(),
            body=f"{interview.round_name or interview.get_interview_type_display()} was recorded with decision {interview.get_decision_display()}.",
            actor=self.request.user,
            notification_type="recruitment_interview",
            target_url=f"/recruitment/interviews?candidate={candidate.id}",
            reference_type="recruitment_interview",
            reference_id=str(interview.id),
        )

    def perform_update(self, serializer):
        previous = self.get_object()
        interview = serializer.save(updated_by=self.request.user)
        sync_candidate_employee_link(interview.candidate)
        sync_interview_employee_link(interview)
        if interview.status == RecruitmentInterview.STATUS_COMPLETED and interview.completed_at is None:
            interview.completed_at = timezone.now()
            interview.save(update_fields=["completed_at", "updated_at"])
        record_candidate_timeline(
            interview.candidate,
            event_type=CandidateTimelineEvent.EVENT_INTERVIEW,
            title=f"Interview record refreshed: {interview.round_name or interview.get_interview_type_display()}",
            description=interview.feedback_summary or interview.next_step or "Interview details refreshed.",
            stage=interview.candidate.stage,
            actor=self.request.user,
            application=interview.application,
            metadata={
                "previous_status": previous.status,
                "status": interview.status,
                "decision": interview.decision,
            },
        )
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="interview_updated",
            target_type="recruitment_interview",
            target_id=str(interview.id),
            summary=f"Updated interview for {interview.candidate.first_name} {interview.candidate.last_name}".strip(),
            metadata={"candidate_id": interview.candidate_id, "decision": interview.decision, "status": interview.status},
        )


class ProductivityOwnedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not can_use_productivity_apps(request.user):
            self.permission_denied(request, message="Only HR, stakeholders, and super admins can use the productivity apps.")

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)


class ProductivityNoteViewSet(ProductivityOwnedViewSet):
    serializer_class = ProductivityNoteSerializer
    queryset = ProductivityNote.objects.select_related("owner").all()

    def perform_create(self, serializer):
        note = serializer.save(owner=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="productivity",
            action="note_created",
            target_type="note",
            target_id=str(note.id),
            summary=f"Created note {note.title}",
        )

    def perform_update(self, serializer):
        note = serializer.save()
        create_audit_log(
            actor=self.request.user,
            scope="productivity",
            action="note_updated",
            target_type="note",
            target_id=str(note.id),
            summary=f"Updated note {note.title}",
        )

    @action(detail=True, methods=["post"])
    def pin(self, request, pk=None):
        note = self.get_object()
        note.is_pinned = not note.is_pinned
        note.save(update_fields=["is_pinned", "updated_at"])
        return Response(self.get_serializer(note).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        note = self.get_object()
        note.is_archived = not note.is_archived
        note.save(update_fields=["is_archived", "updated_at"])
        return Response(self.get_serializer(note).data)


class ProductivityTodoViewSet(ProductivityOwnedViewSet):
    serializer_class = ProductivityTodoSerializer
    queryset = ProductivityTodo.objects.select_related("owner").all()

    def perform_create(self, serializer):
        todo = serializer.save(owner=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="productivity",
            action="todo_created",
            target_type="todo",
            target_id=str(todo.id),
            summary=f"Created todo {todo.title}",
        )

    def perform_update(self, serializer):
        todo = serializer.save()
        if todo.status == ProductivityTodo.STATUS_COMPLETED and todo.completed_at is None:
            todo.completed_at = timezone.now()
            todo.save(update_fields=["completed_at", "updated_at"])
        elif todo.status != ProductivityTodo.STATUS_COMPLETED and todo.completed_at is not None:
            todo.completed_at = None
            todo.save(update_fields=["completed_at", "updated_at"])
        create_audit_log(
            actor=self.request.user,
            scope="productivity",
            action="todo_updated",
            target_type="todo",
            target_id=str(todo.id),
            summary=f"Updated todo {todo.title}",
        )

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        todo = self.get_object()
        todo.status = ProductivityTodo.STATUS_COMPLETED
        todo.completed_at = timezone.now()
        todo.save(update_fields=["status", "completed_at", "updated_at"])
        return Response(self.get_serializer(todo).data)


class ReminderEventViewSet(ProductivityOwnedViewSet):
    serializer_class = ReminderEventSerializer
    queryset = ReminderEvent.objects.select_related("owner").all()

    def perform_create(self, serializer):
        event = serializer.save(owner=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="productivity",
            action="event_created",
            target_type="event",
            target_id=str(event.id),
            summary=f"Created reminder event {event.title}",
        )

    def perform_update(self, serializer):
        event = serializer.save()
        create_audit_log(
            actor=self.request.user,
            scope="productivity",
            action="event_updated",
            target_type="event",
            target_id=str(event.id),
            summary=f"Updated reminder event {event.title}",
        )

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        now = timezone.now()
        window_end = now + timedelta(days=14)
        events = self.get_queryset().filter(is_completed=False, starts_at__gte=now, starts_at__lte=window_end, banner_dismissed_at__isnull=True).order_by("starts_at")[:5]
        return Response(self.get_serializer(events, many=True).data)

    @action(detail=True, methods=["post"])
    def dismiss_banner(self, request, pk=None):
        event = self.get_object()
        event.banner_dismissed_at = timezone.now()
        event.save(update_fields=["banner_dismissed_at", "updated_at"])
        return Response(self.get_serializer(event).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        event = self.get_object()
        event.is_completed = True
        event.save(update_fields=["is_completed", "updated_at"])
        return Response(self.get_serializer(event).data)


class RecruitmentReferralViewSet(viewsets.ModelViewSet):
    serializer_class = RecruitmentReferralSerializer
    permission_classes = [IsAuthenticated]
    queryset = RecruitmentReferral.objects.select_related("job", "created_by").all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if not can_view_recruitment(request.user):
                self.permission_denied(request, message="Only HR, stakeholders, and super admins can view referrals.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage referrals.")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        create_audit_log(
            actor=self.request.user,
            scope="recruitment",
            action="referral_created",
            target_type="referral",
            target_id=str(instance.id),
            summary=f"Added referral {instance.candidate_name}",
        )


def get_approval_settings_payload():
    record = Resource.objects.filter(resource_type="settings-approvals").order_by("-updated_at", "-created_at").first()
    return dict(record.data or {}) if record else {}


class ApprovalInboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = resolve_role(request.user)
        if not (is_hr_or_above(request.user) or is_stakeholder(request.user)):
            return Response({"detail": "Only HR, stakeholders, and super admins can view approvals."}, status=status.HTTP_403_FORBIDDEN)

        settings_payload = get_approval_settings_payload()
        items = []

        leave_qs = Resource.objects.filter(resource_type="leave-employee")
        leave_qs = leave_qs.filter(data__status="Pending")
        if is_stakeholder(request.user) and not settings_payload.get("leave_requires_stakeholder", True):
            leave_qs = leave_qs.none()
        for resource in leave_qs.order_by("-updated_at")[:60]:
            payload = dict(resource.data or {})
            items.append({
                "scope": "leave",
                "id": str(resource.id),
                "title": payload.get("leave_type") or "Leave request",
                "status": payload.get("status") or "Pending",
                "employee_name": payload.get("employee_name") or "Employee",
                "summary": f"{payload.get('employee_name') or 'Employee'} requested {payload.get('requested_days') or payload.get('working_days') or 0} day(s)",
                "submitted_at": resource.updated_at,
                "requested_by": payload.get("requested_by") or payload.get("employee_name") or "Employee",
                "module_path": "/leaves",
                "metadata": payload,
            })

        # Profile Update Requests
        profile_qs = Resource.objects.filter(resource_type="profile-update-requests", data__status="Pending")
        for resource in profile_qs.order_by("-updated_at")[:60]:
            payload = dict(resource.data or {})
            section_label = str(payload.get("section") or "profile").replace("_", " ").title()
            items.append({
                "scope": "profile_update",
                "id": str(resource.id),
                "title": f"Profile Update: {section_label}",
                "status": payload.get("status") or "Pending",
                "employee_name": payload.get("employee_name") or "Employee",
                "summary": f"{payload.get('employee_name') or 'Employee'} requested update to {section_label.lower()} details",
                "submitted_at": resource.updated_at,
                "requested_by": payload.get("requested_by") or payload.get("employee_name") or "Employee",
                "module_path": f"/employee-details/{payload.get('employee_id')}",
                "metadata": payload,
            })

        if is_hr_or_above(request.user):
            for entry in TimesheetEntry.objects.filter(status=TimesheetEntry.STATUS_SUBMITTED).select_related("employee").order_by("-updated_at")[:60]:
                items.append({
                    "scope": "timesheet",
                    "id": str(entry.id),
                    "title": f"Timesheet for {entry.work_date}",
                    "status": entry.status,
                    "employee_name": f"{entry.employee.first_name} {entry.employee.last_name or ''}".strip(),
                    "summary": f"{entry.hours_worked}h logged for {entry.project_name or 'operations'}",
                    "submitted_at": entry.updated_at,
                    "requested_by": entry.submitted_by.get_display_name() if entry.submitted_by else entry.employee.first_name,
                    "module_path": "/timesheets",
                    "metadata": {"hours_worked": str(entry.hours_worked), "work_date": str(entry.work_date)},
                })
            for entry in OvertimeEntry.objects.filter(status=OvertimeEntry.STATUS_REQUESTED).select_related("employee").order_by("-updated_at")[:60]:
                items.append({
                    "scope": "overtime",
                    "id": str(entry.id),
                    "title": f"Overtime for {entry.work_date}",
                    "status": entry.status,
                    "employee_name": f"{entry.employee.first_name} {entry.employee.last_name or ''}".strip(),
                    "summary": f"{entry.hours}h overtime requested",
                    "submitted_at": entry.updated_at,
                    "requested_by": entry.employee.first_name,
                    "module_path": "/overtime",
                    "metadata": {"hours": str(entry.hours), "payroll_amount": str(entry.payroll_amount)},
                })
            from payroll.models import EmployeePayroll, FinalSettlement

            for entry in EmployeePayroll.objects.filter(status__in=[EmployeePayroll.STATUS_DRAFT, EmployeePayroll.STATUS_IN_REVIEW]).select_related("employee")[:60]:
                items.append({
                    "scope": "payroll",
                    "id": str(entry.id),
                    "title": f"Payroll {entry.month}/{entry.year}",
                    "status": entry.status,
                    "employee_name": f"{entry.employee.first_name} {entry.employee.last_name or ''}".strip(),
                    "summary": f"Net salary {entry.net_salary}",
                    "submitted_at": entry.updated_at,
                    "requested_by": entry.approved_by.get_display_name() if entry.approved_by else "Payroll Desk",
                    "module_path": "/accounts/employee-payroll",
                    "metadata": {"month": entry.month, "year": entry.year, "net_salary": str(entry.net_salary)},
                })
            settlement_qs = FinalSettlement.objects.select_related("offboarding_case__employee").filter(status__in=[FinalSettlement.STATUS_DRAFT, FinalSettlement.STATUS_IN_REVIEW])
            for entry in settlement_qs[:60]:
                employee = entry.offboarding_case.employee
                items.append({
                    "scope": "final_settlement",
                    "id": str(entry.id),
                    "title": f"Final settlement {employee.emp_code}",
                    "status": entry.status,
                    "employee_name": f"{employee.first_name} {employee.last_name or ''}".strip(),
                    "summary": f"Final payable {entry.final_payable}",
                    "submitted_at": entry.updated_at,
                    "requested_by": "Offboarding Desk",
                    "module_path": "/accounts/final-settlements",
                    "metadata": {"final_payable": str(entry.final_payable)},
                })
            offboarding_qs = OffboardingCase.objects.filter(status__in=[OffboardingCase.STATUS_DRAFT, OffboardingCase.STATUS_IN_REVIEW]).select_related("employee")
            if is_stakeholder(request.user) and not settings_payload.get("offboarding_dual_check", True):
                offboarding_qs = offboarding_qs.none()
            for entry in offboarding_qs[:60]:
                items.append({
                    "scope": "offboarding",
                    "id": str(entry.id),
                    "title": f"{entry.source_type.title()} case",
                    "status": entry.status,
                    "employee_name": f"{entry.employee.first_name} {entry.employee.last_name or ''}".strip(),
                    "summary": f"Last working day {entry.last_working_day or '-'}",
                    "submitted_at": entry.updated_at,
                    "requested_by": entry.approved_by.get_display_name() if entry.approved_by else "HR Desk",
                    "module_path": "/resignation" if entry.source_type == OffboardingCase.SOURCE_RESIGNATION else "/termination",
                    "metadata": {"source_type": entry.source_type, "final_payroll_status": entry.final_payroll_status},
                })

        items.sort(key=lambda item: item.get("submitted_at") or timezone.now(), reverse=True)
        counts = {}
        for item in items:
            counts[item["scope"]] = counts.get(item["scope"], 0) + 1
        return Response({
            "counts": counts,
            "items": items,
        })

    def post(self, request):
        if not (is_hr_or_above(request.user) or is_stakeholder(request.user)):
            return Response({"detail": "Only HR, stakeholders, and super admins can review approvals."}, status=status.HTTP_403_FORBIDDEN)

        scope = str(request.data.get("scope") or "").strip().lower()
        item_id = str(request.data.get("id") or "").strip()
        decision = str(request.data.get("decision") or "").strip().lower()
        note = str(request.data.get("note") or "").strip()
        if scope not in {"leave", "timesheet", "overtime", "payroll", "final_settlement", "offboarding", "profile_update"}:
            return Response({"detail": "Invalid approval scope."}, status=status.HTTP_400_BAD_REQUEST)
        if decision not in {"approve", "reject", "return"}:
            return Response({"detail": "Select approve, reject, or return."}, status=status.HTTP_400_BAD_REQUEST)

        actor_name = request.user.get_display_name()
        actor_role = resolve_role(request.user) or getattr(request.user, "role", "hr")

        if scope == "profile_update":
            resource = Resource.objects.filter(resource_type="profile-update-requests", id=item_id).first()
            if not resource:
                return Response({"detail": "Profile update request not found."}, status=status.HTTP_404_NOT_FOUND)
            payload = dict(resource.data or {})
            new_status = "Approved" if decision == "approve" else "Rejected" if decision == "reject" else "Pending"
            payload["status"] = new_status
            payload["comments"] = note
            payload["reviewed_by"] = actor_name
            payload["reviewed_role"] = actor_role
            payload["reviewed_at"] = timezone.now().isoformat()
            if decision == "approve":
                payload["approved_by"] = actor_name
                payload["approved_role"] = actor_role
                payload["approved_at"] = timezone.now().isoformat()
                
                # Apply proposed changes to the Employee model record
                emp_id = payload.get("employee_id")
                proposed_changes = payload.get("proposed_changes") or {}
                if emp_id and proposed_changes:
                    from employees.models import Employee
                    try:
                        employee_instance = Employee.objects.get(pk=emp_id)
                        for field, value in proposed_changes.items():
                            if hasattr(employee_instance, field):
                                if field in {"personal_info", "bank_info", "family_info"}:
                                    current_dict = getattr(employee_instance, field) or {}
                                    if isinstance(current_dict, dict) and isinstance(value, dict):
                                        merged_dict = {**current_dict, **value}
                                        setattr(employee_instance, field, merged_dict)
                                    else:
                                        setattr(employee_instance, field, value)
                                elif field in {"education", "experience", "projects", "assets"}:
                                    setattr(employee_instance, field, value)
                                else:
                                    setattr(employee_instance, field, value)
                        employee_instance.save()
                    except Employee.DoesNotExist:
                        pass
            resource.data = payload
            resource.save(update_fields=["data", "updated_at"])
            sync_generic_resource(resource, actor=request.user)
        elif scope == "leave":
            resource = Resource.objects.filter(resource_type="leave-employee", id=item_id).first()
            if not resource:
                return Response({"detail": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)
            payload = dict(resource.data or {})
            payload["status"] = "Approved" if decision == "approve" else "Rejected" if decision == "reject" else "Pending"
            payload["approval_note"] = note
            payload["reviewed_by"] = actor_name
            payload["reviewed_role"] = actor_role
            payload["reviewed_at"] = timezone.now().isoformat()
            if decision == "approve":
                payload["approved_by"] = actor_name
                payload["approved_role"] = actor_role
                payload["approved_at"] = timezone.now().isoformat()
            resource.data = payload
            resource.save(update_fields=["data", "updated_at"])
            sync_generic_resource(resource, actor=request.user)
        elif scope == "timesheet":
            entry = TimesheetEntry.objects.filter(pk=item_id).first()
            if not entry:
                return Response({"detail": "Timesheet not found."}, status=status.HTTP_404_NOT_FOUND)
            entry.status = TimesheetEntry.STATUS_APPROVED if decision == "approve" else TimesheetEntry.STATUS_REJECTED if decision == "reject" else TimesheetEntry.STATUS_DRAFT
            entry.notes = f"{entry.notes}\n{note}".strip()
            if decision == "approve":
                entry.approved_by = request.user
                entry.approved_at = timezone.now()
            entry.save()
        elif scope == "overtime":
            entry = OvertimeEntry.objects.filter(pk=item_id).first()
            if not entry:
                return Response({"detail": "Overtime entry not found."}, status=status.HTTP_404_NOT_FOUND)
            entry.status = OvertimeEntry.STATUS_APPROVED if decision == "approve" else OvertimeEntry.STATUS_REJECTED if decision == "reject" else OvertimeEntry.STATUS_REQUESTED
            entry.notes = f"{entry.notes}\n{note}".strip()
            if decision == "approve":
                entry.approved_by = request.user
                entry.approved_at = timezone.now()
            entry.save()
        elif scope == "payroll":
            if not is_hr_or_above(request.user):
                return Response({"detail": "Only HR can approve payroll."}, status=status.HTTP_403_FORBIDDEN)
            from payroll.models import EmployeePayroll
            entry = EmployeePayroll.objects.filter(pk=item_id).first()
            if not entry:
                return Response({"detail": "Payroll record not found."}, status=status.HTTP_404_NOT_FOUND)
            if decision == "approve":
                entry.status = EmployeePayroll.STATUS_APPROVED
                entry.approved_by = request.user
                entry.approved_at = timezone.now()
            else:
                entry.status = EmployeePayroll.STATUS_DRAFT
                entry.notes = f"{entry.notes or ''}\n{note}".strip()
            entry.save()
        elif scope == "final_settlement":
            if not is_hr_or_above(request.user):
                return Response({"detail": "Only HR can approve settlements."}, status=status.HTTP_403_FORBIDDEN)
            from payroll.models import FinalSettlement
            entry = FinalSettlement.objects.filter(pk=item_id).first()
            if not entry:
                return Response({"detail": "Settlement not found."}, status=status.HTTP_404_NOT_FOUND)
            entry.status = FinalSettlement.STATUS_APPROVED if decision == "approve" else FinalSettlement.STATUS_IN_REVIEW
            entry.approved_by = request.user if decision == "approve" else entry.approved_by
            entry.approved_at = timezone.now() if decision == "approve" else entry.approved_at
            if note:
                entry.notes = f"{entry.notes or ''}\n{note}".strip()
            entry.save()
        elif scope == "offboarding":
            entry = OffboardingCase.objects.filter(pk=item_id).first()
            if not entry:
                return Response({"detail": "Offboarding case not found."}, status=status.HTTP_404_NOT_FOUND)
            entry.status = OffboardingCase.STATUS_APPROVED if decision == "approve" else OffboardingCase.STATUS_IN_REVIEW
            if decision == "approve":
                entry.approved_by = request.user
                entry.approved_at = timezone.now()
            if note:
                entry.notes = f"{entry.notes}\n{note}".strip()
            entry.save()

        create_audit_log(
            actor=request.user,
            scope="approvals",
            action=f"{scope}_{decision}",
            target_type=scope,
            target_id=item_id,
            summary=f"{decision.title()}d {scope} item {item_id}",
            metadata={"note": note},
        )
        return Response({"status": "ok"})


class ExpenseClaimViewSet(HROrEmployeeScopedViewSet):
    serializer_class = ExpenseClaimSerializer
    queryset = ExpenseClaim.objects.select_related(
        "employee",
        "processed_in_payroll",
    ).all()
    employee_can_write = True
    employee_field = "employee_id"

    def perform_create(self, serializer):
        employee = serializer.validated_data.get("employee")
        if is_employee(self.request.user):
            employee = getattr(self.request.user, "employee_profile", None)
            if not employee:
                raise serializers.ValidationError("Employee login is not linked to an employee profile.")
        
        record = serializer.save(employee=employee)
        
        # If created by employee, force status to Pending or Draft
        if is_employee(self.request.user):
            if record.status not in {ExpenseClaim.STATUS_DRAFT, ExpenseClaim.STATUS_PENDING}:
                record.status = ExpenseClaim.STATUS_PENDING
                record.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        # Employees cannot approve/reject or modify reviewer note
        if is_employee(self.request.user):
            if instance.status == ExpenseClaim.STATUS_APPROVED:
                raise serializers.ValidationError("Cannot modify an already approved expense claim.")
            
            serializer.validated_data.pop("status", None)
            serializer.validated_data.pop("reviewer_note", None)
        
        record = serializer.save()
        
        # If HR approved, log audit and notify
        if is_hr_or_above(self.request.user) and record.status in {ExpenseClaim.STATUS_APPROVED, ExpenseClaim.STATUS_REJECTED}:
            create_audit_log(
                actor=self.request.user,
                scope="expenses",
                action=f"expense_{record.status.lower()}",
                target_type="expense",
                target_id=str(record.id),
                summary=f"Expense claim '{record.title}' was {record.status.lower()}ed.",
                metadata={"amount": str(record.amount), "reviewer_note": record.reviewer_note},
            )
            recipient_user = getattr(record.employee, "user_account", None)
            if recipient_user:
                create_notification(
                    recipient=recipient_user,
                    title=f"Expense Claim {record.status}",
                    body=f"Your expense claim '{record.title}' for {record.amount} has been {record.status.lower()}.",
                    actor=self.request.user,
                    notification_type="expense",
                    target_url="/expenses",
                    reference_type="expense",
                    reference_id=str(record.id),
                )


class ReportsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if is_employee(request.user):
            return Response({"detail": "Employees do not have access to reporting overview."}, status=status.HTTP_403_FORBIDDEN)

        leave_pending = LeaveLedgerEntry.objects.filter(entry_type=LeaveLedgerEntry.ENTRY_PENDING_HOLD).count()
        leave_used = LeaveLedgerEntry.objects.filter(entry_type=LeaveLedgerEntry.ENTRY_APPROVED_DEBIT).count()
        leave_balances = LeaveBalance.objects.count()
        timesheet_open = TimesheetEntry.objects.filter(status__in=[TimesheetEntry.STATUS_DRAFT, TimesheetEntry.STATUS_SUBMITTED]).count()
        overtime_open = OvertimeEntry.objects.filter(status=OvertimeEntry.STATUS_REQUESTED).count()
        asset_assigned = AssetAssignment.objects.filter(status=AssetAssignment.STATUS_ASSIGNED).count()
        asset_returns = AssetAssignment.objects.filter(status=AssetAssignment.STATUS_RETURN_REQUESTED).count()
        offboarding_open = OffboardingCase.objects.exclude(status=OffboardingCase.STATUS_COMPLETED).count()
        recruitment_open = RecruitmentJob.objects.filter(status=RecruitmentJob.STATUS_OPEN).count()
        candidate_pipeline = RecruitmentCandidate.objects.exclude(stage=RecruitmentCandidate.STAGE_REJECTED).count()
        unread_notifications = Notification.objects.filter(recipient=request.user, is_read=False).count()
        pending_documents = EmployeeDocument.objects.filter(status=EmployeeDocument.STATUS_PENDING).count()
        expiring_documents = EmployeeDocument.objects.filter(expires_on__isnull=False, expires_on__lte=timezone.now().date() + timedelta(days=30)).count()
        onboarding_active = OnboardingRecord.objects.exclude(status=OnboardingRecord.STATUS_COMPLETED).count()
        onboarding_tasks_open = OnboardingTask.objects.exclude(status=OnboardingTask.STATUS_COMPLETED).count()
        approval_counts = ApprovalInboxView().get(request).data.get("counts", {})

        sections = [
            {
                "title": "People Operations",
                "items": [
                    {"label": "Leave Balances", "value": leave_balances, "meta": f"{leave_pending} pending ledger hold(s)"},
                    {"label": "Timesheets", "value": timesheet_open, "meta": f"{overtime_open} overtime request(s)"},
                    {"label": "Offboarding", "value": offboarding_open, "meta": "Active cases in motion"},
                ],
            },
            {
                "title": "Documents & Onboarding",
                "items": [
                    {"label": "Pending Document Reviews", "value": pending_documents, "meta": f"{expiring_documents} expiring soon"},
                    {"label": "Onboarding Records", "value": onboarding_active, "meta": f"{onboarding_tasks_open} task(s) still open"},
                ],
            },
            {
                "title": "Talent & Approvals",
                "items": [
                    {"label": "Open Roles", "value": recruitment_open, "meta": f"{candidate_pipeline} candidate(s) in flow"},
                    {"label": "Leave Queue", "value": approval_counts.get("leave", 0), "meta": "Approval inbox"},
                    {"label": "Payroll Queue", "value": approval_counts.get("payroll", 0), "meta": "Needs payroll sign-off"},
                ],
            },
        ]

        return Response(
            {
                "cards": [
                    {"label": "Pending Leave Reviews", "value": leave_pending, "meta": "Awaiting decision"},
                    {"label": "Approved Leave Entries", "value": leave_used, "meta": "Recorded in ledger"},
                    {"label": "Open Timesheets", "value": timesheet_open, "meta": "Draft or submitted"},
                    {"label": "Overtime Queue", "value": overtime_open, "meta": "Needs payroll approval"},
                    {"label": "Assets In Use", "value": asset_assigned, "meta": f"{asset_returns} return request(s)"},
                    {"label": "Offboarding Cases", "value": offboarding_open, "meta": "Still active"},
                    {"label": "Pending Documents", "value": pending_documents, "meta": f"{expiring_documents} expiring in 30 days"},
                    {"label": "Unread Notifications", "value": unread_notifications, "meta": "Your personal inbox"},
                ],
                "sections": sections,
            }
        )


class DocumentEsignViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentEsignSerializer
    queryset = DocumentEsign.objects.all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR can configure e-sign templates.")

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_employee(user):
            employee = getattr(user, "employee_profile", None)
            if not employee:
                return qs.none()
            q_all = Q(distribution_type="all")
            q_dept = Q(distribution_type="department", target_department=employee.department)
            q_role = Q(distribution_type="role", target_role__iexact=employee.role)
            return qs.filter(q_all | q_dept | q_role)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(uploaded_by=self.request.user)
        # Automatically create DocumentSignature placeholders
        from employees.models import Employee
        target_employees = Employee.objects.filter(is_active=True)
        if instance.distribution_type == "department" and instance.target_department:
            target_employees = target_employees.filter(department=instance.target_department)
        elif instance.distribution_type == "role" and instance.target_role:
            target_employees = target_employees.filter(role__iexact=instance.target_role)
        
        signatures = []
        for emp in target_employees:
            if not DocumentSignature.objects.filter(document=instance, employee=emp).exists():
                signatures.append(DocumentSignature(
                    document=instance,
                    employee=emp,
                    status="pending"
                ))
        if signatures:
            DocumentSignature.objects.bulk_create(signatures)


class DocumentSignatureViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSignatureSerializer
    queryset = DocumentSignature.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_employee(user):
            employee = getattr(user, "employee_profile", None)
            if not employee:
                return qs.none()
            return qs.filter(employee=employee)
        return qs

    def perform_update(self, serializer):
        instance = serializer.instance
        if is_employee(self.request.user):
            employee = getattr(self.request.user, "employee_profile", None)
            if not employee or instance.employee != employee:
                raise serializers.ValidationError("You can only sign your own documents.")
        
        if serializer.validated_data.get("status") == "signed":
            ip = self.request.META.get("HTTP_X_FORWARDED_FOR", self.request.META.get("REMOTE_ADDR", ""))
            if ip:
                ip = ip.split(",")[0].strip()
            user_agent = self.request.META.get("HTTP_USER_AGENT", "")
            
            serializer.save(
                status="signed",
                signed_at=timezone.now(),
                ip_address=ip,
                user_agent=user_agent
            )
        else:
            serializer.save()


class AdminDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_employee(user):
            return Response({"detail": "Employees do not have access to admin dashboard stats."}, status=status.HTTP_403_FORBIDDEN)

        from employees.models import Department, Designation

        # 1. Base counts
        total_employees = Employee.objects.count()
        active_employees = Employee.objects.filter(is_active=True).count()
        total_projects = Resource.objects.filter(resource_type="projects").count()
        total_clients = Resource.objects.filter(resource_type="crm-companies").count()
        total_tasks = Resource.objects.filter(resource_type="productivity-todos").count()
        job_applicants = RecruitmentCandidate.objects.count()
        
        # Calculate new hires (last 30 days)
        new_hires = Employee.objects.filter(joining_date__gte=timezone.now().date() - timedelta(days=30)).count()

        # 2. Earnings & Profit calculations from generic resource payloads
        payments_qs = Resource.objects.filter(resource_type="payments")
        earnings = 0.0
        for p in payments_qs:
            try:
                amt = float(p.data.get("amount") or 0.0)
                earnings += amt
            except (ValueError, TypeError):
                pass

        expenses_qs = Resource.objects.filter(resource_type="expenses")
        expenses = 0.0
        for ex in expenses_qs:
            try:
                amt = float(ex.data.get("amount") or 0.0)
                expenses += amt
            except (ValueError, TypeError):
                pass

        # Calculate this week's profit (assume a simple sum of payments of this week)
        week_start = timezone.now().date() - timedelta(days=7)
        payments_this_week = Resource.objects.filter(resource_type="payments", created_at__date__gte=week_start)
        profit_this_week = 0.0
        for p in payments_this_week:
            try:
                amt = float(p.data.get("amount") or 0.0)
                profit_this_week += amt
            except (ValueError, TypeError):
                pass

        # 3. Department Headcount List
        departments = Department.objects.annotate(count=Count("employees")).order_by("-count")
        dept_labels = []
        dept_counts = []
        for d in departments[:6]:
            dept_labels.append(d.name)
            dept_counts.append(d.count)

        # Fallback values if departments is empty
        if not dept_labels:
            dept_labels = ['UI/UX', 'Development', 'Management', 'HR', 'Testing', 'Marketing']
            dept_counts = [80, 110, 80, 20, 60, 100]

        # 4. Employee Status breakdown
        fulltime_count = Employee.objects.filter(employment_type="Full-Time").count()
        contract_count = Employee.objects.filter(employment_type="Contract").count()
        parttime_count = Employee.objects.filter(employment_type="Part-Time").count()
        intern_count = Employee.objects.filter(employment_type="Intern").count()

        # 5. Attendance Overview (Today)
        today_date = timezone.now().date().isoformat()
        attendance_qs = Resource.objects.filter(resource_type="attendance-employee")
        present_count = 0
        late_count = 0
        permission_count = 0
        for att in attendance_qs:
            att_data = att.data or {}
            if att_data.get("date") == today_date:
                status_val = att_data.get("status")
                if status_val == "Present":
                    present_count += 1
                elif status_val == "Late":
                    late_count += 1
                elif status_val == "Permission":
                    permission_count += 1

        # Absent calculation
        absent_count = max(0, active_employees - (present_count + late_count + permission_count))

        # Fallback for attendance chart if empty
        if present_count + late_count + permission_count + absent_count == 0:
            present_count = 20
            late_count = 5
            permission_count = 3
            absent_count = 2

        # 6. Sales vs Expenses chart data by month
        income_series = [0.0] * 12
        expense_series = [0.0] * 12
        current_year = timezone.now().year

        for p in payments_qs:
            created_at = p.created_at
            if created_at.year == current_year:
                m = created_at.month - 1
                try:
                    income_series[m] += float(p.data.get("amount") or 0.0)
                except (ValueError, TypeError):
                    pass

        for ex in expenses_qs:
            created_at = ex.created_at
            if created_at.year == current_year:
                m = created_at.month - 1
                try:
                    expense_series[m] += float(ex.data.get("amount") or 0.0)
                except (ValueError, TypeError):
                    pass

        # If chart series is entirely zero, use mock history trend for display
        if sum(income_series) == 0.0:
            income_series = [40.0, 30.0, 45.0, 80.0, 85.0, 90.0, 80.0, 80.0, 80.0, 85.0, 20.0, 80.0]
        if sum(expense_series) == 0.0:
            expense_series = [60.0, 70.0, 55.0, 20.0, 15.0, 10.0, 20.0, 20.0, 20.0, 15.0, 80.0, 20.0]

        # 7. Projects status breakdown
        projects_qs = Resource.objects.filter(resource_type="projects")
        proj_ongoing = 0
        proj_onhold = 0
        proj_completed = 0
        proj_overdue = 0
        for pr in projects_qs:
            status_val = pr.data.get("status") or "Ongoing"
            if status_val == "Ongoing":
                proj_ongoing += 1
            elif status_val in ["On-Hold", "Onhold"]:
                proj_onhold += 1
            elif status_val == "Completed":
                proj_completed += 1
            elif status_val == "Overdue":
                proj_overdue += 1

        # Fallback values for projects status
        if proj_ongoing + proj_onhold + proj_completed + proj_overdue == 0:
            proj_ongoing = 20
            proj_onhold = 40
            proj_completed = 20
            proj_overdue = 10

        # 8. Pending Approvals & Leave Requests counts
        leave_pending = LeaveLedgerEntry.objects.filter(entry_type=LeaveLedgerEntry.ENTRY_PENDING_HOLD).count()
        expense_pending = ExpenseClaim.objects.filter(status="Requested").count()
        pending_approvals = leave_pending + expense_pending

        # 9. Top Performer
        top_perf = Employee.objects.filter(is_active=True).first()
        top_perf_data = None
        if top_perf:
            top_perf_data = {
                "id": top_perf.id,
                "full_name": f"{top_perf.first_name} {top_perf.last_name or ''}".strip(),
                "designation": top_perf.designation.title if top_perf.designation else "Developer",
                "photo": top_perf.photo.url if top_perf.photo else "",
                "score": "99%"
            }

        # 10. Top todo list items
        todos_qs = Resource.objects.filter(resource_type="productivity-todos")[:5]
        todos_list = []
        for t in todos_qs:
            todos_list.append({
                "id": str(t.id),
                "title": t.data.get("title") or "Todo Task",
                "is_completed": t.data.get("is_completed") or False,
                "due_date": t.data.get("due_date") or ""
            })

        # 11. Top Projects List
        projects_list = []
        for p in Resource.objects.filter(resource_type="projects")[:5]:
            p_data = p.data or {}
            projects_list.append({
                "id": str(p.id),
                "project_name": p_data.get("project_name") or "Office Management App",
                "project_id": p_data.get("project_id") or f"PRO-{str(p.id)[:4].upper()}",
                "hours": p_data.get("hours") or "0/255 Hrs",
                "deadline": p_data.get("deadline") or "12/09/2026",
                "priority": p_data.get("priority") or "Medium"
            })

        # 12. Top Invoices List
        invoices_list = []
        for inv in Resource.objects.filter(resource_type="invoices")[:5]:
            inv_data = inv.data or {}
            invoices_list.append({
                "id": str(inv.id),
                "invoice_no": inv_data.get("invoice_no") or f"INV-{str(inv.id)[:4].upper()}",
                "project_name": inv_data.get("project_name") or "Redesign Website",
                "client_name": inv_data.get("client_name") or "Ignis LLP",
                "amount": inv_data.get("amount") or "3,560",
                "status": inv_data.get("status") or "Unpaid"
            })

        # 13. Probation Alerts (ending in 30 days)
        today = timezone.now().date()
        thirty_days_later = today + timedelta(days=30)
        probation_alerts_qs = Employee.objects.filter(
            is_active=True,
            probation_status__in=["on_probation", "extended"],
            probation_end_date__gte=today,
            probation_end_date__lte=thirty_days_later
        )
        probation_alerts_list = []
        for emp in probation_alerts_qs:
            probation_alerts_list.append({
                "id": emp.id,
                "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                "emp_code": emp.emp_code,
                "probation_end_date": str(emp.probation_end_date)
            })

        # 14. Birthdays this week
        birthdays_list = []
        next_7_days = [today + timedelta(days=i) for i in range(7)]
        for day in next_7_days:
            emp_bday = Employee.objects.filter(
                is_active=True,
                date_of_birth__month=day.month,
                date_of_birth__day=day.day
            )
            for emp in emp_bday:
                birthdays_list.append({
                    "id": emp.id,
                    "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                    "emp_code": emp.emp_code,
                    "birthday": f"{day.strftime('%d %b')}"
                })

        # 15. Headcount Trend (last 6 months)
        headcount_labels = []
        headcount_counts = []
        for i in reversed(range(6)):
            temp_month = today.month - i
            temp_year = today.year
            while temp_month <= 0:
                temp_month += 12
                temp_year -= 1
            
            import calendar
            _, last_day = calendar.monthrange(temp_year, temp_month)
            end_of_month = timezone.datetime(temp_year, temp_month, last_day).date()
            
            count = Employee.objects.filter(joining_date__lte=end_of_month, is_active=True).count()
            if count == 0:
                count = max(5, total_employees - (i * 2))
                
            month_name = end_of_month.strftime("%b")
            headcount_labels.append(month_name)
            headcount_counts.append(count)

        return Response({
            "total_employees": total_employees,
            "active_employees": active_employees,
            "total_projects": total_projects,
            "total_clients": total_clients,
            "total_tasks": total_tasks,
            "earnings": earnings,
            "expenses": expenses,
            "profit_this_week": profit_this_week,
            "job_applicants": job_applicants,
            "new_hires": new_hires,
            "pending_approvals": pending_approvals,
            "pending_leave_requests": leave_pending,
            "department_chart": {
                "labels": dept_labels,
                "counts": dept_counts
            },
            "employment_types": {
                "fulltime": fulltime_count or 112,
                "contract": contract_count or 112,
                "probation": parttime_count or 12,
                "wfh": intern_count or 4
            },
            "attendance_overview": {
                "present": present_count,
                "late": late_count,
                "permission": permission_count,
                "absent": absent_count
            },
            "sales_income_chart": {
                "income": income_series,
                "expenses": expense_series
            },
            "projects_status": {
                "ongoing": proj_ongoing,
                "onhold": proj_onhold,
                "completed": proj_completed,
                "overdue": proj_overdue
            },
            "top_performer": top_perf_data,
            "todos": todos_list,
            "top_projects": projects_list,
            "top_invoices": invoices_list,
            "probation_alerts": probation_alerts_list,
            "birthdays_this_week": birthdays_list,
            "headcount_trend": {
                "labels": headcount_labels,
                "counts": headcount_counts
            }
        })


class SalaryRevisionViewSet(HROrEmployeeScopedViewSet):
    serializer_class = SalaryRevisionSerializer
    queryset = SalaryRevision.objects.select_related("employee", "revised_by", "approved_by").all()
    employee_can_write = False

    def perform_create(self, serializer):
        user = self.request.user
        instance = serializer.save(revised_by=user)
        create_audit_log(
            actor=user,
            scope="salary_revision",
            action="create",
            target_type="salary_revision",
            target_id=str(instance.id),
            summary=f"Created salary revision draft for {instance.employee.first_name}"
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        user = request.user
        if not is_hr_or_above(user):
            return Response({"detail": "Only HR and Admins can approve salary revisions."}, status=status.HTTP_403_FORBIDDEN)
        revision = self.get_object()
        if revision.status == "approved":
            return Response({"detail": "This revision is already approved."}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            revision.status = "approved"
            revision.approved_by = user
            revision.approved_at = timezone.now()
            revision.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
            
            employee = revision.employee
            employee.salary = revision.new_salary
            employee.save(update_fields=["salary", "updated_at"])
            
        create_audit_log(
            actor=user,
            scope="salary_revision",
            action="approve",
            target_type="salary_revision",
            target_id=str(revision.id),
            summary=f"Approved salary revision for {employee.first_name} (new salary: {revision.new_salary})"
        )
        return Response(self.get_serializer(revision).data)


class EmployeeTransferViewSet(HROrEmployeeScopedViewSet):
    serializer_class = EmployeeTransferSerializer
    queryset = EmployeeTransfer.objects.select_related("employee", "from_department", "to_department", "from_designation", "to_designation", "from_reporting_to", "to_reporting_to").all()
    employee_can_write = False

    def perform_create(self, serializer):
        user = self.request.user
        emp_id = self.request.data.get("employee") or self.request.data.get("employee_id")
        if not emp_id:
            raise serializers.ValidationError("employee is required.")
        try:
            employee = Employee.objects.get(pk=emp_id)
        except Employee.DoesNotExist:
            raise serializers.ValidationError("Employee not found.")
        
        instance = serializer.save(
            from_department=employee.department,
            from_designation=employee.designation,
            from_reporting_to=employee.reporting_to
        )
        create_audit_log(
            actor=user,
            scope="employee_transfer",
            action="create",
            target_type="employee_transfer",
            target_id=str(instance.id),
            summary=f"Initiated transfer request for {employee.first_name}"
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        user = request.user
        if not is_hr_or_above(user):
            return Response({"detail": "Only HR and Admins can approve transfers."}, status=status.HTTP_403_FORBIDDEN)
        transfer = self.get_object()
        if transfer.status == "approved":
            return Response({"detail": "This transfer is already approved."}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            transfer.status = "approved"
            transfer.approved_by = user
            transfer.approved_at = timezone.now()
            transfer.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
            
            employee = transfer.employee
            if transfer.to_department:
                employee.department = transfer.to_department
            if transfer.to_designation:
                employee.designation = transfer.to_designation
            if transfer.to_reporting_to:
                employee.reporting_to = transfer.to_reporting_to
            employee.save(update_fields=["department", "designation", "reporting_to", "updated_at"])
            
        create_audit_log(
            actor=user,
            scope="employee_transfer",
            action="approve",
            target_type="employee_transfer",
            target_id=str(transfer.id),
            summary=f"Approved transfer of {employee.first_name} to {transfer.to_department}"
        )
        return Response(self.get_serializer(transfer).data)


class EmployeeLoanViewSet(HROrEmployeeScopedViewSet):
    serializer_class = EmployeeLoanSerializer
    queryset = EmployeeLoan.objects.select_related("employee", "approved_by").all()
    employee_can_write = True

    def perform_create(self, serializer):
        user = self.request.user
        if is_employee(user):
            employee = getattr(user, "employee_profile", None)
            if not employee:
                raise serializers.ValidationError("Employee profile not found.")
            instance = serializer.save(employee=employee, status="pending")
        else:
            instance = serializer.save()
        
        create_audit_log(
            actor=user,
            scope="loan",
            action="apply",
            target_type="employee_loan",
            target_id=str(instance.id),
            summary=f"Applied for loan of {instance.sanctioned_amount} for {instance.employee.first_name}"
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        user = request.user
        if not is_hr_or_above(user):
            return Response({"detail": "Only HR and Admins can approve loans."}, status=status.HTTP_403_FORBIDDEN)
        loan = self.get_object()
        if loan.status != "pending":
            return Response({"detail": "Loan is not in pending status."}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            loan.status = "active"
            loan.approved_by = user
            loan.sanctioned_by = user
            loan.save(update_fields=["status", "approved_by", "sanctioned_by", "updated_at"])
            
            import datetime
            current_date = loan.start_date
            month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            for i in range(loan.total_installments):
                installment_month = month_names[current_date.month - 1]
                installment_year = current_date.year
                
                LoanInstallment.objects.create(
                    loan=loan,
                    month=installment_month,
                    year=installment_year,
                    amount=loan.monthly_emi,
                    status="pending"
                )
                if current_date.month == 12:
                    current_date = datetime.date(current_date.year + 1, 1, 1)
                else:
                    current_date = datetime.date(current_date.year, current_date.month + 1, 1)

        create_audit_log(
            actor=user,
            scope="loan",
            action="approve",
            target_type="employee_loan",
            target_id=str(loan.id),
            summary=f"Approved loan of {loan.sanctioned_amount} for {loan.employee.first_name}"
        )
        return Response(self.get_serializer(loan).data)


class LoanInstallmentViewSet(HROrEmployeeScopedViewSet):
    serializer_class = LoanInstallmentSerializer
    queryset = LoanInstallment.objects.select_related("loan", "loan__employee").all()
    employee_field = "loan__employee_id"
    employee_can_write = False


class TrainingProgramViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingProgramSerializer
    queryset = TrainingProgram.objects.select_related("department").all()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        dept_id = self.request.query_params.get("department_id")
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action != "enroll" and request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and Admin can manage training programs.")

    @action(detail=True, methods=["post"])
    def enroll(self, request, pk=None):
        user = request.user
        program = self.get_object()
        
        if is_employee(user):
            employee = getattr(user, "employee_profile", None)
            if not employee:
                return Response({"detail": "User is not linked to an employee profile."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            emp_id = request.data.get("employee_id") or request.data.get("employee")
            if not emp_id:
                return Response({"detail": "employee_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                employee = Employee.objects.get(pk=emp_id)
            except Employee.DoesNotExist:
                return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        if TrainingEnrollment.objects.filter(program=program, employee=employee).exists():
            return Response({"detail": "Employee is already enrolled in this program."}, status=status.HTTP_400_BAD_REQUEST)

        if program.max_seats and program.enrollments.count() >= program.max_seats:
            return Response({"detail": "This training program is fully booked."}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = TrainingEnrollment.objects.create(
            program=program,
            employee=employee,
            status="enrolled"
        )
        create_audit_log(
            actor=user,
            scope="training",
            action="enroll",
            target_type="training_enrollment",
            target_id=str(enrollment.id),
            summary=f"Enrolled {employee.first_name} in {program.title}"
        )
        return Response(TrainingEnrollmentSerializer(enrollment).data, status=status.HTTP_201_CREATED)


class TrainingEnrollmentViewSet(HROrEmployeeScopedViewSet):
    serializer_class = TrainingEnrollmentSerializer
    queryset = TrainingEnrollment.objects.select_related("program", "employee").all()
    employee_can_write = True

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        user = request.user
        if not is_hr_or_above(user):
            return Response({"detail": "Only HR and Admins can complete enrollments."}, status=status.HTTP_403_FORBIDDEN)
        enrollment = self.get_object()
        if enrollment.status == "completed":
            return Response({"detail": "This enrollment is already marked as completed."}, status=status.HTTP_400_BAD_REQUEST)

        enrollment.status = "completed"
        enrollment.score = request.data.get("score")
        enrollment.feedback = request.data.get("feedback")
        enrollment.certificate_url = request.data.get("certificate_url")
        enrollment.completed_at = timezone.now()
        enrollment.save()

        create_audit_log(
            actor=user,
            scope="training",
            action="complete",
            target_type="training_enrollment",
            target_id=str(enrollment.id),
            summary=f"Completed training program {enrollment.program.title} for {enrollment.employee.first_name}"
        )
        return Response(self.get_serializer(enrollment).data)


class ReviewCycleViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewCycleSerializer
    queryset = ReviewCycle.objects.all()
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and Admin can manage review cycles.")


class PerformanceReviewViewSet(HROrEmployeeScopedViewSet):
    serializer_class = PerformanceReviewSerializer
    queryset = PerformanceReview.objects.prefetch_related("goals", "feedbacks").select_related("cycle", "employee", "reviewer").all()
    employee_can_write = True


class ReviewGoalViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewGoalSerializer
    queryset = ReviewGoal.objects.all()
    permission_classes = [IsAuthenticated]


class ReviewFeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewFeedbackSerializer
    queryset = ReviewFeedback.objects.all()
    permission_classes = [IsAuthenticated]


class PeerFeedbackViewSet(HROrEmployeeScopedViewSet):
    serializer_class = PeerFeedbackSerializer
    queryset = PeerFeedback.objects.select_related("reviewer", "reviewee", "cycle").all()
    employee_field = "reviewee_id"
    employee_can_write = True

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_employee(user):
            employee_id = getattr(user, "employee_profile_id", None)
            if not employee_id:
                return qs.none()
            return qs.filter(Q(reviewee_id=employee_id) | Q(reviewer_id=employee_id))
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if is_employee(user):
            reviewer = getattr(user, "employee_profile", None)
            if not reviewer:
                raise serializers.ValidationError("Reviewer employee profile not found.")
            serializer.save(reviewer=reviewer)
        else:
            serializer.save()


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    queryset = Announcement.objects.select_related("author").prefetch_related("read_by").all()
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action != "mark_read" and request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and Admin can manage announcements.")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        announcement = self.get_object()
        announcement.read_by.add(request.user)
        announcement.views_count += 1
        announcement.save()
        return Response({"status": "read marked"})


class DisciplinaryActionViewSet(HROrEmployeeScopedViewSet):
    serializer_class = DisciplinaryActionSerializer
    queryset = DisciplinaryAction.objects.select_related("employee", "issued_by").all()
    employee_can_write = True

    def perform_create(self, serializer):
        user = self.request.user
        instance = serializer.save(issued_by=user, status="issued")
        
        if instance.action_type == "termination_notice":
            if not OffboardingCase.objects.filter(employee=instance.employee, source_type="termination").exists():
                OffboardingCase.objects.create(
                    employee=instance.employee,
                    source_type="termination",
                    source_resource_id=str(instance.id),
                    status="in_review",
                    initiated_on=timezone.now().date(),
                    notes="Disciplinary termination notice"
                )
                
        create_audit_log(
            actor=user,
            scope="disciplinary",
            action="issue",
            target_type="disciplinary_action",
            target_id=str(instance.id),
            summary=f"Issued disciplinary action ({instance.action_type}) to {instance.employee.first_name}"
        )

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.save()
        
        if instance.action_type == "termination_notice":
            if not OffboardingCase.objects.filter(employee=instance.employee, source_type="termination").exists():
                OffboardingCase.objects.create(
                    employee=instance.employee,
                    source_type="termination",
                    source_resource_id=str(instance.id),
                    status="in_review",
                    initiated_on=timezone.now().date(),
                    notes="Disciplinary termination notice"
                )
                
        create_audit_log(
            actor=user,
            scope="disciplinary",
            action="update",
            target_type="disciplinary_action",
            target_id=str(instance.id),
            summary=f"Updated disciplinary action status/response for {instance.employee.first_name}"
        )

    @action(detail=True, methods=["get"], url_path="letter-pdf")
    def letter_pdf(self, request, pk=None):
        instance = self.get_object()
        
        from django.http import HttpResponse
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        import io
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#A82D2D"),
            spaceAfter=20,
            alignment=1, # Center
        )
        body_style = ParagraphStyle(
            "BodyStyle",
            parent=styles["Normal"],
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#2B2B2B"),
            spaceAfter=12,
        )
        header_style = ParagraphStyle(
            "HeaderStyle",
            parent=styles["Normal"],
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#1A1A1A"),
            spaceAfter=6,
        )
        
        # Title
        story.append(Paragraph("DISCIPLINARY MEMORANDUM", title_style))
        story.append(Spacer(1, 10))
        
        # Details Table
        emp_name = f"{instance.employee.first_name} {instance.employee.last_name or ''}".strip()
        data = [
            [Paragraph("<b>Date of Issue:</b>", body_style), Paragraph(str(instance.issued_on), body_style)],
            [Paragraph("<b>Employee Name:</b>", body_style), Paragraph(emp_name, body_style)],
            [Paragraph("<b>Employee Code:</b>", body_style), Paragraph(instance.employee.emp_code, body_style)],
            [Paragraph("<b>Action Type:</b>", body_style), Paragraph(instance.action_type.replace("_", " ").upper(), body_style)],
            [Paragraph("<b>Incident Date:</b>", body_style), Paragraph(str(instance.incident_date), body_style)],
            [Paragraph("<b>Response Due By:</b>", body_style), Paragraph(str(instance.response_required_by or "N/A"), body_style)],
            [Paragraph("<b>Status:</b>", body_style), Paragraph(instance.status.upper(), body_style)],
        ]
        
        t = Table(data, colWidths=[150, 300])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F9F9F9")),
            ('PADDING', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#EAEAEA")),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Description
        story.append(Paragraph("<b>Description of the Incident / Violation:</b>", header_style))
        story.append(Paragraph(instance.incident_description or "No description provided.", body_style))
        story.append(Spacer(1, 15))
        
        if instance.employee_response:
            story.append(Paragraph("<b>Employee Response / Statement:</b>", header_style))
            story.append(Paragraph(instance.employee_response, body_style))
            story.append(Spacer(1, 15))
            
        story.append(Paragraph("Please note that disciplinary actions are recorded in the employee's official personnel file. Future violations or failure to correct performance issues may result in further disciplinary steps up to and including termination of employment.", body_style))
        story.append(Spacer(1, 40))
        
        # Signatures
        sig_data = [
            [Paragraph("__________________________<br/><b>Issued By (HR / Management)</b>", body_style), 
             Paragraph("__________________________<br/><b>Employee Acknowledgment</b>", body_style)]
        ]
        sig_table = Table(sig_data, colWidths=[225, 225])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(sig_table)
        
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="warning_letter_{instance.id}.pdf"'
        return response



