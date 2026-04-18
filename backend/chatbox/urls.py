from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ChatThreadViewSet

router = DefaultRouter()
router.register(r"threads", ChatThreadViewSet, basename="chat-threads")

urlpatterns = [
    path("", include(router.urls)),
]
