from django.urls import path
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView, TokenObtainPairView

from .auth_serializers import CustomTokenObtainPairSerializer


from .views import ChangePasswordView


# ---------------------------------------------------------------------------
# Custom throttle classes for sensitive auth endpoints  (Task 1.6)
# ---------------------------------------------------------------------------

class AuthLoginThrottle(AnonRateThrottle):
    """Strict rate limit on login endpoint — 10 attempts per minute per IP."""
    scope = "auth"


class TokenRefreshThrottle(UserRateThrottle):
    """Rate limit on refresh token endpoint."""
    scope = "auth"


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [AuthLoginThrottle]


urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Logout — blacklists the refresh token so it cannot be reused (Task 1.3)
    path("logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    # Change Password (Task 2.4)
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
]
