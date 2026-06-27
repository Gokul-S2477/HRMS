"""
HRMS Full Seed Script — Corrected for actual model fields
==========================================================
Run: python seed_full.py
"""
import os
import sys
import django
from datetime import date, timedelta
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from employees.models import Employee, Department, Designation
from coredata.models import Resource

User = get_user_model()

print("\n" + "="*60)
print("HRMS FULL SEED — Starting...")
print("="*60)

# ─────────────────────────────────────────────
# STEP 0 — Clear all data (keep admin user)
# ─────────────────────────────────────────────
print("\n[STEP 0] Clearing existing data...")

User.objects.exclude(username="admin").delete()
print("  ✓ Removed non-admin users")

Employee.objects.all().delete()
print("  ✓ Cleared all employees")

Designation.objects.all().delete()
Department.objects.all().delete()
print("  ✓ Cleared departments & designations")

Resource.objects.all().delete()
print("  ✓ Cleared all resources")

try:
    from coredata.models import RecruitmentJob, RecruitmentCandidate, JobApplication
    JobApplication.objects.all().delete()
    RecruitmentCandidate.objects.all().delete()
    RecruitmentJob.objects.all().delete()
    print("  ✓ Cleared recruitment data")
except Exception as e:
    print(f"  ⚠ Recruitment clear: {e}")

try:
    from coredata.models import LeaveBalance, LeaveLedger
    LeaveLedger.objects.all().delete()
    LeaveBalance.objects.all().delete()
    print("  ✓ Cleared leave balances & ledger")
except Exception as e:
    print(f"  ⚠ Leave clear: {e}")

try:
    from coredata.models import Payroll, PayrollComponent, SalaryComponent
    PayrollComponent.objects.all().delete()
    Payroll.objects.all().delete()
    SalaryComponent.objects.all().delete()
    print("  ✓ Cleared payroll data")
except Exception as e:
    print(f"  ⚠ Payroll clear: {e}")

print("  ✅ Data cleared")

# ─────────────────────────────────────────────
# STEP 1 — Departments
# ─────────────────────────────────────────────
print("\n[STEP 1] Creating Departments...")

dept_hr = Department.objects.create(name="Human Resources")
dept_it = Department.objects.create(name="Information Technology")
dept_acc = Department.objects.create(name="Accounts & Finance")
dept_mkt = Department.objects.create(name="Marketing")
dept_ops = Department.objects.create(name="Operations")

print(f"  ✓ Human Resources        (ID: {dept_hr.id})")
print(f"  ✓ Information Technology (ID: {dept_it.id})")
print(f"  ✓ Accounts & Finance     (ID: {dept_acc.id})")
print(f"  ✓ Marketing              (ID: {dept_mkt.id})")
print(f"  ✓ Operations             (ID: {dept_ops.id})")

# ─────────────────────────────────────────────
# STEP 2 — Designations
# ─────────────────────────────────────────────
print("\n[STEP 2] Creating Designations...")

desig_hr_mgr   = Designation.objects.create(title="HR Manager",           department=dept_hr)
desig_hr_exec  = Designation.objects.create(title="HR Executive",          department=dept_hr)
desig_sw_eng   = Designation.objects.create(title="Software Engineer",     department=dept_it)
desig_sw_lead  = Designation.objects.create(title="Tech Lead",             department=dept_it)
desig_acc_exec = Designation.objects.create(title="Accounts Executive",    department=dept_acc)
desig_mkt_exec = Designation.objects.create(title="Marketing Executive",   department=dept_mkt)

print(f"  ✓ HR Manager         (ID: {desig_hr_mgr.id})")
print(f"  ✓ HR Executive       (ID: {desig_hr_exec.id})")
print(f"  ✓ Software Engineer  (ID: {desig_sw_eng.id})")
print(f"  ✓ Tech Lead          (ID: {desig_sw_lead.id})")
print(f"  ✓ Accounts Executive (ID: {desig_acc_exec.id})")
print(f"  ✓ Marketing Executive(ID: {desig_mkt_exec.id})")

# ─────────────────────────────────────────────
# STEP 3 — Leave Types per Designation
# ─────────────────────────────────────────────
print("\n[STEP 3] Creating Leave Types...")

def make_leave(name, days, desig):
    Resource.objects.create(
        resource_type="leave-types",
        data={"name": name, "days": days, "status": "Active",
              "designation_id": str(desig.id), "designation_name": desig.title}
    )

# HR Manager
make_leave("Casual Leave (CL)", 6,  desig_hr_mgr)
make_leave("Sick Leave (SL)",   6,  desig_hr_mgr)
make_leave("Earned Leave (EL)", 15, desig_hr_mgr)

# HR Executive
make_leave("Casual Leave (CL)", 6,  desig_hr_exec)
make_leave("Sick Leave (SL)",   6,  desig_hr_exec)
make_leave("Earned Leave (EL)", 12, desig_hr_exec)

# Software Engineer
make_leave("Casual Leave (CL)", 8,  desig_sw_eng)
make_leave("Sick Leave (SL)",   8,  desig_sw_eng)
make_leave("Earned Leave (EL)", 18, desig_sw_eng)

# Tech Lead
make_leave("Casual Leave (CL)", 8,  desig_sw_lead)
make_leave("Sick Leave (SL)",   6,  desig_sw_lead)
make_leave("Earned Leave (EL)", 20, desig_sw_lead)

# Accounts Executive
make_leave("Casual Leave (CL)", 6,  desig_acc_exec)
make_leave("Sick Leave (SL)",   6,  desig_acc_exec)
make_leave("Earned Leave (EL)", 12, desig_acc_exec)

print(f"  ✓ {Resource.objects.filter(resource_type='leave-types').count()} leave types created")

# ─────────────────────────────────────────────
# STEP 4 — Global Leave Settings
# ─────────────────────────────────────────────
print("\n[STEP 4] Creating Leave Settings...")

Resource.objects.create(
    resource_type="leave-settings",
    data={"max_leave_days": 30, "carry_forward_days": 5,
          "min_notice_days": 2, "approval_required": True}
)
print("  ✓ Leave settings saved")

# ─────────────────────────────────────────────
# STEP 5 — HR User & Employee
# ─────────────────────────────────────────────
print("\n[STEP 5] Creating HR Manager (Priya Sharma)...")

hr_user = User.objects.create_user(
    username="priya.sharma",
    email="priya.sharma@palupupharma.com",
    password="HRPass@2025",
    first_name="Priya",
    last_name="Sharma",
)
hr_user.role = "hr"
hr_user.save()

hr_emp = Employee.objects.create(
    emp_code="EMP001",
    first_name="Priya",
    last_name="Sharma",
    email="priya.sharma@palupupharma.com",
    phone="9876543210",
    gender="Female",
    date_of_birth=date(1990, 4, 15),
    joining_date=date(2022, 1, 10),
    department=dept_hr,
    designation=desig_hr_mgr,
    employment_type="Full-Time",
    is_active=True,
    role="hr",
    national_id="1234-1234-1234",
    blood_group="B+",
    marital_status="Married",
    address="12, MG Road, Hyderabad, Telangana - 500001",
    salary=Decimal("55000.00"),
    bank_info={
        "bank_name": "HDFC Bank",
        "account_number": "12345678901",
        "ifsc_code": "HDFC0001234",
        "branch": "Hyderabad Main Branch"
    },
    personal_info={
        "pan_number": "ABCDE1234F",
        "aadhar": "1234-1234-1234",
        "city": "Hyderabad",
        "state": "Telangana",
        "country": "India",
        "pincode": "500001"
    },
)
hr_user.employee_profile = hr_emp
hr_user.save()

print(f"  ✓ User: priya.sharma | email: priya.sharma@palupupharma.com | role: hr | password: HRPass@2025")
print(f"  ✓ Employee: Priya Sharma (EMP001, DB ID: {hr_emp.id})")

# ─────────────────────────────────────────────
# STEP 6 — Regular Employee (IT)
# ─────────────────────────────────────────────
print("\n[STEP 6] Creating Software Engineer (Rahul Kumar)...")

emp_user = User.objects.create_user(
    username="rahul.kumar",
    email="rahul.kumar@palupupharma.com",
    password="Emp@2025!",
    first_name="Rahul",
    last_name="Kumar",
)
emp_user.role = "employee"
emp_user.save()

emp = Employee.objects.create(
    emp_code="EMP002",
    first_name="Rahul",
    last_name="Kumar",
    email="rahul.kumar@palupupharma.com",
    phone="9876512345",
    gender="Male",
    date_of_birth=date(1995, 8, 22),
    joining_date=date(2023, 6, 1),
    department=dept_it,
    designation=desig_sw_eng,
    employment_type="Full-Time",
    is_active=True,
    role="employee",
    national_id="5678-5678-5678",
    blood_group="O+",
    marital_status="Single",
    address="45, Jubilee Hills, Hyderabad, Telangana - 500033",
    salary=Decimal("40000.00"),
    bank_info={
        "bank_name": "SBI",
        "account_number": "98765432101",
        "ifsc_code": "SBIN0001234",
        "branch": "Jubilee Hills Branch"
    },
    personal_info={
        "pan_number": "XYZAB4321G",
        "aadhar": "5678-5678-5678",
        "city": "Hyderabad",
        "state": "Telangana",
        "country": "India",
        "pincode": "500033"
    },
)
emp_user.employee_profile = emp
emp_user.save()

print(f"  ✓ User: rahul.kumar | email: rahul.kumar@palupupharma.com | role: employee | password: Emp@2025!")
print(f"  ✓ Employee: Rahul Kumar (EMP002, DB ID: {emp.id})")

# ─────────────────────────────────────────────
# STEP 7 — Leave Balances
# ─────────────────────────────────────────────
print("\n[STEP 7] Creating Leave Balances...")

try:
    from coredata.models import LeaveBalance
    yr = date.today().year

    for lt, days in [("Casual Leave (CL)", 6), ("Sick Leave (SL)", 6), ("Earned Leave (EL)", 15)]:
        LeaveBalance.objects.create(
            employee=hr_emp, leave_type=lt, year=yr,
            annual_allocation=Decimal(str(days)),
            used=Decimal("0"), pending=Decimal("0"),
        )

    for lt, days in [("Casual Leave (CL)", 8), ("Sick Leave (SL)", 8), ("Earned Leave (EL)", 18)]:
        LeaveBalance.objects.create(
            employee=emp, leave_type=lt, year=yr,
            annual_allocation=Decimal(str(days)),
            used=Decimal("0"), pending=Decimal("0"),
        )

    print(f"  ✓ Leave balances: Priya Sharma — CL:6, SL:6, EL:15")
    print(f"  ✓ Leave balances: Rahul Kumar  — CL:8, SL:8, EL:18")
except Exception as e:
    print(f"  ⚠ Leave balances skipped: {e}")
    import traceback; traceback.print_exc()

# ─────────────────────────────────────────────
# STEP 8 — Public Job Posting
# ─────────────────────────────────────────────
print("\n[STEP 8] Creating Public Job Posting...")

try:
    from coredata.models import RecruitmentJob
    admin_user = User.objects.get(username="admin")

    job = RecruitmentJob.objects.create(
        title="Software Engineer",
        department_name="Information Technology",
        location="Hyderabad",
        city="Hyderabad",
        state="Telangana",
        country="India",
        employment_type="Full-Time",
        work_mode="Hybrid",
        openings=2,
        experience_min_years=Decimal("1.0"),
        experience_max_years=Decimal("3.0"),
        salary_min=Decimal("400000"),
        salary_max=Decimal("700000"),
        skills=["Python", "Django", "REST APIs", "PostgreSQL", "Git"],
        description=(
            "We are looking for a passionate Software Engineer to join our IT team at PALEPU PHARMA. "
            "You will design, develop and maintain backend services and APIs for our internal HRMS platform.\n\n"
            "Key Responsibilities:\n"
            "• Develop and maintain Django REST APIs\n"
            "• Write clean, testable code\n"
            "• Collaborate with cross-functional teams\n"
            "• Participate in code reviews\n"
            "• Debug and fix production issues"
        ),
        benefits=(
            "• Competitive salary (4-7 LPA)\n"
            "• Health insurance for employee + family\n"
            "• Flexible work hours (Hybrid model)\n"
            "• 30 days paid leave per year\n"
            "• Learning & development budget"
        ),
        hiring_manager="Priya Sharma",
        status=RecruitmentJob.STATUS_OPEN,
        is_public=True,
        posted_on=date.today(),
        closing_on=date.today() + timedelta(days=60),
        created_by=admin_user,
    )
    print(f"  ✓ Job: '{job.title}' | ID: {job.id} | Status: {job.status} | Public: {job.is_public}")
    print(f"  ✓ Visit: http://localhost:3000/careers/jobs (frontend)")
    print(f"  ✓ API:   http://localhost:8000/api/public/jobs/")

except Exception as e:
    print(f"  ⚠ Job creation failed: {e}")
    import traceback; traceback.print_exc()

# ─────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("  SEED COMPLETE — SUMMARY")
print("="*60)
print(f"  Departments:  {Department.objects.count()}")
print(f"  Designations: {Designation.objects.count()}")
print(f"  Leave Types:  {Resource.objects.filter(resource_type='leave-types').count()}")
print(f"  Employees:    {Employee.objects.count()}")
print(f"  Users:        {User.objects.count()}")

try:
    from coredata.models import RecruitmentJob, LeaveBalance
    print(f"  Jobs (public):{RecruitmentJob.objects.filter(is_public=True).count()}")
    print(f"  Leave Bal.:   {LeaveBalance.objects.count()}")
except Exception:
    pass

print("\n  LOGIN CREDENTIALS:")
print("  ┌──────────────┬──────────────────────────────────────────┬─────────────┐")
print("  │ Role         │ Email / Username                         │ Password    │")
print("  ├──────────────┼──────────────────────────────────────────┼─────────────┤")
print("  │ Admin        │ admin                                    │ (existing)  │")
print("  │ HR Manager   │ priya.sharma@palupupharma.com            │ HRPass@2025 │")
print("  │ Employee     │ rahul.kumar@palupupharma.com             │ Emp@2025!   │")
print("  └──────────────┴──────────────────────────────────────────┴─────────────┘")
print("\n  ✅ All done! Refresh the portal and start testing.\n")
