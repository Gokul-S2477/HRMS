from rest_framework.routers import DefaultRouter

from .views import DepartmentViewSet, DesignationViewSet, EmployeeViewSet, PolicyViewSet


router = DefaultRouter()
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(r"departments", DepartmentViewSet, basename="departments")
router.register(r"designations", DesignationViewSet, basename="designations")
router.register(r"policies", PolicyViewSet, basename="policies")

urlpatterns = router.urls
