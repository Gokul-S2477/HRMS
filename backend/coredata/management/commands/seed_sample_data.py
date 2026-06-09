from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from chatbox.models import ChatMessage, ChatParticipant, ChatThread
from coredata.models import (
    AssetAssignment,
    AssetCategory,
    DocumentCategory,
    EmployeeDocument,
    OffboardingCase,
    OnboardingRecord,
    OnboardingTask,
    OnboardingTemplate,
    OvertimeEntry,
    ProductivityNote,
    ProductivityTodo,
    RecruitmentCandidate,
    RecruitmentInterview,
    RecruitmentJob,
    RecruitmentReferral,
    ReminderEvent,
    Resource,
    ShiftDefinition,
    TimesheetEntry,
    ExpenseClaim,
)
from coredata.workflow_services import ensure_onboarding_tasks, sync_generic_resource
from employees.models import Department, Designation, Employee, Policy
from payroll.models import EmployeePayroll, FinalSettlement, PayrollComplianceProfile, SalaryComponent
from payroll.services import ensure_final_settlement, recalculate_employee_payroll


class Command(BaseCommand):
    help = "Seed minimal sample data (2 records per module) for HRMS demo/testing."

    def handle(self, *args, **options):
        created_summary = []

        # --- user (for login) ---
        User = get_user_model()
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.com",
                "role": User.ROLE_SUPER_ADMIN,
                "display_name": "Platform Super Admin",
            },
        )
        admin_user.role = User.ROLE_SUPER_ADMIN
        admin_user.display_name = admin_user.display_name or "Platform Super Admin"
        admin_user.account_status = User.STATUS_ACTIVE
        admin_user.can_use_chat = True
        admin_user.is_active = True
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.set_password("Admin@123")
        if created:
            created_summary.append("user:admin")
        admin_user.save()

        # --- departments ---
        hr, hr_created = Department.objects.get_or_create(
            name="Human Resources",
            defaults={"description": "People operations and HR policies."},
        )
        eng, eng_created = Department.objects.get_or_create(
            name="Engineering",
            defaults={"description": "Product engineering and delivery."},
        )
        if hr_created:
            created_summary.append("department:Human Resources")
        if eng_created:
            created_summary.append("department:Engineering")

        # --- designations ---
        hr_mgr, created = Designation.objects.get_or_create(
            title="HR Manager",
            defaults={"description": "Leads HR operations.", "department": hr},
        )
        if created:
            created_summary.append("designation:HR Manager")
        elif hr_mgr.department_id is None:
            hr_mgr.department = hr
            hr_mgr.save(update_fields=["department"])

        se, created = Designation.objects.get_or_create(
            title="Software Engineer",
            defaults={"description": "Builds product features.", "department": eng},
        )
        if created:
            created_summary.append("designation:Software Engineer")
        elif se.department_id is None:
            se.department = eng
            se.save(update_fields=["department"])

        # --- employees ---
        today = timezone.now().date()
        emp1, created = Employee.objects.get_or_create(
            emp_code="EMP-001",
            defaults={
                "first_name": "Asha",
                "last_name": "Kumar",
                "email": "asha.kumar@example.com",
                "phone": "9000000001",
                "joining_date": today,
                "department": hr,
                "designation": hr_mgr,
                "role": "HR",
                "salary": Decimal("60000.00"),
                "is_active": True,
            },
        )
        if created:
            created_summary.append("employee:EMP-001")

        emp2, created = Employee.objects.get_or_create(
            emp_code="EMP-002",
            defaults={
                "first_name": "Ravi",
                "last_name": "Patel",
                "email": "ravi.patel@example.com",
                "phone": "9000000002",
                "joining_date": today,
                "department": eng,
                "designation": se,
                "role": "Engineer",
                "salary": Decimal("85000.00"),
                "is_active": True,
                "reporting_to": emp1 if emp1.pk else None,
            },
        )
        if created:
            created_summary.append("employee:EMP-002")

        def ensure_user_account(*, username: str, password: str, role: str, employee: Employee | None = None, display_name: str = "", email: str = "", managed_by=None):
            defaults = {
                "email": email or (employee.email if employee else ""),
                "role": role,
                "display_name": display_name or (f"{employee.first_name} {employee.last_name or ''}".strip() if employee else username.title()),
                "employee_profile": employee,
                "managed_by": managed_by,
                "account_status": User.STATUS_ACTIVE,
                "can_use_chat": True,
                "is_active": True,
            }
            account, account_created = User.objects.get_or_create(username=username, defaults=defaults)
            updated = False
            for key, value in defaults.items():
                if getattr(account, key) != value and (value is not None or key != "employee_profile"):
                    setattr(account, key, value)
                    updated = True
            account.set_password(password)
            updated = True
            if account_created:
                created_summary.append(f"user:{username}")
            if updated:
                account.save()
            return account

        hr_user = ensure_user_account(
            username="hr.manager",
            password="HR@12345",
            role=User.ROLE_HR,
            employee=emp1,
            display_name="Asha Kumar",
            email=emp1.email,
            managed_by=admin_user,
        )
        employee_user = ensure_user_account(
            username="ravi.patel",
            password="Emp@12345",
            role=User.ROLE_EMPLOYEE,
            employee=emp2,
            display_name="Ravi Patel",
            email=emp2.email,
            managed_by=hr_user,
        )
        stakeholder_one = ensure_user_account(
            username="stakeholder.one",
            password="Stake@12345",
            role=User.ROLE_STAKEHOLDER,
            display_name="Nina Shah",
            email="nina.shah@example.com",
            managed_by=admin_user,
        )
        stakeholder_two = ensure_user_account(
            username="stakeholder.two",
            password="Stake@12346",
            role=User.ROLE_STAKEHOLDER,
            display_name="Rahul Sen",
            email="rahul.sen@example.com",
            managed_by=admin_user,
        )

        # enrich employee profiles (only if empty)
        def enrich_employee(emp: Employee):
            updated = False
            is_first = emp.emp_code == "EMP-001"
            primary_name = "Adrian Peralt" if is_first else "Rohit Sharma"
            primary_phone = "+1 127 2685 598" if is_first else "+91 90000 90002"
            secondary_name = "Karen Wills" if is_first else "Meera Patel"
            secondary_phone = "+1 989 7774 787" if is_first else "+91 98888 70002"

            if not emp.about:
                emp.about = (
                    f"{emp.first_name} works as "
                    f"{emp.designation.title if emp.designation else 'an employee'} "
                    f"in the {emp.department.name if emp.department else 'company'} department. "
                    "This section can include profile summary and key achievements."
                )
                updated = True

            if not emp.emergency_contact_name:
                emp.emergency_contact_name = primary_name
                updated = True
            if not emp.emergency_contact_number:
                emp.emergency_contact_number = primary_phone
                updated = True

            personal_info = emp.personal_info or {}
            if not personal_info:
                personal_info = {
                    "passport_expiry": "2029-05-15",
                    "nationality": "Indian",
                    "religion": "Christianity",
                    "children_count": 2 if is_first else 0,
                }
                updated = True
            else:
                if not personal_info.get("passport_expiry"):
                    personal_info["passport_expiry"] = "2029-05-15"
                    updated = True
                if not personal_info.get("nationality"):
                    personal_info["nationality"] = "Indian"
                    updated = True
                if not personal_info.get("religion"):
                    personal_info["religion"] = "Christianity"
                    updated = True
                if personal_info.get("children_count") in (None, ""):
                    personal_info["children_count"] = 2 if is_first else 0
                    updated = True
            emp.personal_info = personal_info

            if not emp.bank_info:
                emp.bank_info = {
                    "bank_name": "HDFC Bank",
                    "account_number": "XXXXXX1234",
                    "ifsc": "HDFC0001234",
                    "branch": "Bengaluru Main",
                    "pan": "ABCDE1234F",
                    "pf_number": "PF-001",
                }
                updated = True

            family_info = emp.family_info or {}
            if not family_info:
                family_info = {
                    "spouse_name": "-",
                    "spouse_employment": "-",
                    "children_count": personal_info.get("children_count", 0),
                    "emergency_name": secondary_name,
                    "emergency_phone": secondary_phone,
                }
                updated = True
            else:
                if not family_info.get("spouse_name"):
                    family_info["spouse_name"] = "-"
                    updated = True
                if not family_info.get("spouse_employment"):
                    family_info["spouse_employment"] = "-"
                    updated = True
                if family_info.get("children_count") in (None, ""):
                    family_info["children_count"] = personal_info.get("children_count", 0)
                    updated = True
                if not family_info.get("emergency_name"):
                    family_info["emergency_name"] = secondary_name
                    updated = True
                if not family_info.get("emergency_phone"):
                    family_info["emergency_phone"] = secondary_phone
                    updated = True
            emp.family_info = family_info

            if not emp.education:
                emp.education = [
                    {"degree": "MBA - HR", "institute": "IIM Bangalore", "year": "2018"},
                    {"degree": "BBA", "institute": "Delhi University", "year": "2016"},
                ]
                updated = True

            if not emp.experience:
                emp.experience = [
                    {"company": "PeopleFirst", "role": "HR Executive", "from": "2018", "to": "2021"},
                    {"company": "TalentHub", "role": "HR Manager", "from": "2021", "to": "Present"},
                ]
                updated = True

            if not emp.projects:
                emp.projects = [
                    {"name": "World Health", "tasks": 8, "completed": 15, "deadline": "31 July 2025", "lead": "Leona"},
                    {"name": "Hospital Administration", "tasks": 8, "completed": 15, "deadline": "31 July 2025", "lead": "Leona"},
                ]
                updated = True

            if not emp.assets:
                emp.assets = [
                    {"name": "MacBook Pro", "status": "Assigned", "assigned_on": "2025-06-01"},
                    {"name": "iPhone 13", "status": "Assigned", "assigned_on": "2025-08-15"},
                ]
                updated = True

            if updated:
                emp.save()

        if emp1.pk:
            enrich_employee(emp1)
        if emp2.pk:
            enrich_employee(emp2)

        # --- policies ---
        p1, created = Policy.objects.get_or_create(
            title="Work From Home Policy",
            defaults={
                "description": "WFH allowed up to 2 days/week with manager approval.",
                "department": hr,
            },
        )
        if created:
            created_summary.append("policy:WFH")

        p2, created = Policy.objects.get_or_create(
            title="Leave Policy",
            defaults={
                "description": "Annual leave and carry forward rules.",
                "department": hr,
            },
        )
        if created:
            created_summary.append("policy:Leave")

        # --- payroll ---
        profile, created = PayrollComplianceProfile.objects.get_or_create(
            name="Default India Payroll",
            defaults={
                "country": "India",
                "currency_code": "USD",
                "employee_pf_rate": Decimal("12.00"),
                "employer_pf_rate": Decimal("12.00"),
                "pf_monthly_cap": Decimal("1800.00"),
                "employee_esi_rate": Decimal("0.75"),
                "employer_esi_rate": Decimal("3.25"),
                "esi_wage_limit": Decimal("21000.00"),
                "professional_tax_amount": Decimal("200.00"),
                "professional_tax_threshold": Decimal("15000.00"),
                "leave_salary_divisor": Decimal("30.00"),
                "gratuity_days_factor": Decimal("15.00"),
                "gratuity_service_years": 5,
                "notice_period_days": 30,
                "notice_recovery_enabled": True,
                "is_active": True,
            },
        )
        if created:
            created_summary.append("payroll_profile:default")

        sc1, created = SalaryComponent.objects.get_or_create(
            name="Basic Pay",
            defaults={"component_type": "earning", "amount": Decimal("10000.00")},
        )
        if created:
            created_summary.append("salary_component:Basic Pay")

        sc2, created = SalaryComponent.objects.get_or_create(
            name="Professional Tax",
            defaults={"component_type": "deduction", "amount": Decimal("200.00")},
        )
        if created:
            created_summary.append("salary_component:Professional Tax")

        def seed_payroll(emp: Employee, month: str, year: int, *, basic: Decimal, hra: Decimal, allowance: Decimal, tds: Decimal):
            payroll, created = EmployeePayroll.objects.get_or_create(
                employee=emp,
                month=month,
                year=year,
                defaults={
                    "status": EmployeePayroll.STATUS_PUBLISHED,
                    "pay_date": timezone.now().date(),
                    "basic_salary": basic,
                    "hra": hra,
                    "earnings_breakdown": {
                        "basic": float(basic),
                        "da": 0,
                        "hra": float(hra),
                        "conveyance": 200,
                        "allowance": float(allowance),
                        "medical": 0,
                        "others": 0,
                    },
                    "deductions_breakdown": {
                        "tds": float(tds),
                        "esi": 0,
                        "pf": 0,
                        "leave": 0,
                        "prof_tax": 0,
                        "labour_welfare": 0,
                        "others": 0,
                    },
                    "extra_earnings": [],
                    "extra_deductions": [],
                    "bonus_amount": Decimal("0.00"),
                    "reimbursement_amount": Decimal("0.00"),
                    "arrears_amount": Decimal("0.00"),
                },
            )
            if created:
                payroll.components.set([sc1, sc2])
                created_summary.append(f"employee_payroll:{emp.emp_code}:{month}/{year}")
            payroll.status = EmployeePayroll.STATUS_PUBLISHED
            payroll.published_at = payroll.published_at or timezone.now()
            payroll.save()
            recalculate_employee_payroll(payroll)
            return payroll

        payroll_emp1 = seed_payroll(emp1, "January", 2026, basic=Decimal("3200.00"), hra=Decimal("900.00"), allowance=Decimal("250.00"), tds=Decimal("180.00")) if emp1.pk else None
        payroll_emp2 = seed_payroll(emp2, "January", 2026, basic=Decimal("4200.00"), hra=Decimal("1200.00"), allowance=Decimal("300.00"), tds=Decimal("240.00")) if emp2.pk else None

        # --- coredata resources (HRM/Settings) ---
        def seed_resources(resource_type: str, items: list[dict]):
            existing = Resource.objects.filter(resource_type=resource_type).count()
            if existing >= 2:
                return
            for item in items[existing:2]:
                Resource.objects.create(resource_type=resource_type, data=item)
                created_summary.append(f"resource:{resource_type}")

        emp1_name = f"{emp1.first_name} {emp1.last_name}".strip()
        emp2_name = f"{emp2.first_name} {emp2.last_name}".strip()

        seed_resources(
            "holidays",
            [
                {
                    "title": "Republic Day",
                    "date": "2026-01-26",
                    "description": "National holiday",
                    "status": "Active",
                },
                {
                    "title": "Company Retreat",
                    "date": "2026-04-15",
                    "description": "Annual offsite retreat",
                    "status": "Active",
                },
            ],
        )

        seed_resources(
            "attendance-settings",
            [
                {
                    "latitude": 12.9716,
                    "longitude": 77.5946,
                    "radius": 5000,
                    "ip_ranges": ["127.0.0.1", "192.168.1.", "10.0.0."],
                }
            ],
        )

        seed_resources(
            "leave-admin",
            [
                {
                    "employee_id": emp1.id,
                    "employee_name": emp1_name,
                    "leave_type": "Casual",
                    "from_date": "2026-03-20",
                    "to_date": "2026-03-21",
                    "status": "Approved",
                    "reason": "Family event",
                },
                {
                    "employee_id": emp2.id,
                    "employee_name": emp2_name,
                    "leave_type": "Sick",
                    "from_date": "2026-03-25",
                    "to_date": "2026-03-26",
                    "status": "Pending",
                    "reason": "Medical checkup",
                },
            ],
        )

        seed_resources(
            "leave-employee",
            [
                {
                    "employee_id": emp2.id,
                    "employee_name": emp2_name,
                    "leave_type": "Casual",
                    "from_date": "2026-03-28",
                    "to_date": "2026-03-29",
                    "status": "Pending",
                    "reason": "Personal",
                },
                {
                    "employee_id": emp1.id,
                    "employee_name": emp1_name,
                    "leave_type": "Earned",
                    "from_date": "2026-04-02",
                    "to_date": "2026-04-03",
                    "status": "Approved",
                    "reason": "Travel",
                },
            ],
        )

        seed_resources(
            "leave-settings",
            [
                {
                    "max_leave_days": 24,
                    "carry_forward_days": 6,
                    "min_notice_days": 2,
                    "approval_required": True,
                },
                {
                    "max_leave_days": 18,
                    "carry_forward_days": 0,
                    "min_notice_days": 1,
                    "approval_required": False,
                },
            ],
        )

        seed_resources(
            "attendance-admin",
            [
                {
                    "employee_id": emp1.id,
                    "employee_name": emp1_name,
                    "date": "2026-03-10",
                    "status": "Present",
                    "check_in": "09:15",
                    "check_out": "18:05",
                    "remarks": "On time",
                },
                {
                    "employee_id": emp2.id,
                    "employee_name": emp2_name,
                    "date": "2026-03-10",
                    "status": "Late",
                    "check_in": "09:45",
                    "check_out": "18:10",
                    "remarks": "Traffic delay",
                },
            ],
        )

        seed_resources(
            "attendance-employee",
            [
                {
                    "employee_id": emp2.id,
                    "employee_name": emp2_name,
                    "date": "2026-03-11",
                    "status": "Present",
                    "check_in": "09:05",
                    "check_out": "18:00",
                    "remarks": "On time",
                },
                {
                    "employee_id": emp1.id,
                    "employee_name": emp1_name,
                    "date": "2026-03-11",
                    "status": "Half Day",
                    "check_in": "09:10",
                    "check_out": "13:20",
                    "remarks": "Personal work",
                },
            ],
        )

        seed_resources(
            "leave-types",
            [
                {"name": "Casual Leave", "days": 12, "status": "Active"},
                {"name": "Sick Leave", "days": 8, "status": "Active"},
            ],
        )

        seed_resources(
            "tickets",
            [
                {
                    "code": "TIC-001",
                    "category": "IT Support",
                    "title": "Laptop Issue",
                    "subject": "Laptop Issue",
                    "description": "Laptop freezing intermittently during meetings.",
                    "priority": "High",
                    "status": "Open",
                    "assigned_to": "Edgar Hansel",
                    "requested_by": emp1_name,
                    "requester_email": emp1.email,
                    "comments": [
                        {
                            "author": "Edgar Hansel",
                            "message": "Investigating system logs and updates.",
                            "created_at": timezone.now().isoformat(),
                        }
                    ],
                },
                {
                    "code": "TIC-002",
                    "category": "Payment",
                    "title": "Payment Issue",
                    "subject": "Salary transfer delayed",
                    "description": "Bank transfer is pending for payroll.",
                    "priority": "Low",
                    "status": "On Hold",
                    "assigned_to": "Ann Lynch",
                    "requested_by": emp2_name,
                    "requester_email": emp2.email,
                    "comments": [
                        {
                            "author": "Ann Lynch",
                            "message": "Waiting for bank confirmation.",
                            "created_at": timezone.now().isoformat(),
                        }
                    ],
                },
            ],
        )

        seed_resources(
            "crm-contacts",
            [
                {
                    "full_name": "Asha Kumar",
                    "role": "HR Manager",
                    "company_name": "Nexa Health",
                    "email": "asha.kumar@nexahealth.example",
                    "phone": "+1 555 100 0101",
                    "owner": "Leona Hart",
                    "source": "Referral",
                    "status": "Active",
                    "lead_score": 82,
                    "last_contact_date": "2026-03-18",
                    "next_follow_up": "2026-03-29",
                    "city": "Boston",
                    "tags": "Enterprise, HR, Priority",
                    "notes": "Strong champion inside the HR leadership group. Interested in rollout timeline and change management support.",
                },
                {
                    "full_name": "David Lin",
                    "role": "Operations Director",
                    "company_name": "Quantum Nexus",
                    "email": "david.lin@quantumnexus.example",
                    "phone": "+1 555 100 0102",
                    "owner": "Marcus Reed",
                    "source": "Website",
                    "status": "Nurturing",
                    "lead_score": 68,
                    "last_contact_date": "2026-03-16",
                    "next_follow_up": "2026-04-02",
                    "city": "Seattle",
                    "tags": "Mid-market, Ops",
                    "notes": "Looking for automation and workflow reporting improvements.",
                },
            ],
        )

        seed_resources(
            "crm-companies",
            [
                {
                    "company_name": "Nexa Health",
                    "industry": "Healthcare",
                    "website": "https://nexahealth.example",
                    "account_owner": "Leona Hart",
                    "email": "hello@nexahealth.example",
                    "phone": "+1 555 100 0201",
                    "location": "Chicago, IL",
                    "status": "Strategic",
                    "relationship_stage": "Customer",
                    "annual_value": 150000,
                    "employee_band": "500-1000",
                    "notes": "Existing services customer exploring HRMS expansion across three business units.",
                },
                {
                    "company_name": "Quantum Nexus",
                    "industry": "Technology",
                    "website": "https://quantumnexus.example",
                    "account_owner": "Marcus Reed",
                    "email": "info@quantumnexus.example",
                    "phone": "+1 555 100 0202",
                    "location": "Austin, TX",
                    "status": "Prospect",
                    "relationship_stage": "Qualified",
                    "annual_value": 90000,
                    "employee_band": "200-500",
                    "notes": "Fast-growing technology company with active procurement and security review process.",
                },
            ],
        )

        seed_resources(
            "crm-deals",
            [
                {
                    "deal_name": "Nexa HR Platform Rollout",
                    "company_name": "Nexa Health",
                    "contact_name": "Asha Kumar",
                    "value": 48000,
                    "stage": "Negotiation",
                    "probability": 82,
                    "owner": "Leona Hart",
                    "expected_close_date": "2026-04-04",
                    "status": "Open",
                    "source": "Expansion",
                    "next_step": "Finalize legal review and pricing annexure",
                    "notes": "Commercial terms aligned. Procurement sign-off expected next week.",
                },
                {
                    "deal_name": "Quantum Workflow Suite",
                    "company_name": "Quantum Nexus",
                    "contact_name": "David Lin",
                    "value": 32000,
                    "stage": "Qualified",
                    "probability": 45,
                    "owner": "Marcus Reed",
                    "expected_close_date": "2026-04-18",
                    "status": "Open",
                    "source": "Inbound",
                    "next_step": "Schedule deep-dive discovery workshop",
                    "notes": "Team wants automation visibility and resource planning improvements.",
                },
            ],
        )

        seed_resources(
            "crm-leads",
            [
                {
                    "lead_name": "David Lin",
                    "company_name": "Quantum Nexus",
                    "email": "david.lin@quantumnexus.example",
                    "phone": "+1 555 100 0401",
                    "source": "Website",
                    "score": 71,
                    "stage": "Working",
                    "owner": "Marcus Reed",
                    "status": "Qualified",
                    "expected_value": 32000,
                    "next_follow_up": "2026-03-30",
                    "notes": "Strong fit based on multi-team workflow coordination use case.",
                },
                {
                    "lead_name": "Mira Shah",
                    "company_name": "Bright Retail Group",
                    "email": "mira.shah@brightretail.example",
                    "phone": "+1 555 100 0402",
                    "source": "Campaign",
                    "score": 64,
                    "stage": "New",
                    "owner": "Leona Hart",
                    "status": "New",
                    "expected_value": 18000,
                    "next_follow_up": "2026-04-03",
                    "notes": "Interested in onboarding, attendance, and payroll integration.",
                },
            ],
        )

        crm_deals = list(Resource.objects.filter(resource_type="crm-deals"))
        crm_leads = list(Resource.objects.filter(resource_type="crm-leads"))
        nexah_deal = next((item for item in crm_deals if item.data.get("deal_name") == "Nexa HR Platform Rollout"), None)
        mira_lead = next((item for item in crm_leads if item.data.get("lead_name") == "Mira Shah"), None)

        seed_resources(
            "crm-activities",
            [
                {
                    "subject": "Commercial review call",
                    "activity_type": "Call",
                    "channel": "Phone",
                    "relation_type": "deal",
                    "relation_id": str(nexah_deal.id) if nexah_deal else "",
                    "relation_name": "Nexa HR Platform Rollout",
                    "owner": "Leona Hart",
                    "due_date": "2026-03-28",
                    "status": "Scheduled",
                    "outcome": "",
                    "notes": "Confirm final pricing and check legal redlines before close.",
                },
                {
                    "subject": "Discovery demo follow-up",
                    "activity_type": "Email",
                    "channel": "Email",
                    "relation_type": "lead",
                    "relation_id": str(mira_lead.id) if mira_lead else "",
                    "relation_name": "Mira Shah",
                    "owner": "Marcus Reed",
                    "due_date": "2026-03-26",
                    "status": "Scheduled",
                    "outcome": "",
                    "notes": "Send product recap and lock next week's demo slot.",
                },
            ],
        )

        seed_resources(
            "estimates",
            [
                {
                    "estimate_number": "EST-001",
                    "client_name": "Sara Inc",
                    "project_name": "Website Revamp",
                    "issue_date": "2026-03-01",
                    "expiry_date": "2026-03-31",
                    "amount": 12000,
                    "status": "Sent",
                    "description": "UI redesign, frontend implementation, and QA support.",
                },
                {
                    "estimate_number": "EST-002",
                    "client_name": "Nexa Health",
                    "project_name": "HR Portal Setup",
                    "issue_date": "2026-03-05",
                    "expiry_date": "2026-04-05",
                    "amount": 8500,
                    "status": "Accepted",
                    "description": "Portal onboarding, training, and deployment support.",
                },
            ],
        )

        seed_resources(
            "invoices",
            [
                {
                    "invoice_number": "INV-001",
                    "client_name": "Sara Inc",
                    "project_name": "Website Revamp",
                    "issue_date": "2026-03-03",
                    "due_date": "2026-03-25",
                    "amount": 12000,
                    "paid_amount": 6000,
                    "tax_rate": 5,
                    "status": "Partially Paid",
                    "email": "finance@sarainc.example",
                    "phone": "+1 555 110 1001",
                    "address": "3103 Trainer Avenue Peoria, IL 61602",
                    "description": "Phase 1 design and frontend development invoice.",
                    "notes": "Please quote the invoice number while remitting funds.",
                    "terms": "Payment due within 15 days of invoice date.",
                    "line_items": [
                        {"label": "UX Strategy", "qty": 1, "cost": 3000, "discount": 0},
                        {"label": "Frontend Build", "qty": 1, "cost": 9000, "discount": 0},
                    ],
                },
                {
                    "invoice_number": "INV-002",
                    "client_name": "Nexa Health",
                    "project_name": "HR Portal Setup",
                    "issue_date": "2026-03-08",
                    "due_date": "2026-03-28",
                    "amount": 8500,
                    "paid_amount": 8500,
                    "tax_rate": 5,
                    "status": "Paid",
                    "email": "accounts@nexahealth.example",
                    "phone": "+1 555 110 1002",
                    "address": "48 Howard Street Newark, NJ 07102",
                    "description": "Implementation and training invoice.",
                    "notes": "Thank you for your business.",
                    "terms": "Paid in full.",
                    "line_items": [
                        {"label": "Portal Configuration", "qty": 1, "cost": 5000, "discount": 0},
                        {"label": "Training Sessions", "qty": 1, "cost": 3500, "discount": 0},
                    ],
                },
            ],
        )

        seed_resources(
            "projects",
            [
                {
                    "name": "Website Revamp",
                    "code": "PROJ-001",
                    "status": "Active",
                    "description": "Redesign corporate website",
                },
                {
                    "name": "HR Portal Setup",
                    "code": "PROJ-002",
                    "status": "Active",
                    "description": "Configure and deploy new HR system",
                },
                {
                    "name": "Hospital Dashboard",
                    "code": "PROJ-003",
                    "status": "Active",
                    "description": "Develop hospital management dashboard",
                },
                {
                    "name": "People Ops Revamp",
                    "code": "PROJ-004",
                    "status": "Active",
                    "description": "Improve internal people operations workflow",
                },
            ]
        )

        seed_resources(
            "payments",
            [
                {
                    "payment_number": "PAY-001",
                    "invoice_number": "INV-001",
                    "client_name": "Sara Inc",
                    "payment_date": "2026-03-12",
                    "method": "Bank Transfer",
                    "amount": 6000,
                    "status": "Completed",
                    "reference": "TRX-SARA-001",
                    "notes": "Partial payment received for phase 1.",
                },
                {
                    "payment_number": "PAY-002",
                    "invoice_number": "INV-002",
                    "client_name": "Nexa Health",
                    "payment_date": "2026-03-14",
                    "method": "Card",
                    "amount": 8500,
                    "status": "Completed",
                    "reference": "TRX-NEXA-002",
                    "notes": "Full settlement completed.",
                },
            ],
        )

        seed_resources(
            "expenses",
            [
                {
                    "expense_number": "EXP-001",
                    "category": "Software",
                    "vendor": "Figma",
                    "expense_date": "2026-03-06",
                    "amount": 480,
                    "status": "Approved",
                    "paid_via": "Card",
                    "notes": "Monthly design tooling subscription.",
                },
                {
                    "expense_number": "EXP-002",
                    "category": "Travel",
                    "vendor": "Delta Airlines",
                    "expense_date": "2026-03-09",
                    "amount": 1260,
                    "status": "Pending",
                    "paid_via": "Bank",
                    "notes": "Client meeting travel reimbursement.",
                },
            ],
        )

        seed_resources(
            "provident-fund",
            [
                {
                    "fund_number": "PF-001",
                    "employee_name": emp1_name,
                    "fund_type": "Employee Provident Fund",
                    "month": "March 2026",
                    "employee_share": 450,
                    "organization_share": 450,
                    "total_contribution": 900,
                    "uan": "100120230001",
                    "status": "Filed",
                    "notes": "March filing completed successfully.",
                },
                {
                    "fund_number": "PF-002",
                    "employee_name": emp2_name,
                    "fund_type": "Voluntary Provident Fund",
                    "month": "March 2026",
                    "employee_share": 600,
                    "organization_share": 600,
                    "total_contribution": 1200,
                    "uan": "100120230002",
                    "status": "Pending",
                    "notes": "Awaiting statutory filing review.",
                },
            ],
        )

        seed_resources(
            "taxes",
            [
                {
                    "tax_name": "GST Standard",
                    "tax_code": "TAX-001",
                    "tax_type": "GST",
                    "rate": 18,
                    "effective_from": "2026-03-01",
                    "status": "Active",
                    "description": "Standard GST rate for taxable service invoices.",
                },
                {
                    "tax_name": "Payroll Withholding",
                    "tax_code": "TAX-002",
                    "tax_type": "Payroll Tax",
                    "rate": 10,
                    "effective_from": "2026-02-15",
                    "status": "Draft",
                    "description": "Draft payroll withholding structure under review.",
                },
            ],
        )

        seed_resources(
            "resignations",
            [
                {
                    "employee_name": emp1_name,
                    "department": "Human Resources",
                    "reason": "Career Change",
                    "notice_date": "2026-02-01",
                    "resignation_date": "2026-03-15",
                },
                {
                    "employee_name": emp2_name,
                    "department": "Engineering",
                    "reason": "Relocation",
                    "notice_date": "2026-02-10",
                    "resignation_date": "2026-03-20",
                },
            ],
        )

        seed_resources(
            "terminations",
            [
                {
                    "employee_name": emp1_name,
                    "department": "Human Resources",
                    "termination_type": "Retirement",
                    "notice_date": "2026-01-15",
                    "reason": "Retirement",
                    "termination_date": "2026-03-01",
                },
                {
                    "employee_name": emp2_name,
                    "department": "Engineering",
                    "termination_type": "Layoff",
                    "notice_date": "2026-02-05",
                    "reason": "Workforce reduction",
                    "termination_date": "2026-03-10",
                },
            ],
        )
        seed_resources(
            "promotions",
            [
                {
                    "employee_id": emp1.id,
                    "employee_name": emp1_name,
                    "department": "Human Resources",
                    "designation_from": "HR Executive",
                    "designation_to": "HR Manager",
                    "promotion_date": "2026-04-01",
                    "status": "Approved",
                    "change_reason": "Career Growth",
                    "salary_change": 2500,
                    "notes": "Promotion approved after annual talent review.",
                },
                {
                    "employee_id": emp2.id,
                    "employee_name": emp2_name,
                    "department": "Engineering",
                    "designation_from": "Software Engineer",
                    "designation_to": "Senior Software Engineer",
                    "promotion_date": "2026-04-15",
                    "status": "Planned",
                    "change_reason": "Performance Reward",
                    "salary_change": 3200,
                    "notes": "Promotion planned after release cycle completion.",
                },
            ],
        )

        seed_resources(
            "performance-indicators",
            [
                {
                    "designation": "HR Manager",
                    "department": "Human Resources",
                    "approved_by": "Leona Hart",
                    "reviewer_role": "HR Director",
                    "created_date": "2026-01-10",
                    "metric_focus": "Talent retention, compliance, hiring velocity",
                    "status": "Active",
                    "notes": "Use for all HR business partner roles from Q1 onward.",
                },
                {
                    "designation": "Senior Software Engineer",
                    "department": "Engineering",
                    "approved_by": "Marcus Reed",
                    "reviewer_role": "Engineering Director",
                    "created_date": "2026-01-18",
                    "metric_focus": "Delivery quality, ownership, code review support",
                    "status": "Review",
                    "notes": "Pending calibration with platform engineering leads.",
                },
            ],
        )

        seed_resources(
            "performance-appraisals",
            [
                {
                    "employee_name": emp1_name,
                    "designation": "HR Manager",
                    "department": "Human Resources",
                    "reviewer": "Leona Hart",
                    "appraisal_date": "2026-03-05",
                    "rating": "4 - Strong",
                    "status": "Completed",
                    "summary": "Strong leadership and improved hiring turnaround time.",
                },
                {
                    "employee_name": emp2_name,
                    "designation": "Senior Software Engineer",
                    "department": "Engineering",
                    "reviewer": "Marcus Reed",
                    "appraisal_date": "2026-03-12",
                    "rating": "3 - Solid",
                    "status": "In Progress",
                    "summary": "Solid delivery with scope to improve stakeholder communication.",
                },
            ],
        )

        seed_resources(
            "performance-reviews",
            [
                {
                    "employee_id": emp1.id,
                    "employee_name": emp1_name,
                    "department": "Human Resources",
                    "designation": "HR Manager",
                    "reviewer": "Leona Hart",
                    "review_cycle": "Q1 2026",
                    "review_date": "2026-03-08",
                    "status": "Completed",
                    "quality": "4",
                    "collaboration": "5",
                    "ownership": "4",
                    "attendance": "5",
                    "growth": "4",
                    "overall_score": "4.4",
                    "recommendation": "Strong performer",
                    "strengths": "Builds trust with employees and closes hiring loops quickly.",
                    "opportunities": "Delegate more administrative work.",
                    "manager_notes": "Ready for a larger people-ops remit next cycle.",
                    "employee_comments": "Interested in mentoring junior HR team members.",
                },
                {
                    "employee_id": emp2.id,
                    "employee_name": emp2_name,
                    "department": "Engineering",
                    "designation": "Senior Software Engineer",
                    "reviewer": "Marcus Reed",
                    "review_cycle": "Q1 2026",
                    "review_date": "2026-03-14",
                    "status": "In Review",
                    "quality": "4",
                    "collaboration": "3",
                    "ownership": "4",
                    "attendance": "4",
                    "growth": "3",
                    "overall_score": "3.6",
                    "recommendation": "Strong performer",
                    "strengths": "Strong code quality and reliability under pressure.",
                    "opportunities": "Sharpen technical communication with product stakeholders.",
                    "manager_notes": "Potential tech lead candidate after mentoring plan.",
                    "employee_comments": "Wants to contribute more to architecture decisions.",
                },
            ],
        )

        seed_resources(
            "training-types",
            [
                {
                    "type": "React Essentials",
                    "category": "Technical",
                    "target_audience": "Frontend engineers and new joiners",
                    "description": "Components, hooks, routing patterns, and maintainable UI architecture.",
                    "status": "Active",
                },
                {
                    "type": "Leadership Foundations",
                    "category": "Leadership",
                    "target_audience": "Team leads and first-time managers",
                    "description": "Feedback, delegation, coaching, and prioritization fundamentals.",
                    "status": "Draft",
                },
            ],
        )

        seed_resources(
            "training-sessions",
            [
                {
                    "training_type": "React Essentials",
                    "trainer": "Anthony Lewis",
                    "participants": f"{emp1_name}, {emp2_name}",
                    "start_date": "2026-04-05",
                    "end_date": "2026-04-08",
                    "description": "Four-day bootcamp for frontend standards and reusable UI patterns.",
                    "cost": 450,
                    "delivery_mode": "Hybrid",
                    "status": "Scheduled",
                },
                {
                    "training_type": "Leadership Foundations",
                    "trainer": "Leona Hart",
                    "participants": f"{emp1_name}, Team Lead Cohort",
                    "start_date": "2026-04-18",
                    "end_date": "2026-04-19",
                    "description": "Manager coaching sessions focused on feedback and delegation.",
                    "cost": 620,
                    "delivery_mode": "Classroom",
                    "status": "Running",
                },
            ],
        )
        seed_resources(
            "employee-salaries",
            [
                {
                    "employee_id": emp1.id,
                    "emp_code": emp1.emp_code,
                    "employee_name": emp1_name,
                    "email": emp1.email,
                    "phone": emp1.phone or "",
                    "designation": emp1.designation.title if emp1.designation else "",
                    "joining_date": emp1.joining_date.isoformat() if emp1.joining_date else "",
                    "month": "October",
                    "year": 2024,
                    "earnings": {
                        "basic": 3000,
                        "da": 0,
                        "hra": 1000,
                        "conveyance": 200,
                        "allowance": 100,
                        "medical": 0,
                        "others": 0,
                    },
                    "deductions": {
                        "tds": 200,
                        "esi": 150,
                        "pf": 300,
                        "leave": 0,
                        "prof_tax": 0,
                        "labour_welfare": 0,
                        "others": 0,
                    },
                    "extra_earnings": [],
                    "extra_deductions": [
                        {"label": "Loan", "amount": 50},
                    ],
                    "gross_salary": 4300,
                    "total_deductions": 700,
                    "net_salary": 3600,
                },
                {
                    "employee_id": emp2.id,
                    "emp_code": emp2.emp_code,
                    "employee_name": emp2_name,
                    "email": emp2.email,
                    "phone": emp2.phone or "",
                    "designation": emp2.designation.title if emp2.designation else "",
                    "joining_date": emp2.joining_date.isoformat() if emp2.joining_date else "",
                    "month": "November",
                    "year": 2024,
                    "earnings": {
                        "basic": 3500,
                        "da": 400,
                        "hra": 900,
                        "conveyance": 150,
                        "allowance": 200,
                        "medical": 0,
                        "others": 0,
                    },
                    "deductions": {
                        "tds": 250,
                        "esi": 100,
                        "pf": 300,
                        "leave": 0,
                        "prof_tax": 0,
                        "labour_welfare": 0,
                        "others": 0,
                    },
                    "extra_earnings": [],
                    "extra_deductions": [],
                    "gross_salary": 5150,
                    "total_deductions": 650,
                    "net_salary": 4500,
                },
            ],
        )

        seed_resources(
            "payroll-items",
            [
                {
                    "name": "Leave Balance Amount",
                    "category": "Monthly Remuneration",
                    "amount": 5,
                    "type": "addition",
                },
                {
                    "name": "Professional Tax",
                    "category": "Statutory Deduction",
                    "amount": 200,
                    "type": "deduction",
                },
            ],
        )


        seed_resources(
            "accounting-categories",
            [
                {
                    "category_code": "CAT-001",
                    "category_name": "Technology",
                    "sub_category_name": "Cloud Infrastructure",
                    "department": "Engineering",
                    "owner": emp2_name,
                    "budget_type": "Operating",
                    "monthly_limit": 12000,
                    "status": "Active",
                    "description": "Recurring platform, hosting, and infrastructure subscriptions.",
                },
                {
                    "category_code": "CAT-002",
                    "category_name": "People Operations",
                    "sub_category_name": "Learning & Development",
                    "department": "People",
                    "owner": emp1_name,
                    "budget_type": "Operating",
                    "monthly_limit": 8000,
                    "status": "Review",
                    "description": "Training, workshops, and employee development initiatives.",
                },
            ],
        )

        seed_resources(
            "accounting-budgets",
            [
                {
                    "budget_code": "BUD-001",
                    "budget_title": "FY26 Engineering Ops",
                    "budget_type": "Department",
                    "category_name": "Technology",
                    "owner": emp2_name,
                    "start_date": "2026-01-01",
                    "end_date": "2026-12-31",
                    "allocated_budget": 125000,
                    "total_revenue": 18000,
                    "total_expense": 42000,
                    "tax_amount": 5000,
                    "remaining_amount": 96000,
                    "utilization": 32,
                    "status": "Active",
                    "description": "Core engineering run budget with tooling recovery planned per quarter.",
                },
                {
                    "budget_code": "BUD-002",
                    "budget_title": "People Enablement 2026",
                    "budget_type": "Category",
                    "category_name": "People Operations",
                    "owner": emp1_name,
                    "start_date": "2026-04-01",
                    "end_date": "2026-12-31",
                    "allocated_budget": 60000,
                    "total_revenue": 4000,
                    "total_expense": 18000,
                    "tax_amount": 2500,
                    "remaining_amount": 43500,
                    "utilization": 33,
                    "status": "Planned",
                    "description": "Training and engagement budget for the second half of FY26.",
                },
            ],
        )

        seed_resources(
            "accounting-budget-expenses",
            [
                {
                    "expense_code": "BEX-001",
                    "expense_name": "AWS Enterprise Support",
                    "budget_code": "BUD-001",
                    "budget_title": "FY26 Engineering Ops",
                    "category_name": "Technology",
                    "sub_category_name": "Cloud Infrastructure",
                    "vendor_name": "Amazon Web Services",
                    "amount": 22000,
                    "expense_date": "2026-02-14",
                    "status": "Approved",
                    "notes": "Annual support renewal approved by the engineering director.",
                },
                {
                    "expense_code": "BEX-002",
                    "expense_name": "Leadership Workshop Cohort",
                    "budget_code": "BUD-002",
                    "budget_title": "People Enablement 2026",
                    "category_name": "People Operations",
                    "sub_category_name": "Learning & Development",
                    "vendor_name": "Growth Academy",
                    "amount": 9000,
                    "expense_date": "2026-05-06",
                    "status": "Paid",
                    "notes": "Cohort payment released after finance validation.",
                },
            ],
        )


        general_shift, created = ShiftDefinition.objects.get_or_create(
            code="GEN",
            defaults={
                "name": "General Shift",
                "start_time": "09:00",
                "end_time": "18:00",
                "grace_in_minutes": 15,
                "grace_out_minutes": 15,
                "standard_hours": Decimal("8.00"),
                "overtime_threshold_hours": Decimal("8.50"),
                "is_active": True,
            },
        )
        if created:
            created_summary.append("shift:GEN")

        support_shift, created = ShiftDefinition.objects.get_or_create(
            code="SUP",
            defaults={
                "name": "Support Shift",
                "start_time": "10:00",
                "end_time": "19:00",
                "grace_in_minutes": 10,
                "grace_out_minutes": 10,
                "standard_hours": Decimal("8.00"),
                "overtime_threshold_hours": Decimal("8.50"),
                "is_active": True,
            },
        )
        if created:
            created_summary.append("shift:SUP")

        _, created = TimesheetEntry.objects.get_or_create(
            employee=emp1,
            work_date=today,
            defaults={
                "shift": general_shift,
                "project_name": "People Ops Revamp",
                "task_summary": "Reviewed leave approvals and updated workforce policy pack.",
                "start_time": "09:05",
                "end_time": "18:10",
                "break_minutes": 45,
                "hours_worked": Decimal("8.33"),
                "payroll_impact_hours": Decimal("8.00"),
                "late_minutes": 0,
                "early_exit_minutes": 0,
                "status": TimesheetEntry.STATUS_APPROVED,
                "notes": "Seeded approved HR timesheet.",
                "submitted_by": hr_user,
                "approved_by": admin_user,
                "approved_at": timezone.now(),
            },
        )
        if created:
            created_summary.append("timesheet:EMP-001")

        emp2_work_date = today.replace(day=max(1, today.day - 1))
        timesheet_emp2, created = TimesheetEntry.objects.get_or_create(
            employee=emp2,
            work_date=emp2_work_date,
            defaults={
                "shift": support_shift,
                "project_name": "Hospital Dashboard",
                "task_summary": "Worked on CRM analytics widgets and employee self-service fixes.",
                "start_time": "10:05",
                "end_time": "19:15",
                "break_minutes": 50,
                "hours_worked": Decimal("8.33"),
                "payroll_impact_hours": Decimal("8.00"),
                "late_minutes": 0,
                "early_exit_minutes": 0,
                "status": TimesheetEntry.STATUS_SUBMITTED,
                "notes": "Pending manager review.",
                "submitted_by": employee_user,
            },
        )
        if created:
            created_summary.append("timesheet:EMP-002")

        _, created = OvertimeEntry.objects.get_or_create(
            employee=emp2,
            work_date=today,
            defaults={
                "linked_timesheet": timesheet_emp2,
                "hours": Decimal("2.00"),
                "payroll_amount": Decimal("1225.96"),
                "reason": "Production release support",
                "notes": "Awaiting HR approval.",
                "status": OvertimeEntry.STATUS_REQUESTED,
            },
        )
        if created:
            created_summary.append("overtime:EMP-002")

        _, created = OvertimeEntry.objects.get_or_create(
            employee=emp1,
            work_date=emp2_work_date,
            defaults={
                "hours": Decimal("1.50"),
                "payroll_amount": Decimal("648.00"),
                "reason": "Quarter-close payroll verification",
                "notes": "Approved sample overtime.",
                "status": OvertimeEntry.STATUS_APPROVED,
                "approved_by": admin_user,
                "approved_at": timezone.now(),
            },
        )
        if created:
            created_summary.append("overtime:EMP-001")

        # --- expense claims ---
        _, created = ExpenseClaim.objects.get_or_create(
            employee=emp2,
            title="Client Lunch at Spice Garden",
            defaults={
                "category": ExpenseClaim.CATEGORY_FOOD,
                "amount": Decimal("120.00"),
                "claim_date": today.replace(day=max(1, today.day - 5)),
                "status": ExpenseClaim.STATUS_APPROVED,
                "reviewer_note": "Approved by HR Manager.",
            },
        )
        if created:
            created_summary.append("expense_claim:Client Lunch")

        _, created = ExpenseClaim.objects.get_or_create(
            employee=emp2,
            title="AWS SaaS Monthly Subscription",
            defaults={
                "category": ExpenseClaim.CATEGORY_SOFTWARE,
                "amount": Decimal("350.00"),
                "claim_date": today,
                "status": ExpenseClaim.STATUS_PENDING,
                "reviewer_note": "",
            },
        )
        if created:
            created_summary.append("expense_claim:AWS SaaS")

        _, created = ExpenseClaim.objects.get_or_create(
            employee=emp1,
            title="Travel Taxi for Office Commute",
            defaults={
                "category": ExpenseClaim.CATEGORY_TRAVEL,
                "amount": Decimal("45.50"),
                "claim_date": today.replace(day=max(1, today.day - 2)),
                "status": ExpenseClaim.STATUS_DRAFT,
                "reviewer_note": "",
            },
        )
        if created:
            created_summary.append("expense_claim:Taxi Commute")

        laptop_category, created = AssetCategory.objects.get_or_create(
            name="Laptops",
            defaults={"description": "Portable workstations for employees.", "is_active": True},
        )
        if created:
            created_summary.append("asset-category:laptops")

        mobile_category, created = AssetCategory.objects.get_or_create(
            name="Mobiles",
            defaults={"description": "Official mobile devices and SIM-backed phones.", "is_active": True},
        )
        if created:
            created_summary.append("asset-category:mobiles")

        _, created = AssetAssignment.objects.get_or_create(
            asset_code="AST-001",
            defaults={
                "asset_name": "MacBook Pro 14",
                "category": laptop_category,
                "assigned_to": emp2,
                "status": AssetAssignment.STATUS_ASSIGNED,
                "assigned_on": today,
                "due_return_on": today,
                "notes": "Primary engineering workstation.",
                "issued_by": hr_user,
                "updated_by": hr_user,
            },
        )
        if created:
            created_summary.append("asset:AST-001")

        _, created = AssetAssignment.objects.get_or_create(
            asset_code="AST-002",
            defaults={
                "asset_name": "iPhone 15",
                "category": mobile_category,
                "assigned_to": emp1,
                "status": AssetAssignment.STATUS_ASSIGNED,
                "assigned_on": today,
                "due_return_on": today,
                "notes": "HR hotline device.",
                "issued_by": hr_user,
                "updated_by": hr_user,
            },
        )
        if created:
            created_summary.append("asset:AST-002")

        id_docs_category, created = DocumentCategory.objects.get_or_create(
            code="ID_DOCS",
            defaults={
                "name": "Identity Documents",
                "description": "Government-issued identity and address proof records.",
                "visibility": DocumentCategory.VISIBILITY_EMPLOYEE,
                "is_active": True,
                "is_mandatory": True,
                "requires_expiry": True,
            },
        )
        if created:
            created_summary.append("document-category:id-docs")

        policy_docs_category, created = DocumentCategory.objects.get_or_create(
            code="POLICY_ACK",
            defaults={
                "name": "Policy Acknowledgements",
                "description": "Signed policy, compliance, and handbook acknowledgements.",
                "visibility": DocumentCategory.VISIBILITY_HR,
                "is_active": True,
                "is_mandatory": True,
                "requires_expiry": False,
            },
        )
        if created:
            created_summary.append("document-category:policy")

        _, created = EmployeeDocument.objects.get_or_create(
            employee=emp1,
            title="Passport",
            defaults={
                "category": id_docs_category,
                "file_name": "asha-passport.pdf",
                "document_url": "https://example.com/docs/asha-passport.pdf",
                "document_number": "P1234567",
                "status": EmployeeDocument.STATUS_VERIFIED,
                "issued_on": today,
                "expires_on": today.replace(year=today.year + 5),
                "notes": "Verified during profile setup.",
                "uploaded_by": hr_user,
                "verified_by": hr_user,
                "verified_at": timezone.now(),
            },
        )
        if created:
            created_summary.append("employee-document:passport")

        _, created = EmployeeDocument.objects.get_or_create(
            employee=emp2,
            title="Code of Conduct Acknowledgement",
            defaults={
                "category": policy_docs_category,
                "file_name": "ravi-code-of-conduct.pdf",
                "document_url": "https://example.com/docs/ravi-code-of-conduct.pdf",
                "status": EmployeeDocument.STATUS_PENDING,
                "issued_on": today,
                "notes": "Awaiting HR verification.",
                "uploaded_by": employee_user,
            },
        )
        if created:
            created_summary.append("employee-document:code-of-conduct")

        engineering_onboarding, created = OnboardingTemplate.objects.get_or_create(
            name="Engineering New Hire",
            defaults={
                "department_name": "Engineering",
                "role_name": "Software Engineer",
                "description": "Default landing plan for engineers.",
                "tasks": [
                    {"title": "Share architecture and product walkthrough", "task_type": "manager", "sort_order": 10},
                    {"title": "Provision repository and deployment access", "task_type": "it", "sort_order": 20},
                    {"title": "Confirm laptop and dev environment", "task_type": "admin", "sort_order": 30},
                ],
                "is_active": True,
                "created_by": hr_user,
            },
        )
        if created:
            created_summary.append("onboarding-template:engineering")

        hr_onboarding, created = OnboardingTemplate.objects.get_or_create(
            name="HR Operations New Hire",
            defaults={
                "department_name": "Human Resources",
                "role_name": "HR Manager",
                "description": "Default landing plan for HR operations hires.",
                "tasks": [
                    {"title": "Share policy handbook and approvals desk", "task_type": "hr", "sort_order": 10},
                    {"title": "Provision payroll and leave tools", "task_type": "it", "sort_order": 20},
                    {"title": "Assign document review queue", "task_type": "manager", "sort_order": 30},
                ],
                "is_active": True,
                "created_by": hr_user,
            },
        )
        if created:
            created_summary.append("onboarding-template:hr")

        onboarding_emp2, created = OnboardingRecord.objects.get_or_create(
            employee=emp2,
            title="Onboarding - Ravi Patel",
            defaults={
                "template": engineering_onboarding,
                "owner": hr_user,
                "status": OnboardingRecord.STATUS_IN_PROGRESS,
                "target_joining_date": today,
                "started_on": today,
                "notes": "Engineering handoff and access setup in progress.",
            },
        )
        ensure_onboarding_tasks(onboarding_emp2, actor=hr_user, reset_missing=True)
        if created:
            created_summary.append("onboarding-record:ravi")

        onboarding_emp1, created = OnboardingRecord.objects.get_or_create(
            employee=emp1,
            title="Onboarding - Asha Kumar",
            defaults={
                "template": hr_onboarding,
                "owner": hr_user,
                "status": OnboardingRecord.STATUS_COMPLETED,
                "target_joining_date": today,
                "started_on": today,
                "completed_on": today,
                "progress_percentage": 100,
                "notes": "HR operating stack completed.",
            },
        )
        ensure_onboarding_tasks(onboarding_emp1, actor=hr_user, reset_missing=True)
        OnboardingTask.objects.filter(record=onboarding_emp1).update(
            status=OnboardingTask.STATUS_COMPLETED,
            completed_by=hr_user,
            completed_at=timezone.now(),
        )
        onboarding_emp1.status = OnboardingRecord.STATUS_COMPLETED
        onboarding_emp1.progress_percentage = 100
        onboarding_emp1.completed_on = today
        onboarding_emp1.save(update_fields=["status", "progress_percentage", "completed_on", "updated_at"])
        if created:
            created_summary.append("onboarding-record:asha")

        job_1, created = RecruitmentJob.objects.get_or_create(
            title="Senior Frontend Engineer",
            defaults={
                "department_name": "Engineering",
                "location": "Bengaluru",
                "city": "Bengaluru",
                "state": "Karnataka",
                "country": "India",
                "work_mode": "Hybrid",
                "employment_type": "Full-Time",
                "openings": 2,
                "status": RecruitmentJob.STATUS_OPEN,
                "is_public": True,
                "hiring_manager": emp2_name,
                "experience_band": "5-8 Years",
                "experience_min_years": 5,
                "experience_max_years": 8,
                "salary_min": 1800000,
                "salary_max": 2600000,
                "posted_on": today,
                "closing_on": today,
                "description": "Own advanced HRMS product interfaces, public careers flows, and component systems.",
                "skills": ["React", "TypeScript", "Design Systems", "Analytics UX"],
                "benefits": ["Hybrid schedule", "Learning budget", "Quarterly product offsites"],
                "created_by": hr_user,
            },
        )
        job_1.location = "Bengaluru"
        job_1.city = "Bengaluru"
        job_1.state = "Karnataka"
        job_1.country = "India"
        job_1.work_mode = "Hybrid"
        job_1.is_public = True
        job_1.experience_min_years = 5
        job_1.experience_max_years = 8
        job_1.salary_min = 1800000
        job_1.salary_max = 2600000
        job_1.skills = ["React", "TypeScript", "Design Systems", "Analytics UX"]
        job_1.benefits = ["Hybrid schedule", "Learning budget", "Quarterly product offsites"]
        job_1.save()
        if created:
            created_summary.append("recruitment-job:frontend")

        job_2, created = RecruitmentJob.objects.get_or_create(
            title="HR Operations Specialist",
            defaults={
                "department_name": "Human Resources",
                "location": "Chennai",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "country": "India",
                "work_mode": "Onsite",
                "employment_type": "Full-Time",
                "openings": 1,
                "status": RecruitmentJob.STATUS_OPEN,
                "is_public": True,
                "hiring_manager": emp1_name,
                "experience_band": "3-5 Years",
                "experience_min_years": 3,
                "experience_max_years": 5,
                "salary_min": 700000,
                "salary_max": 1100000,
                "posted_on": today,
                "closing_on": today,
                "description": "Support leave, payroll, onboarding, stakeholder reviews, and policy operations.",
                "skills": ["HR Operations", "Leave Management", "Payroll Coordination"],
                "benefits": ["Structured onboarding", "Cross-functional leadership exposure"],
                "created_by": hr_user,
            },
        )
        job_2.location = "Chennai"
        job_2.city = "Chennai"
        job_2.state = "Tamil Nadu"
        job_2.country = "India"
        job_2.work_mode = "Onsite"
        job_2.is_public = True
        job_2.experience_min_years = 3
        job_2.experience_max_years = 5
        job_2.salary_min = 700000
        job_2.salary_max = 1100000
        job_2.skills = ["HR Operations", "Leave Management", "Payroll Coordination"]
        job_2.benefits = ["Structured onboarding", "Cross-functional leadership exposure"]
        job_2.save()
        if created:
            created_summary.append("recruitment-job:hr-ops")

        candidate_maya, created = RecruitmentCandidate.objects.get_or_create(
            email="maya.verma@example.com",
            defaults={
                "job": job_1,
                "first_name": "Maya",
                "last_name": "Verma",
                "phone": "+91 90000 10001",
                "whatsapp": "+91 90000 10001",
                "location": "Bengaluru, Karnataka",
                "source": "LinkedIn",
                "application_source": "linkedin_public",
                "stage": RecruitmentCandidate.STAGE_INTERVIEW,
                "score": 86,
                "notice_period_days": 30,
                "owner_name": emp2_name,
                "summary": "Strong frontend architecture and analytics experience.",
                "applied_on": today,
                "created_by": hr_user,
            },
        )
        if created:
            created_summary.append("candidate:maya")

        candidate_arjun, created = RecruitmentCandidate.objects.get_or_create(
            email="arjun.menon@example.com",
            defaults={
                "job": job_2,
                "first_name": "Arjun",
                "last_name": "Menon",
                "phone": "+91 90000 10002",
                "whatsapp": "+91 90000 10002",
                "location": "Chennai, Tamil Nadu",
                "source": "Referral",
                "application_source": "referral_program",
                "stage": RecruitmentCandidate.STAGE_SCREENING,
                "score": 79,
                "notice_period_days": 15,
                "owner_name": emp1_name,
                "summary": "Strong employee relations and documentation background.",
                "applied_on": today,
                "created_by": hr_user,
            },
        )
        if created:
            created_summary.append("candidate:arjun")

        _, created = RecruitmentReferral.objects.get_or_create(
            candidate_email="maya.verma@example.com",
            defaults={
                "job": job_1,
                "candidate_name": "Maya Verma",
                "referrer_name": stakeholder_one.get_display_name(),
                "referrer_email": stakeholder_one.email,
                "reward_status": "pending",
                "status": RecruitmentReferral.STATUS_REVIEWING,
                "notes": "Referral under technical review.",
                "referred_on": today,
                "created_by": hr_user,
            },
        )
        if created:
            created_summary.append("referral:maya")

        _, created = RecruitmentReferral.objects.get_or_create(
            candidate_email="arjun.menon@example.com",
            defaults={
                "job": job_2,
                "candidate_name": "Arjun Menon",
                "referrer_name": stakeholder_two.get_display_name(),
                "referrer_email": stakeholder_two.email,
                "reward_status": "eligible",
                "status": RecruitmentReferral.STATUS_ACCEPTED,
                "notes": "Referral moved to screening round.",
                "referred_on": today,
                "created_by": hr_user,
            },
        )
        if created:
            created_summary.append("referral:arjun")

        _, created = RecruitmentInterview.objects.get_or_create(
            candidate=candidate_maya,
            round_name="Technical Panel",
            interview_type=RecruitmentInterview.TYPE_TECHNICAL,
            defaults={
                "application": getattr(candidate_maya, "application_record", None),
                "job": job_1,
                "status": RecruitmentInterview.STATUS_COMPLETED,
                "scheduled_for": timezone.now() - timezone.timedelta(days=3, hours=2),
                "completed_at": timezone.now() - timezone.timedelta(days=3),
                "mode": "virtual",
                "location_or_link": "meet.google.com/hrms-maya-panel",
                "duration_minutes": 70,
                "taken_by": stakeholder_one,
                "taken_by_role": stakeholder_one.role,
                "panel_members": [hr_user.get_display_name(), stakeholder_one.get_display_name()],
                "discussion_topics": ["React", "Analytics", "Design systems"],
                "score": 89,
                "decision": RecruitmentInterview.DECISION_STRONG_HIRE,
                "feedback_summary": "Confident frontend architecture depth with strong product judgment.",
                "strengths": "Excellent ownership, design system maturity, and analytics collaboration.",
                "concerns": "Needs deeper backend API scaling exposure.",
                "salary_discussed": True,
                "salary_expectation": Decimal("2400000.00"),
                "salary_offered": Decimal("2250000.00"),
                "final_ctc_recommended": Decimal("2300000.00"),
                "negotiation_notes": "Open to hybrid flexibility and joining after 30 days notice.",
                "next_step": "Move to final hiring manager round.",
                "created_by": hr_user,
                "updated_by": stakeholder_one,
            },
        )
        if created:
            created_summary.append("interview:maya-tech")

        _, created = RecruitmentInterview.objects.get_or_create(
            candidate=candidate_arjun,
            round_name="HR Operations Screen",
            interview_type=RecruitmentInterview.TYPE_HR,
            defaults={
                "application": getattr(candidate_arjun, "application_record", None),
                "job": job_2,
                "status": RecruitmentInterview.STATUS_SCHEDULED,
                "scheduled_for": timezone.now() + timezone.timedelta(days=2, hours=1),
                "mode": "onsite",
                "location_or_link": "Chennai HQ - Lotus 2",
                "duration_minutes": 50,
                "taken_by": hr_user,
                "taken_by_role": hr_user.role,
                "panel_members": [hr_user.get_display_name(), stakeholder_two.get_display_name()],
                "discussion_topics": ["Leave operations", "Stakeholder reviews", "Policy handling"],
                "score": 0,
                "decision": RecruitmentInterview.DECISION_HOLD,
                "feedback_summary": "Scheduled initial panel for employee operations depth.",
                "strengths": "Good documentation mindset and employee relations exposure.",
                "concerns": "Needs deeper payroll coordination exposure.",
                "salary_discussed": True,
                "salary_expectation": Decimal("900000.00"),
                "salary_offered": Decimal("850000.00"),
                "final_ctc_recommended": Decimal("875000.00"),
                "negotiation_notes": "Candidate requested clarity on variable pay and joining bonus.",
                "next_step": "Complete joint HR and stakeholder screen.",
                "created_by": hr_user,
                "updated_by": hr_user,
            },
        )
        if created:
            created_summary.append("interview:arjun-hr")

        note_hr, created = ProductivityNote.objects.get_or_create(
            owner=hr_user,
            title="Offer discussion notes - Maya Verma",
            defaults={
                "category": "Recruitment",
                "tone": ProductivityNote.TONE_OCEAN,
                "tags": ["offer", "frontend", "stakeholder"],
                "blocks": [
                    {"type": "paragraph", "text": "Stakeholder panel was aligned on technical depth and product thinking."},
                    {"type": "paragraph", "text": "Need to confirm notice-period overlap and design-system ownership expectations."},
                ],
                "checklist": [
                    {"text": "Share final panel summary", "done": True},
                    {"text": "Prepare compensation guardrails", "done": False},
                ],
                "table_data": {
                    "columns": ["Topic", "Owner", "Status"],
                    "rows": [
                        ["Compensation approval", "Asha", "In progress"],
                        ["Hiring manager sign-off", "Nina", "Pending"],
                    ],
                },
                "reminder_at": timezone.now() + timezone.timedelta(days=1),
                "is_pinned": True,
            },
        )
        if created:
            created_summary.append("note:maya-offer")

        _, created = ProductivityNote.objects.get_or_create(
            owner=stakeholder_one,
            title="Quarter close stakeholder prep",
            defaults={
                "category": "Operations",
                "tone": ProductivityNote.TONE_CORAL,
                "tags": ["close", "payroll", "review"],
                "blocks": [
                    {"type": "paragraph", "text": "Review pending approvals, interview decisions, and payroll blocker summaries before Friday."},
                ],
                "checklist": [
                    {"text": "Review approval inbox", "done": False},
                    {"text": "Check final settlements", "done": False},
                ],
                "table_data": {"columns": ["Area", "Owner", "Need"], "rows": [["Payroll", "HR", "Sign-off"], ["Recruitment", "Stakeholder", "Decision"]]},
                "is_pinned": True,
            },
        )
        if created:
            created_summary.append("note:stakeholder-close")

        _, created = ProductivityTodo.objects.get_or_create(
            owner=hr_user,
            title="Prepare Maya offer pack",
            defaults={
                "description": "Compile panel feedback, salary proposal, and joining date options before the final manager review.",
                "status": ProductivityTodo.STATUS_IN_PROGRESS,
                "priority": ProductivityTodo.PRIORITY_HIGH,
                "checklist": [{"text": "Validate salary band", "done": True}, {"text": "Draft offer note", "done": False}],
                "labels": ["recruitment", "offer"],
                "linked_url": "/recruitment/interviews",
                "due_at": timezone.now() + timezone.timedelta(days=1, hours=4),
            },
        )
        if created:
            created_summary.append("todo:maya-offer")

        _, created = ProductivityTodo.objects.get_or_create(
            owner=stakeholder_two,
            title="Review Arjun screening feedback",
            defaults={
                "description": "Join the HR screen and finalize whether the profile should move to final review.",
                "status": ProductivityTodo.STATUS_TODO,
                "priority": ProductivityTodo.PRIORITY_MEDIUM,
                "checklist": [{"text": "Open CV", "done": False}, {"text": "Review interview agenda", "done": False}],
                "labels": ["recruitment", "screening"],
                "linked_url": "/recruitment/interviews",
                "due_at": timezone.now() + timezone.timedelta(days=2),
            },
        )
        if created:
            created_summary.append("todo:arjun-screen")

        _, created = ReminderEvent.objects.get_or_create(
            owner=hr_user,
            title="Maya compensation review",
            defaults={
                "event_type": ReminderEvent.TYPE_INTERVIEW,
                "priority": ReminderEvent.PRIORITY_HIGH,
                "starts_at": timezone.now() + timezone.timedelta(hours=20),
                "ends_at": timezone.now() + timezone.timedelta(hours=21),
                "remind_before_minutes": 45,
                "location": "HR review room",
                "attendees": [hr_user.get_display_name(), stakeholder_one.get_display_name()],
                "notes": "Finalize compensation band before the final interview call.",
                "target_url": "/recruitment/interviews",
            },
        )
        if created:
            created_summary.append("event:maya-comp")

        _, created = ReminderEvent.objects.get_or_create(
            owner=stakeholder_one,
            title="Friday stakeholder approvals",
            defaults={
                "event_type": ReminderEvent.TYPE_REMINDER,
                "priority": ReminderEvent.PRIORITY_URGENT,
                "starts_at": timezone.now() + timezone.timedelta(days=1, hours=3),
                "ends_at": timezone.now() + timezone.timedelta(days=1, hours=4),
                "remind_before_minutes": 60,
                "location": "Approvals Inbox",
                "attendees": [stakeholder_one.get_display_name()],
                "notes": "Check leave approvals, interview updates, and final settlements before EOD.",
                "target_url": "/approvals/inbox",
            },
        )
        if created:
            created_summary.append("event:stakeholder-approvals")

        employee_name_map = {
            emp1_name: emp1.id,
            emp2_name: emp2.id,
        }
        for resource in Resource.objects.filter(resource_type__in=["leave-employee", "training-sessions", "employee-salaries", "resignations", "terminations"]):
            if resource.resource_type in {"resignations", "terminations"}:
                payload = dict(resource.data or {})
                employee_name = str(payload.get("employee_name") or "").strip()
                employee_id = payload.get("employee_id") or employee_name_map.get(employee_name)
                changed = False
                if employee_id and payload.get("employee_id") != employee_id:
                    payload["employee_id"] = employee_id
                    changed = True
                if payload.get("status") != "In Review":
                    payload["status"] = "In Review"
                    changed = True
                if changed:
                    resource.data = payload
                    resource.save(update_fields=["data", "updated_at"])
            sync_generic_resource(resource)

        for case in OffboardingCase.objects.select_related("employee"):
            settlement = ensure_final_settlement(case, hr_user)
            if settlement and settlement.pk and settlement.status == FinalSettlement.STATUS_DRAFT:
                case.final_payroll_status = settlement.status
                case.save(update_fields=["final_payroll_status", "updated_at"])

        # Keep demo accounts available even when offboarding samples exist.
        Employee.objects.filter(pk__in=[emp1.pk, emp2.pk]).update(is_active=True)
        User.objects.filter(pk__in=[hr_user.pk, employee_user.pk]).update(
            account_status=User.STATUS_ACTIVE,
            is_active=True,
            can_use_chat=True,
        )

        if not (
            ChatThread.objects.filter(thread_type=ChatThread.TYPE_DIRECT, memberships__user=hr_user)
            .filter(memberships__user=employee_user)
            .exists()
        ):
            thread = ChatThread.objects.create(
                title="HR Support Desk",
                thread_type=ChatThread.TYPE_DIRECT,
                created_by=hr_user,
            )
            ChatParticipant.objects.bulk_create([
                ChatParticipant(thread=thread, user=hr_user, last_read_at=timezone.now()),
                ChatParticipant(thread=thread, user=employee_user),
            ])
            ChatMessage.objects.create(
                thread=thread,
                sender=hr_user,
                body="Hi Ravi, your employee self-service login is ready. Reach out here anytime for HR or payroll questions.",
            )
            ChatMessage.objects.create(
                thread=thread,
                sender=employee_user,
                body="Thanks Asha. I can see my profile and payslips now.",
            )
            thread.last_message_at = timezone.now()
            thread.save(update_fields=["last_message_at", "updated_at"])
            created_summary.append("chat:hr-support")

        seed_resources(
            "accounting-budget-revenues",
            [
                {
                    "revenue_code": "BRE-001",
                    "revenue_name": "Tooling Cost Recovery",
                    "budget_code": "BUD-001",
                    "budget_title": "FY26 Engineering Ops",
                    "category_name": "Technology",
                    "sub_category_name": "Cloud Infrastructure",
                    "client_name": "Internal Product Pods",
                    "amount": 18000,
                    "revenue_date": "2026-03-01",
                    "status": "Received",
                    "notes": "Quarter one internal chargeback settled.",
                },
                {
                    "revenue_code": "BRE-002",
                    "revenue_name": "Training Sponsorship Credit",
                    "budget_code": "BUD-002",
                    "budget_title": "People Enablement 2026",
                    "category_name": "People Operations",
                    "sub_category_name": "Learning & Development",
                    "client_name": "SkillBridge Partner",
                    "amount": 4000,
                    "revenue_date": "2026-05-12",
                    "status": "Confirmed",
                    "notes": "Partner co-funding confirmed for the workshop series.",
                },
            ],
        )
        if created_summary:
            self.stdout.write(self.style.SUCCESS("Seeded sample data:"))
            for item in created_summary:
                self.stdout.write(f" - {item}")
        else:
            self.stdout.write(self.style.WARNING("No new sample data was created (already seeded)."))





