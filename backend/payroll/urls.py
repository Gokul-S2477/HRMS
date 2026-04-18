from rest_framework.routers import DefaultRouter

from .views import (
    EmployeePayrollViewSet,
    FinalSettlementViewSet,
    PayrollComplianceProfileViewSet,
    SalaryComponentViewSet,
)


router = DefaultRouter()
router.register(r"salary-components", SalaryComponentViewSet, basename="salary-components")
router.register(r"employee-payroll", EmployeePayrollViewSet, basename="employee-payroll")
router.register(r"payroll-compliance-profiles", PayrollComplianceProfileViewSet, basename="payroll-compliance-profiles")
router.register(r"final-settlements", FinalSettlementViewSet, basename="final-settlements")

urlpatterns = router.urls
