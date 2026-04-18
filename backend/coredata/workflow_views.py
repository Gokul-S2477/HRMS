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

from employees.models import Employee
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
        if scope not in {"leave", "timesheet", "overtime", "payroll", "final_settlement", "offboarding"}:
            return Response({"detail": "Invalid approval scope."}, status=status.HTTP_400_BAD_REQUEST)
        if decision not in {"approve", "reject", "return"}:
            return Response({"detail": "Select approve, reject, or return."}, status=status.HTTP_400_BAD_REQUEST)

        actor_name = request.user.get_display_name()
        actor_role = resolve_role(request.user) or getattr(request.user, "role", "hr")

        if scope == "leave":
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


