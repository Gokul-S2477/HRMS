import uuid

from django.db import models


class Resource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resource_type = models.CharField(max_length=100, db_index=True)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["resource_type", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.resource_type}:{self.id}"


from .workflow_models import (  # noqa: E402,F401
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
    ShiftDefinition,
    TimesheetEntry,
)
