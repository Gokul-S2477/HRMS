import { all_routes } from "../../../feature-module/router/all_routes";

type AppMenuItem = {
  label: string;
  icon?: string;
  link?: string;
  children?: AppMenuItem[];
  allowedRoles?: string[];
  accent?: string;
};

type AppMenuSection = {
  title: string;
  allowedRoles?: string[];
  items: AppMenuItem[];
};

const ALL_ADMIN_ROLES = ["super_admin", "hr"];
const ALL_PEOPLE_ROLES = ["super_admin", "hr", "employee"];
const SUPER_ONLY = ["super_admin"];
const STAKEHOLDER_FACING = ["super_admin", "hr", "stakeholder"];
const CHAT_ROLES = ["super_admin", "hr", "employee", "stakeholder"];
const REPORT_ROLES = ["super_admin", "hr", "stakeholder"];

export const APP_NAVIGATION: AppMenuSection[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Dashboards",
        icon: "smart-home",
        allowedRoles: ["super_admin", "hr", "employee", "stakeholder"],
        children: [
          { label: "Command Center", icon: "device-desktop-analytics", link: all_routes.adminDashboard, allowedRoles: ["super_admin", "hr"] },
          { label: "My Workspace", icon: "user-circle", link: all_routes.employeeDashboard, allowedRoles: ["super_admin", "hr", "employee"] },
          { label: "Revenue Insights", icon: "trending-up", link: all_routes.analytics, allowedRoles: STAKEHOLDER_FACING },
        ],
      },
      {
        label: "Applications",
        icon: "layout-grid-add",
        children: [
          { label: "Team Chat", icon: "messages", link: all_routes.chat, allowedRoles: CHAT_ROLES },
          { label: "Notes Studio", icon: "notebook", link: all_routes.notes, allowedRoles: STAKEHOLDER_FACING },
          { label: "Task Board", icon: "list-check", link: all_routes.todo, allowedRoles: STAKEHOLDER_FACING },
          { label: "Events & Reminders", icon: "calendar-event", link: all_routes.calendar, allowedRoles: STAKEHOLDER_FACING },
          { label: "User Access", icon: "key", link: all_routes.manageusers, allowedRoles: ["super_admin", "hr"] },
        ],
      },
    ],
  },
  {
    title: "CRM",
    allowedRoles: STAKEHOLDER_FACING,
    items: [
      { label: "Contacts", icon: "user-shield", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Contact Grid", icon: "layout-grid", link: all_routes.contactGrid, allowedRoles: ALL_ADMIN_ROLES }, { label: "Contact List", icon: "list", link: all_routes.contactList, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Companies", icon: "building", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Company Grid", icon: "layout-grid", link: all_routes.companiesGrid, allowedRoles: ALL_ADMIN_ROLES }, { label: "Company List", icon: "list", link: all_routes.companiesList, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Deals", icon: "heart-handshake", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Deal Grid", icon: "layout-grid", link: all_routes.dealsGrid, allowedRoles: ALL_ADMIN_ROLES }, { label: "Deal List", icon: "list", link: all_routes.dealsList, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Leads", icon: "user-check", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Lead Grid", icon: "layout-grid", link: all_routes.leadsGrid, allowedRoles: ALL_ADMIN_ROLES }, { label: "Lead List", icon: "list", link: all_routes.leadsList, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Pipeline", icon: "timeline-event-text", link: all_routes.pipeline, allowedRoles: STAKEHOLDER_FACING },
      { label: "Analytics", icon: "chart-bar", link: all_routes.analytics, allowedRoles: STAKEHOLDER_FACING },
      { label: "Activities", icon: "activity", link: all_routes.activities, allowedRoles: STAKEHOLDER_FACING },
    ],
  },
  {
    title: "Employee",
    allowedRoles: ALL_PEOPLE_ROLES,
    items: [
      { label: "People Directory", icon: "users-group", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Employee List", icon: "list", link: all_routes.employeeList, allowedRoles: ALL_ADMIN_ROLES }, { label: "Employee Grid", icon: "layout-grid", link: all_routes.employeeGrid, allowedRoles: ALL_ADMIN_ROLES }, { label: "Add Employee", icon: "user-plus", link: all_routes.employeeAdd, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "My Profile", icon: "id-badge-2", link: all_routes.employeedetails, allowedRoles: ALL_PEOPLE_ROLES },
      { label: "Org Chart", icon: "hierarchy-2", link: all_routes.orgChart, allowedRoles: ALL_PEOPLE_ROLES },
      { label: "Org Setup", icon: "building-estate", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Departments", icon: "hierarchy", link: all_routes.departments, allowedRoles: ALL_ADMIN_ROLES }, { label: "Designations", icon: "award", link: all_routes.designations, allowedRoles: ALL_ADMIN_ROLES }, { label: "Policies", icon: "file-shield", link: all_routes.policy, allowedRoles: ALL_PEOPLE_ROLES }] },
    ],
  },
  {
    title: "HRM",
    allowedRoles: ALL_PEOPLE_ROLES,
    items: [
      { label: "Holidays", icon: "calendar-event", link: all_routes.holidays, allowedRoles: ALL_PEOPLE_ROLES },
      { label: "Leave", icon: "calendar-off", children: [{ label: "Leave Inbox", icon: "inbox", link: all_routes.leaveadmin, allowedRoles: STAKEHOLDER_FACING }, { label: "My Leave", icon: "calendar-user", link: all_routes.leaveemployee, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Leave Policy Engine", icon: "adjustments-horizontal", link: all_routes.leavesettings, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Attendance", icon: "clock-hour-4", children: [{ label: "Attendance Control", icon: "settings-automation", link: all_routes.attendanceadmin, allowedRoles: ALL_ADMIN_ROLES }, { label: "My Attendance", icon: "fingerprint", link: all_routes.attendanceemployee, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Timesheets", icon: "calendar-stats", link: all_routes.timesheet, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Overtime", icon: "clock-play", link: all_routes.overtime, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Shift Rules", icon: "calendar-time", link: all_routes.scheduletiming, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Tickets", icon: "ticket", children: [{ label: "Ticket List", icon: "list-details", link: all_routes.tickets, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Ticket Board", icon: "layout-kanban", link: all_routes.ticketGrid, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Performance", icon: "chart-dots-3", children: [{ label: "Indicators", icon: "target", link: all_routes.performanceIndicator, allowedRoles: ALL_ADMIN_ROLES }, { label: "Reviews", icon: "message-report", link: all_routes.performanceReview, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Appraisals", icon: "award", link: all_routes.performanceAppraisal, allowedRoles: ALL_ADMIN_ROLES }, { label: "Promotions", icon: "trending-up", link: all_routes.promotion, allowedRoles: ALL_ADMIN_ROLES }, { label: "Resignations", icon: "user-minus", link: all_routes.resignation, allowedRoles: ALL_ADMIN_ROLES }, { label: "Terminations", icon: "user-x", link: all_routes.termination, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Training", icon: "school", children: [{ label: "Training Calendar", icon: "calendar", link: all_routes.trainingList, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Training Catalog", icon: "book-2", link: all_routes.trainingType, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Reimbursements", icon: "receipt", children: [{ label: "Expense Claims", icon: "cash", link: all_routes.expenseClaims, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Claims Approval", icon: "check", link: all_routes.expenseApprovals, allowedRoles: ALL_ADMIN_ROLES }] },
    ],
  },
  {
    title: "Recruitment",
    allowedRoles: STAKEHOLDER_FACING,
    items: [
      { label: "Jobs", icon: "briefcase-2", allowedRoles: STAKEHOLDER_FACING, children: [{ label: "Job List", icon: "list", link: all_routes.joblist, allowedRoles: STAKEHOLDER_FACING }, { label: "Job Grid", icon: "layout-grid", link: all_routes.jobgrid, allowedRoles: STAKEHOLDER_FACING }] },
      { label: "Candidates", icon: "users-plus", allowedRoles: STAKEHOLDER_FACING, children: [{ label: "Candidate List", icon: "list", link: all_routes.candidateslist, allowedRoles: STAKEHOLDER_FACING }, { label: "Candidate Grid", icon: "layout-grid", link: all_routes.candidatesGrid, allowedRoles: STAKEHOLDER_FACING }, { label: "Candidate Board", icon: "layout-kanban", link: all_routes.candidateskanban, allowedRoles: STAKEHOLDER_FACING }] },
      { label: "Interview Desk", icon: "messages", link: all_routes.recruitmentInterviews, allowedRoles: STAKEHOLDER_FACING },
      { label: "Referrals", icon: "share-2", link: all_routes.refferal, allowedRoles: STAKEHOLDER_FACING },
    ],
  },
  {
    title: "Finance & Accounts",
    allowedRoles: ALL_PEOPLE_ROLES,
    items: [
      { label: "Sales", icon: "report-money", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Estimates", icon: "calculator", link: all_routes.estimate, allowedRoles: ALL_ADMIN_ROLES }, { label: "Invoices", icon: "file-text", link: all_routes.invoices, allowedRoles: ALL_ADMIN_ROLES }, { label: "Payments", icon: "credit-card", link: all_routes.payments, allowedRoles: ALL_ADMIN_ROLES }, { label: "Expenses", icon: "wallet", link: all_routes.expenses, allowedRoles: ALL_ADMIN_ROLES }, { label: "Provident Fund", icon: "piggy-bank", link: all_routes.providentfund, allowedRoles: ALL_ADMIN_ROLES }, { label: "Taxes", icon: "percentage", link: all_routes.taxes, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Payroll", icon: "cash-banknote", children: [{ label: "Salary Components", icon: "adjustments", link: all_routes.salaryComponents, allowedRoles: ALL_ADMIN_ROLES }, { label: "Employee Salary", icon: "users", link: all_routes.employeePayroll, allowedRoles: ALL_ADMIN_ROLES }, { label: "Payslips", icon: "file-description", link: all_routes.payslips, allowedRoles: ALL_PEOPLE_ROLES }, { label: "Payroll Items", icon: "list-numbers", link: all_routes.payrollItems, allowedRoles: ALL_ADMIN_ROLES }, { label: "Final Settlements", icon: "signature", link: all_routes.finalSettlements, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Accounting", icon: "receipt-2", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Categories", icon: "category", link: all_routes.categories, allowedRoles: ALL_ADMIN_ROLES }, { label: "Budgets", icon: "chart-pie", link: all_routes.budgets, allowedRoles: ALL_ADMIN_ROLES }, { label: "Budget Expenses", icon: "trending-down", link: all_routes.budgetexpenses, allowedRoles: ALL_ADMIN_ROLES }, { label: "Budget Revenues", icon: "trending-up", link: all_routes.budgetrevenues, allowedRoles: ALL_ADMIN_ROLES }] },
    ],
  },
  {
    title: "Administration",
    allowedRoles: REPORT_ROLES,
    items: [
      { label: "Assets", icon: "device-laptop", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Asset Register", icon: "database", link: all_routes.assetList, allowedRoles: ALL_ADMIN_ROLES }, { label: "Asset Categories", icon: "tag", link: all_routes.assetCategories, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Documents", icon: "file-description", allowedRoles: ["super_admin", "hr", "employee"], children: [{ label: "Employee Documents", icon: "files", link: all_routes.employeeDocuments, allowedRoles: ["super_admin", "hr", "employee"] }, { label: "Document Categories", icon: "folders", link: all_routes.documentCategories, allowedRoles: ALL_ADMIN_ROLES }] },
      { label: "Onboarding", icon: "user-check", allowedRoles: ["super_admin", "hr", "employee", "stakeholder"], children: [{ label: "Onboarding Desk", icon: "desk", link: all_routes.onboardingDesk, allowedRoles: ["super_admin", "hr", "employee", "stakeholder"] }, { label: "Templates", icon: "layout-align-left", link: all_routes.onboardingTemplates, allowedRoles: ["super_admin", "hr", "stakeholder"] }] },
      { label: "E-Sign", icon: "signature", allowedRoles: ["super_admin", "hr", "employee"], children: [{ label: "E-Sign Desk", icon: "file-signature", link: all_routes.eSignDesk, allowedRoles: ["super_admin", "hr"] }, { label: "My Signatures", icon: "writing", link: all_routes.eSignWorkspace, allowedRoles: ["super_admin", "hr", "employee"] }] },
      { label: "Approvals", icon: "list-check", allowedRoles: REPORT_ROLES, children: [{ label: "Approval Inbox", icon: "inbox", link: all_routes.approvalInbox, allowedRoles: REPORT_ROLES }, { icon: "history", label: "Audit Trail", link: all_routes.auditTrail, allowedRoles: REPORT_ROLES }] },
      { label: "Reports", icon: "report-analytics", allowedRoles: REPORT_ROLES, children: [{ label: "Employee Report", icon: "user", link: all_routes.employeereport, allowedRoles: REPORT_ROLES }, { label: "Attendance Report", icon: "clock", link: all_routes.attendancereport, allowedRoles: REPORT_ROLES }, { label: "Leave Report", icon: "calendar", link: all_routes.leavereport, allowedRoles: REPORT_ROLES }, { label: "Daily Report", icon: "calendar-stats", link: all_routes.dailyreport, allowedRoles: REPORT_ROLES }] },
      { label: "Settings", icon: "settings", allowedRoles: ALL_ADMIN_ROLES, children: [{ label: "Approval Settings", icon: "settings", link: all_routes.approvalSettings, allowedRoles: ALL_ADMIN_ROLES }, { label: "Notification Settings", icon: "bell", link: all_routes.notificationssettings, allowedRoles: ALL_ADMIN_ROLES }, { label: "Leave Types", icon: "calendar-off", link: all_routes.leaveType, allowedRoles: ALL_ADMIN_ROLES }] },
    ],
  },
  {
    title: "Super Admin",
    allowedRoles: SUPER_ONLY,
    items: [
      { label: "Stakeholder Access", icon: "users-plus", link: all_routes.manageusers, allowedRoles: SUPER_ONLY },
      { label: "Revenue Analytics", icon: "chart-infographic", link: all_routes.analytics, allowedRoles: SUPER_ONLY },
      { label: "Flow Blueprint", icon: "binary-tree-2", link: all_routes.flowBlueprint, allowedRoles: SUPER_ONLY },
    ],
  },
];

const roleAllowed = (allowedRoles: string[] | undefined, role: string | null | undefined) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!role) return false;
  return allowedRoles.includes(role);
};

const filterItem = (item: AppMenuItem, role: string | null | undefined, searchText: string) => {
  if (!roleAllowed(item.allowedRoles, role)) return null;
  const nextItem: AppMenuItem = { ...item };
  if (item.children?.length) {
    nextItem.children = item.children.map((child) => filterItem(child, role, searchText)).filter(Boolean) as AppMenuItem[];
  }
  const query = searchText.trim().toLowerCase();
  const matchesSelf = !query || item.label.toLowerCase().includes(query);
  const matchesChild = Boolean(nextItem.children?.length);
  if (!matchesSelf && !matchesChild) return null;
  if (!nextItem.link && !matchesChild) return null;
  return nextItem;
};

export const getAppNavigation = (role: string | null | undefined, searchText = "") =>
  APP_NAVIGATION.map((section) => {
    if (!roleAllowed(section.allowedRoles, role)) return null;
    const items = section.items.map((item) => filterItem(item, role, searchText)).filter(Boolean) as AppMenuItem[];
    if (!items.length) return null;
    return { ...section, items };
  }).filter(Boolean) as AppMenuSection[];

type NavigationContext = {
  sectionTitle: string;
  itemLabel: string;
  itemIcon?: string;
  parentLabel?: string;
  parentIcon?: string;
};

const matchesPath = (link: string | undefined, pathname: string) => {
  if (!link || link === "#") return false;
  const normalized = link.replace(/:\w+/g, "");
  return pathname === normalized || pathname.startsWith(`${normalized}/`);
};

const findItemContext = (item: AppMenuItem, pathname: string, trail: AppMenuItem[] = []): AppMenuItem[] | null => {
  const nextTrail = [...trail, item];
  if (matchesPath(item.link, pathname)) return nextTrail;
  for (const child of item.children || []) {
    const found = findItemContext(child, pathname, nextTrail);
    if (found) return found;
  }
  return null;
};

export const getNavigationContext = (role: string | null | undefined, pathname: string): NavigationContext | null => {
  const sections = getAppNavigation(role);
  for (const section of sections) {
    for (const item of section.items) {
      const trail = findItemContext(item, pathname);
      if (!trail?.length) continue;
      const current = trail[trail.length - 1];
      const parent = trail.length > 1 ? trail[0] : undefined;
      return {
        sectionTitle: section.title,
        itemLabel: current.label,
        itemIcon: current.icon || parent?.icon || item.icon,
        parentLabel: parent?.label,
        parentIcon: parent?.icon,
      };
    }
  }
  return null;
};

export type { AppMenuItem, AppMenuSection, NavigationContext };
