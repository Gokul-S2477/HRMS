from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True, db_index=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Designation(models.Model):
    title = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True, null=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="designations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title


class Employee(models.Model):
    EMPLOYMENT_TYPES = [
        ("Full-Time", "Full-Time"),
        ("Part-Time", "Part-Time"),
        ("Contract", "Contract"),
        ("Intern", "Intern"),
    ]

    MARITAL_STATUS = [
        ("Single", "Single"),
        ("Married", "Married"),
        ("Divorced", "Divorced"),
        ("Widowed", "Widowed"),
    ]

    emp_code = models.CharField(max_length=50, unique=True, db_index=True)
    first_name = models.CharField(max_length=120)
    middle_name = models.CharField(max_length=120, blank=True, null=True)
    last_name = models.CharField(max_length=120, blank=True, null=True)
    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    alternate_phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    gender = models.CharField(max_length=20, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)

    emergency_contact_name = models.CharField(max_length=120, blank=True, null=True)
    emergency_contact_number = models.CharField(max_length=20, blank=True, null=True)

    role = models.CharField(max_length=60, default="Other")
    joining_date = models.DateField(blank=True, null=True)
    employment_type = models.CharField(
        max_length=30, choices=EMPLOYMENT_TYPES, default="Full-Time"
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    designation = models.ForeignKey(
        Designation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )

    reporting_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reportees",
    )

    national_id = models.CharField(max_length=120, blank=True, null=True)
    blood_group = models.CharField(max_length=10, blank=True, null=True)
    marital_status = models.CharField(
        max_length=15, choices=MARITAL_STATUS, default="Single"
    )
    work_shift = models.CharField(max_length=120, blank=True, null=True)
    work_location = models.CharField(max_length=120, blank=True, null=True)

    salary = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    permissions = models.JSONField(default=dict, blank=True)

    # Extended profile sections (used in Employee Details)
    about = models.TextField(blank=True, null=True)
    personal_info = models.JSONField(default=dict, blank=True)
    bank_info = models.JSONField(default=dict, blank=True)
    family_info = models.JSONField(default=dict, blank=True)
    education = models.JSONField(default=list, blank=True)
    experience = models.JSONField(default=list, blank=True)
    projects = models.JSONField(default=list, blank=True)
    assets = models.JSONField(default=list, blank=True)

    photo = models.FileField(upload_to="employee_photos/", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        last = f" {self.last_name}" if self.last_name else ""
        return f"{self.first_name}{last} ({self.emp_code})"


class Policy(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="policies",
    )
    file = models.FileField(upload_to="policies/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title
