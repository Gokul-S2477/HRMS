from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ApplicantAccount, ApplicantLoginCode, ApplicantSession, JobApplication, RecruitmentJob
from .workflow_serializers import ApplicantAccountSerializer, JobApplicationSerializer, RecruitmentJobSerializer
from .workflow_services import (
    create_audit_log,
    create_notification,
    issue_applicant_login_code,
    issue_applicant_session,
    notify_roles,
    sync_candidate_from_application,
)


def as_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


PUBLIC_ROLE_RECIPIENTS = {"hr", "super_admin", "admin", "stakeholder"}


def normalize_email(value: str) -> str:
    return str(value or "").strip().lower()


def resolve_applicant(request):
    token = (
        request.headers.get("X-Applicant-Token")
        or request.headers.get("x-applicant-token")
        or request.query_params.get("applicant_token")
    )
    if not token:
        return None, None
    session = ApplicantSession.objects.select_related("applicant").filter(token=token, expires_at__gt=timezone.now()).first()
    if not session or not session.applicant.is_active:
        return None, None
    session.last_seen_at = timezone.now()
    session.save(update_fields=["last_seen_at"])
    return session, session.applicant


def ensure_applicant(request):
    session, applicant = resolve_applicant(request)
    if applicant is None:
        return None, Response({"detail": "Applicant session required."}, status=status.HTTP_401_UNAUTHORIZED)
    return applicant, None


def serialize_jobs(request, jobs):
    return RecruitmentJobSerializer(jobs, many=True, context={"request": request}).data


class PublicRecruitmentJobsView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        qs = RecruitmentJob.objects.filter(is_public=True, status=RecruitmentJob.STATUS_OPEN).order_by("-posted_on", "title")
        search = request.query_params.get("search")
        location = request.query_params.get("location")
        employment_type = request.query_params.get("employment_type")
        work_mode = request.query_params.get("work_mode")
        department = request.query_params.get("department")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(department_name__icontains=search)
                | Q(location__icontains=search)
                | Q(city__icontains=search)
                | Q(state__icontains=search)
            )
        if location:
            qs = qs.filter(Q(location__icontains=location) | Q(city__icontains=location) | Q(state__icontains=location))
        if employment_type:
            qs = qs.filter(employment_type=employment_type)
        if work_mode:
            qs = qs.filter(work_mode=work_mode)
        if department:
            qs = qs.filter(department_name__icontains=department)
        return Response({
            "results": serialize_jobs(request, qs[:60]),
            "filters": {
                "employment_types": sorted({item.employment_type for item in RecruitmentJob.objects.filter(is_public=True)}),
                "work_modes": sorted({item.work_mode for item in RecruitmentJob.objects.filter(is_public=True)}),
            },
        })


class PublicRecruitmentJobDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk: int, slug: str | None = None):
        job = RecruitmentJob.objects.filter(pk=pk, is_public=True).first()
        if not job:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        _, applicant = resolve_applicant(request)
        suggested_qs = RecruitmentJob.objects.filter(is_public=True, status=RecruitmentJob.STATUS_OPEN).exclude(pk=job.pk)
        if job.department_name:
            suggested_qs = suggested_qs.filter(Q(department_name__icontains=job.department_name) | Q(work_mode=job.work_mode) | Q(employment_type=job.employment_type))
        suggested = serialize_jobs(request, suggested_qs.order_by("-posted_on", "title")[:4])
        already_applied = False
        if applicant:
            already_applied = JobApplication.objects.filter(applicant=applicant, job=job).exists()
        return Response({
            "job": RecruitmentJobSerializer(job, context={"request": request}).data,
            "suggested_jobs": suggested,
            "already_applied": already_applied,
        })


class ApplicantLoginRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = normalize_email(request.data.get("email"))
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        applicant, _ = ApplicantAccount.objects.get_or_create(email=email)
        if request.data.get("first_name") and not applicant.first_name:
            applicant.first_name = str(request.data.get("first_name"))
            applicant.save(update_fields=["first_name", "updated_at"])
        code = issue_applicant_login_code(applicant)
        create_audit_log(
            actor_email=email,
            scope="recruitment_public",
            action="applicant_code_requested",
            target_type="applicant",
            target_id=str(applicant.id),
            summary=f"Applicant code requested for {email}",
        )
        response_payload = {
            "status": "code_sent",
            "message": "A sign-in code was issued for this applicant email.",
            "email": email,
        }
        response_payload["debug_code"] = code.code
        return Response(response_payload)


class ApplicantLoginVerifyView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = normalize_email(request.data.get("email"))
        code_value = str(request.data.get("code") or "").strip()
        if not email or not code_value:
            return Response({"detail": "Email and code are required."}, status=status.HTTP_400_BAD_REQUEST)
        applicant = ApplicantAccount.objects.filter(email=email, is_active=True).first()
        if not applicant:
            return Response({"detail": "Applicant account not found."}, status=status.HTTP_404_NOT_FOUND)
        code = ApplicantLoginCode.objects.filter(
            applicant=applicant,
            code=code_value,
            consumed_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).order_by("-created_at").first()
        if not code:
            return Response({"detail": "Invalid or expired code."}, status=status.HTTP_400_BAD_REQUEST)
        code.consumed_at = timezone.now()
        code.save(update_fields=["consumed_at"])
        session = issue_applicant_session(applicant)
        applicant.last_login_at = timezone.now()
        applicant.save(update_fields=["last_login_at", "updated_at"])
        create_audit_log(
            actor_email=email,
            scope="recruitment_public",
            action="applicant_logged_in",
            target_type="applicant",
            target_id=str(applicant.id),
            summary=f"Applicant logged in: {email}",
        )
        return Response({
            "token": session.token,
            "expires_at": session.expires_at,
            "applicant": ApplicantAccountSerializer(applicant).data,
        })


class ApplicantProfileView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        applicant, error = ensure_applicant(request)
        if error:
            return error
        return Response(ApplicantAccountSerializer(applicant).data)

    def patch(self, request):
        applicant, error = ensure_applicant(request)
        if error:
            return error
        serializer = ApplicantAccountSerializer(applicant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        create_audit_log(
            actor_email=applicant.email,
            scope="recruitment_public",
            action="applicant_profile_updated",
            target_type="applicant",
            target_id=str(applicant.id),
            summary=f"Applicant updated profile {applicant.email}",
        )
        return Response(serializer.data)


class ApplicantApplicationsView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        applicant, error = ensure_applicant(request)
        if error:
            return error
        applications = JobApplication.objects.filter(applicant=applicant).select_related("job", "candidate").order_by("-submitted_at")
        return Response(JobApplicationSerializer(applications, many=True, context={"request": request}).data)


class ApplicantSignOutView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        session, applicant = resolve_applicant(request)
        if session:
            session.delete()
            create_audit_log(
                actor_email=applicant.email if applicant else "",
                scope="recruitment_public",
                action="applicant_logged_out",
                target_type="applicant_session",
                target_id=str(session.id),
                summary="Applicant session closed",
            )
        return Response({"status": "signed_out"})


class PublicJobApplyView(APIView):
    authentication_classes = []
    permission_classes = []

    @transaction.atomic
    def post(self, request, pk: int, slug: str | None = None):
        applicant, error = ensure_applicant(request)
        if error:
            return error
        job = RecruitmentJob.objects.filter(pk=pk, is_public=True, status=RecruitmentJob.STATUS_OPEN).first()
        if not job:
            return Response({"detail": "This role is not available for public applications."}, status=status.HTTP_404_NOT_FOUND)

        payload = request.data or {}
        applicant_updates = {}
        for field in [
            "first_name",
            "last_name",
            "phone",
            "whatsapp",
            "city",
            "state",
            "country",
            "headline",
            "preferred_role",
            "current_company",
            "current_title",
            "linkedin_url",
            "portfolio_url",
            "resume_url",
            "summary",
        ]:
            if field in payload:
                applicant_updates[field] = payload.get(field) or ""
        if "years_experience" in payload:
            applicant_updates["years_experience"] = as_decimal(payload.get("years_experience"))
        for attr, value in applicant_updates.items():
            setattr(applicant, attr, value)
        applicant.save()

        defaults = {
            "stage": JobApplication.STAGE_APPLIED,
            "source_channel": payload.get("source_channel") or "careers_portal",
            "first_name": payload.get("first_name") or applicant.first_name,
            "last_name": payload.get("last_name") or applicant.last_name,
            "email": applicant.email,
            "phone": payload.get("phone") or applicant.phone,
            "whatsapp": payload.get("whatsapp") or applicant.whatsapp,
            "city": payload.get("city") or applicant.city,
            "state": payload.get("state") or applicant.state,
            "country": payload.get("country") or applicant.country,
            "current_company": payload.get("current_company") or applicant.current_company,
            "current_title": payload.get("current_title") or applicant.current_title,
            "years_experience": as_decimal(payload.get("years_experience") or applicant.years_experience),
            "notice_period_days": int(payload.get("notice_period_days") or 0),
            "expected_ctc": as_decimal(payload.get("expected_ctc")),
            "current_ctc": as_decimal(payload.get("current_ctc")),
            "linkedin_url": payload.get("linkedin_url") or applicant.linkedin_url,
            "portfolio_url": payload.get("portfolio_url") or applicant.portfolio_url,
            "resume_url": payload.get("resume_url") or applicant.resume_url,
            "cover_letter": payload.get("cover_letter") or "",
            "skills": payload.get("skills") if isinstance(payload.get("skills"), list) else [item.strip() for item in str(payload.get("skills") or "").split(",") if item.strip()],
            "consent_to_contact": bool(payload.get("consent_to_contact", True)),
        }
        application, created = JobApplication.objects.get_or_create(applicant=applicant, job=job, defaults=defaults)
        if not created:
            for attr, value in defaults.items():
                setattr(application, attr, value)
            application.save()
        candidate = sync_candidate_from_application(application)
        notify_roles(
            PUBLIC_ROLE_RECIPIENTS,
            title=f"New application: {candidate.first_name} {candidate.last_name or ''}".strip(),
            body=f"Applied for {job.title} via the public careers portal.",
            notification_type="candidate_applied",
            target_url="/candidates",
            reference_type="job_application",
            reference_id=str(application.id),
            metadata={"job_id": job.id, "candidate_id": candidate.id},
        )
        create_audit_log(
            actor_email=applicant.email,
            scope="recruitment_public",
            action="job_applied" if created else "job_application_updated",
            target_type="job_application",
            target_id=str(application.id),
            summary=f"{applicant.email} applied for {job.title}",
            metadata={"job_id": job.id, "candidate_id": candidate.id},
        )
        return Response({
            "created": created,
            "application": JobApplicationSerializer(application, context={"request": request}).data,
            "candidate_id": candidate.id,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
