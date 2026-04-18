from decimal import Decimal

from django.conf import settings
from django.db import models

from employees.models import Employee


class SalaryComponent(models.Model):
    COMPONENT_TYPES = (
        ("earning", "Earning"),
        ("deduction", "Deduction"),
    )

    name = models.CharField(max_length=120)
    component_type = models.CharField(max_length=20, choices=COMPONENT_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self) -> str:
        return f"{self.name} ({self.component_type})"


class EmployeePayroll(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_IN_REVIEW = "in_review"
    STATUS_APPROVED = "approved"
    STATUS_PUBLISHED = "published"
    STATUS_LOCKED = "locked"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_IN_REVIEW, "In Review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_LOCKED, "Locked"),
    )

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payrolls")
    month = models.CharField(max_length=20)
    year = models.PositiveIntegerField()
    cycle_start = models.DateField(null=True, blank=True)
    cycle_end = models.DateField(null=True, blank=True)
    pay_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hra = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    earnings_breakdown = models.JSONField(default=dict, blank=True)
    deductions_breakdown = models.JSONField(default=dict, blank=True)
    extra_earnings = models.JSONField(default=list, blank=True)
    extra_deductions = models.JSONField(default=list, blank=True)
    approved_overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    loss_of_pay_days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    leave_deduction_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reimbursement_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    arrears_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    taxable_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employee_pf = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_pf = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employee_esi = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_esi = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    professional_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    income_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    labour_welfare = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    compliance_snapshot = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    components = models.ManyToManyField(SalaryComponent, blank=True)

    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_payrolls",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("employee", "month", "year")
        ordering = ["-year", "-month", "-created_at"]

    def __str__(self) -> str:
        return f"{self.employee} - {self.month}/{self.year}"

    def recalculate(self):
        earnings = Decimal("0")
        deductions = Decimal("0")
        for comp in self.components.all():
            if comp.component_type == "earning":
                earnings += comp.amount
            else:
                deductions += comp.amount
        breakdown = self.earnings_breakdown or {}
        extras = self.extra_earnings or []
        extra_deductions = self.extra_deductions or []
        gross = (
            Decimal(self.basic_salary or 0)
            + Decimal(self.hra or 0)
            + Decimal(self.bonus_amount or 0)
            + Decimal(self.reimbursement_amount or 0)
            + Decimal(self.arrears_amount or 0)
            + Decimal(self.overtime_amount or 0)
            + earnings
        )
        for key, value in breakdown.items():
            if key in {"basic", "hra"}:
                continue
            gross += Decimal(str(value or 0))
        for item in extras:
            gross += Decimal(str((item or {}).get("amount") or 0))
        for item in extra_deductions:
            deductions += Decimal(str((item or {}).get("amount") or 0))
        deductions += (
            Decimal(self.leave_deduction_amount or 0)
            + Decimal(self.employee_pf or 0)
            + Decimal(self.employee_esi or 0)
            + Decimal(self.professional_tax or 0)
            + Decimal(self.income_tax or 0)
            + Decimal(self.labour_welfare or 0)
        )
        self.gross_salary = gross
        self.total_deductions = deductions
        self.net_salary = gross - deductions
        self.total_salary = self.net_salary
        return self.net_salary


class PayrollComplianceProfile(models.Model):
    name = models.CharField(max_length=120, unique=True)
    country = models.CharField(max_length=80, default="India")
    currency_code = models.CharField(max_length=10, default="USD")
    employee_pf_rate = models.DecimalField(max_digits=5, decimal_places=2, default=12)
    employer_pf_rate = models.DecimalField(max_digits=5, decimal_places=2, default=12)
    pf_monthly_cap = models.DecimalField(max_digits=12, decimal_places=2, default=1800)
    employee_esi_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.75)
    employer_esi_rate = models.DecimalField(max_digits=5, decimal_places=2, default=3.25)
    esi_wage_limit = models.DecimalField(max_digits=12, decimal_places=2, default=21000)
    professional_tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=200)
    professional_tax_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=15000)
    leave_salary_divisor = models.DecimalField(max_digits=6, decimal_places=2, default=30)
    gratuity_days_factor = models.DecimalField(max_digits=6, decimal_places=2, default=15)
    gratuity_service_years = models.PositiveIntegerField(default=5)
    notice_period_days = models.PositiveIntegerField(default=30)
    notice_recovery_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_active", "name"]

    def __str__(self) -> str:
        return self.name


class FinalSettlement(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_IN_REVIEW = "in_review"
    STATUS_APPROVED = "approved"
    STATUS_PAID = "paid"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_IN_REVIEW, "In Review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_PAID, "Paid"),
        (STATUS_CLOSED, "Closed"),
    )

    offboarding_case = models.OneToOneField(
        "coredata.OffboardingCase",
        on_delete=models.CASCADE,
        related_name="settlement",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="final_settlements",
    )
    payroll = models.ForeignKey(
        "payroll.EmployeePayroll",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="settlements",
    )
    compliance_profile = models.ForeignKey(
        "payroll.PayrollComplianceProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="settlements",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    last_working_day = models.DateField(null=True, blank=True)
    unpaid_salary_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    leave_encashment_days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    leave_encashment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    overtime_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reimbursement_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gratuity_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    severance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notice_recovery_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    loan_recovery_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    asset_recovery_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    statutory_deduction_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_adjustments_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    final_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    checklist = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="prepared_final_settlements",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_final_settlements",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self) -> str:
        return f"Settlement:{self.employee_id}:{self.status}"
