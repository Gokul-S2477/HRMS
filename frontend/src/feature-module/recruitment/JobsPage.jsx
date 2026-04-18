import React, { useMemo } from "react";
import { useAuth } from "../../core/auth/AuthContext";

import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import { formatCurrency } from "../hrm/hrmShared";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "closed", label: "Closed" },
];

const EMPLOYMENT_OPTIONS = [
  { value: "Full-Time", label: "Full-Time" },
  { value: "Part-Time", label: "Part-Time" },
  { value: "Contract", label: "Contract" },
  { value: "Intern", label: "Intern" },
];

const WORK_MODE_OPTIONS = [
  { value: "Onsite", label: "Onsite" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "Remote", label: "Remote" },
];

const VISIBILITY_OPTIONS = [
  { value: "true", label: "Public" },
  { value: "false", label: "Internal" },
];

const defaultForm = {
  title: "",
  department_name: "",
  location: "",
  city: "",
  state: "",
  country: "India",
  work_mode: "Hybrid",
  employment_type: "Full-Time",
  openings: 1,
  status: "draft",
  is_public: "true",
  hiring_manager: "",
  experience_band: "",
  experience_min_years: 0,
  experience_max_years: 0,
  salary_min: 0,
  salary_max: 0,
  posted_on: "",
  closing_on: "",
  skills_text: "",
  benefits_text: "",
  description: "",
};

const fields = [
  { name: "title", label: "Role title", required: true },
  { name: "department_name", label: "Department" },
  { name: "location", label: "Location" },
  { name: "city", label: "City" },
  { name: "state", label: "State" },
  { name: "country", label: "Country" },
  { name: "work_mode", label: "Work Mode", type: "select", options: WORK_MODE_OPTIONS, required: true },
  { name: "employment_type", label: "Employment Type", type: "select", options: EMPLOYMENT_OPTIONS, required: true },
  { name: "openings", label: "Openings", type: "number", min: 1, required: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, required: true },
  { name: "is_public", label: "Portal Visibility", type: "select", options: VISIBILITY_OPTIONS, required: true },
  { name: "hiring_manager", label: "Hiring Manager" },
  { name: "experience_band", label: "Experience Band" },
  { name: "experience_min_years", label: "Minimum Years", type: "number", min: 0 },
  { name: "experience_max_years", label: "Maximum Years", type: "number", min: 0 },
  { name: "salary_min", label: "Salary Min", type: "number", min: 0 },
  { name: "salary_max", label: "Salary Max", type: "number", min: 0 },
  { name: "posted_on", label: "Posted On", type: "date" },
  { name: "closing_on", label: "Closing On", type: "date" },
  { name: "skills_text", label: "Skills", placeholder: "React, Django, communication" },
  { name: "benefits_text", label: "Benefits", placeholder: "Hybrid setup, medical cover, L&D budget" },
  { name: "description", label: "Role Brief", type: "textarea", colClass: "col-12", rows: 5 },
];

const columns = [
  {
    label: "Role",
    render: (record) => (
      <div>
        <div className="fw-semibold">{record.title}</div>
        <div className="text-muted small">{record.department_name || "General"}</div>
      </div>
    ),
    text: (record) => record.title,
  },
  {
    label: "Hiring",
    render: (record) => (
      <div>
        <div>{record.hiring_manager || "TBD"}</div>
        <div className="text-muted small">{record.location || [record.city, record.state].filter(Boolean).join(", ") || "Location pending"}</div>
      </div>
    ),
    text: (record) => record.hiring_manager || "TBD",
  },
  { label: "Employment", render: (record) => record.employment_type || "-", text: (record) => record.employment_type || "-" },
  { label: "Openings", render: (record) => record.openings || 0, text: (record) => record.openings || 0 },
  {
    label: "Portal",
    render: (record) => (
      <div>
        <span className={`payroll-badge ${record.is_public ? "success" : "warning"}`}>{record.is_public ? "Public" : "Internal"}</span>
        <div className="text-muted small mt-1">{record.work_mode || "Hybrid"}</div>
      </div>
    ),
    text: (record) => (record.is_public ? "Public" : "Internal"),
  },
  {
    label: "Share",
    render: (record) => (
      <div className="d-flex flex-wrap gap-2">
        <a href={record.share_links?.linkedin} target="_blank" rel="noreferrer" className="btn btn-sm btn-light">LinkedIn</a>
        <a href={record.share_links?.indeed} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">Indeed</a>
      </div>
    ),
    text: (record) => record.public_path || "-",
  },
];

const JobsPage = () => {
  const { role } = useAuth();
  const stakeholderView = role === "stakeholder";

  const highlightsBuilder = useMemo(
    () => (records) =>
      records.slice(0, 5).map((item) => ({
        label: item.title,
        meta: `${item.department_name || "General"} · ${item.work_mode || "Hybrid"}`,
        value: item.is_public ? "Public" : "Internal",
        tone: item.is_public ? "success" : "warning",
      })),
    []
  );

  return (
    <CrudOpsWorkspace
      endpoint="/recruitment/jobs/"
      title="Recruitment Jobs"
      subtitle="Run the hiring pipeline with live openings, public sharing links, and a cleaner split between internal roles and portal-facing jobs."
      kicker="Recruitment Control"
      buttonLabel="Add Job"
      searchPlaceholder="Smart search role, department, location, manager"
      emptyTitle="No jobs live yet"
      emptyDescription="Create roles, set hiring owners, and push selected ones to the public careers portal."
      fields={fields}
      filters={[
        { name: "status", label: "Status", accessor: "status", options: STATUS_OPTIONS },
        { name: "employment_type", label: "Type", accessor: "employment_type", options: EMPLOYMENT_OPTIONS },
        { name: "is_public", label: "Portal", accessor: "is_public", options: VISIBILITY_OPTIONS },
      ]}
      columns={columns}
      defaultForm={defaultForm}
      allowCreate={!stakeholderView}
      allowEdit={!stakeholderView}
      canDelete={!stakeholderView}
      highlightsBuilder={highlightsBuilder}
      normalizeForm={(record) => ({
        ...defaultForm,
        ...record,
        is_public: String(Boolean(record.is_public)),
        skills_text: Array.isArray(record.skills) ? record.skills.join(", ") : "",
        benefits_text: Array.isArray(record.benefits) ? record.benefits.join(", ") : "",
      })}
      buildPayload={(form) => ({
        ...form,
        openings: Number(form.openings || 1),
        experience_min_years: Number(form.experience_min_years || 0),
        experience_max_years: Number(form.experience_max_years || 0),
        salary_min: Number(form.salary_min || 0),
        salary_max: Number(form.salary_max || 0),
        is_public: String(form.is_public) === "true",
        skills: String(form.skills_text || "").split(",").map((item) => item.trim()).filter(Boolean),
        benefits: String(form.benefits_text || "").split(",").map((item) => item.trim()).filter(Boolean),
      })}
      summaryBuilder={(fieldsList, form) => (
        <div className="payroll-summary-list">
          <div className="payroll-summary-row"><span>Role</span><strong>{form.title || "-"}</strong></div>
          <div className="payroll-summary-row"><span>Portal visibility</span><strong>{String(form.is_public) === "true" ? "Public" : "Internal"}</strong></div>
          <div className="payroll-summary-row"><span>Comp band</span><strong>{Number(form.salary_max || 0) > 0 ? `${formatCurrency(form.salary_min)} - ${formatCurrency(form.salary_max)}` : "TBD"}</strong></div>
          <div className="payroll-summary-row"><span>Hiring owner</span><strong>{form.hiring_manager || "TBD"}</strong></div>
        </div>
      )}
      statsBuilder={(records) => {
        const open = records.filter((item) => item.status === "open").length;
        const openings = records.reduce((sum, item) => sum + Number(item.openings || 0), 0);
        const publicRoles = records.filter((item) => item.is_public).length;
        return [
          { label: "Roles", value: records.length, meta: "Tracked openings" },
          { label: "Live Jobs", value: open, meta: `${publicRoles} public role(s)` },
          { label: "Total Openings", value: openings, meta: "Headcount still required" },
          { label: "Hiring Owners", value: new Set(records.map((item) => item.hiring_manager).filter(Boolean)).size, meta: "Active managers" },
        ];
      }}
    />
  );
};

export default JobsPage;
