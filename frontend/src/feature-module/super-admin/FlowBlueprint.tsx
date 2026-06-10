import React, { useState, useMemo } from "react";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";

type StepDetail = {
  id: string;
  stage: string;
  icon: string;
  title: string;
  summary: string;
  features: string[];
  models: string[];
  endpoints: string[];
  interdependencies: {
    target: string;
    description: string;
  }[];
  color: string;
  businessFlow: string[];
  specialFeatures: { name: string; description: string }[];
  permissions: { action: string; roles: string[] }[];
};

type SubModule = {
  name: string;
  icon: string;
  description: string;
  details: string;
};

type SystemModule = {
  id: string;
  name: string;
  icon: string;
  description: string;
  specialFeatures: string;
  color: string;
  subModules: SubModule[];
};

const STAGES: StepDetail[] = [
  {
    id: "recruitment",
    stage: "1. Recruitment & Hiring",
    icon: "ti-briefcase-2",
    title: "Talent Acquisition Pipeline",
    summary: "Publishes open positions to the public job board, collects candidate resumes, and orchestrates interview rounds.",
    features: [
      "Public Careers Page & Job Listings",
      "Applicant Self-Service Portal",
      "Candidate Status Kanban Board",
      "Referrals & Interview Schedulers"
    ],
    models: ["RecruitmentJob", "RecruitmentCandidate", "RecruitmentInterview", "RecruitmentReferral"],
    endpoints: ["/api/recruitment/jobs/", "/api/recruitment/candidates/", "/api/recruitment/interviews/", "/api/recruitment/referrals/"],
    interdependencies: [
      { target: "Employee Setup", description: "Hired candidates can be directly onboarded into the employee registry, auto-populating contact details." }
    ],
    color: "#2563eb", // Blue
    businessFlow: [
      "HR creates vacancy posting in Job List/Grid.",
      "Vacancy is instantly published to public Careers Portal.",
      "Candidate registers account & submits application.",
      "HR moves candidates across the Kanban Board stages.",
      "Interviewers input scores; Hired state triggers core HR onboarding link."
    ],
    specialFeatures: [
      { name: "Public Apply Hook", description: "Secured external public endpoints allowing candidates to upload documents without full authentication." },
      { name: "Job Kanban Board", description: "Interactive drag-and-drop interface for candidate selection workflow." }
    ],
    permissions: [
      { action: "Post Job Openings", roles: ["super_admin", "hr"] },
      { action: "Screen & Edit Candidates", roles: ["super_admin", "hr"] },
      { action: "Submit Referrals", roles: ["super_admin", "hr", "employee"] }
    ]
  },
  {
    id: "org-setup",
    stage: "2. Organization Setup",
    icon: "ti-building-estate",
    title: "Company Structures & Hierarchy",
    summary: "Sets the organizational framework by defining operational departments, role titles, and baseline reporting patterns.",
    features: [
      "Department Registries with live headcount",
      "Designation titles mapping",
      "Organizational Chart tree hierarchy builder",
      "Role-Based Access Control permissions"
    ],
    models: ["Department", "Designation"],
    endpoints: ["/api/departments/", "/api/designations/"],
    interdependencies: [
      { target: "Employee Setup", description: "Every employee must map to a valid department and designation before active payroll calculation." },
      { target: "Attendance & Leaves", description: "Shift scheduler rules and leave policies are applied to specific department codes." }
    ],
    color: "#0d9488", // Teal
    businessFlow: [
      "Admin creates central operational departments.",
      "Designation hierarchies and salary brackets defined.",
      "Manager-to-reporting line structure configured.",
      "System builds stabilized subpixel org hierarchy view."
    ],
    specialFeatures: [
      { name: "Headcount Aggregates", description: "Django DB query annotations compute active employee counts per department in real time." },
      { name: "Hierarchy Anchoring", description: "Maintains structured node connections for the organizational diagram, eliminating jittering." }
    ],
    permissions: [
      { action: "Create/Modify Departments", roles: ["super_admin", "hr"] },
      { action: "Create/Modify Designations", roles: ["super_admin", "hr"] },
      { action: "View Organization Structure", roles: ["super_admin", "hr", "employee", "stakeholder"] }
    ]
  },
  {
    id: "employee-setup",
    stage: "3. Employee Registry",
    icon: "ti-users-group",
    title: "Core Profile Setup",
    summary: "The main source of truth for active worker details, including salaries, bank accounts, reporting managers, and employment status.",
    features: [
      "Grid View ID Card visual snapshots",
      "List View registry with complete exports",
      "Detailed profile builder (basic, personal, bank, and family tabs)",
      "Availability status toggles (Active / Inactive)"
    ],
    models: ["Employee", "User"],
    endpoints: ["/api/employees/", "/api/employees/<id>/", "/api/employees/tree/"],
    interdependencies: [
      { target: "Compliance & Signing", description: "Triggers onboarding checklist creation and issues document signature notifications." },
      { target: "Attendance & Leaves", description: "Creates attendance logs and sets leave balances based on the joining date." }
    ],
    color: "#7c3aed", // Purple
    businessFlow: [
      "Employee user account generated, linked to system credentials.",
      "Profile filled with personal details, bank data, and education.",
      "Manager mapped via reporting-to foreign key.",
      "Security access levels resolved based on active role tags."
    ],
    specialFeatures: [
      { name: "Digital ID Card Snapshot", description: "Custom card styling featuring lanyard banner layouts and color-filled fallback avatars." },
      { name: "Profile Approval Check", description: "Edits to critical details (e.g. bank info) queue as review items in the Admin inbox." }
    ],
    permissions: [
      { action: "Register/Deactivate Employees", roles: ["super_admin", "hr"] },
      { action: "Edit Personal Profile details", roles: ["super_admin", "hr", "employee"] },
      { action: "Manage System Roles", roles: ["super_admin"] }
    ]
  },
  {
    id: "onboarding-esign",
    stage: "4. Compliance & Signing",
    icon: "ti-file-shield",
    title: "Onboarding Checklists & E-Sign Desk",
    summary: "Monitors onboarding progress and manages digital signature requests for compliance templates.",
    features: [
      "Interactive onboarding checklist tasks",
      "E-Sign template upload console (HR side)",
      "Signature canvas drawing tool (Employee side)",
      "Audit logs capturing IP and client headers"
    ],
    models: ["DocumentEsign", "DocumentSignature", "EmployeeDocument", "DocumentCategory", "AssetAssignment", "AssetCategory"],
    endpoints: ["/api/esign-documents/", "/api/esign-signatures/", "/api/employee-documents/", "/api/asset-assignments/"],
    interdependencies: [
      { target: "Employee Setup", description: "Completed signatures mark profiles as compliance-cleared, updating onboarding maturity statistics." }
    ],
    color: "#db2777", // Pink
    businessFlow: [
      "HR uploads document template (.pdf) in E-Sign template editor.",
      "System generates signature request tasks for active employees.",
      "Employee receives dashboard task notification.",
      "Employee opens viewport, draws signature, signs document.",
      "System stamps remote IP address and user-agent details in audit log."
    ],
    specialFeatures: [
      { name: "Signature Canvas Engine", description: "Saves high-quality canvas vector drawings directly into database signatures." },
      { name: "Strict Access Scopes", description: "Middlewares block employees from viewing files or signature records of other workers." }
    ],
    permissions: [
      { action: "Publish E-Sign Templates", roles: ["super_admin", "hr"] },
      { action: "Sign Compliance Documents", roles: ["super_admin", "hr", "employee"] },
      { action: "Inspect Audit Trail Logs", roles: ["super_admin", "hr"] }
    ]
  },
  {
    id: "hrm-timekeeping",
    stage: "5. Attendance & Leaves",
    icon: "ti-clock-hour-4",
    title: "HRM Timekeeping & Leave Engine",
    summary: "Tracks check-ins with GPS geofencing, leave request workflows, timesheets, and schedules.",
    features: [
      "Leave approval inbox & policy engines",
      "GPS Geofenced web check-in verification",
      "Timesheet logs & overtime records",
      "Shift rules & scheduler timetables"
    ],
    models: ["LeaveBalance", "LeaveLedger", "TimesheetEntry", "ShiftDefinition", "OvertimeEntry"],
    endpoints: ["/api/leave-ledger/", "/api/timesheets/", "/api/shift-definitions/", "/api/overtime-entries/", "/api/data/attendance-employee/"],
    interdependencies: [
      { target: "Payroll & Finance", description: "Unpaid leave balances and overtime hours are directly piped into the monthly payroll engine." }
    ],
    color: "#f59e0b", // Amber
    businessFlow: [
      "Employee triggers check-in; browser collects GPS coordinates.",
      "Backend checks coordinates against department Geofence rules.",
      "Timesheet entries submitted weekly for manager review.",
      "Leave request initiated; checks quotas and forwards to inbox approvals."
    ],
    specialFeatures: [
      { name: "GPS Coordinate Verification", description: "Django views compute boundary distances from preconfigured latitude/longitude tags." },
      { name: "IP Whitelisting Range", description: "Blocks check-in actions if the requesting remote address falls outside office subnets." }
    ],
    permissions: [
      { action: "Clock-In/Clock-Out", roles: ["super_admin", "hr", "employee"] },
      { action: "Approve Leaves & Timesheets", roles: ["super_admin", "hr", "stakeholder"] },
      { action: "Configure Shift Rules", roles: ["super_admin", "hr"] }
    ]
  },
  {
    id: "payroll-finance",
    stage: "6. Payroll & Reimbursements",
    icon: "ti-cash-banknote",
    title: "Compensation & Expense Desk",
    summary: "Maps salary components, payslips, expense claim checks, budgets, and tax brackets.",
    features: [
      "Reimbursement Expense claim review",
      "Salary components additions & deductions config",
      "Automated Payslip generation & release",
      "Provident fund tracking & tax mapping"
    ],
    models: ["ExpenseClaim", "Resource (employee-salaries, payroll-items)"],
    endpoints: ["/api/expense-claims/", "/api/data/employee-salaries/", "/api/data/payroll-items/"],
    interdependencies: [
      { target: "Offboarding Setup", description: "Determines final payouts, remaining allowances, and severance terms." }
    ],
    color: "#10b981", // Green
    businessFlow: [
      "Employee submits reimbursement receipt; expense claim enters queue.",
      "Payroll admin evaluates hours, overtime, and unpaid leave penalties.",
      "Salary components computed (Basic, HRA, Provident deductions).",
      "Draft payslip generated; payslips locked and issued to employees."
    ],
    specialFeatures: [
      { name: "Leave Deduction Engine", description: "Cross-checks timesheets and approved leaves to compute loss-of-pay penalties." },
      { name: "Expense Approval Flow", description: "Claims routing to regional managers before landing on finance desks." }
    ],
    permissions: [
      { action: "Process Monthly Payroll", roles: ["super_admin", "hr"] },
      { action: "Submit Expense Claims", roles: ["super_admin", "hr", "employee"] },
      { action: "Approve/Reject Claims", roles: ["super_admin", "hr"] }
    ]
  },
  {
    id: "offboarding",
    stage: "7. Exit & Offboarding",
    icon: "ti-circle-x",
    title: "Exit Management & Settlement",
    summary: "Handles promotions, resignations, terminations, and final settlements.",
    features: [
      "Resignation workflow approval tracking",
      "Termination records & compliance notices",
      "Final settlement calculation desk",
      "Checklist release & asset recovery logs"
    ],
    models: ["OffboardingCase", "Resource (promotions, resignations, terminations)"],
    endpoints: ["/api/offboarding-cases/", "/api/data/promotions/", "/api/data/resignations/", "/api/data/terminations/"],
    interdependencies: [
      { target: "Employee Setup", description: "Marks the profile status as Inactive, deauthorizes system login access, and updates org chart." }
    ],
    color: "#dc2626", // Red
    businessFlow: [
      "Employee submits resignation via workflow console.",
      "Offboarding case file generated with checklist tasks.",
      "Assets recovered, system accounts queued for removal.",
      "Final payout calculations computed, deactivating login access."
    ],
    specialFeatures: [
      { name: "System Lockout hook", description: "Approving a resignation case triggers status updates that block further access." },
      { name: "Asset Recovery Tracker", description: "Blocks offboarding closure until assigned items are marked as returned." }
    ],
    permissions: [
      { action: "Authorize exit settlements", roles: ["super_admin", "hr"] },
      { action: "Submit resignation", roles: ["super_admin", "hr", "employee"] },
      { action: "Deauthorize user accounts", roles: ["super_admin"] }
    ]
  }
];

const SYSTEM_MODULES: SystemModule[] = [
  {
    id: "workspace",
    name: "Workspace (Collaborative Center)",
    icon: "ti-smart-home",
    description: "Centralized workspace providing widgets, personal action workflows, collaborative tools, and shared feeds.",
    specialFeatures: "Real-time task synchronization, interactive dashboard widgets, role-based shortcut displays.",
    color: "#6366f1", // Indigo
    subModules: [
      { name: "Command Center", icon: "ti-device-desktop-analytics", description: "Global operational KPIs", details: "Renders core headcounts, active tickets, pending leave applications, and upcoming events for admins." },
      { name: "My Workspace", icon: "ti-user-circle", description: "Personal employee portal", details: "Consolidates personal balances, geofenced clock-in buttons, check-in status, and user files." },
      { name: "Team Chat", icon: "ti-messages", description: "Instant company messenger", details: "Real-time secure chat supporting text logs, channels, and attachments for team alignment." },
      { name: "Notes Studio", icon: "ti-notebook", description: "Personal draft pad", details: "Allows individual workers to create and retain private lists, logs, and drafts." },
      { name: "Task Board", icon: "ti-list-check", description: "Individual Kanban dashboard", details: "Personal task tracker allowing employees to prioritize, organize, and drag tasks." }
    ]
  },
  {
    id: "crm",
    name: "CRM (Client Relations)",
    icon: "ti-heart-handshake",
    description: "Core center for tracking business partners, contacts, pipeline stages, and deal progression.",
    specialFeatures: "Visual sales stage progression, financial estimates aggregation, and activity logging.",
    color: "#f59e0b", // Amber
    subModules: [
      { name: "Contacts Registry", icon: "ti-user-shield", description: "Client profiles mapping", details: "Directory of client contacts, communication history, and phone details." },
      { name: "Companies Database", icon: "ti-building", description: "Business account directory", details: "Profiles of corporate partners, employee counts, revenue ranges, and locations." },
      { name: "Deal Pipelines", icon: "ti-layout-grid", description: "Contract stage boards", details: "Tracks sales contracts from contact made to negotiation and contract closure." },
      { name: "Sales Leads", icon: "ti-user-check", description: "Lead tracking console", details: "Manages incoming prospect files, scoring metrics, and status flags." }
    ]
  },
  {
    id: "employee",
    name: "Employee Module (Core HR)",
    icon: "ti-users-group",
    description: "Company records center holding worker data, department configs, role catalogs, and organizational charts.",
    specialFeatures: "Stabilized subpixel Org Chart rendering, corporate ID card grids, initial-based profile fallbacks.",
    color: "#3b82f6", // Blue
    subModules: [
      { name: "People Directory", icon: "ti-list", description: "Visual grids & registers", details: "Main search engine for worker lists, exports, and status toggles." },
      { name: "My Profile", icon: "ti-id-badge-2", description: "Detailed worker files", details: "Manages basic fields, bank details, emergency contacts, education, and career experience logs." },
      { name: "Org Chart Map", icon: "ti-hierarchy-2", description: "Visual reporting tree", details: "Renders interactive hierarchy charts. Stabilized styling prevents wobbling/reflow jitter." },
      { name: "Org Setup", icon: "ti-building-estate", description: "Departments & designations", details: "Stores company configuration structures, job descriptions, and hierarchical relationships." },
      { name: "Policies Desk", icon: "ti-file-shield", description: "Document handbook centers", details: "Houses corporate policies by department with animated download action buttons." }
    ]
  },
  {
    id: "hrm",
    name: "HRM & Timekeeping",
    icon: "ti-clock-hour-4",
    description: "Operates time tracking, GPS geofencing, IP whitelisting check-ins, shift rosters, training, and support tickets.",
    specialFeatures: "GPS coordinates analysis, IP whitelist subnet screening, leave quota calculations, shift schedules.",
    color: "#0d9488", // Teal
    subModules: [
      { name: "Leave Inbox", icon: "ti-inbox", description: "Admin balance management", details: "Central queue for managers to check leave limits, view reasons, and sign approvals." },
      { name: "Attendance Check", icon: "ti-fingerprint", description: "Geofenced web clock-in", details: "Validates check-ins using latitude/longitude tags and office internet IPs." },
      { name: "Timesheets", icon: "ti-calendar-stats", description: "Weekly hours register", details: "Enables logging of project tasks, worked hours, and approvals workflows." },
      { name: "Shift Scheduler", icon: "ti-calendar-time", description: "Roster timetables", details: "Constructs rotational shifts, holiday schedules, and overtime rules." },
      { name: "Tickets Desk", icon: "ti-ticket", description: "Employee support tickets", details: "Workflow tracker for internal support queries, comments, and priority queues." }
    ]
  },
  {
    id: "recruitment",
    name: "Recruitment (Talent Acquisition)",
    icon: "ti-briefcase-2",
    description: "Manages vacancy creation, public listings, candidate pipelines, interview setups, and employee referrers.",
    specialFeatures: "Public application submission portals, Candidate Kanban drag trackers, referral fee calculations.",
    color: "#a855f7", // Purple
    subModules: [
      { name: "Job Listings", icon: "ti-timeline", description: "SaaS vacancy board creator", details: "Enables creating job posts, matching qualifications, and publishing to the web." },
      { name: "Candidates Pipeline", icon: "ti-user-shield", description: "Screening stages board", details: "Visual dashboard highlighting applicant files from applied to screening and hiring." },
      { name: "Interview Desk", icon: "ti-messages", description: "Interviewer mapping", details: "Schedules interviews, sets feedback sheets, and logs scores." }
    ]
  },
  {
    id: "finance",
    name: "Finance & Accounts (Payroll)",
    icon: "ti-cash-banknote",
    description: "compensation calculator managing salary structures, components, tax calculations, and expense claims.",
    specialFeatures: "Loss-of-pay calculation integrated with attendance logs, automated tax bracket configuration, payslip locking.",
    color: "#10b981", // Green
    subModules: [
      { name: "Salary Components", icon: "ti-adjustments", description: "Allowances & deductions parameters", details: "Configures HRA, transport allowances, provident fund rules, and tax deductions." },
      { name: "Employee Salaries", icon: "ti-users", description: "Monthly base registers", details: "Assigns salary structures and compensation parameters to worker files." },
      { name: "Payslip Console", icon: "ti-file-description", description: "Wages generation & release", details: "Calculates nets pay, factors in overtime and leave deductions, and generates PDF slips." },
      { name: "Expense Claims", icon: "ti-cash", description: "Worker spend desk", details: "Manages reimbursable spend claims, receipts storage, and payment approvals." },
      { name: "Budgets Ledger", icon: "ti-chart-pie", description: "Accounting budget tracker", details: "Tracks operational expense targets against actual financial spend records." }
    ]
  },
  {
    id: "administration",
    name: "Administration & Compliance",
    icon: "ti-settings-automation",
    description: "Oversees onboarding checklists, company inventory assets, document types, and digital E-Sign workflows.",
    specialFeatures: "Secure signature drawing pad canvas, IP audit logs, asset inventory allocations, multi-tier approvals.",
    color: "#ec4899", // Pink
    subModules: [
      { name: "Asset Register", icon: "ti-database", description: "Inventory asset control", details: "Logs laptops, software licenses, serial codes, and assignments." },
      { name: "Onboarding Desk", icon: "ti-user-check", description: "Compliance checklist desk", details: "Generates list targets for new hires (e.g. upload ID, sign handbook, pick equipment)." },
      { name: "E-Sign Console", icon: "ti-file-signature", description: "Legal document publishers", details: "HR tools to upload templates and issue signature requests to employees." },
      { name: "My Signatures", icon: "ti-writing", description: "Employee signature viewport", details: "Drawing canvas for employees to sign compliance documents with audit details (IP, Agent)." }
    ]
  },
  {
    id: "super_admin",
    name: "Super Admin (SaaS Controls)",
    icon: "ti-shield-lock",
    description: "Global system dashboard for subscription billing, packages, client domains, and architecture maps.",
    specialFeatures: "Multi-tenant company separation validations, custom domain hooks, systems flow maps.",
    color: "#f43f5e", // Rose
    subModules: [
      { name: "Companies Index", icon: "ti-building", description: "Tenant directories", details: "Lists active corporate accounts, databases, and billing tiers." },
      { name: "Subscriptions Desk", icon: "ti-credit-card", description: "Pricing packages logs", details: "Manages client licenses, billing cycles, transactions, and features availability." },
      { name: "Flow Blueprint", icon: "ti-route", description: "This system architecture map", details: "The visual interactive process map and module index designed to train administrators." }
    ]
  }
];

const FlowBlueprint: React.FC = () => {
  const [activeStep, setActiveStep] = useState<string>("recruitment");
  const [activeTab, setActiveTab] = useState<"flow" | "directory" | "matrix">("flow");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const currentStepData = useMemo(() => {
    return STAGES.find((s) => s.id === activeStep) || STAGES[0];
  }, [activeStep]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return SYSTEM_MODULES;
    const query = searchQuery.toLowerCase();
    return SYSTEM_MODULES.map((mod) => {
      const matchesName = mod.name.toLowerCase().includes(query);
      const matchesDesc = mod.description.toLowerCase().includes(query);
      const matchesFeature = mod.specialFeatures.toLowerCase().includes(query);
      const matchedSubs = mod.subModules.filter(
        (sub) =>
          sub.name.toLowerCase().includes(query) ||
          sub.description.toLowerCase().includes(query) ||
          sub.details.toLowerCase().includes(query)
      );

      if (matchesName || matchesDesc || matchesFeature || matchedSubs.length > 0) {
        return {
          ...mod,
          subModules: matchedSubs.length > 0 ? matchedSubs : mod.subModules,
          highlight: true
        };
      }
      return null;
    }).filter(Boolean) as (SystemModule & { highlight?: boolean })[];
  }, [searchQuery]);

  const selectedStepIndex = useMemo(() => {
    return STAGES.findIndex((s) => s.id === activeStep);
  }, [activeStep]);

  return (
    <div className="page-wrapper">
      <style>{`
        .blueprint-container {
          background: #0b0f19 !important; /* Premium Obsidian Navy */
          color: #f8fafc !important;
          border-radius: 24px;
          border: 1px solid #1e293b;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .blueprint-title-area {
          border-bottom: 1px solid #1e293b;
          padding-bottom: 24px;
        }
        .blueprint-tab-btn {
          border: 1px solid #1e293b;
          background: #111827;
          color: #94a3b8;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .blueprint-tab-btn.active {
          background: var(--hrms-accent, #F26522);
          color: #ffffff;
          border-color: var(--hrms-accent, #F26522);
          box-shadow: 0 8px 20px rgba(242, 101, 34, 0.35);
        }
        .blueprint-svg-wrapper {
          background: #111827;
          border: 1px solid #1e293b;
          border-radius: 20px;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .blueprint-svg-wrapper::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 50% 50%, rgba(242, 101, 34, 0.03) 0%, transparent 70%);
          pointer-events: none;
        }
        .svg-node {
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .svg-node-bg {
          fill: #1f2937;
          stroke: #374151;
          stroke-width: 2px;
          transition: all 0.3s ease;
        }
        .svg-node:hover .svg-node-bg, .svg-node.hovered .svg-node-bg {
          fill: #111827;
          stroke: #f8fafc;
          transform: scale(1.08);
          filter: drop-shadow(0 0 10px rgba(255,255,255,0.15));
        }
        .svg-node.active .svg-node-bg {
          fill: #030712;
          stroke: var(--hrms-accent, #F26522);
          stroke-width: 3px;
          filter: drop-shadow(0 0 12px rgba(242, 101, 34, 0.45));
        }
        .svg-node-text {
          fill: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          transition: all 0.3s ease;
        }
        .svg-node:hover .svg-node-text, .svg-node.active .svg-node-text {
          fill: #ffffff;
        }
        .flow-path-bg {
          stroke: #1e293b;
          stroke-width: 6px;
        }
        .flow-path-active {
          stroke: var(--hrms-accent, #F26522);
          stroke-width: 4px;
          stroke-dasharray: 8 4;
          animation: flowDash 25s linear infinite;
        }
        @keyframes flowDash {
          to { stroke-dashoffset: -1000; }
        }
        @keyframes rotateRing {
          to { transform: rotate(360deg); }
        }
        .blueprint-detail-panel {
          background: #111827;
          border-radius: 20px;
          border: 1px solid #1e293b;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);
        }
        .feature-item-box {
          background: rgba(242, 101, 34, 0.02);
          border: 1px dashed rgba(242, 101, 34, 0.15);
          border-radius: 12px;
          transition: all 0.3s ease;
        }
        .feature-item-box:hover {
          background: rgba(242, 101, 34, 0.05);
          border-color: var(--hrms-accent, #F26522);
          transform: translateY(-2px);
        }
        .step-bubble {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 12px;
          flex-shrink: 0;
        }
        .matrix-badge {
          background: #1f2937;
          border: 1px solid #374151;
          color: #f8fafc;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }
        .module-card {
          background: #111827;
          border: 1px solid #1e293b;
          border-radius: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }
        .module-card:hover {
          transform: translateY(-6px);
          border-color: #475569;
          box-shadow: 0 15px 30px rgba(0,0,0,0.4);
        }
        .module-card.search-highlight {
          border-color: var(--hrms-accent, #F26522);
          box-shadow: 0 0 15px rgba(242, 101, 34, 0.2);
        }
        .sub-module-badge {
          background: #1f2937;
          border: 1px solid #374151;
          color: #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .sub-module-badge:hover {
          background: #374151;
          color: #ffffff;
        }
        .permission-table th {
          background: #0b0f19 !important;
          color: #94a3b8 !important;
          font-weight: 700;
          border-bottom: 2px solid #1e293b !important;
        }
        .permission-table td {
          border-bottom: 1px solid #1e293b !important;
          color: #cbd5e1 !important;
        }
        .search-input-group {
          position: relative;
        }
        .search-input-group i {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 18px;
        }
        .search-input-group input {
          background: #111827 !important;
          border: 1px solid #1e293b !important;
          color: #ffffff !important;
          border-radius: 12px;
          padding: 12px 16px 12px 48px;
          width: 100%;
          max-width: 450px;
          transition: all 0.3s ease;
        }
        .search-input-group input:focus {
          border-color: var(--hrms-accent, #F26522) !important;
          box-shadow: 0 0 12px rgba(242, 101, 34, 0.25) !important;
        }
      `}</style>

      <div className="content container-fluid payroll-shell employee-shell">
        
        {/* HERO HEADER */}
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker"><i className="ti ti-shield-lock" /> Admin Security Console</span>
                <h1 className="payroll-title">HRMS Flow Blueprint</h1>
                <p className="payroll-subtitle">
                  Interactive systems layout explaining the end-to-end data pipeline, major operational layers, and relational schema flows.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip"><i className="ti ti-key" /> Super Admin Credentials Only</span>
                  <span className="employee-chip"><i className="ti ti-binary-tree" /> System Walkthrough Blueprint</span>
                </div>
              </div>
              <div className="col-lg-4 text-end">
                <div className="payroll-hero-actions">
                  <div className="head-icons"><CollapseHeader /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLUEPRINT CORE PANEL */}
        <div className="card blueprint-container p-4">
          
          {/* HEADER OPTIONS */}
          <div className="blueprint-title-area d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
            <div>
              <h4 className="text-white mb-1"><i className="ti ti-route" /> HRMS Architecture Map</h4>
              <p className="text-muted small mb-0">Select views and stages to analyze how modules and data models interconnect.</p>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button 
                className={`blueprint-tab-btn ${activeTab === "flow" ? "active" : ""}`} 
                onClick={() => { setActiveTab("flow"); setSearchQuery(""); }}
              >
                <i className="ti ti-hierarchy-2 me-1" /> Interactive Flow Chart
              </button>
              <button 
                className={`blueprint-tab-btn ${activeTab === "directory" ? "active" : ""}`} 
                onClick={() => setActiveTab("directory")}
              >
                <i className="ti ti-folders me-1" /> Module Directory Map
              </button>
              <button 
                className={`blueprint-tab-btn ${activeTab === "matrix" ? "active" : ""}`} 
                onClick={() => { setActiveTab("matrix"); setSearchQuery(""); }}
              >
                <i className="ti ti-table me-1" /> Interdependency Matrix
              </button>
            </div>
          </div>

          {/* TAB 1: INTERACTIVE FLOW CHART */}
          {activeTab === "flow" && (
            <>
              {/* VISUAL SVG GRAPH */}
              <div className="blueprint-svg-wrapper mb-4">
                <div className="text-muted small mb-3 text-center uppercase tracking-wider font-weight-700">
                  <i className="ti ti-click text-warning" /> Click nodes to inspect business process and REST payloads
                </div>
                <svg viewBox="0 0 1000 200" width="100%" height="100%" style={{ overflow: "visible" }}>
                  <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Connecting Line - Background */}
                  <path 
                    d="M 60,100 L 940,100" 
                    fill="none" 
                    className="flow-path-bg" 
                  />

                  {/* Connecting Line - Animated Active path */}
                  <path 
                    d={`M 60,100 L ${60 + selectedStepIndex * 146},100`}
                    fill="none" 
                    className="flow-path-active"
                    style={{ filter: "url(#glow)" }}
                  />

                  {/* Render Nodes */}
                  {STAGES.map((step, index) => {
                    const cx = 60 + index * 146;
                    const isActive = activeStep === step.id;
                    const isHovered = hoveredNode === step.id;

                    return (
                      <g 
                        key={step.id} 
                        className={`svg-node ${isActive ? "active" : ""} ${isHovered ? "hovered" : ""}`}
                        onClick={() => setActiveStep(step.id)}
                        onMouseEnter={() => setHoveredNode(step.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                        {/* Selected Pulsing Ring */}
                        {isActive && (
                          <circle 
                            cx={cx} 
                            cy={100} 
                            r={36} 
                            fill="none" 
                            stroke={step.color} 
                            strokeWidth="2" 
                            strokeDasharray="4 2"
                            style={{ 
                              transformOrigin: `${cx}px 100px`,
                              animation: "rotateRing 6s linear infinite"
                            }}
                          />
                        )}

                        {/* Node Bubble */}
                        <circle 
                          cx={cx} 
                          cy={100} 
                          r={28} 
                          className="svg-node-bg"
                        />

                        {/* Node Icons inside foreignObject to support CSS fonts */}
                        <foreignObject x={cx - 14} y={86} width={28} height={28} style={{ pointerEvents: "none" }}>
                          <div style={{ 
                            color: isActive ? "#ffffff" : step.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            fontSize: "18px"
                          }}>
                            <i className={`ti ${step.icon}`} />
                          </div>
                        </foreignObject>

                        {/* Text Label */}
                        <text 
                          x={cx} 
                          y={150} 
                          textAnchor="middle" 
                          className="svg-node-text"
                          style={{ fill: isActive ? "#ffffff" : "#94a3b8" }}
                        >
                          {step.stage.split(" ")[1] || step.stage}
                        </text>

                        {/* Miniature Subtitle */}
                        <text 
                          x={cx} 
                          y={166} 
                          textAnchor="middle" 
                          fill="#475569" 
                          fontSize="9px" 
                          fontWeight="600"
                        >
                          {step.title.split(" ")[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* DETAILED INSPECTION EXPLORER */}
              <div className="blueprint-detail-panel p-4">
                <div className="row g-4">
                  
                  {/* Left Column: Flow & Features */}
                  <div className="col-lg-6">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="p-3 rounded-circle" style={{ background: `${currentStepData.color}20` }}>
                        <i className={`ti ${currentStepData.icon} fs-4`} style={{ color: currentStepData.color }} />
                      </div>
                      <div>
                        <span className="text-muted small uppercase font-weight-700 tracking-wider">Workflow Stage Details</span>
                        <h4 className="text-white mb-0">{currentStepData.stage} — {currentStepData.title}</h4>
                      </div>
                    </div>
                    <p className="text-slate-400 mb-4">{currentStepData.summary}</p>
                    
                    {/* Business Process Flowchart Steps */}
                    <h5 className="text-white mb-3"><i className="ti ti-git-fork text-primary me-2" /> Business Process Walkthrough</h5>
                    <div className="d-flex flex-column gap-3 mb-4">
                      {currentStepData.businessFlow.map((flowStep, idx) => (
                        <div className="d-flex gap-3 align-items-start" key={idx}>
                          <div 
                            className="step-bubble" 
                            style={{ 
                              background: idx <= 2 ? `${currentStepData.color}30` : "#1f2937", 
                              color: idx <= 2 ? "#ffffff" : "#94a3b8",
                              border: `1px solid ${currentStepData.color}50`
                            }}
                          >
                            {idx + 1}
                          </div>
                          <p className="text-slate-300 small mb-0 pt-1">{flowStep}</p>
                        </div>
                      ))}
                    </div>

                    {/* Special Features */}
                    <h5 className="text-white mb-3"><i className="ti ti-award text-warning me-2" /> Special App Features Utilized</h5>
                    <div className="row g-3">
                      {currentStepData.specialFeatures.map((feat) => (
                        <div className="col-md-6" key={feat.name}>
                          <div className="feature-item-box p-3 h-100">
                            <strong className="text-white small d-block mb-1">
                              <i className="ti ti-star text-warning me-1" /> {feat.name}
                            </strong>
                            <span className="text-muted small">{feat.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Database, Endpoints & Access Control */}
                  <div className="col-lg-6">
                    
                    {/* Models */}
                    <div className="mb-4">
                      <h5 className="text-white mb-2"><i className="ti ti-database text-primary me-2" /> Relational Database Models</h5>
                      <div className="d-flex flex-wrap gap-2">
                        {currentStepData.models.map((model) => (
                          <span className="matrix-badge" key={model}>
                            <i className="ti ti-table text-primary me-1" /> {model}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* REST Endpoints */}
                    <div className="mb-4">
                      <h5 className="text-white mb-2"><i className="ti ti-api text-warning me-2" /> REST API Routes & Endpoints</h5>
                      <div className="d-flex flex-wrap gap-2">
                        {currentStepData.endpoints.map((ep) => (
                          <span className="matrix-badge text-warning" key={ep}>
                            <i className="ti ti-link me-1" /> {ep}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Permissions Matrix */}
                    <div className="mb-4">
                      <h5 className="text-white mb-2"><i className="ti ti-shield-lock text-danger me-2" /> Access Permissions Matrix</h5>
                      <div className="table-responsive">
                        <table className="table table-sm permission-table mb-0">
                          <thead>
                            <tr>
                              <th>Action Operation</th>
                              <th>Authorized Roles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentStepData.permissions.map((perm) => (
                              <tr key={perm.action}>
                                <td className="small font-weight-600">{perm.action}</td>
                                <td>
                                  {perm.roles.map((role) => (
                                    <span 
                                      className="badge bg-slate-800 text-slate-300 me-1" 
                                      key={role}
                                      style={{
                                        border: role === "super_admin" ? "1px solid #ef4444" : "1px solid #4b5563"
                                      }}
                                    >
                                      {role}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Inter-Module Pipes */}
                    <div>
                      <h5 className="text-white mb-2"><i className="ti ti-arrow-loop-right-2 text-info me-2" /> Inter-Module Data Piping</h5>
                      {currentStepData.interdependencies.map((dep) => (
                        <div key={dep.target} className="p-3 rounded bg-slate-900/60 border border-slate-800">
                          <strong className="text-white small d-block mb-1">
                            <i className="ti ti-circle-chevron-right text-info me-1" /> target: {dep.target}
                          </strong>
                          <span className="text-slate-400 small">{dep.description}</span>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>
              </div>
            </>
          )}

          {/* TAB 2: SYSTEM MODULES DIRECTORY MAP */}
          {activeTab === "directory" && (
            <>
              {/* SEARCH FILTER */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                <div className="search-input-group w-100">
                  <i className="ti ti-search" />
                  <input 
                    type="text" 
                    placeholder="Search modules, sub-modules, or features (e.g. Geofencing, E-Sign)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {searchQuery && (
                  <span className="badge bg-slate-800 text-slate-300 p-2">
                    Found {filteredModules.length} match{filteredModules.length !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              {/* MODULE CARDS GRID */}
              <div className="row g-4">
                {filteredModules.map((module) => (
                  <div className="col-xl-6" key={module.id}>
                    <div className={`module-card h-100 p-4 ${searchQuery ? "search-highlight" : ""}`}>
                      
                      {/* Card Header */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-3">
                          <div className="p-3 rounded-lg" style={{ background: `${module.color}15`, border: `1px solid ${module.color}30` }}>
                            <i className={`ti ${module.icon} fs-4`} style={{ color: module.color }} />
                          </div>
                          <div>
                            <h5 className="text-white mb-0">{module.name}</h5>
                            <span className="text-muted small uppercase font-weight-700 tracking-wider">System Module</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-400 small mb-4">{module.description}</p>

                      {/* Sub-modules listing */}
                      <h6 className="text-white mb-3 font-weight-700">Sub-Modules Included:</h6>
                      <div className="row g-2 mb-4">
                        {module.subModules.map((sub) => (
                          <div className="col-md-6" key={sub.name}>
                            <div className="p-3 rounded bg-slate-900 border border-slate-800 h-100">
                              <strong className="text-white small d-block mb-1">
                                <i className={`ti ${sub.icon} me-1`} style={{ color: module.color }} /> {sub.name}
                              </strong>
                              <p className="text-slate-400 small mb-0" style={{ fontSize: "11.5px" }}>{sub.description}</p>
                              <div className="text-muted small mt-2 pt-2 border-top border-slate-800" style={{ fontSize: "10.5px" }}>
                                {sub.details}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Special Feature highlights */}
                      <div className="p-3 rounded" style={{ background: `${module.color}08`, border: `1px dashed ${module.color}25` }}>
                        <span className="text-white small font-weight-700 d-block mb-1">
                          <i className="ti ti-bulb text-warning me-1" /> Special Module Technology:
                        </span>
                        <span className="text-slate-300 small">{module.specialFeatures}</span>
                      </div>

                    </div>
                  </div>
                ))}
                {filteredModules.length === 0 && (
                  <div className="col-12 text-center py-5">
                    <i className="ti ti-search-off fs-1 text-muted mb-3 d-block" />
                    <h5 className="text-white">No modules found matching your query</h5>
                    <p className="text-muted">Try looking up broad terms like "attendance", "recruitment", "payroll" or "signature".</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 3: INTERDEPENDENCY MATRIX */}
          {activeTab === "matrix" && (
            <div className="table-responsive">
              <table className="table blueprint-matrix-table mb-0">
                <thead>
                  <tr>
                    <th>Module Area</th>
                    <th>Core Features</th>
                    <th>Relational Backend Models</th>
                    <th>Endpoints Checked</th>
                    <th>Pipes Data Into</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGES.map((stage) => (
                    <tr key={stage.id}>
                      <td className="font-weight-700 text-white">
                        <i className={`ti ${stage.icon} me-2`} style={{ color: stage.color }} />
                        {stage.stage}
                      </td>
                      <td className="small">
                        {stage.features.join(", ")}
                      </td>
                      <td>
                        {stage.models.map((model) => (
                          <span className="badge bg-slate-800 text-slate-300 me-1" key={model}>{model}</span>
                        ))}
                      </td>
                      <td className="small text-warning">
                        {stage.endpoints.join(", ")}
                      </td>
                      <td className="small">
                        {stage.interdependencies.map((dep) => `${dep.target} (${dep.description.slice(0, 30)}...)`).join(" | ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default FlowBlueprint;
