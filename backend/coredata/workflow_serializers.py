from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from employees.models import Employee

from .models import (
    ApplicantAccount,
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
    ShiftDefinition,
    TimesheetEntry,
)

User = get_user_model()


class EmployeeMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    designation_title = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "emp_code",
            "full_name",
            "email",
            "phone",
            "department_name",
            "designation_title",
            "salary",
            "is_active",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name or ''}".strip()

    def get_department_name(self, obj):
        return obj.department.name if obj.department else ""

    def get_designation_title(self, obj):
        return obj.designation.title if obj.designation else ""


class UserMiniSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "display_name", "last_seen_at"]

    def get_display_name(self, obj):
        return obj.get_display_name()


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserMiniSerializer(read_only=True)
    recipient = UserMiniSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "body",
            "target_url",
            "reference_type",
            "reference_id",
            "metadata",
            "is_read",
            "read_at",
            "actor",
            "recipient",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "actor",
            "recipient",
            "created_at",
            "read_at",
        ]


class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        write_only=True,
        required=False,
    )
    available = serializers.SerializerMethodField()

    class Meta:
        model = LeaveBalance
        fields = [
            "id",
            "employee",
            "employee_id",
            "leave_type",
            "year",
            "annual_allocation",
            "carry_forward",
            "credited",
            "used",
            "pending",
            "adjusted",
            "available",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_available(self, obj):
        return obj.available


class LeaveLedgerEntrySerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    balance_id = serializers.PrimaryKeyRelatedField(
        source="balance",
        queryset=LeaveBalance.objects.all(),
        write_only=True,
        required=False,
    )
    created_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = LeaveLedgerEntry
        fields = [
            "id",
            "employee",
            "balance_id",
            "leave_type",
            "entry_type",
            "days",
            "related_resource_id",
            "description",
            "metadata",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["created_at", "created_by", "employee"]


class ShiftDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftDefinition
        fields = "__all__"


class TimesheetEntrySerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        write_only=True,
        required=False,
    )
    shift_detail = ShiftDefinitionSerializer(source="shift", read_only=True)
    shift_id = serializers.PrimaryKeyRelatedField(
        source="shift",
        queryset=ShiftDefinition.objects.all(),
        write_only=True,
        allow_null=True,
        required=False,
    )
    submitted_by = UserMiniSerializer(read_only=True)
    approved_by = UserMiniSerializer(read_only=True)
    settlement_summary = serializers.SerializerMethodField()

    class Meta:
        model = TimesheetEntry
        fields = [
            "id",
            "employee",
            "employee_id",
            "shift_detail",
            "shift_id",
            "work_date",
            "project_name",
            "task_summary",
            "start_time",
            "end_time",
            "break_minutes",
            "hours_worked",
            "payroll_impact_hours",
            "late_minutes",
            "early_exit_minutes",
            "status",
            "notes",
            "submitted_by",
            "approved_by",
            "settlement_summary",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "hours_worked",
            "payroll_impact_hours",
            "late_minutes",
            "early_exit_minutes",
            "submitted_by",
            "approved_by",
            "settlement_summary",
            "approved_at",
            "created_at",
            "updated_at",
            "employee",
            "shift_detail",
        ]

    def get_settlement_summary(self, obj):
        return {
            "hours_worked": obj.hours_worked,
            "payroll_impact_hours": obj.payroll_impact_hours,
            "late_minutes": obj.late_minutes,
            "early_exit_minutes": obj.early_exit_minutes,
        }

    def validate(self, attrs):
        start_time = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end_time = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError("End time must be after start time.")
        return attrs


class OvertimeEntrySerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        write_only=True,
        required=False,
    )
    linked_timesheet_id = serializers.PrimaryKeyRelatedField(
        source="linked_timesheet",
        queryset=TimesheetEntry.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    approved_by = UserMiniSerializer(read_only=True)
    settlement_summary = serializers.SerializerMethodField()

    class Meta:
        model = OvertimeEntry
        fields = [
            "id",
            "employee",
            "employee_id",
            "linked_timesheet_id",
            "work_date",
            "hours",
            "payroll_amount",
            "reason",
            "notes",
            "status",
            "approved_by",
            "settlement_summary",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "payroll_amount",
            "approved_by",
            "settlement_summary",
            "approved_at",
            "created_at",
            "updated_at",
            "employee",
        ]


    def get_settlement_summary(self, obj):
        return {
            "hours": obj.hours,
            "payroll_amount": obj.payroll_amount,
            "status": obj.status,
        }


class AssetCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetCategory
        fields = "__all__"


class AssetAssignmentSerializer(serializers.ModelSerializer):
    category = AssetCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=AssetCategory.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    assigned_to = EmployeeMiniSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=Employee.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    issued_by = UserMiniSerializer(read_only=True)
    updated_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = AssetAssignment
        fields = [
            "id",
            "asset_name",
            "asset_code",
            "category",
            "category_id",
            "assigned_to",
            "assigned_to_id",
            "status",
            "assigned_on",
            "due_return_on",
            "returned_on",
            "return_condition",
            "notes",
            "issued_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["issued_by", "updated_by", "created_at", "updated_at", "category", "assigned_to"]


class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = "__all__"


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        write_only=True,
        required=False,
    )
    category = DocumentCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=DocumentCategory.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    uploaded_by = UserMiniSerializer(read_only=True)
    verified_by = UserMiniSerializer(read_only=True)
    expiring_soon = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeDocument
        fields = [
            "id",
            "employee",
            "employee_id",
            "category",
            "category_id",
            "title",
            "file_name",
            "document_url",
            "document_number",
            "status",
            "issued_on",
            "expires_on",
            "notes",
            "metadata",
            "uploaded_by",
            "verified_by",
            "verified_at",
            "expiring_soon",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "employee",
            "category",
            "uploaded_by",
            "verified_by",
            "verified_at",
            "expiring_soon",
            "created_at",
            "updated_at",
        ]

    def get_expiring_soon(self, obj):
        if not obj.expires_on:
            return False
        return (obj.expires_on - datetime.now().date()).days <= 30


class OnboardingTemplateSerializer(serializers.ModelSerializer):
    created_by = UserMiniSerializer(read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingTemplate
        fields = [
            "id",
            "name",
            "department_name",
            "role_name",
            "description",
            "tasks",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
            "task_count",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at", "task_count"]

    def get_task_count(self, obj):
        return len(obj.tasks or [])


class OnboardingTaskSerializer(serializers.ModelSerializer):
    assigned_to = UserMiniSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    completed_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = OnboardingTask
        fields = [
            "id",
            "record",
            "title",
            "task_type",
            "sort_order",
            "due_date",
            "assigned_to",
            "assigned_to_id",
            "status",
            "notes",
            "metadata",
            "completed_by",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "completed_by",
            "completed_at",
            "created_at",
            "updated_at",
            "assigned_to",
        ]


class OnboardingRecordSerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        write_only=True,
        allow_null=True,
        required=False,
    )
    candidate = serializers.SerializerMethodField()
    candidate_id = serializers.PrimaryKeyRelatedField(
        source="candidate",
        queryset=RecruitmentCandidate.objects.all(),
        write_only=True,
        allow_null=True,
        required=False,
    )
    template = OnboardingTemplateSerializer(read_only=True)
    template_id = serializers.PrimaryKeyRelatedField(
        source="template",
        queryset=OnboardingTemplate.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    owner = UserMiniSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        source="owner",
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    tasks_preview = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingRecord
        fields = [
            "id",
            "title",
            "employee",
            "employee_id",
            "candidate",
            "candidate_id",
            "template",
            "template_id",
            "owner",
            "owner_id",
            "status",
            "target_joining_date",
            "started_on",
            "completed_on",
            "progress_percentage",
            "notes",
            "tasks_preview",
            "totals",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "employee",
            "candidate",
            "template",
            "owner",
            "tasks_preview",
            "totals",
            "created_at",
            "updated_at",
        ]

    def get_candidate(self, obj):
        if not obj.candidate:
            return None
        return {
            "id": obj.candidate_id,
            "full_name": f"{obj.candidate.first_name} {obj.candidate.last_name or ''}".strip(),
            "stage": obj.candidate.stage,
            "job_title": obj.candidate.job.title if obj.candidate.job else "",
        }

    def get_tasks_preview(self, obj):
        preview = list(obj.tasks.all()[:4]) if hasattr(obj, "tasks") else []
        return OnboardingTaskSerializer(preview, many=True).data

    def get_totals(self, obj):
        tasks = list(obj.tasks.all()) if hasattr(obj, "tasks") else []
        total = len(tasks)
        completed = len([item for item in tasks if item.status == OnboardingTask.STATUS_COMPLETED])
        blocked = len([item for item in tasks if item.status == OnboardingTask.STATUS_BLOCKED])
        return {
            "total": total,
            "completed": completed,
            "blocked": blocked,
        }


class OffboardingCaseSerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        write_only=True,
        required=False,
    )
    approved_by = UserMiniSerializer(read_only=True)
    settlement_summary = serializers.SerializerMethodField()

    class Meta:
        model = OffboardingCase
        fields = [
            "id",
            "employee",
            "employee_id",
            "source_type",
            "source_resource_id",
            "status",
            "initiated_on",
            "last_working_day",
            "deactivate_employee",
            "block_login",
            "asset_return_status",
            "final_payroll_status",
            "checklist",
            "notes",
            "approved_by",
            "settlement_summary",
            "approved_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["approved_by", "settlement_summary", "approved_at", "completed_at", "created_at", "updated_at", "employee"]

    def get_settlement_summary(self, obj):
        settlement = getattr(obj, "settlement", None)
        if not settlement:
            return None
        return {
            "id": settlement.id,
            "status": settlement.status,
            "final_payable": settlement.final_payable,
            "last_working_day": settlement.last_working_day,
        }


class ApplicantAccountSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicantAccount
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "whatsapp",
            "city",
            "state",
            "country",
            "headline",
            "preferred_role",
            "current_company",
            "current_title",
            "years_experience",
            "linkedin_url",
            "portfolio_url",
            "resume_url",
            "summary",
            "is_active",
            "last_login_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["email", "is_active", "last_login_at", "created_at", "updated_at", "full_name"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name or ''}".strip() or obj.email


class CandidateTimelineEventSerializer(serializers.ModelSerializer):
    actor = UserMiniSerializer(read_only=True)

    class Meta:
        model = CandidateTimelineEvent
        fields = [
            "id",
            "event_type",
            "title",
            "description",
            "stage",
            "channel",
            "metadata",
            "actor",
            "created_at",
        ]
        read_only_fields = fields


class RecruitmentJobSerializer(serializers.ModelSerializer):
    created_by = UserMiniSerializer(read_only=True)
    application_count = serializers.SerializerMethodField()
    public_path = serializers.SerializerMethodField()
    share_links = serializers.SerializerMethodField()

    class Meta:
        model = RecruitmentJob
        fields = [
            "id",
            "title",
            "public_slug",
            "department_name",
            "location",
            "city",
            "state",
            "country",
            "work_mode",
            "employment_type",
            "openings",
            "status",
            "is_public",
            "hiring_manager",
            "experience_band",
            "experience_min_years",
            "experience_max_years",
            "salary_min",
            "salary_max",
            "posted_on",
            "closing_on",
            "description",
            "skills",
            "benefits",
            "created_by",
            "created_at",
            "updated_at",
            "application_count",
            "public_path",
            "share_links",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at", "application_count", "public_path", "share_links"]

    def get_application_count(self, obj):
        annotated = getattr(obj, "applications_count", None)
        if annotated is not None:
            return annotated
        if hasattr(obj, "applications"):
            return obj.applications.count()
        return 0

    def get_public_path(self, obj):
        slug = obj.public_slug or str(obj.title or "job-opening").strip().lower().replace(" ", "-")
        return f"/careers/jobs/{obj.id}/{slug}"

    def get_share_links(self, obj):
        request = self.context.get("request")
        public_path = self.get_public_path(obj)
        base_url = ""
        if request:
            base_url = (request.headers.get("Origin") or request.build_absolute_uri("/")).rstrip("/")
        share_url = f"{base_url}{public_path}" if base_url else public_path
        encoded = share_url.replace(" ", "%20")
        indeed_query = f"https://www.indeed.com/jobs?q={obj.title.replace(' ', '+')}+{(obj.location or obj.city or '').replace(' ', '+')}"
        return {
            "direct": share_url,
            "linkedin": f"https://www.linkedin.com/sharing/share-offsite/?url={encoded}",
            "whatsapp": f"https://wa.me/?text={encoded}",
            "email": f"mailto:?subject={obj.title}&body={encoded}",
            "indeed": indeed_query,
        }


class JobApplicationSerializer(serializers.ModelSerializer):
    applicant = ApplicantAccountSerializer(read_only=True)
    job = RecruitmentJobSerializer(read_only=True)
    candidate = serializers.SerializerMethodField()

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "applicant",
            "job",
            "candidate",
            "stage",
            "source_channel",
            "first_name",
            "last_name",
            "email",
            "phone",
            "whatsapp",
            "city",
            "state",
            "country",
            "current_company",
            "current_title",
            "years_experience",
            "notice_period_days",
            "expected_ctc",
            "current_ctc",
            "linkedin_url",
            "portfolio_url",
            "resume_url",
            "cover_letter",
            "skills",
            "consent_to_contact",
            "submitted_at",
            "last_activity_at",
            "updated_at",
        ]
        read_only_fields = ["applicant", "job", "candidate", "submitted_at", "last_activity_at", "updated_at"]

    def get_candidate(self, obj):
        if not obj.candidate:
            return None
        return {
            "id": obj.candidate_id,
            "full_name": f"{obj.candidate.first_name} {obj.candidate.last_name or ''}".strip(),
            "stage": obj.candidate.stage,
            "owner_name": obj.candidate.owner_name,
        }


class RecruitmentCandidateSerializer(serializers.ModelSerializer):
    job = RecruitmentJobSerializer(read_only=True)
    job_id = serializers.PrimaryKeyRelatedField(
        source="job",
        queryset=RecruitmentJob.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    applicant = ApplicantAccountSerializer(read_only=True)
    created_by = UserMiniSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()
    contact_actions = serializers.SerializerMethodField()
    timeline_preview = serializers.SerializerMethodField()
    interview_snapshot = serializers.SerializerMethodField()

    class Meta:
        model = RecruitmentCandidate
        fields = [
            "id",
            "job",
            "job_id",
            "employee",
            "employee_id",
            "applicant",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "whatsapp",
            "location",
            "source",
            "application_source",
            "stage",
            "score",
            "notice_period_days",
            "owner_name",
            "current_company",
            "current_title",
            "linkedin_url",
            "portfolio_url",
            "resume_url",
            "preferred_contact_channel",
            "last_contacted_at",
            "stage_updated_at",
            "summary",
            "applied_on",
            "created_by",
            "created_at",
            "updated_at",
            "contact_actions",
            "timeline_preview",
            "interview_snapshot",
        ]
        read_only_fields = [
            "created_by",
            "created_at",
            "updated_at",
            "job",
            "employee",
            "full_name",
            "applicant",
            "contact_actions",
            "timeline_preview",
            "interview_snapshot",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name or ''}".strip()

    def get_contact_actions(self, obj):
        email = obj.email or ""
        phone = (obj.whatsapp or obj.phone or "").replace("+", "").replace(" ", "")
        message = f"Hi {self.get_full_name(obj)}, regarding your application"
        return {
            "email": f"mailto:{email}" if email else "",
            "whatsapp": f"https://wa.me/{phone}?text={message.replace(' ', '%20')}" if phone else "",
        }

    def get_timeline_preview(self, obj):
        events = getattr(obj, "timeline_events", None)
        if events is None:
            return []
        preview = list(events.all()[:3])
        return CandidateTimelineEventSerializer(preview, many=True).data

    def get_interview_snapshot(self, obj):
        interview_qs = getattr(obj, "interviews", None)
        if interview_qs is None:
            return {"count": 0, "latest": None}
        interviews = list(interview_qs.all()[:1])
        latest = interviews[0] if interviews else None
        return {
            "count": interview_qs.count() if hasattr(interview_qs, "count") else len(interviews),
            "latest": {
                "round_name": latest.round_name,
                "decision": latest.decision,
                "scheduled_for": latest.scheduled_for,
                "taken_by_role": latest.taken_by_role,
            } if latest else None,
        }


class RecruitmentInterviewSerializer(serializers.ModelSerializer):
    candidate = RecruitmentCandidateSerializer(read_only=True)
    candidate_id = serializers.PrimaryKeyRelatedField(source="candidate", queryset=RecruitmentCandidate.objects.all(), write_only=True)
    application = JobApplicationSerializer(read_only=True)
    application_id = serializers.PrimaryKeyRelatedField(source="application", queryset=JobApplication.objects.all(), allow_null=True, required=False, write_only=True)
    job = RecruitmentJobSerializer(read_only=True)
    job_id = serializers.PrimaryKeyRelatedField(source="job", queryset=RecruitmentJob.objects.all(), allow_null=True, required=False, write_only=True)
    employee = EmployeeMiniSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(source="employee", queryset=Employee.objects.all(), allow_null=True, required=False, write_only=True)
    taken_by = UserMiniSerializer(read_only=True)
    taken_by_id = serializers.PrimaryKeyRelatedField(source="taken_by", queryset=User.objects.all(), allow_null=True, required=False, write_only=True)
    created_by = UserMiniSerializer(read_only=True)
    updated_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = RecruitmentInterview
        fields = [
            "id",
            "candidate",
            "candidate_id",
            "application",
            "application_id",
            "job",
            "job_id",
            "employee",
            "employee_id",
            "round_name",
            "interview_type",
            "status",
            "scheduled_for",
            "completed_at",
            "mode",
            "location_or_link",
            "duration_minutes",
            "taken_by",
            "taken_by_id",
            "taken_by_role",
            "panel_members",
            "discussion_topics",
            "score",
            "decision",
            "feedback_summary",
            "strengths",
            "concerns",
            "salary_discussed",
            "salary_expectation",
            "salary_offered",
            "final_ctc_recommended",
            "negotiation_notes",
            "next_step",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["candidate", "application", "job", "employee", "taken_by", "created_by", "updated_by", "created_at", "updated_at"]


class ProductivityNoteSerializer(serializers.ModelSerializer):
    owner = UserMiniSerializer(read_only=True)
    checklist_summary = serializers.SerializerMethodField()

    class Meta:
        model = ProductivityNote
        fields = [
            "id",
            "owner",
            "title",
            "category",
            "tone",
            "tags",
            "blocks",
            "checklist",
            "table_data",
            "reminder_at",
            "is_pinned",
            "is_archived",
            "checklist_summary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "checklist_summary", "created_at", "updated_at"]

    def get_checklist_summary(self, obj):
        items = list(obj.checklist or [])
        total = len(items)
        completed = len([item for item in items if item.get("done")])
        return {"completed": completed, "total": total}


class ProductivityTodoSerializer(serializers.ModelSerializer):
    owner = UserMiniSerializer(read_only=True)
    checklist_summary = serializers.SerializerMethodField()

    class Meta:
        model = ProductivityTodo
        fields = [
            "id",
            "owner",
            "title",
            "description",
            "status",
            "priority",
            "checklist",
            "labels",
            "linked_url",
            "due_at",
            "completed_at",
            "checklist_summary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "completed_at", "checklist_summary", "created_at", "updated_at"]

    def get_checklist_summary(self, obj):
        items = list(obj.checklist or [])
        total = len(items)
        completed = len([item for item in items if item.get("done")])
        return {"completed": completed, "total": total}


class ReminderEventSerializer(serializers.ModelSerializer):
    owner = UserMiniSerializer(read_only=True)

    class Meta:
        model = ReminderEvent
        fields = [
            "id",
            "owner",
            "title",
            "event_type",
            "priority",
            "starts_at",
            "ends_at",
            "remind_before_minutes",
            "location",
            "attendees",
            "notes",
            "target_url",
            "is_completed",
            "banner_dismissed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "banner_dismissed_at", "created_at", "updated_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_user = UserMiniSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_user",
            "actor_email",
            "scope",
            "action",
            "target_type",
            "target_id",
            "summary",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields


class RecruitmentReferralSerializer(serializers.ModelSerializer):
    job = RecruitmentJobSerializer(read_only=True)
    job_id = serializers.PrimaryKeyRelatedField(
        source="job",
        queryset=RecruitmentJob.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    created_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = RecruitmentReferral
        fields = [
            "id",
            "job",
            "job_id",
            "candidate_name",
            "candidate_email",
            "referrer_name",
            "referrer_email",
            "reward_status",
            "status",
            "notes",
            "referred_on",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at", "job"]
