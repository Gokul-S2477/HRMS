from django.contrib.auth import get_user_model
from rest_framework import serializers

from employees.models import Employee

User = get_user_model()


class EmployeeAccountEmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    designation_title = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "emp_code",
            "full_name",
            "first_name",
            "last_name",
            "email",
            "phone",
            "department_name",
            "designation_title",
            "joining_date",
            "is_active",
        ]

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_designation_title(self, obj):
        return obj.designation.title if obj.designation else None

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name or ''}".strip()


class UserMiniSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    effective_role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "display_name", "role", "effective_role"]

    def get_display_name(self, obj):
        return obj.get_display_name()


class UserMeSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    effective_role = serializers.CharField(read_only=True)
    employee_profile = EmployeeAccountEmployeeSerializer(read_only=True)
    managed_by = UserMiniSerializer(read_only=True)
    can_manage_accounts = serializers.SerializerMethodField()
    can_manage_stakeholders = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "effective_role",
            "account_status",
            "is_staff",
            "is_superuser",
            "is_active",
            "can_use_chat",
            "must_change_password",
            "employee_profile",
            "managed_by",
            "can_manage_accounts",
            "can_manage_stakeholders",
            "last_seen_at",
            "last_login",
            "date_joined",
        ]

    def get_display_name(self, obj):
        return obj.get_display_name()

    def get_can_manage_accounts(self, obj):
        return obj.effective_role in {User.ROLE_SUPER_ADMIN, User.ROLE_HR}

    def get_can_manage_stakeholders(self, obj):
        return obj.effective_role == User.ROLE_SUPER_ADMIN


class UserAccountSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    effective_role = serializers.CharField(read_only=True)
    employee_profile = EmployeeAccountEmployeeSerializer(read_only=True)
    managed_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "effective_role",
            "account_status",
            "is_active",
            "can_use_chat",
            "must_change_password",
            "employee_profile",
            "managed_by",
            "last_login",
            "last_seen_at",
            "date_joined",
        ]

    def get_display_name(self, obj):
        return obj.get_display_name()


class UserAccountWriteSerializer(serializers.ModelSerializer):
    employee_profile_id = serializers.PrimaryKeyRelatedField(
        source="employee_profile",
        queryset=Employee.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "account_status",
            "is_active",
            "can_use_chat",
            "must_change_password",
            "employee_profile_id",
            "password",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        role = attrs.get("role") or getattr(self.instance, "role", User.ROLE_EMPLOYEE)
        employee_profile = attrs.get("employee_profile", getattr(self.instance, "employee_profile", None))

        if actor and getattr(actor, "is_authenticated", False) and actor.effective_role == User.ROLE_HR:
            if role != User.ROLE_EMPLOYEE:
                raise serializers.ValidationError("HR can only create or manage employee logins.")

        if role == User.ROLE_EMPLOYEE and not employee_profile:
            raise serializers.ValidationError("Employee logins must be linked to an employee record.")

        if role != User.ROLE_EMPLOYEE and employee_profile:
            raise serializers.ValidationError("Only employee logins can be linked to an employee record.")

        if employee_profile:
            existing = User.objects.filter(employee_profile=employee_profile)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("This employee already has a login account.")

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", "") or User.objects.make_random_password()
        employee_profile = validated_data.get("employee_profile")
        account_status = validated_data.get("account_status") or User.STATUS_ACTIVE

        if employee_profile and not validated_data.get("email"):
            validated_data["email"] = employee_profile.email
        if employee_profile and not validated_data.get("first_name"):
            validated_data["first_name"] = employee_profile.first_name
        if employee_profile and not validated_data.get("last_name"):
            validated_data["last_name"] = employee_profile.last_name or ""
        if employee_profile and not validated_data.get("display_name"):
            validated_data["display_name"] = f"{employee_profile.first_name} {employee_profile.last_name or ''}".strip()

        user = User(**validated_data)
        user.account_status = account_status
        user.is_active = account_status != User.STATUS_BLOCKED and validated_data.get("is_active", True)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        account_status = validated_data.get("account_status", instance.account_status)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.account_status = account_status
        instance.is_active = account_status != User.STATUS_BLOCKED and validated_data.get("is_active", instance.is_active)

        if password:
            instance.set_password(password)
            instance.must_change_password = True

        instance.save()
        return instance
