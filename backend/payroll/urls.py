from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    EmployeePayrollViewSet,
    FinalSettlementViewSet,
    PayrollComplianceProfileViewSet,
    SalaryComponentViewSet,
)
from .reports_views import (
    PFChallanView,
    ESIReportView,
    SalaryRegisterView,
    Form16View,
)


router = DefaultRouter()
router.register(r"salary-components", SalaryComponentViewSet, basename="salary-components")
router.register(r"employee-payroll", EmployeePayrollViewSet, basename="employee-payroll")
router.register(r"payroll-compliance-profiles", PayrollComplianceProfileViewSet, basename="payroll-compliance-profiles")
router.register(r"final-settlements", FinalSettlementViewSet, basename="final-settlements")

urlpatterns = router.urls + [
    path("reports/pf-challan/", PFChallanView.as_view(), name="pf-challan"),
    path("reports/esi-report/", ESIReportView.as_view(), name="esi-report"),
    path("reports/salary-register/", SalaryRegisterView.as_view(), name="salary-register"),
    path("reports/form16/", Form16View.as_view(), name="form16"),
]
