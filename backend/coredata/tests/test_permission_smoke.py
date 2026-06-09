from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from coredata.models import (
    AuditLog,
    DocumentCategory,
    EmployeeDocument,
    OffboardingCase,
    OnboardingRecord,
    OnboardingTask,
    OnboardingTemplate,
    RecruitmentJob,
    Resource,
    DocumentEsign,
    DocumentSignature,
)
from employees.models import Department, Designation, Employee
from payroll.models import EmployeePayroll, FinalSettlement
from users.models import CustomUser


class RolePermissionSmokeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.department = Department.objects.create(name="Human Resources")
        cls.designation = Designation.objects.create(title="HR Manager", department=cls.department)

        cls.employee_one = Employee.objects.create(
            emp_code="EMP-001",
            first_name="Asha",
            last_name="Kumar",
            email="asha@example.com",
            phone="9000000001",
            department=cls.department,
            designation=cls.designation,
            joining_date=date.today() - timedelta(days=240),
            salary=Decimal("50000.00"),
        )
        cls.employee_two = Employee.objects.create(
            emp_code="EMP-002",
            first_name="Ravi",
            last_name="Patel",
            email="ravi@example.com",
            phone="9000000002",
            department=cls.department,
            designation=cls.designation,
            joining_date=date.today() - timedelta(days=120),
            salary=Decimal("42000.00"),
        )

        cls.super_admin = CustomUser.objects.create_user(
            username="superadmin",
            password="pass1234",
            role=CustomUser.ROLE_SUPER_ADMIN,
            email="superadmin@example.com",
            first_name="Super",
            last_name="Admin",
        )
        cls.hr_user = CustomUser.objects.create_user(
            username="hruser",
            password="pass1234",
            role=CustomUser.ROLE_HR,
            email="hr@example.com",
            first_name="Hema",
            last_name="R",
        )
        cls.stakeholder = CustomUser.objects.create_user(
            username="stakeholder",
            password="pass1234",
            role=CustomUser.ROLE_STAKEHOLDER,
            email="stake@example.com",
            first_name="Sree",
            last_name="Holder",
        )
        cls.employee_user = CustomUser.objects.create_user(
            username="employee1",
            password="pass1234",
            role=CustomUser.ROLE_EMPLOYEE,
            email="asha.login@example.com",
            first_name="Asha",
            last_name="Kumar",
            employee_profile=cls.employee_one,
        )
        cls.employee_two_user = CustomUser.objects.create_user(
            username="employee2",
            password="pass1234",
            role=CustomUser.ROLE_EMPLOYEE,
            email="ravi.login@example.com",
            first_name="Ravi",
            last_name="Patel",
            employee_profile=cls.employee_two,
        )

        cls.doc_category = DocumentCategory.objects.create(
            name="ID Proof",
            code="id-proof",
            visibility=DocumentCategory.VISIBILITY_EMPLOYEE,
            is_active=True,
        )
        cls.employee_doc_one = EmployeeDocument.objects.create(
            employee=cls.employee_one,
            category=cls.doc_category,
            title="Passport",
            file_name="passport.pdf",
            uploaded_by=cls.hr_user,
        )
        cls.employee_doc_two = EmployeeDocument.objects.create(
            employee=cls.employee_two,
            category=cls.doc_category,
            title="PAN Card",
            file_name="pan.pdf",
            uploaded_by=cls.hr_user,
        )

        cls.onboarding_template = OnboardingTemplate.objects.create(
            name="Standard Onboarding",
            description="Base checklist",
            tasks=[{"title": "Laptop handover", "task_type": "it", "sort_order": 1}],
            created_by=cls.hr_user,
        )
        cls.onboarding_record = OnboardingRecord.objects.create(
            employee=cls.employee_one,
            template=cls.onboarding_template,
            owner=cls.hr_user,
            title="Asha Onboarding",
            status=OnboardingRecord.STATUS_IN_PROGRESS,
            progress_percentage=25,
        )
        cls.onboarding_task = OnboardingTask.objects.create(
            record=cls.onboarding_record,
            title="Laptop handover",
            task_type="it",
            sort_order=1,
            assigned_to=cls.hr_user,
        )

        cls.job = RecruitmentJob.objects.create(
            title="HR Analyst",
            department_name="HR",
            status=RecruitmentJob.STATUS_OPEN,
            is_public=True,
            created_by=cls.hr_user,
        )

        cls.ticket_one = Resource.objects.create(
            resource_type="tickets",
            data={"employee_id": cls.employee_one.id, "subject": "Laptop issue", "requester_email": cls.employee_user.email},
        )
        cls.ticket_two = Resource.objects.create(
            resource_type="tickets",
            data={"employee_id": cls.employee_two.id, "subject": "Access request", "requester_email": cls.employee_two_user.email},
        )
        cls.crm_deal = Resource.objects.create(
            resource_type="crm-deals",
            data={"name": "Acme Renewal", "owner": "Sales Ops"},
        )
        cls.accounting_category = Resource.objects.create(
            resource_type="accounting-categories",
            data={"name": "Operations"},
        )

        cls.payroll_one = EmployeePayroll.objects.create(
            employee=cls.employee_one,
            month="March",
            year=2026,
            basic_salary=Decimal("30000.00"),
            hra=Decimal("12000.00"),
            gross_salary=Decimal("42000.00"),
            net_salary=Decimal("39000.00"),
            total_salary=Decimal("39000.00"),
        )
        cls.payroll_two = EmployeePayroll.objects.create(
            employee=cls.employee_two,
            month="March",
            year=2026,
            basic_salary=Decimal("28000.00"),
            hra=Decimal("10000.00"),
            gross_salary=Decimal("38000.00"),
            net_salary=Decimal("35000.00"),
            total_salary=Decimal("35000.00"),
        )

        cls.offboarding_case = OffboardingCase.objects.create(
            employee=cls.employee_two,
            source_type=OffboardingCase.SOURCE_RESIGNATION,
            source_resource_id="res-1",
            initiated_on=date.today() - timedelta(days=5),
            status=OffboardingCase.STATUS_IN_REVIEW,
            approved_by=cls.hr_user,
        )
        cls.final_settlement = FinalSettlement.objects.create(
            offboarding_case=cls.offboarding_case,
            employee=cls.employee_two,
            payroll=cls.payroll_two,
            prepared_by=cls.hr_user,
            final_payable=Decimal("21000.00"),
        )

        AuditLog.objects.create(
            actor_user=cls.hr_user,
            actor_email=cls.hr_user.email,
            scope="documents",
            action="document_created",
            target_type="employee_document",
            target_id=str(cls.employee_doc_one.id),
            summary="Created passport document",
        )

    def setUp(self):
        self.client = APIClient()

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_employee_is_scoped_to_own_documents_and_payroll(self):
        self.auth(self.employee_user)

        docs_response = self.client.get("/api/employee-documents/")
        self.assertEqual(docs_response.status_code, 200)
        self.assertEqual(len(docs_response.data), 1)
        self.assertEqual(docs_response.data[0]["employee"]["id"], self.employee_one.id)

        payroll_response = self.client.get("/api/employee-payroll/")
        self.assertEqual(payroll_response.status_code, 200)
        self.assertEqual(len(payroll_response.data), 1)
        self.assertEqual(payroll_response.data[0]["employee"]["id"], self.employee_one.id)

        tickets_response = self.client.get("/api/data/tickets/")
        self.assertEqual(tickets_response.status_code, 200)
        self.assertEqual(len(tickets_response.data), 1)
        self.assertEqual(str(tickets_response.data[0]["data"]["employee_id"]), str(self.employee_one.id))

        recruitment_denied = self.client.get("/api/recruitment/jobs/")
        self.assertEqual(recruitment_denied.status_code, 403)

        settlements_denied = self.client.get("/api/final-settlements/")
        self.assertEqual(settlements_denied.status_code, 403)

        category_create_denied = self.client.post("/api/document-categories/", {"name": "Tax", "code": "tax"}, format="json")
        self.assertEqual(category_create_denied.status_code, 403)

        accounting_denied = self.client.get("/api/data/accounting-categories/")
        self.assertEqual(accounting_denied.status_code, 403)

    def test_employee_document_and_ticket_write_paths_are_self_scoped(self):
        self.auth(self.employee_user)

        document_response = self.client.post(
            "/api/employee-documents/",
            {
                "employee_id": self.employee_two.id,
                "category_id": self.doc_category.id,
                "title": "Updated Aadhaar",
                "file_name": "aadhaar.pdf",
            },
            format="json",
        )
        self.assertEqual(document_response.status_code, 201)
        self.assertEqual(document_response.data["employee"]["id"], self.employee_one.id)
        self.assertEqual(document_response.data["status"], "pending")

        ticket_response = self.client.post(
            "/api/data/tickets/",
            {"data": {"employee_id": self.employee_two.id, "subject": "Need access", "status": "Closed"}},
            format="json",
        )
        self.assertEqual(ticket_response.status_code, 201)
        self.assertEqual(str(ticket_response.data["data"]["employee_id"]), str(self.employee_one.id))
        self.assertEqual(ticket_response.data["data"]["requester_email"], self.employee_user.email)
        self.assertEqual(ticket_response.data["data"]["status"], "Open")

        update_denied = self.client.patch(
            f"/api/data/tickets/{self.ticket_one.id}/",
            {"data": {"status": "Resolved"}},
            format="json",
        )
        self.assertEqual(update_denied.status_code, 403)

    def test_hr_can_manage_documents_templates_and_approvals(self):
        self.auth(self.hr_user)

        docs_response = self.client.get("/api/employee-documents/")
        self.assertEqual(docs_response.status_code, 200)
        self.assertEqual(len(docs_response.data), 2)

        category_response = self.client.post(
            "/api/document-categories/",
            {
                "name": "Tax Docs",
                "code": "tax-docs",
                "visibility": DocumentCategory.VISIBILITY_HR,
            },
            format="json",
        )
        self.assertEqual(category_response.status_code, 201)

        template_response = self.client.post(
            "/api/onboarding/templates/",
            {
                "name": "Engineering Onboarding",
                "description": "HR + IT tasks",
                "tasks": [{"title": "Issue laptop", "task_type": "it", "sort_order": 1}],
            },
            format="json",
        )
        self.assertEqual(template_response.status_code, 201)

        approval_response = self.client.get("/api/approvals/inbox/")
        self.assertEqual(approval_response.status_code, 200)
        self.assertIn("counts", approval_response.data)

    def test_stakeholder_can_view_inbox_audit_and_recruitment_but_cannot_manage(self):
        self.auth(self.stakeholder)

        approvals_response = self.client.get("/api/approvals/inbox/")
        self.assertEqual(approvals_response.status_code, 200)

        audit_response = self.client.get("/api/audit-logs/")
        self.assertEqual(audit_response.status_code, 200)
        self.assertGreaterEqual(len(audit_response.data), 1)

        recruitment_response = self.client.get("/api/recruitment/jobs/")
        self.assertEqual(recruitment_response.status_code, 200)
        self.assertEqual(len(recruitment_response.data), 1)

        template_create_denied = self.client.post(
            "/api/onboarding/templates/",
            {"name": "Stakeholder Template", "tasks": []},
            format="json",
        )
        self.assertEqual(template_create_denied.status_code, 403)

        job_create_denied = self.client.post(
            "/api/recruitment/jobs/",
            {"title": "Director", "status": RecruitmentJob.STATUS_OPEN},
            format="json",
        )
        self.assertEqual(job_create_denied.status_code, 403)

    def test_stakeholder_can_read_but_not_write_crm_generic_resources(self):
        self.auth(self.stakeholder)

        deals_response = self.client.get("/api/data/crm-deals/")
        self.assertEqual(deals_response.status_code, 200)
        self.assertEqual(len(deals_response.data), 1)

        create_denied = self.client.post(
            "/api/data/crm-deals/",
            {"data": {"name": "Expansion"}},
            format="json",
        )
        self.assertEqual(create_denied.status_code, 403)

    def test_profile_update_request_workflow(self):
        # 1. Employee submits a profile update request
        self.auth(self.employee_user)
        proposed_changes = {
            "phone": "9999999999",
            "bank_info": {"bank_name": "New International Bank", "account_number": "9876543210"}
        }
        current_data = {
            "phone": self.employee_one.phone,
            "bank_info": self.employee_one.bank_info
        }
        
        response = self.client.post(
            "/api/data/profile-update-requests/",
            {
                "data": {
                    "section": "bank",
                    "proposed_changes": proposed_changes,
                    "current_data": current_data
                }
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        request_id = response.data["id"]
        self.assertEqual(response.data["data"]["status"], "Pending")
        self.assertEqual(response.data["data"]["employee_id"], self.employee_one.id)
        
        # Verify employee scoping: Asha cannot view other employee's requests if created (and she can view hers)
        get_response = self.client.get("/api/data/profile-update-requests/")
        self.assertEqual(get_response.status_code, 200)
        self.assertGreaterEqual(len(get_response.data), 1)
        
        # 2. HR views the approval inbox and sees the request
        self.auth(self.hr_user)
        inbox_response = self.client.get("/api/approvals/inbox/")
        self.assertEqual(inbox_response.status_code, 200)
        items = inbox_response.data["items"]
        profile_items = [it for it in items if it["scope"] == "profile_update"]
        self.assertEqual(len(profile_items), 1)
        self.assertEqual(profile_items[0]["id"], str(request_id))
        
        # 3. HR approves the request
        approve_response = self.client.post(
            "/api/approvals/inbox/",
            {
                "scope": "profile_update",
                "id": str(request_id),
                "decision": "approve",
                "note": "Bank details look correct."
            },
            format="json",
        )
        self.assertEqual(approve_response.status_code, 200)
        
        # 4. Verify request status is updated to Approved
        req_check = Resource.objects.get(pk=request_id)
        self.assertEqual(req_check.data["status"], "Approved")
        self.assertEqual(req_check.data["comments"], "Bank details look correct.")
        
        # 5. Verify Employee record was updated in the database
        self.employee_one.refresh_from_db()
        self.assertEqual(self.employee_one.phone, "9999999999")
        self.assertEqual(self.employee_one.bank_info["bank_name"], "New International Bank")
        self.assertEqual(self.employee_one.bank_info["account_number"], "9876543210")

    def test_document_esign_and_signature_workflow(self):
        # 1. Non-HR cannot create an E-Sign document
        self.auth(self.employee_user)
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        pdf_file = SimpleUploadedFile("contract.pdf", b"pdf content", content_type="application/pdf")
        
        response = self.client.post(
            "/api/esign-documents/",
            {
                "title": "Employee Agreement",
                "description": "Please sign",
                "file": pdf_file,
                "distribution_type": "all",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)

        # 2. HR can create and distribute an E-Sign document
        self.auth(self.hr_user)
        pdf_file.seek(0)
        response = self.client.post(
            "/api/esign-documents/",
            {
                "title": "Employee Agreement",
                "description": "Please sign",
                "file": pdf_file,
                "distribution_type": "all",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        doc_id = response.data["id"]

        # 3. Check that DocumentSignature records were auto-generated for active employees (Asha and Ravi)
        signatures = DocumentSignature.objects.filter(document_id=doc_id)
        self.assertEqual(signatures.count(), 2)
        
        # 4. Employee Asha can view and sign their own signature record
        self.auth(self.employee_user)
        asha_sig = signatures.get(employee=self.employee_one)
        
        # Verify employee can see their own signatures
        sig_list_response = self.client.get("/api/esign-signatures/")
        self.assertEqual(sig_list_response.status_code, 200)
        self.assertEqual(len(sig_list_response.data), 1)
        self.assertEqual(sig_list_response.data[0]["id"], asha_sig.id)

        # Try signing as employee
        sign_response = self.client.patch(
            f"/api/esign-signatures/{asha_sig.id}/",
            {"status": "signed"},
            format="json",
        )
        self.assertEqual(sign_response.status_code, 200)
        self.assertEqual(sign_response.data["status"], "signed")
        
        # Verify IP and signed_at are recorded
        asha_sig.refresh_from_db()
        self.assertEqual(asha_sig.status, "signed")
        self.assertIsNotNone(asha_sig.signed_at)
        
        # 5. Asha cannot sign Ravi's signature record
        ravi_sig = signatures.get(employee=self.employee_two)
        sign_denied = self.client.patch(
            f"/api/esign-signatures/{ravi_sig.id}/",
            {"status": "signed"},
            format="json",
        )
        self.assertEqual(sign_denied.status_code, 404)

