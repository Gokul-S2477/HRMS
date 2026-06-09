import React, { useState } from "react";
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
    models: ["Job", "Candidate", "Interview", "Referral"],
    endpoints: ["/jobs/", "/candidates/", "/recruitment/interviews/", "/referrals/"],
    interdependencies: [
      { target: "Employee Setup", description: "Hired candidates can be directly onboarded into the employee registry, auto-populating contact details." }
    ],
    color: "#2563eb" // Blue
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
    models: ["Department", "Designation", "UserRole"],
    endpoints: ["/departments/", "/designations/", "/employees/tree/"],
    interdependencies: [
      { target: "Employee Setup", description: "Every employee must map to a valid department and designation before active payroll calculation." },
      { target: "Attendance & Leaves", description: "Shift scheduler rules and leave policies are applied to specific department codes." }
    ],
    color: "#0d9488" // Teal
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
    models: ["Employee", "User", "EmployeeProfile"],
    endpoints: ["/employees/", "/employees/<id>/"],
    interdependencies: [
      { target: "Onboarding & E-Sign", description: "Triggers onboarding checklist creation and issues document signature notifications." },
      { target: "HRM & Timekeeping", description: "Creates attendance logs and sets leave balances based on the joining date." }
    ],
    color: "#7c3aed" // Purple
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
    models: ["DocumentEsign", "DocumentSignature", "Asset", "AssetCategory"],
    endpoints: ["/document-esign/", "/document-signature/", "/assets/"],
    interdependencies: [
      { target: "Employee Setup", description: "Completed signatures mark profiles as compliance-cleared, updating onboarding maturity statistics." }
    ],
    color: "#db2777" // Pink
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
    models: ["LeaveRequest", "AttendanceRecord", "Timesheet", "ShiftRule"],
    endpoints: ["/leave-requests/", "/attendance/", "/timesheets/"],
    interdependencies: [
      { target: "Payroll & Finance", description: "Unpaid leave balances and overtime hours are directly piped into the monthly payroll engine." }
    ],
    color: "#f59e0b" // Amber
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
    models: ["SalaryComponent", "EmployeePayroll", "Payslip", "ExpenseClaim"],
    endpoints: ["/salary-components/", "/employee-payroll/", "/payslips/", "/expense-claims/"],
    interdependencies: [
      { target: "Offboarding", description: "Determines final payouts, remaining allowances, and severance terms." }
    ],
    color: "#10b981" // Green
  },
  {
    id: "offboarding",
    stage: "7. Offboarding & Settlement",
    icon: "ti-circle-x",
    title: "Exit Management & Settlement",
    summary: "Handles promotions, resignations, terminations, and final settlements.",
    features: [
      "Resignation workflow approval tracking",
      "Termination records & compliance notices",
      "Final settlement calculation desk",
      "Checklist release & asset recovery logs"
    ],
    models: ["Promotion", "Resignation", "Termination", "FinalSettlement"],
    endpoints: ["/promotions/", "/resignations/", "/terminations/", "/final-settlements/"],
    interdependencies: [
      { target: "Employee Setup", description: "Marks the profile status as Inactive, deauthorizes system login access, and updates org chart." }
    ],
    color: "#dc2626" // Red
  }
];

const FlowBlueprint: React.FC = () => {
  const [activeStep, setActiveStep] = useState<string>("recruitment");
  const [activeTab, setActiveTab] = useState<"flow" | "matrix">("flow");

  const currentStepData = STAGES.find((s) => s.id === activeStep) || STAGES[0];

  return (
    <div className="page-wrapper">
      <style>{`
        .blueprint-container {
          background: #0f172a !important; /* Premium Dark Navy */
          color: #f8fafc !important;
          border-radius: 24px;
          border: 1px solid #1e293b;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .blueprint-title-area {
          border-bottom: 1px solid #1e293b;
          padding-bottom: 24px;
        }
        .blueprint-kpi-row {
          background: #1e293b;
          border-radius: 16px;
          border: 1px solid #334155;
        }
        .blueprint-kpi-col {
          border-right: 1px solid #334155;
          padding: 20px;
        }
        .blueprint-kpi-col:last-child {
          border-right: none;
        }
        .blueprint-tab-btn {
          border: 1px solid #334155;
          background: transparent;
          color: #94a3b8;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .blueprint-tab-btn.active {
          background: var(--hrms-accent, #F26522);
          color: #ffffff;
          border-color: var(--hrms-accent, #F26522);
          box-shadow: 0 4px 12px rgba(242, 101, 34, 0.2);
        }
        .blueprint-flow-wrapper {
          display: flex;
          align-items: center;
          gap: 16px;
          overflow-x: auto;
          padding: 24px 0;
          scrollbar-width: thin;
        }
        .blueprint-step-node {
          flex-shrink: 0;
          width: 170px;
          background: #1e293b;
          border: 2px solid #334155;
          border-radius: 16px;
          padding: 18px 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1.1);
          position: relative;
        }
        .blueprint-step-node:hover {
          transform: translateY(-8px);
          border-color: #f8fafc;
        }
        .blueprint-step-node.active {
          background: #0f172a;
          border-color: var(--hrms-accent, #F26522);
          box-shadow: 0 0 16px rgba(242, 101, 34, 0.3);
        }
        .blueprint-step-node i {
          font-size: 24px;
          margin-bottom: 10px;
          display: inline-block;
        }
        .blueprint-step-arrow {
          font-size: 18px;
          color: #475569;
          flex-shrink: 0;
          animation: arrowPulse 1.5s infinite;
        }
        @keyframes arrowPulse {
          0%, 100% { transform: translateX(0); opacity: 0.6; }
          50% { transform: translateX(4px); opacity: 1; }
        }
        .blueprint-detail-panel {
          background: #1e293b;
          border-radius: 20px;
          border: 1px solid #334155;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        }
        .blueprint-badge {
          background: #0f172a;
          border: 1px solid #334155;
          color: #f8fafc;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .blueprint-bullet {
          width: 6px;
          height: 6px;
          background: var(--hrms-accent, #F26522);
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .blueprint-matrix-table th {
          background: #0f172a !important;
          color: #94a3b8 !important;
          border-bottom: 2px solid #1e293b !important;
        }
        .blueprint-matrix-table td {
          border-bottom: 1px solid #334155 !important;
          color: #cbd5e1 !important;
        }
        .blueprint-matrix-table tr:hover td {
          background: #1e293b !important;
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
                  An interactive reference system mapping operational lifecycles, backend data relationships, and REST endpoint routes.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip"><i className="ti ti-key" /> Visible only to Super Admins</span>
                  <span className="employee-chip"><i className="ti ti-binary-tree" /> End-to-end data pipelines</span>
                </div>
              </div>
              <div className="col-lg-4">
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
              <h4 className="text-white mb-1"><i className="ti ti-route" /> System Process Architecture</h4>
              <p className="text-muted small mb-0">Select views and stages to analyze how data flows across modules.</p>
            </div>
            <div className="d-flex gap-2">
              <button 
                className={`blueprint-tab-btn ${activeTab === "flow" ? "active" : ""}`} 
                onClick={() => setActiveTab("flow")}
              >
                <i className="ti ti-hierarchy-2 me-1" /> Interactive Flow
              </button>
              <button 
                className={`blueprint-tab-btn ${activeTab === "matrix" ? "active" : ""}`} 
                onClick={() => setActiveTab("matrix")}
              >
                <i className="ti ti-table me-1" /> Interdependency Matrix
              </button>
            </div>
          </div>

          {/* KPI STATS BAR */}
          <div className="row blueprint-kpi-row g-0 mb-4">
            <div className="col-md-3 blueprint-kpi-col text-center">
              <div className="text-muted small mb-1">Core Modules</div>
              <h3 className="text-white mb-0">7 Major Areas</h3>
            </div>
            <div className="col-md-3 blueprint-kpi-col text-center">
              <div className="text-muted small mb-1">Operational Stages</div>
              <h3 className="text-white mb-0">12 Touchpoints</h3>
            </div>
            <div className="col-md-3 blueprint-kpi-col text-center">
              <div className="text-muted small mb-1">Relational Mappings</div>
              <h3 className="text-white mb-0">24 Interconnects</h3>
            </div>
            <div className="col-md-3 blueprint-kpi-col text-center">
              <div className="text-muted small mb-1">Role Settings</div>
              <h3 className="text-white mb-0">4 Persona Access</h3>
            </div>
          </div>

          {activeTab === "flow" ? (
            <>
              {/* FLOWCHART STAGE SELECTOR */}
              <div className="blueprint-flow-wrapper mb-4">
                {STAGES.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div 
                      className={`blueprint-step-node ${activeStep === step.id ? "active" : ""}`}
                      onClick={() => setActiveStep(step.id)}
                    >
                      <i className={`ti ${step.icon}`} style={{ color: step.color }} />
                      <div className="small font-weight-700 text-white text-truncate">{step.stage}</div>
                    </div>
                    {index < STAGES.length - 1 && (
                      <div className="blueprint-step-arrow"><i className="ti ti-chevron-right" /></div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* STAGE DETAILS EXPLORER */}
              <div className="blueprint-detail-panel p-4">
                <div className="row g-4">
                  
                  {/* Left Column: Summary and Features */}
                  <div className="col-lg-6">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <i className={`ti ${currentStepData.icon} fs-4`} style={{ color: currentStepData.color }} />
                      <h4 className="text-white mb-0">{currentStepData.title}</h4>
                    </div>
                    <p className="text-slate-400 mb-4">{currentStepData.summary}</p>
                    
                    <h5 className="text-white mb-3">Core Features</h5>
                    <div className="row g-2">
                      {currentStepData.features.map((feat) => (
                        <div className="col-md-6 d-flex align-items-center gap-2 text-slate-300 small mb-2" key={feat}>
                          <span className="blueprint-bullet" style={{ background: currentStepData.color }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Schema, Endpoints, and Connections */}
                  <div className="col-lg-6">
                    
                    <div className="mb-4">
                      <h5 className="text-white mb-2"><i className="ti ti-database text-muted" /> Related Data Models</h5>
                      <div className="d-flex flex-wrap gap-2">
                        {currentStepData.models.map((model) => (
                          <span className="blueprint-badge" key={model}>
                            <i className="ti ti-table text-primary" /> {model}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h5 className="text-white mb-2"><i className="ti ti-api text-muted" /> REST API Endpoints</h5>
                      <div className="d-flex flex-wrap gap-2">
                        {currentStepData.endpoints.map((ep) => (
                          <span className="blueprint-badge text-warning" key={ep}>
                            <i className="ti ti-link" /> {ep}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-white mb-2"><i className="ti ti-arrow-loop-right-2 text-muted" /> Inter-Module Dependencies</h5>
                      {currentStepData.interdependencies.map((dep) => (
                        <div key={dep.target} className="p-3 rounded-lg border border-slate-700 bg-slate-900/30">
                          <strong className="text-white small d-block mb-1">Piped to: {dep.target}</strong>
                          <span className="text-slate-400 small">{dep.description}</span>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>
              </div>
            </>
          ) : (
            /* INTERDEPENDENCY MATRIX VIEW */
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
