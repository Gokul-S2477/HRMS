import datetime
from decimal import Decimal
from django.test import TestCase
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status

from employees.models import Department, Designation, Employee, SalaryRevision, EmployeeTransfer
from payroll.models import EmployeeLoan, LoanInstallment
from coredata.models import (
    TrainingProgram,
    TrainingEnrollment,
    ReviewCycle,
    PerformanceReview,
    ReviewGoal,
    ReviewFeedback,
    PeerFeedback,
    Announcement,
    DisciplinaryAction,
    OffboardingCase,
    Notification
)
from users.models import CustomUser

class Group4FeaturesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.department = Department.objects.create(name="Engineering")
        cls.hr_department = Department.objects.create(name="HR")
        cls.designation = Designation.objects.create(title="Software Engineer", department=cls.department)
        cls.hr_designation = Designation.objects.create(title="HR Specialist", department=cls.hr_department)

        cls.employee = Employee.objects.create(
            emp_code="EMP-001",
            first_name="Gokul",
            last_name="S",
            email="emp@test.com",
            department=cls.department,
            designation=cls.designation,
            joining_date=datetime.date(2026, 1, 1),
            salary=Decimal("60000.00"),
        )

        cls.employee_two = Employee.objects.create(
            emp_code="EMP-002",
            first_name="Jane",
            last_name="Doe",
            email="emp2@test.com",
            department=cls.department,
            designation=cls.designation,
            joining_date=datetime.date(2026, 1, 1),
            salary=Decimal("55000.00"),
        )

        cls.hr_user = CustomUser.objects.create_user(
            username="hr_user",
            password="password123",
            role=CustomUser.ROLE_HR,
            email="hr@test.com"
        )
        cls.employee_user = CustomUser.objects.create_user(
            username="emp_user",
            password="password123",
            role=CustomUser.ROLE_EMPLOYEE,
            email="emp@test.com",
            employee_profile=cls.employee
        )
        cls.employee_user_two = CustomUser.objects.create_user(
            username="emp_user_two",
            password="password123",
            role=CustomUser.ROLE_EMPLOYEE,
            email="emp2@test.com",
            employee_profile=cls.employee_two
        )

    def setUp(self):
        self.client = APIClient()

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_probation_auto_calculation_and_endpoints(self):
        # 1. Test auto-calculation of probation end date on Employee creation/save
        emp = Employee.objects.create(
            emp_code="EMP-003",
            first_name="Probationer",
            email="probationer@test.com",
            joining_date=datetime.date(2026, 1, 10),
            probation_period_months=6
        )
        # 6 months from 2026-01-10 should be 2026-07-10
        self.assertEqual(emp.probation_end_date, datetime.date(2026, 7, 10))
        self.assertEqual(emp.probation_status, "on_probation")

        # 2. Test confirm probation endpoint
        self.auth(self.hr_user)
        response = self.client.post(f"/api/employees/{emp.id}/confirm/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emp.refresh_from_db()
        self.assertEqual(emp.probation_status, "confirmed")
        self.assertEqual(emp.confirmed_on, datetime.date.today())
        self.assertEqual(emp.confirmed_by, self.hr_user)

        # 3. Test extend probation endpoint
        emp2 = Employee.objects.create(
            emp_code="EMP-004",
            first_name="Probationer2",
            email="probationer2@test.com",
            joining_date=datetime.date(2026, 1, 10),
            probation_period_months=3
        )
        response = self.client.post(f"/api/employees/{emp2.id}/extend-probation/", {"new_end_date": "2026-08-15"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emp2.refresh_from_db()
        self.assertEqual(emp2.probation_status, "extended")
        self.assertEqual(emp2.probation_end_date, datetime.date(2026, 8, 15))

    def test_check_probation_completions_command(self):
        # Create an employee whose probation ended in the past
        emp = Employee.objects.create(
            emp_code="EMP-005",
            first_name="Overdue",
            email="overdue@test.com",
            joining_date=datetime.date(2025, 1, 1),
            probation_period_months=3,
            probation_status="on_probation"
        )
        self.assertTrue(emp.probation_end_date < datetime.date.today())

        # Clear notifications first
        Notification.objects.all().delete()

        # Run command
        call_command("check_probation_completions")

        # Check notification was sent to HR User
        notifications = Notification.objects.filter(recipient=self.hr_user, notification_type="probation_due")
        self.assertEqual(notifications.count(), 1)
        self.assertIn("Overdue", notifications.first().body)

    def test_salary_revision(self):
        # Create a revision draft
        revision = SalaryRevision.objects.create(
            employee=self.employee,
            previous_salary=Decimal("60000.00"),
            new_salary=Decimal("70000.00"),
            revision_percentage=Decimal("16.67"),
            reason="Performance promotion",
            revision_type="promotion",
            effective_date=datetime.date.today(),
            status="draft",
            revised_by=self.hr_user
        )

        self.auth(self.employee_user)
        # Employees cannot approve salary revisions
        response = self.client.post(f"/api/salary-revisions/{revision.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.auth(self.hr_user)
        response = self.client.post(f"/api/salary-revisions/{revision.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        revision.refresh_from_db()
        self.assertEqual(revision.status, "approved")
        self.assertEqual(revision.approved_by, self.hr_user)
        
        # Verify employee's salary is auto-updated
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.salary, Decimal("70000.00"))

    def test_employee_transfer(self):
        transfer = EmployeeTransfer.objects.create(
            employee=self.employee,
            from_department=self.department,
            to_department=self.hr_department,
            from_designation=self.designation,
            to_designation=self.hr_designation,
            effective_date=datetime.date.today(),
            status="draft"
        )

        self.auth(self.hr_user)
        response = self.client.post(f"/api/employee-transfers/{transfer.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        transfer.refresh_from_db()
        self.assertEqual(transfer.status, "approved")

        self.employee.refresh_from_db()
        self.assertEqual(self.employee.department, self.hr_department)
        self.assertEqual(self.employee.designation, self.hr_designation)

    def test_employee_loans_and_installments(self):
        self.auth(self.employee_user)
        # Apply for loan
        response = self.client.post("/api/employee-loans/", {
            "employee": self.employee.id,
            "loan_type": "personal_loan",
            "principal_amount": "50000.00",
            "sanctioned_amount": "50000.00",
            "interest_rate": "10.00",
            "total_installments": 5,
            "monthly_emi": "10000.00",
            "start_date": "2026-07-01",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        loan_id = response.data["id"]

        self.auth(self.hr_user)
        # Approve loan
        approve_response = self.client.post(f"/api/employee-loans/{loan_id}/approve/")
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        # Check installments auto-generated
        installments = LoanInstallment.objects.filter(loan_id=loan_id)
        self.assertEqual(installments.count(), 5)
        self.assertEqual(installments.first().amount, Decimal("10000.00"))

    def test_training_programs_and_enrollments(self):
        # Create program
        program = TrainingProgram.objects.create(
            title="Django Advanced Coding",
            description="Deep dive",
            training_type="internal",
            start_date=datetime.date(2026, 8, 1),
            end_date=datetime.date(2026, 8, 5),
            duration_hours=20,
            max_seats=2
        )

        self.auth(self.employee_user)
        # Self-enroll
        response = self.client.post(f"/api/training-programs/{program.id}/enroll/")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        enrollment_id = response.data["id"]

        self.auth(self.hr_user)
        # Complete training
        response = self.client.post(f"/api/training-enrollments/{enrollment_id}/complete/", {
            "score": 95,
            "feedback": "Excellent performance"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        enrollment = TrainingEnrollment.objects.get(pk=enrollment_id)
        self.assertEqual(enrollment.status, "completed")
        self.assertEqual(enrollment.score, 95)

    def test_performance_review_and_peer_feedback(self):
        cycle = ReviewCycle.objects.create(
            name="H1 2026 Review Cycle",
            period_start=datetime.date(2026, 1, 1),
            period_end=datetime.date(2026, 6, 30),
            status="active",
            cycle_type="mid-year"
        )

        self.auth(self.hr_user)
        review = PerformanceReview.objects.create(
            cycle=cycle,
            employee=self.employee,
            reviewer=self.employee_two,
            status="pending"
        )

        self.auth(self.employee_user)
        # Employee submits peer feedback for employee two
        response = self.client.post("/api/peer-feedbacks/", {
            "reviewer": self.employee.id,
            "reviewee": self.employee_two.id,
            "cycle": cycle.id,
            "rating": 5,
            "comments": "Great collaborator"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_announcements(self):
        self.auth(self.hr_user)
        announcement = Announcement.objects.create(
            title="Office Holiday Notice",
            body="Office will be closed on Friday.",
            priority="high",
            author=self.hr_user,
            published_at=datetime.date.today(),
            expires_at=datetime.date.today() + datetime.timedelta(days=5)
        )

        self.auth(self.employee_user)
        response = self.client.post(f"/api/announcements/{announcement.id}/mark-read/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "read marked")
        self.assertTrue(announcement.read_by.filter(id=self.employee_user.id).exists())

    def test_disciplinary_action_termination_notice(self):
        self.auth(self.hr_user)
        # Create disciplinary action of type termination_notice
        response = self.client.post("/api/disciplinary-actions/", {
            "employee": self.employee.id,
            "action_type": "termination_notice",
            "incident_date": "2026-06-20",
            "incident_description": "Repeated policy violations.",
            "status": "issued"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify OffboardingCase was automatically created
        offboarding_exists = OffboardingCase.objects.filter(employee=self.employee, source_type="termination").exists()
        self.assertTrue(offboarding_exists)
