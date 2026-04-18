from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MeView, UserAccountViewSet

router = DefaultRouter()
router.register(r"accounts", UserAccountViewSet, basename="user-accounts")

urlpatterns = [
    path("me/", MeView.as_view(), name="user-me"),
    path("", include(router.urls)),
]
