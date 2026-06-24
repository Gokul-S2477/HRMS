from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .public_recruitment_views import (
    ApplicantApplicationsView,
    ApplicantLoginRequestView,
    ApplicantLoginVerifyView,
    ApplicantProfileView,
    ApplicantSignOutView,
    PublicJobApplyView,
    PublicRecruitmentJobDetailView,
    PublicRecruitmentJobsView,
)
from .views import ResourceDetailView, ResourceListCreateView
from .workflow_views import (
    AdminDashboardStatsView,
    ApprovalInboxView,
    AssetAssignmentViewSet,
    AssetCategoryViewSet,
    AuditLogViewSet,
    DocumentCategoryViewSet,
    EmployeeDocumentViewSet,
    EmployeeDocumentUploadView,
    AttendanceRecordViewSet,
    LeaveBalanceViewSet,
    LeaveLedgerViewSet,
    NotificationViewSet,
    OnboardingRecordViewSet,
    OnboardingTaskViewSet,
    OnboardingTemplateViewSet,
    OffboardingCaseViewSet,
    OvertimeEntryViewSet,
    ProductivityNoteViewSet,
    ProductivityTodoViewSet,
    RecruitmentCandidateViewSet,
    RecruitmentInterviewViewSet,
    RecruitmentJobViewSet,
    RecruitmentReferralViewSet,
    ReminderEventViewSet,
    ReportsOverviewView,
    ShiftDefinitionViewSet,
    TimesheetEntryViewSet,
    ExpenseClaimViewSet,
    DocumentEsignViewSet,
    DocumentSignatureViewSet,
    SalaryRevisionViewSet,
    EmployeeTransferViewSet,
    EmployeeLoanViewSet,
    LoanInstallmentViewSet,
    TrainingProgramViewSet,
    TrainingEnrollmentViewSet,
    ReviewCycleViewSet,
    PerformanceReviewViewSet,
    ReviewGoalViewSet,
    ReviewFeedbackViewSet,
    PeerFeedbackViewSet,
    AnnouncementViewSet,
    DisciplinaryActionViewSet,
)

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notifications")
router.register(r"leave-balances", LeaveBalanceViewSet, basename="leave-balances")
router.register(r"leave-ledger", LeaveLedgerViewSet, basename="leave-ledger")
router.register(r"shift-definitions", ShiftDefinitionViewSet, basename="shift-definitions")
router.register(r"timesheets", TimesheetEntryViewSet, basename="timesheets")
router.register(r"expense-claims", ExpenseClaimViewSet, basename="expense-claims")
router.register(r"overtime-entries", OvertimeEntryViewSet, basename="overtime-entries")
router.register(r"asset-categories", AssetCategoryViewSet, basename="asset-categories")
router.register(r"asset-assignments", AssetAssignmentViewSet, basename="asset-assignments")
router.register(r"document-categories", DocumentCategoryViewSet, basename="document-categories")
router.register(r"employee-documents", EmployeeDocumentViewSet, basename="employee-documents")
router.register(r"onboarding/templates", OnboardingTemplateViewSet, basename="onboarding-templates")
router.register(r"onboarding/records", OnboardingRecordViewSet, basename="onboarding-records")
router.register(r"onboarding/tasks", OnboardingTaskViewSet, basename="onboarding-tasks")
router.register(r"audit-logs", AuditLogViewSet, basename="audit-logs")
router.register(r"offboarding-cases", OffboardingCaseViewSet, basename="offboarding-cases")
router.register(r"recruitment/jobs", RecruitmentJobViewSet, basename="recruitment-jobs")
router.register(r"recruitment/candidates", RecruitmentCandidateViewSet, basename="recruitment-candidates")
router.register(r"recruitment/interviews", RecruitmentInterviewViewSet, basename="recruitment-interviews")
router.register(r"recruitment/referrals", RecruitmentReferralViewSet, basename="recruitment-referrals")
router.register(r"productivity/notes", ProductivityNoteViewSet, basename="productivity-notes")
router.register(r"productivity/todos", ProductivityTodoViewSet, basename="productivity-todos")
router.register(r"productivity/events", ReminderEventViewSet, basename="productivity-events")
router.register(r"esign-documents", DocumentEsignViewSet, basename="esign-documents")
router.register(r"esign-signatures", DocumentSignatureViewSet, basename="esign-signatures")
router.register(r"attendance-records", AttendanceRecordViewSet, basename="attendance-records")
router.register(r"salary-revisions", SalaryRevisionViewSet, basename="salary-revisions")
router.register(r"employee-transfers", EmployeeTransferViewSet, basename="employee-transfers")
router.register(r"employee-loans", EmployeeLoanViewSet, basename="employee-loans")
router.register(r"loan-installments", LoanInstallmentViewSet, basename="loan-installments")
router.register(r"training-programs", TrainingProgramViewSet, basename="training-programs")
router.register(r"training-enrollments", TrainingEnrollmentViewSet, basename="training-enrollments")
router.register(r"review-cycles", ReviewCycleViewSet, basename="review-cycles")
router.register(r"performance-reviews", PerformanceReviewViewSet, basename="performance-reviews")
router.register(r"review-goals", ReviewGoalViewSet, basename="review-goals")
router.register(r"review-feedbacks", ReviewFeedbackViewSet, basename="review-feedbacks")
router.register(r"peer-feedbacks", PeerFeedbackViewSet, basename="peer-feedbacks")
router.register(r"announcements", AnnouncementViewSet, basename="announcements")
router.register(r"disciplinary-actions", DisciplinaryActionViewSet, basename="disciplinary-actions")

urlpatterns = [
    path("employee-documents/upload/", EmployeeDocumentUploadView.as_view(), name="employee-document-upload"),
    path("public/jobs/", PublicRecruitmentJobsView.as_view(), name="public-jobs"),
    path("public/jobs/<int:pk>/<slug:slug>/", PublicRecruitmentJobDetailView.as_view(), name="public-job-detail"),
    path("public/jobs/<int:pk>/<slug:slug>/apply/", PublicJobApplyView.as_view(), name="public-job-apply"),
    path("public/jobs/<int:pk>/", PublicRecruitmentJobDetailView.as_view(), name="public-job-detail-simple"),
    path("public/jobs/<int:pk>/apply/", PublicJobApplyView.as_view(), name="public-job-apply-simple"),
    path("public/auth/request-code/", ApplicantLoginRequestView.as_view(), name="applicant-request-code"),
    path("public/auth/verify-code/", ApplicantLoginVerifyView.as_view(), name="applicant-verify-code"),
    path("public/auth/sign-out/", ApplicantSignOutView.as_view(), name="applicant-sign-out"),
    path("public/applicant/me/", ApplicantProfileView.as_view(), name="applicant-profile"),
    path("public/applicant/applications/", ApplicantApplicationsView.as_view(), name="applicant-applications"),
    path("data/<slug:resource_type>/", ResourceListCreateView.as_view(), name="resource-list"),
    path(
        "data/<slug:resource_type>/<uuid:id>/",
        ResourceDetailView.as_view(),
        name="resource-detail",
    ),
    path("reports/overview/", ReportsOverviewView.as_view(), name="reports-overview"),
    path("dashboard/admin/", AdminDashboardStatsView.as_view(), name="admin-dashboard-stats"),
    path("approvals/inbox/", ApprovalInboxView.as_view(), name="approval-inbox"),
    path("", include(router.urls)),
]
