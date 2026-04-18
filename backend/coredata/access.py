from users.permissions import resolve_role


ROLE_SUPER_ADMIN = "super_admin"
ROLE_HR = "hr"
ROLE_EMPLOYEE = "employee"
ROLE_STAKEHOLDER = "stakeholder"

SUPER_AND_HR = {ROLE_SUPER_ADMIN, ROLE_HR}
PEOPLE_ROLES = {ROLE_SUPER_ADMIN, ROLE_HR, ROLE_EMPLOYEE, ROLE_STAKEHOLDER}
REVIEW_ROLES = {ROLE_SUPER_ADMIN, ROLE_HR, ROLE_STAKEHOLDER}


RESOURCE_RULES = {
    "holidays": {
        "read": PEOPLE_ROLES,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "leave-settings": {
        "read": PEOPLE_ROLES,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": {ROLE_SUPER_ADMIN},
    },
    "leave-types": {
        "read": PEOPLE_ROLES,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "leave-employee": {
        "read": REVIEW_ROLES | {ROLE_EMPLOYEE},
        "create": {ROLE_EMPLOYEE},
        "update": REVIEW_ROLES,
        "delete": SUPER_AND_HR,
        "employee_self_scope": True,
    },
    "attendance-admin": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "attendance-employee": {
        "read": SUPER_AND_HR | {ROLE_EMPLOYEE},
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
        "employee_self_scope": True,
    },
    "tickets": {
        "read": SUPER_AND_HR | {ROLE_EMPLOYEE},
        "create": SUPER_AND_HR | {ROLE_EMPLOYEE},
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
        "employee_ticket_scope": True,
    },
    "training-types": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "training-sessions": {
        "read": SUPER_AND_HR | {ROLE_EMPLOYEE},
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
        "employee_self_scope": True,
    },
    "performance-indicators": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "performance-appraisals": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "performance-reviews": {
        "read": SUPER_AND_HR | {ROLE_EMPLOYEE},
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
        "employee_self_scope": True,
    },
    "promotions": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "resignations": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "terminations": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "employee-salaries": {
        "read": SUPER_AND_HR | {ROLE_EMPLOYEE},
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
        "employee_self_scope": True,
    },
    "payroll-items": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "accounting-categories": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "accounting-budgets": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "accounting-budget-expenses": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "accounting-budget-revenues": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "estimates": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "invoices": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "payments": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "expenses": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "provident-fund": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "taxes": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "crm-contacts": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "crm-companies": {
        "read": SUPER_AND_HR,
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "crm-deals": {
        "read": SUPER_AND_HR | {ROLE_STAKEHOLDER},
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "crm-leads": {
        "read": SUPER_AND_HR | {ROLE_STAKEHOLDER},
        "create": SUPER_AND_HR,
        "update": SUPER_AND_HR,
        "delete": SUPER_AND_HR,
    },
    "crm-activities": {
        "read": SUPER_AND_HR | {ROLE_STAKEHOLDER},
        "create": SUPER_AND_HR | {ROLE_STAKEHOLDER},
        "update": SUPER_AND_HR | {ROLE_STAKEHOLDER},
        "delete": SUPER_AND_HR,
    },
}


READ_ONLY_PREFIX_RULES = {
    "report-": {"read": SUPER_AND_HR | {ROLE_STAKEHOLDER}},
    "settings-": {"read": SUPER_AND_HR, "create": SUPER_AND_HR, "update": SUPER_AND_HR, "delete": {ROLE_SUPER_ADMIN}},
}


DEFAULT_RULE = {
    "read": {ROLE_SUPER_ADMIN},
    "create": {ROLE_SUPER_ADMIN},
    "update": {ROLE_SUPER_ADMIN},
    "delete": {ROLE_SUPER_ADMIN},
}


def get_resource_rule(resource_type: str) -> dict:
    if resource_type in RESOURCE_RULES:
        return RESOURCE_RULES[resource_type]
    for prefix, rule in READ_ONLY_PREFIX_RULES.items():
        if resource_type.startswith(prefix):
            base = DEFAULT_RULE.copy()
            base.update(rule)
            return base
    return DEFAULT_RULE


def role_can_access_resource(user, resource_type: str, action: str) -> bool:
    role = resolve_role(user)
    if not role:
        return False
    return role in get_resource_rule(resource_type).get(action, set())


def resource_uses_employee_scope(resource_type: str) -> bool:
    return bool(get_resource_rule(resource_type).get("employee_self_scope"))


def resource_uses_ticket_scope(resource_type: str) -> bool:
    return bool(get_resource_rule(resource_type).get("employee_ticket_scope"))
