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

    # Probation tracking fields (Task 4.6)
    probation_period_months = models.IntegerField(default=6)
    probation_status = models.CharField(
        max_length=30,
        choices=[
            ("on_probation", "On Probation"),
            ("confirmed", "Confirmed"),
            ("extended", "Extended"),
            ("terminated", "Terminated")
        ],
        default="on_probation"
    )
    probation_end_date = models.DateField(blank=True, null=True)
    confirmed_on = models.DateField(blank=True, null=True)
    confirmed_by = models.ForeignKey(
        "users.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_probations"
    )

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

    def save(self, *args, **kwargs):
        # Auto-calculate probation end date if not set and joining_date exists
        if not self.probation_end_date and self.joining_date:
            import datetime
            try:
                months = self.probation_period_months or 6
                year = self.joining_date.year + (self.joining_date.month + months - 1) // 12
                month = (self.joining_date.month + months - 1) % 12 + 1
                # Handle end of month days safely
                days_in_month = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
                day = min(self.joining_date.day, days_in_month[month-1])
                self.probation_end_date = datetime.date(year, month, day)
            except Exception:
                pass
        super().save(*args, **kwargs)

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


class SalaryRevision(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("approved", "Approved"),
    ]
    REVISION_TYPE_CHOICES = [
        ("increment", "Increment"),
        ("promotion", "Promotion"),
        ("correction", "Correction"),
        ("joining", "Joining"),
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salary_revisions")
    revised_by = models.ForeignKey("users.CustomUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="revised_salaries")
    effective_date = models.DateField()
    previous_salary = models.DecimalField(max_digits=12, decimal_places=2)
    new_salary = models.DecimalField(max_digits=12, decimal_places=2)
    revision_percentage = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    reason = models.TextField(blank=True, null=True)
    revision_type = models.CharField(max_length=30, choices=REVISION_TYPE_CHOICES, default="increment")
    approved_by = models.ForeignKey("users.CustomUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_salary_revisions")
    approved_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-effective_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.employee.first_name} - {self.previous_salary} -> {self.new_salary}"


class EmployeeTransfer(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="transfers")
    from_department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_from")
    to_department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_to")
    from_designation = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_from")
    to_designation = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_to")
    from_reporting_to = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_reporting_from")
    to_reporting_to = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_reporting_to")
    effective_date = models.DateField()
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    approved_by = models.ForeignKey("users.CustomUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_transfers")
    approved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-effective_date", "-created_at"]

    def __str__(self) -> str:
        return f"Transfer of {self.employee.first_name} to {self.to_department}"
