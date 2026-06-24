import csv
import io
from datetime import datetime
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from employees.models import Employee, Department, Designation
from users.permissions import is_employee, is_hr_or_above
from .models import EmployeePayroll


class EmployeeBulkImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_hr_or_above(request.user):
            return Response({"detail": "Only HR and Admin can import employees."}, status=status.HTTP_403_FORBIDDEN)

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "CSV file is required under key 'file'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded_file = file.read().decode("utf-8-sig")
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
        except Exception as e:
            return Response({"detail": f"Failed to read file: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []
        rows = list(reader)

        if not rows:
            return Response({"detail": "CSV file is empty or headers are missing."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for idx, row in enumerate(rows, start=1):
                emp_code = row.get("emp_code", "").strip()
                first_name = row.get("first_name", "").strip()
                last_name = row.get("last_name", "").strip()
                email = row.get("email", "").strip()
                phone = row.get("phone", "").strip()
                joining_date_str = row.get("joining_date", "").strip()
                employment_type = row.get("employment_type", "Full-Time").strip()
                salary_str = row.get("salary", "").strip()
                dept_name = row.get("department", "").strip()
                desig_title = row.get("designation", "").strip()

                if not emp_code or not first_name or not email:
                    errors.append({"row": idx, "reason": "Missing required fields (emp_code, first_name, email)."})
                    continue

                if Employee.objects.filter(emp_code=emp_code).exists():
                    errors.append({"row": idx, "reason": f"Employee with code '{emp_code}' already exists."})
                    continue

                if Employee.objects.filter(email=email).exists():
                    errors.append({"row": idx, "reason": f"Employee with email '{email}' already exists."})
                    continue

                dept = None
                if dept_name:
                    dept, _ = Department.objects.get_or_create(name=dept_name)

                desig = None
                if desig_title:
                    desig, _ = Designation.objects.get_or_create(title=desig_title, defaults={"department": dept})

                joining_date = None
                if joining_date_str:
                    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
                        try:
                            joining_date = datetime.strptime(joining_date_str, fmt).date()
                            break
                        except ValueError:
                            continue
                    if not joining_date:
                        errors.append({"row": idx, "reason": f"Invalid joining_date format: {joining_date_str}"})
                        continue

                salary = None
                if salary_str:
                    try:
                        salary = float(salary_str.replace(",", ""))
                    except ValueError:
                        errors.append({"row": idx, "reason": f"Invalid salary: {salary_str}"})
                        continue

                try:
                    Employee.objects.create(
                        emp_code=emp_code,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        phone=phone,
                        joining_date=joining_date,
                        employment_type=employment_type,
                        salary=salary,
                        department=dept,
                        designation=desig,
                        role="Employee",
                    )
                    created_count += 1
                except Exception as e:
                    errors.append({"row": idx, "reason": f"Database error: {e}"})

        return Response({
            "total": len(rows),
            "created": created_count,
            "errors": errors
        }, status=status.HTTP_200_OK)


class PFChallanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_hr_or_above(request.user):
            return Response({"detail": "Only HR and Admin can view PF reports."}, status=status.HTTP_403_FORBIDDEN)

        month = request.query_params.get("month", "")
        year = request.query_params.get("year", "")

        if not month or not year:
            return Response({"detail": "month and year are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
        except ValueError:
            return Response({"detail": "year must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        payrolls = EmployeePayroll.objects.filter(month=month, year=year).select_related("employee")

        records = []
        total_basic = 0.0
        total_emp_pf = 0.0
        total_employer_pf = 0.0

        for p in payrolls:
            emp = p.employee
            basic_sal = float(p.basic_salary or 0.0)
            emp_pf = float(p.deductions_breakdown.get("provident_fund") or p.deductions_breakdown.get("pf") or 0.0)
            employer_pf = emp_pf

            records.append({
                "employee_id": emp.id,
                "emp_code": emp.emp_code,
                "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                "uan": emp.bank_info.get("uan") or emp.personal_info.get("uan") or "-",
                "basic_salary": basic_sal,
                "employee_pf": emp_pf,
                "employer_pf": employer_pf,
            })

            total_basic += basic_sal
            total_emp_pf += emp_pf
            total_employer_pf += employer_pf

        return Response({
            "month": month,
            "year": year,
            "records": records,
            "totals": {
                "basic_salary": round(total_basic, 2),
                "employee_pf": round(total_emp_pf, 2),
                "employer_pf": round(total_employer_pf, 2),
            }
        })


class ESIReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_hr_or_above(request.user):
            return Response({"detail": "Only HR and Admin can view ESI reports."}, status=status.HTTP_403_FORBIDDEN)

        month = request.query_params.get("month", "")
        year = request.query_params.get("year", "")

        if not month or not year:
            return Response({"detail": "month and year are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
        except ValueError:
            return Response({"detail": "year must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        payrolls = EmployeePayroll.objects.filter(month=month, year=year).select_related("employee")

        records = []
        total_gross = 0.0
        total_emp_esi = 0.0
        total_employer_esi = 0.0

        for p in payrolls:
            emp = p.employee
            gross_sal = float(p.gross_salary or 0.0)

            if gross_sal > 21000:
                continue

            emp_esi = float(p.deductions_breakdown.get("esi") or p.deductions_breakdown.get("employee_state_insurance") or 0.0)
            employer_esi = round(gross_sal * 0.0325, 2)

            records.append({
                "employee_id": emp.id,
                "emp_code": emp.emp_code,
                "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                "esi_number": emp.bank_info.get("esi") or emp.personal_info.get("esi") or "-",
                "gross_salary": gross_sal,
                "employee_esi": emp_esi,
                "employer_esi": employer_esi,
            })

            total_gross += gross_sal
            total_emp_esi += emp_esi
            total_employer_esi += employer_esi

        return Response({
            "month": month,
            "year": year,
            "records": records,
            "totals": {
                "gross_salary": round(total_gross, 2),
                "employee_esi": round(total_emp_esi, 2),
                "employer_esi": round(total_employer_esi, 2),
            }
        })


class SalaryRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_hr_or_above(request.user):
            return Response({"detail": "Only HR and Admin can view Salary Register."}, status=status.HTTP_403_FORBIDDEN)

        month = request.query_params.get("month", "")
        year = request.query_params.get("year", "")

        if not month or not year:
            return Response({"detail": "month and year are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
        except ValueError:
            return Response({"detail": "year must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        payrolls = EmployeePayroll.objects.filter(month=month, year=year).select_related("employee", "employee__department", "employee__designation")

        records = []
        for p in payrolls:
            emp = p.employee
            records.append({
                "employee_id": emp.id,
                "emp_code": emp.emp_code,
                "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                "department": emp.department.name if emp.department else "-",
                "designation": emp.designation.title if emp.designation else "-",
                "basic_salary": float(p.basic_salary or 0.0),
                "gross_salary": float(p.gross_salary or 0.0),
                "total_deductions": float(p.total_deductions or 0.0),
                "net_salary": float(p.net_salary or 0.0),
                "earnings_breakdown": p.earnings_breakdown,
                "deductions_breakdown": p.deductions_breakdown,
            })

        return Response({
            "month": month,
            "year": year,
            "records": records,
        })


class Form16View(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        emp_id = request.query_params.get("employee_id")
        year = request.query_params.get("year")

        if not year:
            return Response({"detail": "year is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
        except ValueError:
            return Response({"detail": "year must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        if is_employee(user):
            self_emp_id = getattr(user, "employee_profile_id", None)
            if not self_emp_id:
                return Response({"detail": "User is not linked to an employee profile."}, status=status.HTTP_400_BAD_REQUEST)
            emp_id = self_emp_id
        else:
            if not emp_id:
                return Response({"detail": "employee_id is required for Admin/HR users."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(pk=emp_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        payrolls = EmployeePayroll.objects.filter(employee=employee, year=year)

        q1_months = {"April", "May", "June"}
        q2_months = {"July", "August", "September"}
        q3_months = {"October", "November", "December"}
        q4_months = {"January", "February", "March"}

        q1_gross = 0.0
        q2_gross = 0.0
        q3_gross = 0.0
        q4_gross = 0.0

        monthly_tds = []
        total_pt = 0.0
        total_gross = 0.0

        for p in payrolls:
            g = float(p.gross_salary or 0.0)
            m = p.month
            tds = float(p.deductions_breakdown.get("tds") or p.deductions_breakdown.get("tax_deducted_at_source") or p.deductions_breakdown.get("income_tax") or 0.0)
            pt = float(p.deductions_breakdown.get("professional_tax") or p.deductions_breakdown.get("pt") or 0.0)

            total_gross += g
            total_pt += pt
            monthly_tds.append({"month": m, "tds": tds})

            if m in q1_months:
                q1_gross += g
            elif m in q2_months:
                q2_gross += g
            elif m in q3_months:
                q3_gross += g
            elif m in q4_months:
                q4_gross += g

        return Response({
            "employee_id": employee.id,
            "emp_code": employee.emp_code,
            "name": f"{employee.first_name} {employee.last_name or ''}".strip(),
            "pan": employee.personal_info.get("pan") or employee.bank_info.get("pan") or "-",
            "year": year,
            "quarterly_gross": {
                "Q1": round(q1_gross, 2),
                "Q2": round(q2_gross, 2),
                "Q3": round(q3_gross, 2),
                "Q4": round(q4_gross, 2),
            },
            "monthly_tds": monthly_tds,
            "total_taxable_income": round(total_gross, 2),
            "professional_tax_paid": round(total_pt, 2),
        })
