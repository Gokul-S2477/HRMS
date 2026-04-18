from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from coredata.models import AssetAssignment, LeaveBalance, OffboardingCase, OvertimeEntry, Resource
from employees.models import Employee

from .models import EmployeePayroll, FinalSettlement, PayrollComplianceProfile

MONTH_LOOKUP = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

PAYROLL_CURRENCY = "USD"


def as_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def money(value) -> Decimal:
    return as_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_iso_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        return None


def month_bounds(month_name: str, year: int) -> tuple[date, date]:
    month_number = MONTH_LOOKUP.get(str(month_name or "").strip().lower(), timezone.now().month)
    year_value = int(year or timezone.now().year)
    last_day = monthrange(year_value, month_number)[1]
    return date(year_value, month_number, 1), date(year_value, month_number, last_day)


def get_active_compliance_profile() -> PayrollComplianceProfile:
    profile = PayrollComplianceProfile.objects.filter(is_active=True).order_by("-updated_at", "name").first()
    if profile:
        return profile
    return PayrollComplianceProfile(
        name="Default Compliance Profile",
        country="India",
        currency_code=PAYROLL_CURRENCY,
    )


def get_cycle_start_end(payroll: EmployeePayroll) -> tuple[date, date]:
    if payroll.cycle_start and payroll.cycle_end:
        return payroll.cycle_start, payroll.cycle_end
    return month_bounds(payroll.month, payroll.year)


def calculate_leave_without_pay_days(employee: Employee, start: date, end: date) -> Decimal:
    unpaid_keywords = {"loss of pay", "lop", "unpaid", "leave without pay", "without pay"}
    total = Decimal("0")
    from coredata.workflow_services import count_working_days

    for resource in Resource.objects.filter(resource_type="leave-employee"):
        payload = dict(resource.data or {})
        if str(payload.get("employee_id") or "") != str(employee.id):
            continue
        status_value = str(payload.get("status") or "").lower()
        if "approved" not in status_value:
            continue
        leave_type = str(payload.get("leave_type") or "").strip().lower()
        if leave_type not in unpaid_keywords and not any(word in leave_type for word in unpaid_keywords):
            continue
        leave_start = parse_iso_date(payload.get("from_date"))
        leave_end = parse_iso_date(payload.get("to_date"))
        if not leave_start or not leave_end:
            continue
        overlap_start = max(start, leave_start)
        overlap_end = min(end, leave_end)
        if overlap_end < overlap_start:
            continue
        total += Decimal(str(count_working_days(overlap_start, overlap_end)))
    return money(total)


def calculate_overtime_summary(employee: Employee, start: date, end: date) -> tuple[Decimal, Decimal]:
    queryset = OvertimeEntry.objects.filter(
        employee=employee,
        work_date__gte=start,
        work_date__lte=end,
        status__in=[OvertimeEntry.STATUS_APPROVED, OvertimeEntry.STATUS_PAID],
    )
    total_hours = Decimal("0")
    total_amount = Decimal("0")
    for entry in queryset:
        total_hours += as_decimal(entry.hours)
        total_amount += as_decimal(entry.payroll_amount)
    return money(total_hours), money(total_amount)


def payroll_daily_rate(payroll: EmployeePayroll, profile: PayrollComplianceProfile) -> Decimal:
    divisor = as_decimal(getattr(profile, "leave_salary_divisor", 30) or 30)
    if divisor <= 0:
        divisor = Decimal("30")
    base = as_decimal(payroll.basic_salary) + as_decimal(payroll.hra)
    if base <= 0:
        base = as_decimal(getattr(payroll.employee, "salary", 0))
    if base <= 0:
        base = as_decimal(payroll.gross_salary)
    if base <= 0:
        return Decimal("0")
    return money(base / divisor)


@transaction.atomic
def recalculate_employee_payroll(payroll: EmployeePayroll, *, save: bool = True) -> EmployeePayroll:
    profile = get_active_compliance_profile()
    cycle_start, cycle_end = get_cycle_start_end(payroll)
    payroll.cycle_start = cycle_start
    payroll.cycle_end = cycle_end

    earnings = dict(payroll.earnings_breakdown or {})
    deductions = dict(payroll.deductions_breakdown or {})
    payroll.basic_salary = money(earnings.get("basic") or payroll.basic_salary)
    payroll.hra = money(earnings.get("hra") or payroll.hra)

    overtime_hours, overtime_amount = calculate_overtime_summary(payroll.employee, cycle_start, cycle_end)
    payroll.approved_overtime_hours = overtime_hours
    payroll.overtime_amount = overtime_amount

    loss_of_pay_days = calculate_leave_without_pay_days(payroll.employee, cycle_start, cycle_end)
    payroll.loss_of_pay_days = loss_of_pay_days
    computed_leave_deduction = money(payroll_daily_rate(payroll, profile) * loss_of_pay_days)

    base_earnings_total = Decimal("0")
    for value in earnings.values():
        base_earnings_total += as_decimal(value)
    extra_earnings_total = sum((as_decimal((item or {}).get("amount")) for item in (payroll.extra_earnings or [])), Decimal("0"))
    extra_deductions_total = sum((as_decimal((item or {}).get("amount")) for item in (payroll.extra_deductions or [])), Decimal("0"))

    gross_salary = money(
        base_earnings_total
        + extra_earnings_total
        + as_decimal(payroll.bonus_amount)
        + as_decimal(payroll.reimbursement_amount)
        + as_decimal(payroll.arrears_amount)
        + overtime_amount
    )

    computed_pf = money(min(as_decimal(payroll.basic_salary) * as_decimal(profile.employee_pf_rate) / Decimal("100"), as_decimal(profile.pf_monthly_cap)))
    employer_pf = money(min(as_decimal(payroll.basic_salary) * as_decimal(profile.employer_pf_rate) / Decimal("100"), as_decimal(profile.pf_monthly_cap)))

    if gross_salary <= as_decimal(profile.esi_wage_limit):
        computed_esi = money(gross_salary * as_decimal(profile.employee_esi_rate) / Decimal("100"))
        employer_esi = money(gross_salary * as_decimal(profile.employer_esi_rate) / Decimal("100"))
    else:
        computed_esi = Decimal("0.00")
        employer_esi = Decimal("0.00")

    computed_professional_tax = money(
        profile.professional_tax_amount if gross_salary >= as_decimal(profile.professional_tax_threshold) else 0
    )

    applied_tds = money(deductions.get("tds"))
    applied_pf = money(deductions.get("pf") or computed_pf)
    applied_esi = money(deductions.get("esi") or computed_esi)
    applied_leave = money(deductions.get("leave") or computed_leave_deduction)
    applied_prof_tax = money(deductions.get("prof_tax") or computed_professional_tax)
    applied_labour_welfare = money(deductions.get("labour_welfare") or payroll.labour_welfare)
    other_deductions = money(deductions.get("others"))

    payroll.employee_pf = applied_pf
    payroll.employer_pf = employer_pf
    payroll.employee_esi = applied_esi
    payroll.employer_esi = employer_esi
    payroll.leave_deduction_amount = applied_leave
    payroll.professional_tax = applied_prof_tax
    payroll.income_tax = applied_tds
    payroll.labour_welfare = applied_labour_welfare
    payroll.gross_salary = gross_salary
    payroll.total_deductions = money(
        applied_tds
        + applied_pf
        + applied_esi
        + applied_leave
        + applied_prof_tax
        + applied_labour_welfare
        + other_deductions
        + extra_deductions_total
    )
    payroll.taxable_earnings = money(max(gross_salary - applied_pf - applied_esi, Decimal("0")))
    payroll.net_salary = money(gross_salary - payroll.total_deductions)
    payroll.total_salary = payroll.net_salary
    payroll.employer_cost = money(gross_salary + employer_pf + employer_esi)

    deductions.update(
        {
            "pf": float(applied_pf),
            "esi": float(applied_esi),
            "leave": float(applied_leave),
            "prof_tax": float(applied_prof_tax),
            "tds": float(applied_tds),
            "labour_welfare": float(applied_labour_welfare),
            "others": float(other_deductions),
        }
    )
    payroll.deductions_breakdown = deductions
    payroll.compliance_snapshot = {
        "profile": getattr(profile, "name", "Default Compliance Profile"),
        "currency_code": getattr(profile, "currency_code", PAYROLL_CURRENCY),
        "computed": {
            "employee_pf": float(computed_pf),
            "employee_esi": float(computed_esi),
            "professional_tax": float(computed_professional_tax),
            "leave_deduction": float(computed_leave_deduction),
        },
        "applied": {
            "employee_pf": float(applied_pf),
            "employee_esi": float(applied_esi),
            "professional_tax": float(applied_prof_tax),
            "leave_deduction": float(applied_leave),
            "income_tax": float(applied_tds),
            "labour_welfare": float(applied_labour_welfare),
        },
        "employer": {
            "pf": float(employer_pf),
            "esi": float(employer_esi),
        },
        "cycle": {
            "start": cycle_start.isoformat(),
            "end": cycle_end.isoformat(),
        },
        "attendance_inputs": {
            "approved_overtime_hours": float(overtime_hours),
            "loss_of_pay_days": float(loss_of_pay_days),
        },
    }

    if save:
        payroll.save()
        if payroll.components.exists():
            payroll.recalculate()
            payroll.save(update_fields=["gross_salary", "total_deductions", "net_salary", "total_salary", "updated_at"])
    return payroll


FINAL_SETTLEMENT_CHECKLIST = [
    {"key": "payroll", "label": "Validate final payroll period", "done": False},
    {"key": "leave", "label": "Review leave encashment and unpaid leave", "done": False},
    {"key": "assets", "label": "Confirm asset return and recoveries", "done": False},
    {"key": "compliance", "label": "Review statutory and gratuity obligations", "done": False},
    {"key": "payout", "label": "Approve and release final payout", "done": False},
]


def service_years(joining_date: date | None, last_working_day: date | None) -> int:
    if not joining_date or not last_working_day or last_working_day < joining_date:
        return 0
    years = last_working_day.year - joining_date.year
    if (last_working_day.month, last_working_day.day) < (joining_date.month, joining_date.day):
        years -= 1
    return max(years, 0)


@transaction.atomic
def ensure_final_settlement(case: OffboardingCase, actor=None, *, save: bool = True) -> FinalSettlement:
    profile = get_active_compliance_profile()
    latest_payroll = EmployeePayroll.objects.filter(employee=case.employee).order_by("-year", "-cycle_end", "-updated_at").first()
    settlement, _ = FinalSettlement.objects.get_or_create(
        offboarding_case=case,
        defaults={
            "employee": case.employee,
            "payroll": latest_payroll,
            "compliance_profile": profile if getattr(profile, "pk", None) else None,
            "last_working_day": case.last_working_day,
            "status": FinalSettlement.STATUS_DRAFT,
            "checklist": FINAL_SETTLEMENT_CHECKLIST,
            "prepared_by": actor if getattr(actor, "is_authenticated", False) else None,
        },
    )
    settlement.employee = case.employee
    settlement.payroll = latest_payroll
    settlement.compliance_profile = profile if getattr(profile, "pk", None) else None
    settlement.last_working_day = case.last_working_day
    settlement.checklist = settlement.checklist or list(FINAL_SETTLEMENT_CHECKLIST)
    if getattr(actor, "is_authenticated", False) and not settlement.prepared_by_id:
        settlement.prepared_by = actor

    leave_encashment_days = Decimal("0")
    if case.last_working_day:
        current_year = case.last_working_day.year
        for balance in LeaveBalance.objects.filter(employee=case.employee, year=current_year):
            available = as_decimal(balance.available)
            if available > 0:
                leave_encashment_days += available
    leave_encashment_days = money(leave_encashment_days)

    reference_payroll = latest_payroll
    if reference_payroll:
        recalculate_employee_payroll(reference_payroll)
    daily_rate = payroll_daily_rate(reference_payroll, profile) if reference_payroll else money(as_decimal(getattr(case.employee, "salary", 0)) / Decimal("30"))

    overtime_amount = reference_payroll.overtime_amount if reference_payroll else Decimal("0")
    unpaid_salary_amount = reference_payroll.net_salary if reference_payroll else money(getattr(case.employee, "salary", 0))
    leave_encashment_amount = money(daily_rate * leave_encashment_days)

    years_of_service = service_years(case.employee.joining_date, case.last_working_day)
    if years_of_service >= int(getattr(profile, "gratuity_service_years", 5) or 5):
        base_salary = as_decimal(getattr(case.employee, "salary", 0)) or as_decimal(reference_payroll.basic_salary if reference_payroll else 0)
        gratuity_amount = money(
            (base_salary * as_decimal(profile.gratuity_days_factor) / Decimal("26")) * Decimal(str(years_of_service))
        )
    else:
        gratuity_amount = Decimal("0.00")

    actual_notice_days = 0
    if case.last_working_day and case.initiated_on:
        actual_notice_days = max((case.last_working_day - case.initiated_on).days, 0)
    if case.source_type == OffboardingCase.SOURCE_RESIGNATION and getattr(profile, "notice_recovery_enabled", True):
        shortfall = max(int(profile.notice_period_days or 0) - actual_notice_days, 0)
        notice_recovery_amount = money(daily_rate * Decimal(str(shortfall)))
    else:
        notice_recovery_amount = Decimal("0.00")

    pending_assets = AssetAssignment.objects.filter(
        assigned_to=case.employee,
        status__in=[AssetAssignment.STATUS_ASSIGNED, AssetAssignment.STATUS_RETURN_REQUESTED, AssetAssignment.STATUS_LOST],
    ).count()
    asset_recovery_amount = money(settlement.asset_recovery_amount)

    settlement.unpaid_salary_amount = money(unpaid_salary_amount)
    settlement.leave_encashment_days = leave_encashment_days
    settlement.leave_encashment_amount = leave_encashment_amount
    settlement.overtime_amount = money(overtime_amount)
    settlement.gratuity_amount = money(gratuity_amount)
    settlement.notice_recovery_amount = notice_recovery_amount
    settlement.asset_recovery_amount = asset_recovery_amount
    settlement.final_payable = money(
        settlement.unpaid_salary_amount
        + settlement.leave_encashment_amount
        + settlement.overtime_amount
        + settlement.bonus_amount
        + settlement.reimbursement_amount
        + settlement.gratuity_amount
        + settlement.severance_amount
        + settlement.other_adjustments_amount
        - settlement.notice_recovery_amount
        - settlement.loan_recovery_amount
        - settlement.asset_recovery_amount
        - settlement.statutory_deduction_amount
    )
    if pending_assets:
        for item in settlement.checklist:
            if item.get("key") == "assets":
                item["done"] = False
                item["meta"] = f"{pending_assets} asset(s) still open"
    if save:
        settlement.save()
        case.final_payroll_status = settlement.status
        case.save(update_fields=["final_payroll_status", "updated_at"])
    return settlement
