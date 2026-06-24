from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from employees.models import Employee, Department, Designation
from payroll.models import EmployeePayroll
import io

User = get_user_model()

class PayrollReportsTests(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="Engineering")
        self.desig = Designation.objects.create(title="Software Engineer", department=self.dept)

        self.hr_user = User.objects.create_user(
            username="hruser",
            email="hr@company.com",
            password="hrpassword123",
            role="hr"
        )
        self.emp_user = User.objects.create_user(
            username="employee1",
            email="emp@company.com",
            password="emppassword123",
            role="employee"
        )
        self.employee = Employee.objects.create(
            emp_code="EMP001",
            first_name="Gokul",
            last_name="S",
            email="emp@company.com",
            department=self.dept,
            designation=self.desig,
            salary=50000,
            is_active=True
        )
        self.emp_user.employee_profile = self.employee
        self.emp_user.save()

        self.payroll_draft = EmployeePayroll.objects.create(
            employee=self.employee,
            month="June",
            year=2026,
            basic_salary=50000,
            gross_salary=55000,
            total_deductions=5000,
            net_salary=50000,
            status="draft",
            earnings_breakdown={"basic": 50000, "hra": 5000},
            deductions_breakdown={"provident_fund": 1800, "esi": 150, "tds": 2000, "professional_tax": 200}
        )

        self.payroll_published = EmployeePayroll.objects.create(
            employee=self.employee,
            month="May",
            year=2026,
            basic_salary=50000,
            gross_salary=55000,
            total_deductions=5000,
            net_salary=50000,
            status="published",
            earnings_breakdown={"basic": 50000, "hra": 5000},
            deductions_breakdown={"provident_fund": 1800, "esi": 150, "tds": 2000, "professional_tax": 200}
        )

    def test_payslip_pdf_fallback(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("employee-payroll-payslip-pdf", kwargs={"pk": self.payroll_published.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(len(response.content) > 0)

    def test_payslip_pdf_draft_denied(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("employee-payroll-payslip-pdf", kwargs={"pk": self.payroll_draft.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pf_challan_hr_only(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("pf-challan") + "?month=May&year=2026"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("records", response.data)
        self.assertIn("totals", response.data)
        self.assertEqual(response.data["totals"]["employee_pf"], 1800.0)

    def test_esi_report_hr_only(self):
        self.client.force_authenticate(user=self.hr_user)
        url = reverse("esi-report") + "?month=May&year=2026"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["records"]), 0)

    def test_salary_register(self):
        self.client.force_authenticate(user=self.hr_user)
        url = reverse("salary-register") + "?month=May&year=2026"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["records"]), 1)
        self.assertEqual(response.data["records"][0]["net_salary"], 50850.0)

    def test_form16(self):
        self.client.force_authenticate(user=self.emp_user)
        url = reverse("form16") + "?year=2026"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_taxable_income"], 110000.0)

    def test_bulk_import_csv(self):
        self.client.force_authenticate(user=self.hr_user)
        csv_data = (
            "emp_code,first_name,last_name,email,department,designation,joining_date,employment_type,salary,phone\n"
            "EMP999,BulkFirst,BulkLast,bulk@test.com,Engineering,QA Engineer,2026-06-01,Full-Time,45000,9876543210\n"
        )
        csv_file = io.BytesIO(csv_data.encode("utf-8"))
        csv_file.name = "employees.csv"

        url = reverse("employees-bulk-import")
        response = self.client.post(url, {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created"], 1)
        self.assertEqual(len(response.data["errors"]), 0)

        emp = Employee.objects.get(emp_code="EMP999")
        self.assertEqual(emp.first_name, "BulkFirst")
        self.assertEqual(emp.designation.title, "QA Engineer")
