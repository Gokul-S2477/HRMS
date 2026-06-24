from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import is_employee, is_hr_or_above

from .models import EmployeePayroll, FinalSettlement, PayrollComplianceProfile, SalaryComponent
from .serializers import (
    EmployeePayrollSerializer,
    FinalSettlementSerializer,
    PayrollComplianceProfileSerializer,
    SalaryComponentSerializer,
)
from .services import ensure_final_settlement, recalculate_employee_payroll


class SalaryComponentViewSet(viewsets.ModelViewSet):
    serializer_class = SalaryComponentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SalaryComponent.objects.all().order_by("name")
        if is_employee(self.request.user):
            return qs.none()
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change salary components.")


class PayrollComplianceProfileViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollComplianceProfileSerializer
    permission_classes = [IsAuthenticated]
    queryset = PayrollComplianceProfile.objects.all().order_by("-is_active", "name")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if is_employee(request.user):
                self.permission_denied(request, message="Employees cannot view payroll compliance profiles.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage payroll compliance profiles.")


class EmployeePayrollViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeePayrollSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            EmployeePayroll.objects.select_related(
                "employee",
                "employee__department",
                "employee__designation",
                "approved_by",
            )
            .prefetch_related("components", "settlements")
            .order_by("-year", "-cycle_end", "-updated_at")
        )
        user = self.request.user
        if is_employee(user):
            if getattr(user, "employee_profile_id", None):
                qs = qs.filter(employee_id=user.employee_profile_id)
            else:
                return qs.none()
        status_filter = self.request.query_params.get("status")
        month_filter = self.request.query_params.get("month")
        year_filter = self.request.query_params.get("year")
        employee_filter = self.request.query_params.get("employee_id")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if month_filter:
            qs = qs.filter(month__iexact=month_filter)
        if year_filter:
            qs = qs.filter(year=year_filter)
        if employee_filter and not is_employee(user):
            qs = qs.filter(employee_id=employee_filter)
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change payroll data.")

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can recalculate payroll.")
        payroll = self.get_object()
        recalculate_employee_payroll(payroll)
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can publish payroll.")
        payroll = self.get_object()
        recalculate_employee_payroll(payroll)
        payroll.status = EmployeePayroll.STATUS_PUBLISHED
        payroll.published_at = timezone.now()
        payroll.save(update_fields=["status", "published_at", "updated_at"])
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can lock payroll.")
        payroll = self.get_object()
        payroll.status = EmployeePayroll.STATUS_LOCKED
        payroll.locked_at = timezone.now()
        payroll.save(update_fields=["status", "locked_at", "updated_at"])
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can unlock payroll.")
        payroll = self.get_object()
        payroll.status = EmployeePayroll.STATUS_APPROVED if payroll.approved_by_id else EmployeePayroll.STATUS_IN_REVIEW
        payroll.locked_at = None
        payroll.save(update_fields=["status", "locked_at", "updated_at"])
        return Response(self.get_serializer(payroll).data)

    @action(detail=False, methods=["post"], url_path="run-batch")
    def run_batch(self, request):
        """
        Task 2.1 / Task 3.3 — Batch payroll processing.
        POST /api/payroll/run-batch/
        Body: { "month": "June", "year": 2026, "employee_ids": [] }
        Empty employee_ids = all active employees.
        """
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and admins can run payroll batch.")

        from employees.models import Employee

        month = request.data.get("month", "")
        year = int(request.data.get("year") or timezone.now().year)
        employee_ids = request.data.get("employee_ids") or []

        if not month:
            return Response({"detail": "month is required."}, status=status.HTTP_400_BAD_REQUEST)

        if employee_ids:
            employees = Employee.objects.filter(pk__in=employee_ids, is_active=True)
        else:
            employees = Employee.objects.filter(is_active=True)

        total = employees.count()
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        for employee in employees:
            try:
                payroll, created = EmployeePayroll.objects.get_or_create(
                    employee=employee,
                    month=month,
                    year=year,
                    defaults={
                        "basic_salary": getattr(employee, "salary", 0) or 0,
                        "status": EmployeePayroll.STATUS_DRAFT,
                    },
                )
                if payroll.status in {EmployeePayroll.STATUS_LOCKED, EmployeePayroll.STATUS_APPROVED}:
                    skipped_count += 1
                    continue
                recalculate_employee_payroll(payroll)
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            except Exception as exc:
                errors.append({"employee_id": employee.pk, "name": str(employee), "error": str(exc)})

        return Response({
            "month": month,
            "year": year,
            "total_employees": total,
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors,
        })

    @action(detail=True, methods=["get"], url_path="payslip-pdf")
    def payslip_pdf(self, request, pk=None):
        """
        Task 3.2 — Download payslip as PDF.
        GET /api/payroll/{id}/payslip-pdf/
        Only published or locked payrolls can be downloaded.
        """
        from django.http import HttpResponse
        import os

        payroll = self.get_object()

        # Employees can only download their own payslip
        if is_employee(request.user):
            if not getattr(request.user, "employee_profile_id", None) or \
               request.user.employee_profile_id != payroll.employee_id:
                self.permission_denied(request, message="You can only download your own payslip.")

        if payroll.status not in {EmployeePayroll.STATUS_PUBLISHED, EmployeePayroll.STATUS_LOCKED}:
            return Response(
                {"detail": "Payslip PDF is only available for published or locked payrolls."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def generate_payslip_pdf_reportlab(payroll_obj):
            from io import BytesIO
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors

            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter,
                                    rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
            story = []
            styles = getSampleStyleSheet()

            # Create custom styles
            title_style = ParagraphStyle(
                'TitleStyle',
                parent=styles['Heading1'],
                fontSize=20,
                leading=24,
                textColor=colors.HexColor("#ff7a1a"),
                alignment=1 # Center
            )
            subtitle_style = ParagraphStyle(
                'SubtitleStyle',
                parent=styles['Normal'],
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#475569"),
                alignment=1
            )
            heading_style = ParagraphStyle(
                'HeadingStyle',
                parent=styles['Heading2'],
                fontSize=12,
                leading=16,
                textColor=colors.HexColor("#1e293b"),
                spaceBefore=10,
                spaceAfter=5
            )
            body_style = ParagraphStyle(
                'BodyStyle',
                parent=styles['Normal'],
                fontSize=9,
                leading=13,
                textColor=colors.HexColor("#1e293b")
            )
            bold_style = ParagraphStyle(
                'BoldStyle',
                parent=body_style,
                fontName='Helvetica-Bold'
            )
            white_bold_style = ParagraphStyle(
                'WhiteBold',
                parent=bold_style,
                textColor=colors.white
            )

            company_name_val = os.getenv("COMPANY_NAME", "Palepu Pharma")
            company_address_val = os.getenv("COMPANY_ADDRESS", "Main Office")

            # Header
            story.append(Paragraph(company_name_val, title_style))
            story.append(Paragraph(company_address_val, subtitle_style))
            story.append(Spacer(1, 15))

            # Payslip Title
            story.append(Paragraph(f"PAYSLIP FOR {str(payroll_obj.month).upper()} {payroll_obj.year}", heading_style))
            story.append(Spacer(1, 10))

            # Employee Details Table
            emp = payroll_obj.employee
            emp_details = [
                [Paragraph("Employee Code:", bold_style), Paragraph(emp.emp_code or "-", body_style),
                 Paragraph("Department:", bold_style), Paragraph(emp.department.name if emp.department else "-", body_style)],
                [Paragraph("Employee Name:", bold_style), Paragraph(f"{emp.first_name} {emp.last_name or ''}".strip(), body_style),
                 Paragraph("Designation:", bold_style), Paragraph(emp.designation.title if emp.designation else "-", body_style)],
                [Paragraph("Joining Date:", bold_style), Paragraph(str(emp.joining_date) if emp.joining_date else "-", body_style),
                 Paragraph("Bank Acc No:", bold_style), Paragraph(str(emp.bank_info.get("account_number") if emp.bank_info else "-"), body_style)]
            ]
            t_details = Table(emp_details, colWidths=[100, 160, 100, 160])
            t_details.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
                ('PADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(t_details)
            story.append(Spacer(1, 15))

            # Earnings & Deductions Tables side-by-side
            earnings = [
                [Paragraph("Earnings Component", bold_style), Paragraph("Amount", bold_style)]
            ]
            earnings_breakdown = payroll_obj.earnings_breakdown or {}
            for comp, amt in earnings_breakdown.items():
                earnings.append([Paragraph(comp.replace("_", " ").title(), body_style), Paragraph(f"INR {amt}", body_style)])
            earnings.append([Paragraph("Total Earnings", bold_style), Paragraph(f"INR {payroll_obj.gross_salary}", bold_style)])

            deductions = [
                [Paragraph("Deductions Component", bold_style), Paragraph("Amount", bold_style)]
            ]
            deductions_breakdown = payroll_obj.deductions_breakdown or {}
            for comp, amt in deductions_breakdown.items():
                deductions.append([Paragraph(comp.replace("_", " ").title(), body_style), Paragraph(f"INR {amt}", body_style)])
            deductions.append([Paragraph("Total Deductions", bold_style), Paragraph(f"INR {payroll_obj.total_deductions}", bold_style)])

            t_earnings = Table(earnings, colWidths=[170, 90])
            t_earnings.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (1,0), colors.HexColor("#e2e8f0")),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                ('ALIGN', (1,0), (1,-1), 'RIGHT'),
                ('PADDING', (0,0), (-1,-1), 6),
            ]))

            t_deductions = Table(deductions, colWidths=[170, 90])
            t_deductions.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (1,0), colors.HexColor("#e2e8f0")),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                ('ALIGN', (1,0), (1,-1), 'RIGHT'),
                ('PADDING', (0,0), (-1,-1), 6),
            ]))

            side_table = Table([[t_earnings, t_deductions]], colWidths=[265, 265])
            side_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(side_table)
            story.append(Spacer(1, 15))

            # Net Pay
            net_pay_data = [
                [Paragraph("NET TAKE-HOME PAY", white_bold_style), Paragraph(f"INR {payroll_obj.net_salary}", white_bold_style)]
            ]
            t_net = Table(net_pay_data, colWidths=[380, 140])
            t_net.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#ff7a1a")),
                ('PADDING', (0,0), (-1,-1), 8),
                ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ]))
            story.append(t_net)
            story.append(Spacer(1, 40))

            # Footer
            story.append(Paragraph("This is a computer-generated document and does not require a physical signature.", subtitle_style))

            doc.build(story)
            buffer.seek(0)
            return buffer.getvalue()

        pdf_bytes = None
        weasy_error = None
        try:
            import weasyprint
            from django.template.loader import render_to_string
            from django.conf import settings as django_settings

            company_name = os.getenv("COMPANY_NAME", "Palepu Pharma")
            html_content = render_to_string("payroll/payslip.html", {
                "payroll": payroll,
                "employee": payroll.employee,
                "company_name": company_name,
                "company_address": os.getenv("COMPANY_ADDRESS", ""),
                "company_pan": os.getenv("COMPANY_PAN", ""),
                "company_pf": os.getenv("COMPANY_PF_NUMBER", ""),
                "company_esi": os.getenv("COMPANY_ESI_NUMBER", ""),
            })
            pdf_bytes = weasyprint.HTML(string=html_content, base_url=request.build_absolute_uri("/")).write_pdf()
        except Exception as weasy_exc:
            weasy_error = weasy_exc

        if not pdf_bytes:
            try:
                pdf_bytes = generate_payslip_pdf_reportlab(payroll)
            except Exception as rl_exc:
                return Response(
                    {"detail": f"PDF generation failed. WeasyPrint: {weasy_error}. ReportLab fallback: {rl_exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        filename = f"payslip_{payroll.employee_id}_{payroll.month}_{payroll.year}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class FinalSettlementViewSet(viewsets.ModelViewSet):
    serializer_class = FinalSettlementSerializer
    permission_classes = [IsAuthenticated]
    queryset = FinalSettlement.objects.select_related(
        "employee",
        "employee__department",
        "employee__designation",
        "offboarding_case",
        "payroll",
        "compliance_profile",
        "prepared_by",
        "approved_by",
    ).all()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            if is_employee(request.user):
                self.permission_denied(request, message="Employees cannot view final settlement records.")
            return
        if not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can manage final settlements.")

    def get_queryset(self):
        qs = self.queryset.order_by("-updated_at", "-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        employee_filter = self.request.query_params.get("employee_id")
        if employee_filter:
            qs = qs.filter(employee_id=employee_filter)
        return qs

    def perform_create(self, serializer):
        settlement = serializer.save(prepared_by=self.request.user)
        if settlement.offboarding_case_id:
            ensure_final_settlement(settlement.offboarding_case, self.request.user)

    def perform_update(self, serializer):
        settlement = serializer.save()
        if settlement.offboarding_case_id:
            ensure_final_settlement(settlement.offboarding_case, self.request.user)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        settlement = self.get_object()
        ensure_final_settlement(settlement.offboarding_case, request.user)
        settlement.refresh_from_db()
        return Response(self.get_serializer(settlement).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        settlement = self.get_object()
        ensure_final_settlement(settlement.offboarding_case, request.user)
        settlement.refresh_from_db()
        settlement.status = FinalSettlement.STATUS_APPROVED
        settlement.approved_by = request.user
        settlement.approved_at = timezone.now()
        settlement.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        if settlement.offboarding_case_id:
            case = settlement.offboarding_case
            case.final_payroll_status = settlement.status
            case.save(update_fields=["final_payroll_status", "updated_at"])
        return Response(self.get_serializer(settlement).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        settlement = self.get_object()
        settlement.status = FinalSettlement.STATUS_PAID
        settlement.paid_at = timezone.now()
        settlement.save(update_fields=["status", "paid_at", "updated_at"])
        if settlement.offboarding_case_id:
            case = settlement.offboarding_case
            case.final_payroll_status = settlement.status
            case.status = case.STATUS_COMPLETED
            case.completed_at = case.completed_at or timezone.now()
            case.save(update_fields=["final_payroll_status", "status", "completed_at", "updated_at"])
        return Response(self.get_serializer(settlement).data)
