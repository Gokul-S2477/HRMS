import { all_routes } from "../../feature-module/router/all_routes";

export const ROLE_SUPER_ADMIN = "super_admin";
export const ROLE_ADMIN = "admin";
export const ROLE_HR = "hr";
export const ROLE_EMPLOYEE = "employee";
export const ROLE_STAKEHOLDER = "stakeholder";

export type AppRole =
  | typeof ROLE_SUPER_ADMIN
  | typeof ROLE_ADMIN
  | typeof ROLE_HR
  | typeof ROLE_EMPLOYEE
  | typeof ROLE_STAKEHOLDER;

const EMPLOYEE_ALLOWED_PREFIXES = [
  all_routes.employeeDashboard,
  "/employee-details",
  all_routes.payslips,
  all_routes.payslip,
  "/accounts/payslips/view",
  all_routes.leaveemployee,
  all_routes.attendanceemployee,
  all_routes.timesheet,
  all_routes.overtime,
  all_routes.holidays,
  all_routes.policy,
  "/tickets",
  all_routes.trainingList,
  all_routes.employeeDocuments,
  all_routes.onboardingDesk,
  all_routes.chat,
];

const HR_ALLOWED_PREFIXES = [
  "/index",
  all_routes.employeeDashboard,
  "/contact",
  "/companies",
  "/deals",
  "/leads",
  all_routes.pipeline,
  all_routes.analytics,
  all_routes.activities,
  all_routes.activity,
  "/employee",
  "/departments",
  "/designations",
  "/policy",
  "/hrm",
  "/leaves",
  "/attendance",
  "/timesheets",
  "/overtime",
  "/schedule-timing",
  "/tickets",
  "/performance",
  "/training",
  "/promotion",
  "/resignation",
  "/termination",
  "/job",
  "/candidates",
  "/refferals",
  all_routes.recruitmentInterviews,
  "/sales",
  "/accounting",
  "/payroll",
  "/employee-salary",
  "/accounts/salary-components",
  "/accounts/employee-payroll",
  "/accounts/payslips",
  "/accounts/final-settlements",
  "/assets",
  "/asset-categories",
  "/document-categories",
  "/employee-documents",
  "/onboarding",
  "/approvals",
  "/audit-trail",
  "/expenses-report",
  "/invoice-report",
  "/payment-report",
  "/project-report",
  "/task-report",
  "/user-report",
  "/employee-report",
  "/payslip-report",
  "/attendance-report",
  "/leave-report",
  "/daily-report",
  "/app-settings/approval-settings",
  "/general-settings/notifications-settings",
  "/app-settings/leave-type",
  all_routes.manageusers,
  all_routes.chat,
  all_routes.notes,
  all_routes.todo,
  all_routes.TodoList,
  all_routes.calendar,
];

const STAKEHOLDER_ALLOWED_PREFIXES = [
  all_routes.adminDashboard,
  all_routes.pipeline,
  all_routes.analytics,
  all_routes.activities,
  all_routes.activity,
  "/job",
  "/candidates",
  "/refferals",
  all_routes.recruitmentInterviews,
  "/expenses-report",
  "/invoice-report",
  "/payment-report",
  "/project-report",
  "/task-report",
  "/user-report",
  "/employee-report",
  "/payslip-report",
  "/attendance-report",
  "/leave-report",
  "/daily-report",
  "/onboarding",
  "/approvals",
  "/audit-trail",
  all_routes.chat,
  all_routes.notes,
  all_routes.todo,
  all_routes.TodoList,
  all_routes.calendar,
];

const STAKEHOLDER_EXACT_PATHS = [all_routes.leaveadmin];

export const normalizeRole = (value?: string | null): AppRole => {
  const role = String(value || ROLE_EMPLOYEE).toLowerCase();
  if (role === ROLE_ADMIN || role === ROLE_SUPER_ADMIN) return ROLE_SUPER_ADMIN;
  if (role === ROLE_HR) return ROLE_HR;
  if (role === ROLE_STAKEHOLDER) return ROLE_STAKEHOLDER;
  return ROLE_EMPLOYEE;
};

export const getHomeRouteForRole = (role?: string | null) => {
  switch (normalizeRole(role)) {
    case ROLE_SUPER_ADMIN:
      return all_routes.adminDashboard;
    case ROLE_HR:
      return all_routes.adminDashboard;
    case ROLE_STAKEHOLDER:
      return all_routes.analytics;
    default:
      return all_routes.employeeDashboard;
  }
};

export const roleMatches = (role: string | null | undefined, allowedRoles?: string[]) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const normalized = normalizeRole(role);
  return allowedRoles.includes(normalized) || (normalized === ROLE_SUPER_ADMIN && allowedRoles.includes(ROLE_ADMIN));
};

const normalizePath = (path?: string) => String(path || "").replace(/:\w+/g, "").trim();

export const canAccessPath = (role: string | null | undefined, path?: string) => {
  const normalizedRole = normalizeRole(role);
  const normalizedPath = normalizePath(path);
  if (!normalizedPath || normalizedPath === "#") return true;
  if (normalizedRole === ROLE_SUPER_ADMIN) return true;

  if (
    normalizedRole === ROLE_STAKEHOLDER &&
    STAKEHOLDER_EXACT_PATHS.some((item) => {
      const exactPath = normalizePath(item);
      return normalizedPath === exactPath || normalizedPath.startsWith(`${exactPath}/`);
    })
  ) {
    return true;
  }

  const prefixes =
    normalizedRole === ROLE_HR
      ? HR_ALLOWED_PREFIXES
      : normalizedRole === ROLE_STAKEHOLDER
      ? STAKEHOLDER_ALLOWED_PREFIXES
      : EMPLOYEE_ALLOWED_PREFIXES;

  return prefixes.some((prefix) => normalizedPath.startsWith(normalizePath(prefix)));
};

const filterNode = (node: any, role: string | null | undefined): any | null => {
  if (!node) return null;
  const nextNode = { ...node };
  if (Array.isArray(node.submenuItems)) {
    nextNode.submenuItems = node.submenuItems.map((item: any) => filterNode(item, role)).filter(Boolean);
  }
  if (Array.isArray(node.subMenus)) {
    nextNode.subMenus = node.subMenus.map((item: any) => filterNode(item, role)).filter(Boolean);
  }
  if (Array.isArray(node.subMenusTwo)) {
    nextNode.subMenusTwo = node.subMenusTwo.map((item: any) => filterNode(item, role)).filter(Boolean);
  }
  const childrenCount = (nextNode.submenuItems?.length || 0) + (nextNode.subMenus?.length || 0) + (nextNode.subMenusTwo?.length || 0);
  const path = nextNode.link || nextNode.route;
  const selfAllowed = canAccessPath(role, path);
  if (childrenCount > 0) return nextNode;
  return selfAllowed ? nextNode : null;
};

export const filterMenuByRole = (sections: any[], role: string | null | undefined) =>
  (sections || [])
    .map((section) => {
      const nextSection = { ...section };
      if (Array.isArray(section.submenuItems)) {
        nextSection.submenuItems = section.submenuItems.map((item: any) => filterNode(item, role)).filter(Boolean);
      }
      if (Array.isArray(section.menu)) {
        nextSection.menu = section.menu.map((item: any) => filterNode(item, role)).filter(Boolean);
      }
      return nextSection;
    })
    .filter((section) => (section.submenuItems?.length || 0) > 0 || (section.menu?.length || 0) > 0);
