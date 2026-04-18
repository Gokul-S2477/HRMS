from rest_framework import serializers

from .models import EmployeePayroll, FinalSettlement, PayrollComplianceProfile, SalaryComponent
from .services import ensure_final_settlement, recalculate_employee_payroll


class SalaryComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryComponent
        fields = ["id", "name", "component_type", "amount"]


class PayrollComplianceProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollComplianceProfile
        fields = "__all__"


class FinalSettlementSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    payroll_summary = serializers.SerializerMethodField()

    class Meta:
        model = FinalSettlement
        fields = [
            "id",
            "offboarding_case",
            "employee",
            "employee_name",
            "employee_code",
            "payroll",
            "payroll_summary",
            "compliance_profile",
            "status",
            "last_working_day",
            "unpaid_salary_amount",
            "leave_encashment_days",
            "leave_encashment_amount",
            "overtime_amount",
            "bonus_amount",
            "reimbursement_amount",
            "gratuity_amount",
            "severance_amount",
            "notice_recovery_amount",
            "loan_recovery_amount",
            "asset_recovery_amount",
            "statutory_deduction_amount",
            "other_adjustments_amount",
            "final_payable",
            "checklist",
            "notes",
            "prepared_by",
            "approved_by",
            "approved_at",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "employee_name",
            "employee_code",
            "payroll_summary",
            "prepared_by",
            "approved_by",
            "approved_at",
            "paid_at",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name or ''}".strip()

    def get_employee_code(self, obj):
        return obj.employee.emp_code

    def get_payroll_summary(self, obj):
        if not obj.payroll:
            return None
        return {
            "id": obj.payroll_id,
            "month": obj.payroll.month,
            "year": obj.payroll.year,
            "status": obj.payroll.status,
            "net_salary": obj.payroll.net_salary,
        }


class EmployeePayrollSerializer(serializers.ModelSerializer):
    employee = serializers.SerializerMethodField(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=EmployeePayroll._meta.get_field("employee").remote_field.model.objects.all(),
        write_only=True,
        required=False,
    )
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    joining_date = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    components = serializers.PrimaryKeyRelatedField(
        queryset=SalaryComponent.objects.all(),
        many=True,
        required=False,
    )
    settlement_id = serializers.SerializerMethodField()
    data = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayroll
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "employee_code",
            "email",
            "phone",
            "designation",
            "department",
            "joining_date",
            "month",
            "year",
            "cycle_start",
            "cycle_end",
            "pay_date",
            "status",
            "basic_salary",
            "hra",
            "earnings_breakdown",
            "deductions_breakdown",
            "extra_earnings",
            "extra_deductions",
            "approved_overtime_hours",
            "overtime_amount",
            "loss_of_pay_days",
            "leave_deduction_amount",
            "bonus_amount",
            "reimbursement_amount",
            "arrears_amount",
            "taxable_earnings",
            "employee_pf",
            "employer_pf",
            "employee_esi",
            "employer_esi",
            "professional_tax",
            "income_tax",
            "labour_welfare",
            "gross_salary",
            "total_deductions",
            "employer_cost",
            "net_salary",
            "total_salary",
            "compliance_snapshot",
            "notes",
            "components",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "published_at",
            "locked_at",
            "settlement_id",
            "created_at",
            "updated_at",
            "data",
        ]
        read_only_fields = [
            "employee",
            "employee_name",
            "employee_code",
            "email",
            "phone",
            "designation",
            "department",
            "joining_date",
            "approved_overtime_hours",
            "overtime_amount",
            "loss_of_pay_days",
            "leave_deduction_amount",
            "taxable_earnings",
            "employee_pf",
            "employer_pf",
            "employee_esi",
            "employer_esi",
            "professional_tax",
            "income_tax",
            "labour_welfare",
            "gross_salary",
            "total_deductions",
            "employer_cost",
            "net_salary",
            "total_salary",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "published_at",
            "locked_at",
            "settlement_id",
            "created_at",
            "updated_at",
            "data",
        ]

    def to_internal_value(self, data):
        raw = dict(data)
        nested = raw.get("data")
        if isinstance(nested, dict):
            raw = {**raw}
            raw.pop("data", None)
            raw.setdefault("employee_id", nested.get("employee_id"))
            raw.setdefault("month", nested.get("month"))
            raw.setdefault("year", nested.get("year"))
            raw.setdefault("cycle_start", nested.get("cycle_start"))
            raw.setdefault("cycle_end", nested.get("cycle_end"))
            raw.setdefault("pay_date", nested.get("pay_date"))
            raw.setdefault("status", nested.get("status"))
            raw.setdefault("earnings_breakdown", nested.get("earnings") or nested.get("earnings_breakdown") or {})
            raw.setdefault("deductions_breakdown", nested.get("deductions") or nested.get("deductions_breakdown") or {})
            raw.setdefault("extra_earnings", nested.get("extra_earnings") or raw.get("extra_earnings") or [])
            raw.setdefault("extra_deductions", nested.get("extra_deductions") or raw.get("extra_deductions") or [])
            raw.setdefault("bonus_amount", nested.get("bonus_amount") or 0)
            raw.setdefault("reimbursement_amount", nested.get("reimbursement_amount") or 0)
            raw.setdefault("arrears_amount", nested.get("arrears_amount") or 0)
            raw.setdefault("notes", nested.get("notes") or raw.get("notes") or "")
        if "earnings" in raw and "earnings_breakdown" not in raw:
            raw["earnings_breakdown"] = raw.pop("earnings")
        if "deductions" in raw and "deductions_breakdown" not in raw:
            raw["deductions_breakdown"] = raw.pop("deductions")
        return super().to_internal_value(raw)

    def get_employee(self, obj):
        employee = obj.employee
        return {
            "id": employee.id,
            "emp_code": employee.emp_code,
            "full_name": f"{employee.first_name} {employee.last_name or ''}".strip(),
            "email": employee.email,
            "phone": employee.phone,
        }

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name or ''}".strip()

    def get_employee_code(self, obj):
        return obj.employee.emp_code

    def get_email(self, obj):
        return obj.employee.email

    def get_phone(self, obj):
        return obj.employee.phone

    def get_designation(self, obj):
        return obj.employee.designation.title if obj.employee.designation else ""

    def get_department(self, obj):
        return obj.employee.department.name if obj.employee.department else ""

    def get_joining_date(self, obj):
        return obj.employee.joining_date

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_display_name() if obj.approved_by_id else ""

    def get_settlement_id(self, obj):
        settlement = obj.settlements.order_by("-updated_at").first()
        return settlement.id if settlement else None

    def get_data(self, obj):
        return {
            "employee_id": obj.employee_id,
            "emp_code": self.get_employee_code(obj),
            "employee_name": self.get_employee_name(obj),
            "email": self.get_email(obj),
            "phone": self.get_phone(obj),
            "designation": self.get_designation(obj),
            "department": self.get_department(obj),
            "joining_date": obj.employee.joining_date.isoformat() if obj.employee.joining_date else "",
            "month": obj.month,
            "year": obj.year,
            "cycle_start": obj.cycle_start.isoformat() if obj.cycle_start else "",
            "cycle_end": obj.cycle_end.isoformat() if obj.cycle_end else "",
            "pay_date": obj.pay_date.isoformat() if obj.pay_date else "",
            "status": obj.status,
            "earnings": obj.earnings_breakdown or {},
            "deductions": obj.deductions_breakdown or {},
            "extra_earnings": obj.extra_earnings or [],
            "extra_deductions": obj.extra_deductions or [],
            "gross_salary": obj.gross_salary,
            "total_deductions": obj.total_deductions,
            "net_salary": obj.net_salary,
            "taxable_earnings": obj.taxable_earnings,
            "approved_overtime_hours": obj.approved_overtime_hours,
            "overtime_amount": obj.overtime_amount,
            "loss_of_pay_days": obj.loss_of_pay_days,
            "leave_deduction_amount": obj.leave_deduction_amount,
            "employer_cost": obj.employer_cost,
            "compliance_snapshot": obj.compliance_snapshot or {},
            "settlement_id": self.get_settlement_id(obj),
        }

    def validate(self, attrs):
        employee = attrs.get("employee") or getattr(self.instance, "employee", None)
        month = attrs.get("month") or getattr(self.instance, "month", None)
        year = attrs.get("year") or getattr(self.instance, "year", None)
        if self.instance and self.instance.status == EmployeePayroll.STATUS_LOCKED:
            raise serializers.ValidationError("Locked payroll entries cannot be edited.")
        if self.instance is None and employee and month and year:
            if EmployeePayroll.objects.filter(employee=employee, month=month, year=year).exists():
                raise serializers.ValidationError("Payroll already exists for this employee/month/year.")
        return attrs

    def create(self, validated_data):
        components = validated_data.pop("components", [])
        payroll = EmployeePayroll.objects.create(**validated_data)
        if components:
            payroll.components.set(components)
        recalculate_employee_payroll(payroll)
        return payroll

    def update(self, instance, validated_data):
        components = validated_data.pop("components", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if components is not None:
            instance.components.set(components)
        recalculate_employee_payroll(instance)
        return instance
