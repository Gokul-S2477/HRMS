import datetime
from django.core.management.base import BaseCommand
from employees.models import Employee
from coredata.models import Notification
from users.models import CustomUser

class Command(BaseCommand):
    help = "Flags and processes employees whose probation end date has passed."

    def handle(self, *args, **options):
        today = datetime.date.today()
        employees_due = Employee.objects.filter(
            probation_status__in=["on_probation", "extended"],
            probation_end_date__lte=today,
            is_active=True
        )

        self.stdout.write(f"Found {employees_due.count()} employees with completed or overdue probation.")

        # Get HR / Admin users to notify
        hr_users = CustomUser.objects.filter(role__in=[CustomUser.ROLE_HR, CustomUser.ROLE_SUPER_ADMIN])

        for emp in employees_due:
            self.stdout.write(
                f"Flagging employee: {emp.first_name} {emp.last_name or ''} ({emp.emp_code}) - "
                f"Probation ended on {emp.probation_end_date}"
            )
            
            # Create in-app notification for each HR user
            for hr in hr_users:
                Notification.objects.create(
                    recipient=hr,
                    notification_type="probation_due",
                    title="Probation End Date Reached",
                    body=(
                        f"Employee {emp.first_name} {emp.last_name or ''} ({emp.emp_code}) "
                        f"completed their probation on {emp.probation_end_date}. Action required for confirmation."
                    ),
                    target_url=f"/employees/{emp.id}",
                    reference_type="employee",
                    reference_id=str(emp.id)
                )
