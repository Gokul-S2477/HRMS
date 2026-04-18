import json

from rest_framework import serializers

from .models import Department, Designation, Employee, Policy


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "description", "employee_count"]


class DesignationSerializer(serializers.ModelSerializer):
    department_detail = DepartmentSerializer(source="department", read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        source="department",
        queryset=Department.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = Designation
        fields = [
            "id",
            "title",
            "description",
            "department",
            "department_id",
            "department_detail",
        ]
        read_only_fields = ["department"]


class EmployeeSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    designation = DesignationSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        source="department",
        queryset=Department.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    designation_id = serializers.PrimaryKeyRelatedField(
        source="designation",
        queryset=Designation.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    reporting_to = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        allow_null=True,
        required=False,
    )
    name = serializers.SerializerMethodField()
    user_account = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "emp_code",
            "first_name",
            "middle_name",
            "last_name",
            "email",
            "phone",
            "alternate_phone",
            "address",
            "gender",
            "date_of_birth",
            "emergency_contact_name",
            "emergency_contact_number",
            "role",
            "joining_date",
            "employment_type",
            "department",
            "designation",
            "department_id",
            "designation_id",
            "reporting_to",
            "national_id",
            "blood_group",
            "marital_status",
            "work_shift",
            "work_location",
            "salary",
            "is_active",
            "permissions",
            "about",
            "personal_info",
            "bank_info",
            "family_info",
            "education",
            "experience",
            "projects",
            "assets",
            "photo",
            "created_at",
            "name",
            "user_account",
        ]

    def get_name(self, obj):
        last = f" {obj.last_name}" if obj.last_name else ""
        return f"{obj.first_name}{last}"

    def get_user_account(self, obj):
        account = getattr(obj, "user_account", None)
        if not account:
            return None
        return {
            "id": account.id,
            "username": account.username,
            "email": account.email,
            "role": account.role,
            "effective_role": account.effective_role,
            "account_status": account.account_status,
            "can_use_chat": account.can_use_chat,
        }

    def validate_permissions(self, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("Invalid permissions JSON") from exc
        return value


class PolicySerializer(serializers.ModelSerializer):
    department_detail = DepartmentSerializer(source="department", read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        source="department",
        queryset=Department.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = Policy
        fields = [
            "id",
            "title",
            "description",
            "department",
            "department_id",
            "department_detail",
            "file",
            "created_at",
        ]
        read_only_fields = ["department"]
