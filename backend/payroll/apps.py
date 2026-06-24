from django.apps import AppConfig


class PayrollConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "payroll"

    def ready(self):
        # Connect auto-recalculate signal (Task 2.1)
        import payroll.signals  # noqa: F401
