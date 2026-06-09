from decimal import Decimal

from django.conf import settings
from django.db import models

from employees.models import Employee


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    notification_type = models.CharField(max_length=80, db_index=True)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    target_url = models.CharField(max_length=255, blank=True)
    reference_type = models.CharField(max_length=80, blank=True)
    reference_id = models.CharField(max_length=80, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.recipient_id}:{self.notification_type}:{self.title}"


class LeaveBalance(models.Model):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_balances",
    )
    leave_type = models.CharField(max_length=80, db_index=True)
    year = models.PositiveIntegerField(db_index=True)
    annual_allocation = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    carry_forward = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    credited = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    used = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    pending = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    adjusted = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_id", "leave_type", "-year"]
        unique_together = ("employee", "leave_type", "year")

    @property
    def available(self) -> Decimal:
        return (
            Decimal(self.annual_allocation or 0)
            + Decimal(self.carry_forward or 0)
            + Decimal(self.credited or 0)
            + Decimal(self.adjusted or 0)
            - Decimal(self.used or 0)
            - Decimal(self.pending or 0)
        )

    def __str__(self) -> str:
        return f"{self.employee_id}:{self.leave_type}:{self.year}"


class LeaveLedgerEntry(models.Model):
    ENTRY_ALLOCATION = "allocation"
    ENTRY_CARRY_FORWARD = "carry_forward"
    ENTRY_PENDING_HOLD = "pending_hold"
    ENTRY_PENDING_RELEASE = "pending_release"
    ENTRY_APPROVED_DEBIT = "approved_debit"
    ENTRY_ADJUSTMENT = "adjustment"
    ENTRY_TYPES = (
        (ENTRY_ALLOCATION, "Allocation"),
        (ENTRY_CARRY_FORWARD, "Carry Forward"),
        (ENTRY_PENDING_HOLD, "Pending Hold"),
        (ENTRY_PENDING_RELEASE, "Pending Release"),
        (ENTRY_APPROVED_DEBIT, "Approved Debit"),
        (ENTRY_ADJUSTMENT, "Adjustment"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_ledger_entries",
    )
    balance = models.ForeignKey(
        LeaveBalance,
        on_delete=models.CASCADE,
        related_name="ledger_entries",
    )
    leave_type = models.CharField(max_length=80, db_index=True)
    entry_type = models.CharField(max_length=40, choices=ENTRY_TYPES, db_index=True)
    days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    related_resource_id = models.CharField(max_length=80, blank=True, db_index=True)
    description = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_ledger_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.employee_id}:{self.leave_type}:{self.entry_type}:{self.days}"


class ShiftDefinition(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=40, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_in_minutes = models.PositiveIntegerField(default=15)
    grace_out_minutes = models.PositiveIntegerField(default=15)
    standard_hours = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    overtime_threshold_hours = models.DecimalField(max_digits=5, decimal_places=2, default=8.5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TimesheetEntry(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="timesheet_entries",
    )
    shift = models.ForeignKey(
        ShiftDefinition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timesheet_entries",
    )
    work_date = models.DateField(db_index=True)
    project_name = models.CharField(max_length=160, blank=True)
    task_summary = models.TextField(blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)
    hours_worked = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    payroll_impact_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    late_minutes = models.PositiveIntegerField(default=0)
    early_exit_minutes = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    notes = models.TextField(blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_timesheets",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_timesheets",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-work_date", "-updated_at"]

    def __str__(self) -> str:
        return f"{self.employee_id}:{self.work_date}:{self.status}"


class OvertimeEntry(models.Model):
    STATUS_REQUESTED = "requested"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PAID = "paid"
    STATUS_CHOICES = (
        (STATUS_REQUESTED, "Requested"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PAID, "Paid"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="overtime_entries",
    )
    linked_timesheet = models.ForeignKey(
        TimesheetEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="overtime_entries",
    )
    work_date = models.DateField(db_index=True)
    hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    payroll_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_REQUESTED, db_index=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_overtime_entries",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-work_date", "-updated_at"]

    def __str__(self) -> str:
        return f"{self.employee_id}:{self.work_date}:{self.hours}"


class AssetCategory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class AssetAssignment(models.Model):
    STATUS_AVAILABLE = "available"
    STATUS_ASSIGNED = "assigned"
    STATUS_RETURN_REQUESTED = "return_requested"
    STATUS_RETURNED = "returned"
    STATUS_LOST = "lost"
    STATUS_CHOICES = (
        (STATUS_AVAILABLE, "Available"),
        (STATUS_ASSIGNED, "Assigned"),
        (STATUS_RETURN_REQUESTED, "Return Requested"),
        (STATUS_RETURNED, "Returned"),
        (STATUS_LOST, "Lost"),
    )

    asset_name = models.CharField(max_length=160)
    asset_code = models.CharField(max_length=80, unique=True, db_index=True)
    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    assigned_to = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_assets",
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_AVAILABLE, db_index=True)
    assigned_on = models.DateField(null=True, blank=True)
    due_return_on = models.DateField(null=True, blank=True)
    returned_on = models.DateField(null=True, blank=True)
    return_condition = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_assets",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_assets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["asset_name", "asset_code"]

    def __str__(self) -> str:
        return f"{self.asset_name} ({self.asset_code})"


class DocumentCategory(models.Model):
    VISIBILITY_EMPLOYEE = "employee"
    VISIBILITY_HR = "hr"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = (
        (VISIBILITY_EMPLOYEE, "Employee Visible"),
        (VISIBILITY_HR, "HR Only"),
        (VISIBILITY_PRIVATE, "Private"),
    )

    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=40, unique=True)
    description = models.TextField(blank=True)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default=VISIBILITY_EMPLOYEE)
    is_active = models.BooleanField(default=True)
    is_mandatory = models.BooleanField(default=False)
    requires_expiry = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class EmployeeDocument(models.Model):
    STATUS_PENDING = "pending"
    STATUS_VERIFIED = "verified"
    STATUS_REJECTED = "rejected"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending Review"),
        (STATUS_VERIFIED, "Verified"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_EXPIRED, "Expired"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    category = models.ForeignKey(
        DocumentCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )
    title = models.CharField(max_length=160)
    file_name = models.CharField(max_length=160, blank=True)
    document_url = models.URLField(blank=True)
    document_number = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_employee_documents",
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_employee_documents",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "title", "-updated_at"]

    def __str__(self) -> str:
        return f"{self.employee_id}:{self.title}"


class OffboardingCase(models.Model):
    SOURCE_RESIGNATION = "resignation"
    SOURCE_TERMINATION = "termination"
    SOURCE_CHOICES = (
        (SOURCE_RESIGNATION, "Resignation"),
        (SOURCE_TERMINATION, "Termination"),
    )
    STATUS_DRAFT = "draft"
    STATUS_IN_REVIEW = "in_review"
    STATUS_APPROVED = "approved"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_IN_REVIEW, "In Review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_COMPLETED, "Completed"),
    )
    CLEARANCE_PENDING = "pending"
    CLEARANCE_CLEARED = "cleared"
    CLEARANCE_NOT_REQUIRED = "not_required"
    CLEARANCE_CHOICES = (
        (CLEARANCE_PENDING, "Pending"),
        (CLEARANCE_CLEARED, "Cleared"),
        (CLEARANCE_NOT_REQUIRED, "Not Required"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="offboarding_cases",
    )
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    source_resource_id = models.CharField(max_length=80, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    initiated_on = models.DateField()
    last_working_day = models.DateField(null=True, blank=True)
    deactivate_employee = models.BooleanField(default=True)
    block_login = models.BooleanField(default=True)
    asset_return_status = models.CharField(
        max_length=20,
        choices=CLEARANCE_CHOICES,
        default=CLEARANCE_PENDING,
    )
    final_payroll_status = models.CharField(max_length=30, default="pending")
    checklist = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_offboarding_cases",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-initiated_on", "-updated_at"]
        unique_together = ("employee", "source_type", "source_resource_id")

    def __str__(self) -> str:
        return f"{self.employee_id}:{self.source_type}:{self.status}"


class ApplicantAccount(models.Model):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True, default="India")
    headline = models.CharField(max_length=180, blank=True)
    preferred_role = models.CharField(max_length=160, blank=True)
    current_company = models.CharField(max_length=160, blank=True)
    current_title = models.CharField(max_length=160, blank=True)
    years_experience = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    linkedin_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    resume_url = models.URLField(blank=True)
    summary = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["email"]

    def __str__(self) -> str:
        return self.email


class ApplicantLoginCode(models.Model):
    applicant = models.ForeignKey(
        ApplicantAccount,
        on_delete=models.CASCADE,
        related_name="login_codes",
    )
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.applicant.email}:{self.code}"


class ApplicantSession(models.Model):
    applicant = models.ForeignKey(
        ApplicantAccount,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    token = models.CharField(max_length=120, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.applicant.email}:{self.token[:8]}"


class AuditLog(models.Model):
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    actor_email = models.EmailField(blank=True)
    scope = models.CharField(max_length=80, db_index=True)
    action = models.CharField(max_length=80, db_index=True)
    target_type = models.CharField(max_length=80, db_index=True)
    target_id = models.CharField(max_length=80, blank=True, db_index=True)
    summary = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.scope}:{self.action}:{self.target_type}:{self.target_id}"


class OnboardingTemplate(models.Model):
    name = models.CharField(max_length=160, unique=True)
    department_name = models.CharField(max_length=120, blank=True)
    role_name = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    tasks = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_templates_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class OnboardingRecord(models.Model):
    STATUS_PLANNED = "planned"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_BLOCKED = "blocked"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = (
        (STATUS_PLANNED, "Planned"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_BLOCKED, "Blocked"),
        (STATUS_COMPLETED, "Completed"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_records",
    )
    candidate = models.ForeignKey(
        "RecruitmentCandidate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_records",
    )
    template = models.ForeignKey(
        OnboardingTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_onboarding_records",
    )
    title = models.CharField(max_length=180)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PLANNED, db_index=True)
    target_joining_date = models.DateField(null=True, blank=True)
    started_on = models.DateField(null=True, blank=True)
    completed_on = models.DateField(null=True, blank=True)
    progress_percentage = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "title"]

    def __str__(self) -> str:
        return self.title


class OnboardingTask(models.Model):
    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_BLOCKED = "blocked"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_BLOCKED, "Blocked"),
    )

    record = models.ForeignKey(
        OnboardingRecord,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    title = models.CharField(max_length=180)
    task_type = models.CharField(max_length=80, blank=True, default="general")
    sort_order = models.PositiveIntegerField(default=0)
    due_date = models.DateField(null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="onboarding_tasks",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_onboarding_tasks",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "due_date", "title"]

    def __str__(self) -> str:
        return f"{self.record_id}:{self.title}"


class RecruitmentJob(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_OPEN = "open"
    STATUS_ON_HOLD = "on_hold"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_OPEN, "Open"),
        (STATUS_ON_HOLD, "On Hold"),
        (STATUS_CLOSED, "Closed"),
    )

    title = models.CharField(max_length=160)
    public_slug = models.SlugField(max_length=190, blank=True, db_index=True)
    department_name = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True, default="India")
    work_mode = models.CharField(max_length=60, blank=True, default="Hybrid")
    employment_type = models.CharField(max_length=60, default="Full-Time")
    openings = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    is_public = models.BooleanField(default=False, db_index=True)
    hiring_manager = models.CharField(max_length=120, blank=True)
    experience_band = models.CharField(max_length=120, blank=True)
    experience_min_years = models.PositiveIntegerField(default=0)
    experience_max_years = models.PositiveIntegerField(default=0)
    salary_min = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    salary_max = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    posted_on = models.DateField(null=True, blank=True)
    closing_on = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)
    benefits = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_jobs_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "title"]

    def save(self, *args, **kwargs):
        if not self.public_slug:
            base_slug = (self.title or "job-opening").strip().lower().replace(" ", "-")
            self.public_slug = base_slug[:190]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.title


class RecruitmentCandidate(models.Model):
    STAGE_APPLIED = "applied"
    STAGE_SCREENING = "screening"
    STAGE_INTERVIEW = "interview"
    STAGE_OFFER = "offer"
    STAGE_JOINED = "joined"
    STAGE_REJECTED = "rejected"
    STAGE_CHOICES = (
        (STAGE_APPLIED, "Applied"),
        (STAGE_SCREENING, "Screening"),
        (STAGE_INTERVIEW, "Interview"),
        (STAGE_OFFER, "Offer"),
        (STAGE_JOINED, "Joined"),
        (STAGE_REJECTED, "Rejected"),
    )

    job = models.ForeignKey(
        RecruitmentJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="candidates",
    )
    applicant = models.ForeignKey(
        ApplicantAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="candidate_profiles",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_candidates",
    )
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    location = models.CharField(max_length=160, blank=True)
    source = models.CharField(max_length=120, blank=True)
    application_source = models.CharField(max_length=80, blank=True, default="internal")
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default=STAGE_APPLIED, db_index=True)
    score = models.PositiveIntegerField(default=0)
    notice_period_days = models.PositiveIntegerField(default=0)
    owner_name = models.CharField(max_length=120, blank=True)
    current_company = models.CharField(max_length=160, blank=True)
    current_title = models.CharField(max_length=160, blank=True)
    linkedin_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    resume_url = models.URLField(blank=True)
    preferred_contact_channel = models.CharField(max_length=40, blank=True, default="email")
    last_contacted_at = models.DateTimeField(null=True, blank=True)
    stage_updated_at = models.DateTimeField(null=True, blank=True)
    summary = models.TextField(blank=True)
    applied_on = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_candidates_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "first_name", "last_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class RecruitmentReferral(models.Model):
    STATUS_NEW = "new"
    STATUS_REVIEWING = "reviewing"
    STATUS_ACCEPTED = "accepted"
    STATUS_CONVERTED = "converted"
    STATUS_DECLINED = "declined"
    STATUS_CHOICES = (
        (STATUS_NEW, "New"),
        (STATUS_REVIEWING, "Reviewing"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_CONVERTED, "Converted"),
        (STATUS_DECLINED, "Declined"),
    )

    job = models.ForeignKey(
        RecruitmentJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="referrals",
    )
    candidate_name = models.CharField(max_length=160)
    candidate_email = models.EmailField(blank=True)
    referrer_name = models.CharField(max_length=160)
    referrer_email = models.EmailField(blank=True)
    reward_status = models.CharField(max_length=80, default="pending")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW, db_index=True)
    notes = models.TextField(blank=True)
    referred_on = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_referrals_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "candidate_name"]

    def __str__(self) -> str:
        return self.candidate_name


class JobApplication(models.Model):
    STAGE_APPLIED = "applied"
    STAGE_SCREENING = "screening"
    STAGE_INTERVIEW = "interview"
    STAGE_OFFER = "offer"
    STAGE_JOINED = "joined"
    STAGE_REJECTED = "rejected"
    STAGE_WITHDRAWN = "withdrawn"
    STAGE_CHOICES = (
        (STAGE_APPLIED, "Applied"),
        (STAGE_SCREENING, "Screening"),
        (STAGE_INTERVIEW, "Interview"),
        (STAGE_OFFER, "Offer"),
        (STAGE_JOINED, "Joined"),
        (STAGE_REJECTED, "Rejected"),
        (STAGE_WITHDRAWN, "Withdrawn"),
    )

    applicant = models.ForeignKey(
        ApplicantAccount,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    job = models.ForeignKey(
        RecruitmentJob,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    candidate = models.OneToOneField(
        RecruitmentCandidate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="application_record",
    )
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default=STAGE_APPLIED, db_index=True)
    source_channel = models.CharField(max_length=80, blank=True, default="careers_portal")
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True, default="India")
    current_company = models.CharField(max_length=160, blank=True)
    current_title = models.CharField(max_length=160, blank=True)
    years_experience = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    notice_period_days = models.PositiveIntegerField(default=0)
    expected_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    linkedin_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    resume_url = models.URLField(blank=True)
    cover_letter = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)
    consent_to_contact = models.BooleanField(default=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at"]
        unique_together = ("applicant", "job")

    def __str__(self) -> str:
        return f"{self.email}:{self.job_id}"


class CandidateTimelineEvent(models.Model):
    EVENT_APPLIED = "applied"
    EVENT_STAGE = "stage_changed"
    EVENT_CONTACT = "contacted"
    EVENT_INTERVIEW = "interview"
    EVENT_NOTE = "note"
    EVENT_CHOICES = (
        (EVENT_APPLIED, "Applied"),
        (EVENT_STAGE, "Stage Changed"),
        (EVENT_CONTACT, "Contacted"),
        (EVENT_INTERVIEW, "Interview"),
        (EVENT_NOTE, "Note"),
    )

    candidate = models.ForeignKey(
        RecruitmentCandidate,
        on_delete=models.CASCADE,
        related_name="timeline_events",
    )
    application = models.ForeignKey(
        JobApplication,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timeline_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="candidate_timeline_events",
    )
    event_type = models.CharField(max_length=30, choices=EVENT_CHOICES, db_index=True)
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    stage = models.CharField(max_length=20, blank=True)
    channel = models.CharField(max_length=40, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.candidate_id}:{self.event_type}:{self.title}"


class RecruitmentInterview(models.Model):
    STATUS_SCHEDULED = "scheduled"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_NO_SHOW = "no_show"
    STATUS_CHOICES = (
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_NO_SHOW, "No Show"),
    )

    TYPE_SCREENING = "screening"
    TYPE_TECHNICAL = "technical"
    TYPE_MANAGERIAL = "managerial"
    TYPE_BEHAVIORAL = "behavioral"
    TYPE_HR = "hr"
    TYPE_FINAL = "final"
    TYPE_CHOICES = (
        (TYPE_SCREENING, "Screening"),
        (TYPE_TECHNICAL, "Technical"),
        (TYPE_MANAGERIAL, "Managerial"),
        (TYPE_BEHAVIORAL, "Behavioral"),
        (TYPE_HR, "HR"),
        (TYPE_FINAL, "Final"),
    )

    DECISION_STRONG_HIRE = "strong_hire"
    DECISION_HIRE = "hire"
    DECISION_HOLD = "hold"
    DECISION_REJECT = "reject"
    DECISION_CHOICES = (
        (DECISION_STRONG_HIRE, "Strong Hire"),
        (DECISION_HIRE, "Hire"),
        (DECISION_HOLD, "Hold"),
        (DECISION_REJECT, "Reject"),
    )

    candidate = models.ForeignKey(
        RecruitmentCandidate,
        on_delete=models.CASCADE,
        related_name="interviews",
    )
    application = models.ForeignKey(
        JobApplication,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interviews",
    )
    job = models.ForeignKey(
        RecruitmentJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interviews",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_interviews",
    )
    round_name = models.CharField(max_length=120, blank=True)
    interview_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default=TYPE_SCREENING, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SCHEDULED, db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    mode = models.CharField(max_length=40, blank=True, default="virtual")
    location_or_link = models.CharField(max_length=255, blank=True)
    duration_minutes = models.PositiveIntegerField(default=45)
    taken_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interviews_taken",
    )
    taken_by_role = models.CharField(max_length=30, blank=True)
    panel_members = models.JSONField(default=list, blank=True)
    discussion_topics = models.JSONField(default=list, blank=True)
    score = models.PositiveIntegerField(default=0)
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, default=DECISION_HOLD, db_index=True)
    feedback_summary = models.TextField(blank=True)
    strengths = models.TextField(blank=True)
    concerns = models.TextField(blank=True)
    salary_discussed = models.BooleanField(default=False)
    salary_expectation = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    salary_offered = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    final_ctc_recommended = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    negotiation_notes = models.TextField(blank=True)
    next_step = models.CharField(max_length=180, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_interviews_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recruitment_interviews_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_for", "-updated_at"]

    def __str__(self) -> str:
        return f"{self.candidate_id}:{self.round_name or self.interview_type}"


class ProductivityNote(models.Model):
    TONE_AMBER = "amber"
    TONE_CORAL = "coral"
    TONE_OCEAN = "ocean"
    TONE_MINT = "mint"
    TONE_VIOLET = "violet"
    TONE_CHOICES = (
        (TONE_AMBER, "Amber"),
        (TONE_CORAL, "Coral"),
        (TONE_OCEAN, "Ocean"),
        (TONE_MINT, "Mint"),
        (TONE_VIOLET, "Violet"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="productivity_notes",
    )
    title = models.CharField(max_length=180)
    category = models.CharField(max_length=80, blank=True)
    tone = models.CharField(max_length=20, choices=TONE_CHOICES, default=TONE_AMBER)
    tags = models.JSONField(default=list, blank=True)
    blocks = models.JSONField(default=list, blank=True)
    checklist = models.JSONField(default=list, blank=True)
    table_data = models.JSONField(default=dict, blank=True)
    reminder_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_pinned = models.BooleanField(default=False, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-updated_at"]

    def __str__(self) -> str:
        return self.title


class ProductivityTodo(models.Model):
    STATUS_TODO = "todo"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_WAITING = "waiting"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = (
        (STATUS_TODO, "To Do"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_WAITING, "Waiting"),
        (STATUS_COMPLETED, "Completed"),
    )

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_URGENT = "urgent"
    PRIORITY_CHOICES = (
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_URGENT, "Urgent"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="productivity_todos",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_TODO, db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM, db_index=True)
    checklist = models.JSONField(default=list, blank=True)
    labels = models.JSONField(default=list, blank=True)
    linked_url = models.CharField(max_length=255, blank=True)
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "due_at", "-updated_at"]

    def __str__(self) -> str:
        return self.title


class ReminderEvent(models.Model):
    TYPE_EVENT = "event"
    TYPE_REMINDER = "reminder"
    TYPE_MEETING = "meeting"
    TYPE_INTERVIEW = "interview"
    TYPE_PAYROLL = "payroll"
    TYPE_CHOICES = (
        (TYPE_EVENT, "Event"),
        (TYPE_REMINDER, "Reminder"),
        (TYPE_MEETING, "Meeting"),
        (TYPE_INTERVIEW, "Interview"),
        (TYPE_PAYROLL, "Payroll"),
    )

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_URGENT = "urgent"
    PRIORITY_CHOICES = (
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_URGENT, "Urgent"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reminder_events",
    )
    title = models.CharField(max_length=180)
    event_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_EVENT, db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM, db_index=True)
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    remind_before_minutes = models.PositiveIntegerField(default=30)
    location = models.CharField(max_length=180, blank=True)
    attendees = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    target_url = models.CharField(max_length=255, blank=True)
    is_completed = models.BooleanField(default=False, db_index=True)
    banner_dismissed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at", "-priority"]

    def __str__(self) -> str:
        return self.title


class ExpenseClaim(models.Model):
    STATUS_DRAFT = "Draft"
    STATUS_PENDING = "Pending"
    STATUS_APPROVED = "Approved"
    STATUS_REJECTED = "Rejected"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    )

    CATEGORY_TRAVEL = "Travel"
    CATEGORY_FOOD = "Food"
    CATEGORY_CLIENT = "Client"
    CATEGORY_SOFTWARE = "Software"
    CATEGORY_OTHER = "Other"
    CATEGORY_CHOICES = (
        (CATEGORY_TRAVEL, "Travel"),
        (CATEGORY_FOOD, "Food"),
        (CATEGORY_CLIENT, "Client"),
        (CATEGORY_SOFTWARE, "Software"),
        (CATEGORY_OTHER, "Other"),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="expense_claims",
    )
    title = models.CharField(max_length=150)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default=CATEGORY_OTHER)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    claim_date = models.DateField(db_index=True)
    receipt_file = models.FileField(upload_to="receipts/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    reviewer_note = models.TextField(blank=True)
    processed_in_payroll = models.ForeignKey(
        "payroll.EmployeePayroll",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expense_claims",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-claim_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.employee.first_name} - {self.title} ({self.amount})"


class DocumentEsign(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="esign_documents/")
    distribution_type = models.CharField(max_length=20, default="all")  # "all", "department", "role"
    target_department = models.ForeignKey(
        "employees.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    target_role = models.CharField(max_length=60, blank=True, null=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class DocumentSignature(models.Model):
    document = models.ForeignKey(
        DocumentEsign,
        on_delete=models.CASCADE,
        related_name="signatures",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="esign_signatures",
    )
    status = models.CharField(max_length=20, default="pending")  # "pending", "signed"
    signed_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.CharField(max_length=45, blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.employee.first_name} - {self.document.title} ({self.status})"
