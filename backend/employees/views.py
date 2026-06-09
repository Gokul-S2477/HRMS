from datetime import datetime

from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import is_employee, is_hr_or_above

from .models import Department, Designation, Employee, Policy
from .serializers import (
    DepartmentSerializer,
    DesignationSerializer,
    EmployeeSerializer,
    PolicySerializer,
)


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Department.objects.annotate(employee_count=Count("employees")).order_by("name")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change departments.")


class DesignationViewSet(viewsets.ModelViewSet):
    serializer_class = DesignationSerializer

    def get_queryset(self):
        return Designation.objects.select_related("department").order_by("title")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change designations.")


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Employee.objects.select_related("department", "designation", "reporting_to", "user_account").order_by("-created_at")
        user = self.request.user
        if is_employee(user):
            if getattr(user, "employee_profile_id", None):
                return qs.filter(pk=user.employee_profile_id)
            return qs.none()
        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change employees.")

    @action(detail=False, methods=["get"], url_path="tree", permission_classes=[IsAuthenticated])
    def tree(self, request):
        employees = Employee.objects.select_related("department", "designation").filter(is_active=True)
        
        all_nodes = {}
        for emp in employees:
            node = {
                "id": emp.id,
                "first_name": emp.first_name,
                "last_name": emp.last_name,
                "full_name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                "email": emp.email,
                "phone": emp.phone or "",
                "department": emp.department.name if emp.department else None,
                "designation": emp.designation.title if emp.designation else None,
                "emp_code": emp.emp_code,
                "photo": emp.photo.url if emp.photo else None,
                "joining_date": emp.joining_date.isoformat() if emp.joining_date else None,
                "reporting_to_id": emp.reporting_to_id,
                "children": []
            }
            all_nodes[emp.id] = node
            
        roots = []
        for emp in employees:
            node = all_nodes[emp.id]
            parent_id = emp.reporting_to_id
            if parent_id and parent_id in all_nodes:
                all_nodes[parent_id]["children"].append(node)
            else:
                roots.append(node)
                
        return Response(roots)


class PolicyViewSet(viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Policy.objects.select_related("department").order_by("-created_at")
        search = self.request.query_params.get("search")
        department = self.request.query_params.get("department")
        from_date = self.request.query_params.get("from")
        to_date = self.request.query_params.get("to")

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        if department:
            qs = qs.filter(department_id=department)
        if from_date:
            try:
                qs = qs.filter(created_at__date__gte=datetime.fromisoformat(from_date).date())
            except ValueError:
                pass
        if to_date:
            try:
                qs = qs.filter(created_at__date__lte=datetime.fromisoformat(to_date).date())
            except ValueError:
                pass

        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not is_hr_or_above(request.user):
            self.permission_denied(request, message="Only HR and super admins can change policies.")
