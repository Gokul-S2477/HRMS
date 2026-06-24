from datetime import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from coredata.models import Resource, AttendanceRecord
from employees.models import Employee

class Command(BaseCommand):
    help = "Syncs attendance records from the generic Resource model (resource_type='attendance-employee') to the structured AttendanceRecord table"

    def handle(self, *args, **options):
        resources = Resource.objects.filter(resource_type="attendance-employee")
        self.stdout.write(f"Found {resources.count()} attendance resources to process.")

        success_count = 0
        skipped_count = 0
        error_count = 0

        for res in resources:
            data = res.data or {}
            employee_id = data.get("employee_id")
            if not employee_id:
                self.stderr.write(f"Resource {res.id} missing employee_id. Skipping.")
                error_count += 1
                continue

            try:
                employee = Employee.objects.get(pk=employee_id)
            except Employee.DoesNotExist:
                self.stderr.write(f"Employee {employee_id} not found for Resource {res.id}. Skipping.")
                error_count += 1
                continue

            work_date_str = data.get("date")
            if not work_date_str:
                self.stderr.write(f"Resource {res.id} missing date. Skipping.")
                error_count += 1
                continue

            try:
                work_date = datetime.strptime(work_date_str, "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(f"Invalid date format '{work_date_str}' in Resource {res.id}. Skipping.")
                error_count += 1
                continue

            # Convert string check-in/check-out to time objects
            def parse_time(time_str):
                if not time_str:
                    return None
                try:
                    return datetime.strptime(time_str, "%H:%M").time()
                except ValueError:
                    try:
                        return datetime.strptime(time_str, "%H:%M:%S").time()
                    except ValueError:
                        return None

            check_in_time = parse_time(data.get("check_in"))
            check_out_time = parse_time(data.get("check_out"))

            # Convert coords to Decimal
            def to_decimal(val):
                if val is None or val == "":
                    return None
                try:
                    return Decimal(str(val))
                except Exception:
                    return None

            check_in_lat = to_decimal(data.get("latitude") or data.get("check_in_lat"))
            check_in_lng = to_decimal(data.get("longitude") or data.get("check_in_lng"))
            check_out_lat = to_decimal(data.get("check_out_lat"))
            check_out_lng = to_decimal(data.get("check_out_lng"))

            status_val = data.get("status") or "Present"
            # Map statuses just in case they differ in casing
            # But the options are "Present", "Absent", "On Leave", "Half Day", "Late" which match choices exactly

            # Create or update structured record
            record, created = AttendanceRecord.objects.update_or_create(
                employee=employee,
                work_date=work_date,
                defaults={
                    "check_in_time": check_in_time,
                    "check_out_time": check_out_time,
                    "check_in_lat": check_in_lat,
                    "check_in_lng": check_in_lng,
                    "check_out_lat": check_out_lat,
                    "check_out_lng": check_out_lng,
                    "check_in_ip": data.get("ip_address"),
                    "check_out_ip": data.get("ip_address_out"),
                    "check_in_method": data.get("check_in_method") or "web",
                    "status": status_val,
                    "total_hours": to_decimal(data.get("work_hours")) or Decimal("0.00"),
                    "break_hours": to_decimal(data.get("break_hours")) or Decimal("0.00"),
                    "on_break": bool(data.get("on_break", False)),
                    "breaks": data.get("breaks") or [],
                    "work_mode": data.get("work_mode") or "Office",
                    "shift": data.get("shift") or "General",
                    "punctuality": data.get("punctuality") or "On time",
                    "discrepancy": bool(data.get("discrepancy", False)),
                    "discrepancy_reasons": data.get("discrepancy_reasons") or [],
                    "is_regularized": bool(data.get("is_regularized", False)),
                    "notes": data.get("remarks") or "",
                }
            )

            if created:
                success_count += 1
            else:
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully synced: {success_count} created, {skipped_count} updated. Errors: {error_count}."
            )
        )
