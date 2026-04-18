from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .serializers import UserMeSerializer

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["effective_role"] = user.effective_role
        token["employee_id"] = user.employee_profile_id
        return token

    def validate(self, attrs):
        identifier = (attrs.get("username") or attrs.get("email") or "").strip()
        if identifier and "@" in identifier:
            matched_user = User.objects.filter(email__iexact=identifier).only("username").first()
            if matched_user:
                attrs["username"] = matched_user.username
        elif identifier:
            attrs["username"] = identifier

        data = super().validate(attrs)
        if getattr(self.user, "account_status", None) == self.user.STATUS_BLOCKED:
            raise AuthenticationFailed("This account is blocked. Contact HR or the system administrator.")
        if not getattr(self.user, "is_active", True):
            raise AuthenticationFailed("This account is inactive. Contact HR or the system administrator.")
        self.user.last_seen_at = timezone.now()
        self.user.save(update_fields=["last_seen_at"])
        data["user"] = UserMeSerializer(self.user).data
        return data
