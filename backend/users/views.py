from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import can_manage_user, is_hr_or_above, is_super_admin
from .serializers import (
    UserAccountSerializer,
    UserAccountWriteSerializer,
    UserMeSerializer,
)

User = get_user_model()


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=["last_seen_at"])
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data)


class UserAccountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.select_related("employee_profile", "managed_by").order_by("username")

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return UserAccountWriteSerializer
        return UserAccountSerializer

    def get_queryset(self):
        actor = self.request.user
        qs = self.queryset

        if is_super_admin(actor):
            pass
        elif is_hr_or_above(actor):
            qs = qs.filter(Q(role=User.ROLE_EMPLOYEE) | Q(pk=actor.pk))
        else:
            qs = qs.filter(pk=actor.pk)

        search = self.request.query_params.get("search")
        role = self.request.query_params.get("role")
        status_filter = self.request.query_params.get("status")
        linked = self.request.query_params.get("linked")

        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(display_name__icontains=search)
                | Q(employee_profile__emp_code__icontains=search)
                | Q(employee_profile__email__icontains=search)
            )
        if role:
            qs = qs.filter(role=role)
        if status_filter:
            qs = qs.filter(account_status=status_filter)
        if linked == "yes":
            qs = qs.filter(employee_profile__isnull=False)
        if linked == "no":
            qs = qs.filter(employee_profile__isnull=True)
        return qs

    def list(self, request, *args, **kwargs):
        if not is_hr_or_above(request.user) and not is_super_admin(request.user):
            return Response({"detail": "You are not allowed to manage login accounts."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not is_hr_or_above(request.user):
            return Response({"detail": "You are not allowed to create accounts."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save(managed_by=request.user)
        return Response(UserAccountSerializer(account).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        account = self.get_object()
        if not can_manage_user(request.user, account):
            return Response({"detail": "You are not allowed to modify this account."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        account = self.get_object()
        if not can_manage_user(request.user, account):
            return Response({"detail": "You are not allowed to modify this account."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        account = self.get_object()
        if account.pk == request.user.pk:
            return Response({"detail": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        if not can_manage_user(request.user, account):
            return Response({"detail": "You are not allowed to delete this account."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        account = self.get_object()
        if account.pk == request.user.pk:
            return Response({"detail": "You cannot block your own account."}, status=status.HTTP_400_BAD_REQUEST)
        if not can_manage_user(request.user, account):
            return Response({"detail": "You are not allowed to block this account."}, status=status.HTTP_403_FORBIDDEN)
        account.account_status = User.STATUS_BLOCKED
        account.is_active = False
        account.save(update_fields=["account_status", "is_active"])
        return Response(UserAccountSerializer(account).data)

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        account = self.get_object()
        if not can_manage_user(request.user, account):
            return Response({"detail": "You are not allowed to unblock this account."}, status=status.HTTP_403_FORBIDDEN)
        account.account_status = User.STATUS_ACTIVE
        account.is_active = True
        account.save(update_fields=["account_status", "is_active"])
        return Response(UserAccountSerializer(account).data)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        account = self.get_object()
        if not can_manage_user(request.user, account):
            return Response({"detail": "You are not allowed to reset this password."}, status=status.HTTP_403_FORBIDDEN)
        new_password = request.data.get("password") or User.objects.make_random_password()
        account.set_password(new_password)
        account.must_change_password = True
        account.account_status = User.STATUS_ACTIVE
        account.is_active = True
        account.save(update_fields=["password", "must_change_password", "account_status", "is_active"])
        return Response({"temporary_password": new_password, "account": UserAccountSerializer(account).data})
