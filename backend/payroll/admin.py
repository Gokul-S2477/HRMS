from django.contrib import admin

from .models import EmployeePayroll, SalaryComponent


admin.site.register(SalaryComponent)
admin.site.register(EmployeePayroll)
