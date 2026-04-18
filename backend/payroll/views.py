from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import is_employee, is_hr_or_above

from .models import EmployeePayroll, FinalSettlement, PayrollComplianceProfile, SalaryComponent
from .serializers import (
    EmployeePayrollSerializer,
    FinalSettlementSerializer,
    PayrollComplianceProfileSerializer,
    SalaryComponentSerializer,
)
from .services import ensure_final_settlement, recalculate_employee_payroll


class SalaryComponentViewSet(viewsets.ModelViewSet):
    serializer_class = SalaryComponentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SalaryComponent.objects.all().order_by("name")
        if is_employee(self.request.user):
            return qs.none()
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change salary components.")


class PayrollComplianceProfileViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollComplianceProfileSerializer
    permission_classes = [IsAuthenticated]
    queryset = PayrollComplianceProfile.objects.all().order_by("-is_active", "name")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if is_employee(request.user):
                self.permission_denied(request, message="Employees cannot view payroll compliance profiles.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage payroll compliance profiles.")


class EmployeePayrollViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeePayrollSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            EmployeePayroll.objects.select_related(
                "employee",
                "employee__department",
                "employee__designation",
                "approved_by",
            )
            .prefetch_related("components", "settlements")
            .order_by("-year", "-cycle_end", "-updated_at")
        )
        user = self.request.user
        if is_employee(user):
            if getattr(user, "employee_profile_id", None):
                qs = qs.filter(employee_id=user.employee_profile_id)
            else:
                return qs.none()
        status_filter = self.request.query_params.get("status")
        month_filter = self.request.query_params.get("month")
        year_filter = self.request.query_params.get("year")
        employee_filter = self.request.query_params.get("employee_id")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if month_filter:
            qs = qs.filter(month__iexact=month_filter)
        if year_filter:
            qs = qs.filter(year=year_filter)
        if employee_filter and not is_employee(user):
            qs = qs.filter(employee_id=employee_filter)
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change payroll data.")

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can recalculate payroll.")
        payroll = self.get_object()
        recalculate_employee_payroll(payroll)
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can publish payroll.")
        payroll = self.get_object()
        recalculate_employee_payroll(payroll)
        payroll.status = EmployeePayroll.STATUS_PUBLISHED
        payroll.published_at = timezone.now()
        payroll.save(update_fields=["status", "published_at", "updated_at"])
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can lock payroll.")
        payroll = self.get_object()
        payroll.status = EmployeePayroll.STATUS_LOCKED
        payroll.locked_at = timezone.now()
        payroll.save(update_fields=["status", "locked_at", "updated_at"])
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can unlock payroll.")
        payroll = self.get_object()
        payroll.status = EmployeePayroll.STATUS_APPROVED if payroll.approved_by_id else EmployeePayroll.STATUS_IN_REVIEW
        payroll.locked_at = None
        payroll.save(update_fields=["status", "locked_at", "updated_at"])
        return Response(self.get_serializer(payroll).data)


class FinalSettlementViewSet(viewsets.ModelViewSet):
    serializer_class = FinalSettlementSerializer
    permission_classes = [IsAuthenticated]
    queryset = FinalSettlement.objects.select_related(
        "employee",
        "employee__department",
        "employee__designation",
        "offboarding_case",
        "payroll",
        "compliance_profile",
        "prepared_by",
        "approved_by",
    ).all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if is_employee(request.user):
                self.permission_denied(request, message="Employees cannot view final settlement records.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage final settlements.")

    def get_queryset(self):
        qs = self.queryset.order_by("-updated_at", "-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        employee_filter = self.request.query_params.get("employee_id")
        if employee_filter:
            qs = qs.filter(employee_id=employee_filter)
        return qs

    def perform_create(self, serializer):
        settlement = serializer.save(prepared_by=self.request.user)
        if settlement.offboarding_case_id:
            ensure_final_settlement(settlement.offboarding_case, self.request.user)

    def perform_update(self, serializer):
        settlement = serializer.save()
        if settlement.offboarding_case_id:
            ensure_final_settlement(settlement.offboarding_case, self.request.user)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        settlement = self.get_object()
        ensure_final_settlement(settlement.offboarding_case, request.user)
        settlement.refresh_from_db()
        return Response(self.get_serializer(settlement).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        settlement = self.get_object()
        ensure_final_settlement(settlement.offboarding_case, request.user)
        settlement.refresh_from_db()
        settlement.status = FinalSettlement.STATUS_APPROVED
        settlement.approved_by = request.user
        settlement.approved_at = timezone.now()
        settlement.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        if settlement.offboarding_case_id:
            case = settlement.offboarding_case
            case.final_payroll_status = settlement.status
            case.save(update_fields=["final_payroll_status", "updated_at"])
        return Response(self.get_serializer(settlement).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        settlement = self.get_object()
        settlement.status = FinalSettlement.STATUS_PAID
        settlement.paid_at = timezone.now()
        settlement.save(update_fields=["status", "paid_at", "updated_at"])
        if settlement.offboarding_case_id:
            case = settlement.offboarding_case
            case.final_payroll_status = settlement.status
            case.status = case.STATUS_COMPLETED
            case.completed_at = case.completed_at or timezone.now()
            case.save(update_fields=["final_payroll_status", "status", "completed_at", "updated_at"])
        return Response(self.get_serializer(settlement).data)
