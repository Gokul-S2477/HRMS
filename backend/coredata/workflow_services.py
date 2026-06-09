from __future__ import annotations

from datetime import date, datetime, timedelta
import secrets
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from employees.models import Employee
from users.permissions import is_employee, resolve_role

from .models import (
    ApplicantAccount,
    ApplicantLoginCode,
    ApplicantSession,
    AssetAssignment,
    AuditLog,
    DocumentCategory,
    EmployeeDocument,
    CandidateTimelineEvent,
    JobApplication,
    LeaveBalance,
    LeaveLedgerEntry,
    Notification,
    OnboardingRecord,
    OnboardingTask,
    OnboardingTemplate,
    OffboardingCase,
    RecruitmentCandidate,
    RecruitmentInterview,
    RecruitmentJob,
    Resource,
)

User = get_user_model()


def as_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def parse_iso_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        return None


def daterange(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def get_leave_settings_payload() -> dict:
    record = Resource.objects.filter(resource_type="leave-settings").order_by("-created_at").first()
    return dict(record.data or {}) if record else {}


def get_leave_type_limit(leave_type: str, fallback: Decimal) -> Decimal:
    leave_type_key = str(leave_type or "").strip().lower()
    for resource in Resource.objects.filter(resource_type="leave-types"):
        payload = resource.data or {}
        name = str(payload.get("name") or "").lower()
        if leave_type_key and leave_type_key in name:
            return as_decimal(payload.get("days")) or fallback
    return fallback


def get_holiday_dates() -> set[date]:
    holidays = set()
    for resource in Resource.objects.filter(resource_type="holidays"):
        holiday_date = parse_iso_date((resource.data or {}).get("date"))
        if holiday_date:
            holidays.add(holiday_date)
    return holidays


def count_working_days(start_value, end_value) -> int:
    start = parse_iso_date(start_value)
    end = parse_iso_date(end_value)
    if not start or not end or end < start:
        return 0

    settings = get_leave_settings_payload()
    excluded_weekdays = settings.get("excluded_weekdays") or ["Saturday", "Sunday"]
    excluded_weekdays = {str(item).strip().lower() for item in excluded_weekdays}
    exclude_holidays = settings.get("holiday_exclusion", True)
    holidays = get_holiday_dates() if exclude_holidays else set()

    total = 0
    for current in daterange(start, end):
        weekday = current.strftime("%A").lower()
        if weekday in excluded_weekdays:
            continue
        if current in holidays:
            continue
        total += 1
    return total


def create_notification(
    recipient,
    title: str,
    body: str = "",
    *,
    actor=None,
    notification_type: str = "general",
    target_url: str = "",
    reference_type: str = "",
    reference_id: str = "",
    metadata: dict | None = None,
):
    if not recipient:
        return None
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        title=title,
        body=body,
        target_url=target_url,
        reference_type=reference_type,
        reference_id=reference_id,
        metadata=metadata or {},
    )


def create_audit_log(
    *,
    actor=None,
    actor_email: str = "",
    scope: str,
    action: str,
    target_type: str,
    target_id: str = "",
    summary: str = "",
    metadata: dict | None = None,
):
    return AuditLog.objects.create(
        actor_user=actor if getattr(actor, "is_authenticated", False) else None,
        actor_email=actor_email or getattr(actor, "email", "") or "",
        scope=scope,
        action=action,
        target_type=target_type,
        target_id=str(target_id or ""),
        summary=summary,
        metadata=metadata or {},
    )


def notify_roles(roles: set[str], title: str, body: str, **kwargs):
    recipients = User.objects.filter(is_active=True, account_status=User.STATUS_ACTIVE, role__in=roles)
    for user in recipients:
        create_notification(user, title, body, **kwargs)


DEFAULT_ONBOARDING_TASKS = [
    {"title": "Share welcome note and policy pack", "task_type": "hr", "sort_order": 10},
    {"title": "Provision email and tool access", "task_type": "it", "sort_order": 20},
    {"title": "Assign workstation and assets", "task_type": "admin", "sort_order": 30},
    {"title": "Collect employee documents", "task_type": "documents", "sort_order": 40},
    {"title": "Confirm induction and manager connect", "task_type": "manager", "sort_order": 50},
]


def recalculate_onboarding_progress(record: OnboardingRecord):
    tasks = list(record.tasks.all())
    total = len(tasks)
    if total == 0:
        record.progress_percentage = 0
        if record.status == OnboardingRecord.STATUS_COMPLETED:
            record.completed_on = record.completed_on or timezone.now().date()
        record.save(update_fields=["progress_percentage", "completed_on", "updated_at"])
        return record

    completed = len([task for task in tasks if task.status == OnboardingTask.STATUS_COMPLETED])
    blocked = len([task for task in tasks if task.status == OnboardingTask.STATUS_BLOCKED])
    progress = int(round((completed / total) * 100))
    record.progress_percentage = progress
    if blocked and record.status != OnboardingRecord.STATUS_COMPLETED:
        record.status = OnboardingRecord.STATUS_BLOCKED
    elif completed == total:
        record.status = OnboardingRecord.STATUS_COMPLETED
        record.completed_on = record.completed_on or timezone.now().date()
    elif completed > 0 and record.status == OnboardingRecord.STATUS_PLANNED:
        record.status = OnboardingRecord.STATUS_IN_PROGRESS
        record.started_on = record.started_on or timezone.now().date()
    record.save(update_fields=["progress_percentage", "status", "started_on", "completed_on", "updated_at"])
    return record


def ensure_onboarding_tasks(record: OnboardingRecord, actor=None, reset_missing: bool = False):
    template_tasks = []
    if record.template and record.template.tasks:
        template_tasks = list(record.template.tasks)
    if not template_tasks:
        template_tasks = list(DEFAULT_ONBOARDING_TASKS)

    existing = {task.title.strip().lower(): task for task in record.tasks.all()}
    seen_keys = set()
    for index, item in enumerate(template_tasks, start=1):
        title = str(item.get("title") or item.get("name") or "Task").strip()
        if not title:
            continue
        key = title.lower()
        seen_keys.add(key)
        defaults = {
            "task_type": str(item.get("task_type") or "general"),
            "sort_order": int(item.get("sort_order") or index * 10),
            "notes": str(item.get("notes") or ""),
            "due_date": parse_iso_date(item.get("due_date")),
        }
        if key not in existing:
            OnboardingTask.objects.create(record=record, title=title, **defaults)
        elif reset_missing:
            current = existing[key]
            changed = False
            for field_name, value in defaults.items():
                if getattr(current, field_name) != value and current.status == OnboardingTask.STATUS_PENDING:
                    setattr(current, field_name, value)
                    changed = True
            if changed:
                current.save()
    if reset_missing:
        removable = record.tasks.filter(status=OnboardingTask.STATUS_PENDING)
        for task in removable:
            if task.title.strip().lower() not in seen_keys:
                task.delete()
    return recalculate_onboarding_progress(record)


def find_employee_for_email(email: str):
    email_value = str(email or "").strip()
    if not email_value:
        return None
    return Employee.objects.filter(email__iexact=email_value).first()


def sync_candidate_employee_link(candidate: RecruitmentCandidate, *, persist: bool = True):
    employee = candidate.employee or find_employee_for_email(candidate.email)
    if employee and candidate.employee_id != employee.id:
        candidate.employee = employee
        if persist:
            candidate.save(update_fields=["employee", "updated_at"])
    return employee


def sync_interview_employee_link(interview: RecruitmentInterview, *, persist: bool = True):
    employee = interview.employee or interview.candidate.employee or find_employee_for_email(interview.candidate.email)
    if employee and interview.employee_id != employee.id:
        interview.employee = employee
        if persist:
            interview.save(update_fields=["employee", "updated_at"])
    return employee


def ensure_onboarding_record(candidate: RecruitmentCandidate, actor=None) -> OnboardingRecord:
    record = OnboardingRecord.objects.filter(candidate=candidate).select_related("template").first()
    if record:
        return ensure_onboarding_tasks(record, actor=actor)

    template = None
    active_templates = list(OnboardingTemplate.objects.filter(is_active=True).order_by("name"))
    department_name = (candidate.job.department_name if candidate.job else "") or ""
    role_name = (candidate.current_title or (candidate.job.title if candidate.job else "")) or ""
    for candidate_template in active_templates:
        if department_name and candidate_template.department_name.lower() == department_name.lower():
            template = candidate_template
            break
        if role_name and candidate_template.role_name.lower() == role_name.lower():
            template = candidate_template
            break
    if template is None and active_templates:
        template = active_templates[0]

    employee = candidate.employee or find_employee_for_email(candidate.email)
    title = f"Onboarding - {candidate.first_name} {candidate.last_name or ''}".strip()
    record = OnboardingRecord.objects.create(
        employee=employee,
        candidate=candidate,
        template=template,
        owner=actor if getattr(actor, "is_authenticated", False) else None,
        title=title,
        status=OnboardingRecord.STATUS_PLANNED,
        target_joining_date=candidate.applied_on or timezone.now().date(),
    )
    ensure_onboarding_tasks(record, actor=actor)
    create_audit_log(
        actor=actor,
        scope="onboarding",
        action="record_auto_created",
        target_type="onboarding_record",
        target_id=str(record.id),
        summary=f"Auto-created onboarding record for {candidate.first_name} {candidate.last_name}".strip(),
        metadata={"candidate_id": candidate.id},
    )
    return record


def run_accrual_catchup(balance: LeaveBalance):
    today = timezone.now().date()
    if balance.year != today.year:
        return
        
    settings = get_leave_settings_payload()
    accrual_rate = as_decimal(settings.get("monthly_accrual_rate") or "1.5")
    
    for m in range(1, today.month + 1):
        exists = balance.ledger_entries.filter(
            entry_type=LeaveLedgerEntry.ENTRY_ALLOCATION,
            metadata__accrual_month=m,
            metadata__accrual_year=today.year
        ).exists()
        
        if not exists:
            month_name = date(today.year, m, 1).strftime("%B")
            LeaveLedgerEntry.objects.create(
                employee=balance.employee,
                balance=balance,
                leave_type=balance.leave_type,
                entry_type=LeaveLedgerEntry.ENTRY_ALLOCATION,
                days=accrual_rate,
                description=f"Monthly accrual credit for {month_name} {today.year}",
                metadata={"accrual_month": m, "accrual_year": today.year},
            )

def ensure_leave_balance(employee: Employee, leave_type: str, year: int) -> LeaveBalance:
    settings = get_leave_settings_payload()
    default_allocation = as_decimal(settings.get("max_leave_days") or 24)
    annual_allocation = get_leave_type_limit(leave_type, default_allocation)
    carry_forward_cap = as_decimal(settings.get("carry_forward_days") or 0)

    balance, created = LeaveBalance.objects.get_or_create(
        employee=employee,
        leave_type=leave_type,
        year=year,
        defaults={
            "annual_allocation": annual_allocation,
            "carry_forward": Decimal("0"),
        },
    )

    if created:
        previous = LeaveBalance.objects.filter(
            employee=employee,
            leave_type=leave_type,
            year=year - 1,
        ).first()
        carry_forward = Decimal("0")
        if previous:
            carry_forward = min(max(previous.available, Decimal("0")), carry_forward_cap)
        balance.annual_allocation = annual_allocation
        balance.carry_forward = carry_forward
        balance.save(update_fields=["annual_allocation", "carry_forward", "updated_at"])
        
    # Catch up monthly accruals
    run_accrual_catchup(balance)
    
    return balance


def recalculate_leave_balance(balance: LeaveBalance):
    approved = Decimal("0")
    pending = Decimal("0")
    adjusted = Decimal("0")
    credited = Decimal("0")
    for entry in balance.ledger_entries.all():
        if entry.entry_type == LeaveLedgerEntry.ENTRY_APPROVED_DEBIT:
            approved += as_decimal(entry.days)
        elif entry.entry_type == LeaveLedgerEntry.ENTRY_PENDING_HOLD:
            pending += as_decimal(entry.days)
        elif entry.entry_type == LeaveLedgerEntry.ENTRY_ADJUSTMENT:
            adjusted += as_decimal(entry.days)
        elif entry.entry_type == LeaveLedgerEntry.ENTRY_ALLOCATION:
            credited += as_decimal(entry.days)
    balance.used = approved
    balance.pending = pending
    balance.adjusted = adjusted
    balance.credited = credited
    balance.save(update_fields=["used", "pending", "adjusted", "credited", "updated_at"])


@transaction.atomic
def sync_leave_request_resource(resource: Resource, actor=None):
    data = dict(resource.data or {})
    employee_id = data.get("employee_id")
    if not employee_id:
        return
    try:
        employee = Employee.objects.get(pk=employee_id)
    except Employee.DoesNotExist:
        return

    leave_type = data.get("leave_type") or "General"
    leave_year = parse_iso_date(data.get("from_date"))
    leave_year = leave_year.year if leave_year else timezone.now().year
    working_days = count_working_days(data.get("from_date"), data.get("to_date"))

    data["requested_days"] = working_days
    data["working_days"] = working_days
    data["leave_year"] = leave_year
    resource.data = data
    resource.save(update_fields=["data", "updated_at"])

    balance = ensure_leave_balance(employee, leave_type, leave_year)
    LeaveLedgerEntry.objects.filter(balance=balance, related_resource_id=str(resource.id)).delete()

    status_value = str(data.get("status") or "Pending").lower()
    if status_value == "approved" and working_days:
        LeaveLedgerEntry.objects.create(
            employee=employee,
            balance=balance,
            leave_type=leave_type,
            entry_type=LeaveLedgerEntry.ENTRY_APPROVED_DEBIT,
            days=working_days,
            related_resource_id=str(resource.id),
            description=f"Approved leave for {leave_type}",
            metadata={"from_date": data.get("from_date"), "to_date": data.get("to_date")},
            created_by=actor,
        )
    elif status_value in {"pending", "supervisor approved"} and working_days:
        LeaveLedgerEntry.objects.create(
            employee=employee,
            balance=balance,
            leave_type=leave_type,
            entry_type=LeaveLedgerEntry.ENTRY_PENDING_HOLD,
            days=working_days,
            related_resource_id=str(resource.id),
            description=f"Pending leave hold for {leave_type}",
            metadata={"from_date": data.get("from_date"), "to_date": data.get("to_date")},
            created_by=actor,
        )

    recalculate_leave_balance(balance)

    # Multi-level notifications
    supervisor = employee.reporting_to
    if actor and is_employee(actor):
        # Notify supervisor first if reporting hierarchy is set
        if status_value == "pending" and supervisor and getattr(supervisor, "user_account", None):
            create_notification(
                supervisor.user_account,
                title=f"Leave request from {employee.first_name} pending your review",
                body=f"{employee.first_name} requested {working_days} day(s) of {leave_type} leave.",
                actor=actor,
                notification_type="leave_request",
                target_url="/leaves",
                reference_type="leave-request",
                reference_id=str(resource.id),
                metadata={"employee_id": employee.id, "leave_type": leave_type},
            )
        else:
            # Otherwise notify HR/Admin
            notify_roles(
                {User.ROLE_HR, User.ROLE_STAKEHOLDER, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
                title=f"Leave request from {employee.first_name}",
                body=f"{employee.first_name} requested {working_days} day(s) of {leave_type} leave.",
                actor=actor,
                notification_type="leave_request",
                target_url="/leaves",
                reference_type="leave-request",
                reference_id=str(resource.id),
                metadata={"employee_id": employee.id, "leave_type": leave_type},
            )
    elif getattr(employee, "user_account", None) and actor:
        # If supervisor approves, notify HR/Admin for final approval
        if status_value == "supervisor approved":
            notify_roles(
                {User.ROLE_HR, User.ROLE_STAKEHOLDER, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
                title=f"Supervisor approved leave request from {employee.first_name}",
                body=f"Supervisor approved {employee.first_name}'s request for {working_days} day(s) of {leave_type} leave. Pending final HR approval.",
                actor=actor,
                notification_type="leave_request",
                target_url="/leaves",
                reference_type="leave-request",
                reference_id=str(resource.id),
                metadata={"employee_id": employee.id, "leave_type": leave_type},
            )
        
        # Notify the employee
        create_notification(
            employee.user_account,
            title=f"Leave request {data.get('status') or 'updated'}",
            body=f"Your {leave_type} leave request for {working_days} day(s) was marked {data.get('status') or 'updated'} by {actor.get_display_name()}.",
            actor=actor,
            notification_type="leave_review",
            target_url="/leaves-employee",
            reference_type="leave-request",
            reference_id=str(resource.id),
            metadata={"notice_timing": data.get("notice_timing"), "approved_by": data.get("approved_by")},
        )


@transaction.atomic
def sync_ticket_notifications(resource: Resource, actor=None):
    data = dict(resource.data or {})
    employee = None
    employee_id = data.get("employee_id")
    if employee_id:
        employee = Employee.objects.filter(pk=employee_id).select_related("user_account").first()

    if actor and is_employee(actor):
        notify_roles(
            {User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
            title=f"New ticket: {data.get('title') or data.get('subject') or 'Support request'}",
            body=f"{actor.get_display_name()} created a {data.get('priority') or 'normal'} priority ticket.",
            actor=actor,
            notification_type="ticket_created",
            target_url="/tickets/ticket-list",
            reference_type="ticket",
            reference_id=str(resource.id),
        )
        return

    if employee and getattr(employee, "user_account", None) and actor:
        create_notification(
            employee.user_account,
            title=f"Ticket {data.get('status') or 'updated'}",
            body=f"Your ticket '{data.get('title') or data.get('subject') or 'Support request'}' was updated by {actor.get_display_name()}.",
            actor=actor,
            notification_type="ticket_updated",
            target_url="/tickets/ticket-details",
            reference_type="ticket",
            reference_id=str(resource.id),
        )


def sync_training_notifications(resource: Resource, actor=None):
    data = dict(resource.data or {})
    employee = Employee.objects.filter(pk=data.get("employee_id")).select_related("user_account").first()
    if employee and getattr(employee, "user_account", None):
        create_notification(
            employee.user_account,
            title=f"Training scheduled: {data.get('title') or data.get('course_name') or 'Session'}",
            body=f"A training session was assigned for {data.get('date') or data.get('start_date') or 'an upcoming date'}.",
            actor=actor,
            notification_type="training_reminder",
            target_url="/training/training-list",
            reference_type="training-session",
            reference_id=str(resource.id),
        )


def sync_payroll_notifications(resource: Resource, actor=None):
    data = dict(resource.data or {})
    employee = Employee.objects.filter(pk=data.get("employee_id")).select_related("user_account").first()
    if employee and getattr(employee, "user_account", None):
        month = data.get("salary_month") or data.get("month") or "Current cycle"
        create_notification(
            employee.user_account,
            title="Payslip published",
            body=f"Your payroll details for {month} are now available.",
            actor=actor,
            notification_type="payroll_published",
            target_url="/accounts/payslips",
            reference_type="employee-salary",
            reference_id=str(resource.id),
        )


def default_offboarding_checklist(source_type: str) -> list[dict]:
    return [
        {"key": "access", "label": "Disable employee access", "done": False},
        {"key": "manager_handover", "label": "Confirm manager handover", "done": False},
        {"key": "assets", "label": "Collect company assets", "done": False},
        {"key": "payroll", "label": "Finalize payroll", "done": False},
        {"key": "compliance", "label": f"Archive {source_type} paperwork", "done": False},
    ]


@transaction.atomic
def sync_offboarding_from_resource(resource: Resource, actor=None):
    data = dict(resource.data or {})
    employee_id = data.get("employee_id")
    if not employee_id:
        return
    employee = Employee.objects.filter(pk=employee_id).select_related("user_account").first()
    if not employee:
        return

    source_type = "resignation" if resource.resource_type == "resignations" else "termination"
    source_status = str(data.get("status") or "").lower()
    approved_states = {"accepted", "approved", "completed"}

    initiated_on = parse_iso_date(data.get("notice_date")) or timezone.now().date()
    last_working_day = parse_iso_date(data.get("resignation_date") or data.get("termination_date"))

    case, _ = OffboardingCase.objects.get_or_create(
        employee=employee,
        source_type=source_type,
        source_resource_id=str(resource.id),
        defaults={
            "initiated_on": initiated_on,
            "last_working_day": last_working_day,
            "status": OffboardingCase.STATUS_IN_REVIEW,
            "checklist": default_offboarding_checklist(source_type),
        },
    )

    case.initiated_on = initiated_on
    case.last_working_day = last_working_day
    case.notes = data.get("notes") or case.notes
    case.checklist = case.checklist or default_offboarding_checklist(source_type)

    if source_status in approved_states:
        case.status = OffboardingCase.STATUS_APPROVED if source_status != "completed" else OffboardingCase.STATUS_COMPLETED
        if actor and not case.approved_by_id:
            case.approved_by = actor
            case.approved_at = timezone.now()
        if case.deactivate_employee and employee.is_active:
            employee.is_active = False
            employee.save(update_fields=["is_active", "updated_at"])
        if case.block_login and getattr(employee, "user_account", None):
            account = employee.user_account
            account.account_status = User.STATUS_BLOCKED
            account.is_active = False
            account.save(update_fields=["account_status", "is_active"])
        assigned_assets = AssetAssignment.objects.filter(
            assigned_to=employee,
            status=AssetAssignment.STATUS_ASSIGNED,
        )
        if assigned_assets.exists():
            assigned_assets.update(
                status=AssetAssignment.STATUS_RETURN_REQUESTED,
                due_return_on=last_working_day or timezone.now().date(),
            )
            case.asset_return_status = OffboardingCase.CLEARANCE_PENDING
        else:
            case.asset_return_status = OffboardingCase.CLEARANCE_NOT_REQUIRED
        if source_status == "completed":
            case.completed_at = timezone.now()
    else:
        case.status = OffboardingCase.STATUS_IN_REVIEW

    case.save()

    if source_status in approved_states:
        from payroll.services import ensure_final_settlement

        settlement = ensure_final_settlement(case, actor)
        case.final_payroll_status = settlement.status
        case.save(update_fields=["final_payroll_status", "updated_at"])

    notify_roles(
        {User.ROLE_HR, User.ROLE_SUPER_ADMIN, User.ROLE_ADMIN},
        title=f"Offboarding case: {employee.first_name} {employee.last_name or ''}".strip(),
        body=f"{source_type.title()} workflow is now {case.status.replace('_', ' ')}.",
        actor=actor,
        notification_type="offboarding",
        target_url="/resignation" if source_type == "resignation" else "/termination",
        reference_type="offboarding",
        reference_id=str(case.id),
    )


def generate_login_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


@transaction.atomic
def issue_applicant_login_code(applicant: ApplicantAccount) -> ApplicantLoginCode:
    ApplicantLoginCode.objects.filter(applicant=applicant, consumed_at__isnull=True).update(consumed_at=timezone.now())
    return ApplicantLoginCode.objects.create(
        applicant=applicant,
        code=generate_login_code(),
        expires_at=timezone.now() + timedelta(minutes=15),
    )


@transaction.atomic
def issue_applicant_session(applicant: ApplicantAccount) -> ApplicantSession:
    ApplicantSession.objects.filter(applicant=applicant, expires_at__lt=timezone.now()).delete()
    return ApplicantSession.objects.create(
        applicant=applicant,
        token=secrets.token_urlsafe(32),
        expires_at=timezone.now() + timedelta(days=30),
        last_seen_at=timezone.now(),
    )


@transaction.atomic
def record_candidate_timeline(
    candidate: RecruitmentCandidate,
    *,
    event_type: str,
    title: str,
    description: str = "",
    stage: str = "",
    channel: str = "",
    actor=None,
    application: JobApplication | None = None,
    metadata: dict | None = None,
):
    return CandidateTimelineEvent.objects.create(
        candidate=candidate,
        application=application,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        event_type=event_type,
        title=title,
        description=description,
        stage=stage,
        channel=channel,
        metadata=metadata or {},
    )


@transaction.atomic
def sync_candidate_from_application(application: JobApplication, actor=None) -> RecruitmentCandidate:
    job = application.job
    applicant = application.applicant
    linked_employee = find_employee_for_email(application.email)
    defaults = {
        "employee": linked_employee,
        "first_name": application.first_name,
        "last_name": application.last_name,
        "email": application.email,
        "phone": application.phone,
        "whatsapp": application.whatsapp,
        "location": ", ".join(part for part in [application.city, application.state, application.country] if part),
        "source": application.source_channel,
        "application_source": application.source_channel,
        "stage": application.stage if application.stage in dict(RecruitmentCandidate.STAGE_CHOICES) else RecruitmentCandidate.STAGE_APPLIED,
        "notice_period_days": application.notice_period_days,
        "owner_name": job.hiring_manager,
        "current_company": application.current_company,
        "current_title": application.current_title,
        "linkedin_url": application.linkedin_url,
        "portfolio_url": application.portfolio_url,
        "resume_url": application.resume_url,
        "preferred_contact_channel": "whatsapp" if application.whatsapp else "email",
        "summary": application.cover_letter,
        "applied_on": application.submitted_at.date() if application.submitted_at else timezone.now().date(),
        "stage_updated_at": timezone.now(),
    }
    candidate = application.candidate
    if candidate is None:
        candidate = RecruitmentCandidate.objects.filter(job=job, email__iexact=application.email).first()
    if candidate is None:
        candidate = RecruitmentCandidate.objects.create(
            job=job,
            applicant=applicant,
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
            **defaults,
        )
        sync_candidate_employee_link(candidate)
        record_candidate_timeline(
            candidate,
            event_type=CandidateTimelineEvent.EVENT_APPLIED,
            title="Candidate entered via careers portal",
            description=f"Applied for {job.title}",
            stage=candidate.stage,
            actor=actor,
            application=application,
            metadata={"source_channel": application.source_channel},
        )
    else:
        for attr, value in defaults.items():
            setattr(candidate, attr, value)
        candidate.applicant = applicant
        candidate.save()
        sync_candidate_employee_link(candidate)
        record_candidate_timeline(
            candidate,
            event_type=CandidateTimelineEvent.EVENT_NOTE,
            title="Application refreshed",
            description="Applicant updated their public application details.",
            stage=candidate.stage,
            actor=actor,
            application=application,
        )
    application.candidate = candidate
    application.save(update_fields=["candidate", "last_activity_at", "updated_at"])
    return candidate


@transaction.atomic
def update_application_stage_from_candidate(candidate: RecruitmentCandidate):
    sync_candidate_employee_link(candidate)
    application = getattr(candidate, "application_record", None)
    if not application:
        return
    stage = candidate.stage
    if stage == RecruitmentCandidate.STAGE_JOINED:
        application.stage = JobApplication.STAGE_JOINED
        ensure_onboarding_record(candidate)
    elif stage == RecruitmentCandidate.STAGE_REJECTED:
        application.stage = JobApplication.STAGE_REJECTED
    elif stage == RecruitmentCandidate.STAGE_OFFER:
        application.stage = JobApplication.STAGE_OFFER
    elif stage == RecruitmentCandidate.STAGE_INTERVIEW:
        application.stage = JobApplication.STAGE_INTERVIEW
    elif stage == RecruitmentCandidate.STAGE_SCREENING:
        application.stage = JobApplication.STAGE_SCREENING
    else:
        application.stage = JobApplication.STAGE_APPLIED
    application.save(update_fields=["stage", "last_activity_at", "updated_at"])


def sync_generic_resource(resource: Resource, actor=None):
    if resource.resource_type == "leave-employee":
        sync_leave_request_resource(resource, actor=actor)
    elif resource.resource_type in {"resignations", "terminations"}:
        sync_offboarding_from_resource(resource, actor=actor)
    elif resource.resource_type == "tickets":
        sync_ticket_notifications(resource, actor=actor)
    elif resource.resource_type == "training-sessions":
        sync_training_notifications(resource, actor=actor)
    elif resource.resource_type == "employee-salaries":
        sync_payroll_notifications(resource, actor=actor)

def cleanup_resource_artifacts(resource: Resource):
    if resource.resource_type != "leave-employee":
        return

    related_entries = LeaveLedgerEntry.objects.filter(related_resource_id=str(resource.id)).select_related("balance")
    balance_ids = list(related_entries.values_list("balance_id", flat=True).distinct())
    related_entries.delete()
    for balance in LeaveBalance.objects.filter(id__in=balance_ids):
        recalculate_leave_balance(balance)
