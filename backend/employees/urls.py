from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DepartmentViewSet, DesignationViewSet, EmployeeViewSet, PolicyViewSet
from payroll.reports_views import EmployeeBulkImportView


router = DefaultRouter()
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"departments", DepartmentViewSet, basename="departments")
router.register(r"designations", DesignationViewSet, basename="designations")
router.register(r"policies", PolicyViewSet, basename="policies")

urlpatterns = [
    path("employees/bulk-import/", EmployeeBulkImportView.as_view(), name="employees-bulk-import"),
] + router.urls
