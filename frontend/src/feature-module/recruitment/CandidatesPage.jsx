import React from "react";
import { Link } from "react-router-dom";

import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import { all_routes } from "../router/all_routes";
import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import { fetchJobOptions } from "../liveops/liveHelpers";
import { formatDisplayDate } from "../hrm/hrmShared";

const STAGE_OPTIONS = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "joined", label: "Joined" },
  { value: "rejected", label: "Rejected" },
];

const fields = [
  { name: "job_id", label: "Linked Job", type: "select", optionsKey: "jobOptions" },
  { name: "first_name", label: "First Name", required: true },
  { name: "last_name", label: "Last Name" },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "whatsapp", label: "WhatsApp" },
  { name: "location", label: "Location" },
  { name: "source", label: "Source" },
  { name: "application_source", label: "Application Source" },
  { name: "stage", label: "Stage", type: "select", options: STAGE_OPTIONS, required: true },
  { name: "score", label: "Fit Score", type: "number", min: 0, max: 100 },
  { name: "notice_period_days", label: "Notice Period", type: "number", min: 0 },
  { name: "owner_name", label: "Recruiter / Owner" },
  { name: "current_company", label: "Current Company" },
  { name: "current_title", label: "Current Title" },
  { name: "linkedin_url", label: "LinkedIn URL" },
  { name: "portfolio_url", label: "Portfolio URL" },
  { name: "resume_url", label: "Resume URL" },
  { name: "applied_on", label: "Applied On", type: "date" },
  { name: "summary", label: "Summary", type: "textarea", colClass: "col-12", rows: 5 },
];

const columns = [
  {
    label: "Candidate",
    render: (record) => (
      <div>
        <div className="fw-semibold">{record.full_name || `${record.first_name} ${record.last_name || ""}`}</div>
        <div className="text-muted small">{record.email}</div>
      </div>
    ),
    text: (record) => record.full_name || `${record.first_name} ${record.last_name || ""}`,
  },
  { label: "Role", render: (record) => record.job?.title || "Unassigned", text: (record) => record.job?.title || "Unassigned" },
  {
    label: "Contact",
    render: (record) => (
      <div>
        <div>{record.phone || record.whatsapp || "-"}</div>
        <div className="text-muted small">{record.location || "Location pending"}</div>
      </div>
    ),
    text: (record) => record.phone || record.whatsapp || "-",
  },
  {
    label: "Stage",
    render: (record) => <span className={`payroll-badge ${record.stage === "joined" ? "success" : record.stage === "rejected" ? "danger" : "warning"}`}>{record.stage}</span>,
    text: (record) => record.stage,
  },
  { label: "Score", render: (record) => `${record.score || 0}/100`, text: (record) => `${record.score || 0}/100` },
  {
    label: "Owner",
    render: (record) => (
      <div>
        <div>{record.owner_name || "-"}</div>
        <div className="text-muted small">Updated {formatDisplayDate(record.stage_updated_at || record.updated_at)}</div>
      </div>
    ),
    text: (record) => record.owner_name || "-",
  },
  {
    label: "Interview Trail",
    render: (record) => (
      <div>
        <div>{record.interview_snapshot?.count || 0} round(s)</div>
        <div className="text-muted small">{record.interview_snapshot?.latest?.decision ? String(record.interview_snapshot.latest.decision).replace(/_/g, " ") : "No interview logged yet"}</div>
      </div>
    ),
    text: (record) => String(record.interview_snapshot?.count || 0),
  },
];

const CandidatesPage = ({ variant = "table" }) => {
  const { role } = useAuth();
  const stakeholderView = role === "stakeholder";

  const handleContact = async (record, channel, refresh) => {
    try {
      await API.post(`/recruitment/candidates/${record.id}/contact/`, {
        channel,
        note: `Candidate contact initiated from ${channel}.`,
      });
      refresh();
    } catch (error) {
      console.error("Failed to log candidate contact", error);
    }
    if (channel === "email" && record.contact_actions?.email) {
      window.open(record.contact_actions.email, "_blank");
    }
    if (channel === "whatsapp" && record.contact_actions?.whatsapp) {
      window.open(record.contact_actions.whatsapp, "_blank");
    }
  };

  return (
    <CrudOpsWorkspace
      endpoint="/recruitment/candidates/"
      title="Candidates"
      subtitle="Track applicant flow with richer profiles, recruiter ownership, timeline-ready stages, and direct contact handoffs for HR and stakeholders."
      kicker="Talent Pipeline"
      buttonLabel="Add Candidate"
      searchPlaceholder="Smart search candidate, role, source, recruiter"
      emptyTitle="No candidates yet"
      emptyDescription="Start capturing candidate movement from applied through offer and joining."
      fields={fields}
      filters={[
        { name: "stage", label: "Stage", accessor: "stage", options: STAGE_OPTIONS },
        { name: "job", label: "Job", accessor: "job.id", optionsKey: "jobOptions" },
      ]}
      columns={columns}
      variant={variant}
      allowCreate={!stakeholderView}
      allowEdit={!stakeholderView}
      canDelete={!stakeholderView}
      extraRowActions={(record, context) => (
        <>
          {record.contact_actions?.email ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleContact(record, "email", context.refresh)}>
              Email
            </button>
          ) : null}
          {record.contact_actions?.whatsapp ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleContact(record, "whatsapp", context.refresh)}>
              WhatsApp
            </button>
          ) : null}
          <Link to={`${all_routes.recruitmentInterviews}?candidate=${record.id}`} className="btn btn-sm btn-light">
            Interviews
          </Link>
          {record.resume_url ? (
            <a href={record.resume_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-light">
              Resume
            </a>
          ) : null}
        </>
      )}
      defaultForm={{
        job_id: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        whatsapp: "",
        location: "",
        source: "",
        application_source: "internal",
        stage: "applied",
        score: 0,
        notice_period_days: 0,
        owner_name: "",
        current_company: "",
        current_title: "",
        linkedin_url: "",
        portfolio_url: "",
        resume_url: "",
        applied_on: "",
        summary: "",
      }}
      loadDependencies={async () => ({ jobOptions: await fetchJobOptions() })}
      statsBuilder={(records) => {
        const active = records.filter((item) => !["rejected", "joined"].includes(item.stage)).length;
        const offers = records.filter((item) => item.stage === "offer").length;
        const avgScore = records.length ? Math.round(records.reduce((sum, item) => sum + Number(item.score || 0), 0) / records.length) : 0;
        return [
          { label: "Candidates", value: records.length, meta: "Tracked applicants" },
          { label: "Active Pipeline", value: active, meta: `${offers} in offer stage` },
          { label: "Average Score", value: `${avgScore}/100`, meta: "Fit estimate" },
          { label: "Interview Ready", value: records.filter((item) => Number(item.interview_snapshot?.count || 0) > 0).length, meta: "Profiles with round history" },
          { label: "Contact Ready", value: records.filter((item) => item.contact_actions?.email || item.contact_actions?.whatsapp).length, meta: "Email or WhatsApp available" },
        ];
      }}
      highlightsBuilder={(records) =>
        records.slice(0, 5).map((item) => ({
          label: item.full_name || `${item.first_name} ${item.last_name || ""}`,
          meta: `${item.job?.title || "Unassigned"} · ${item.owner_name || "Unowned"}`,
          value: item.stage,
          tone: item.stage === "joined" ? "success" : item.stage === "rejected" ? "danger" : "warning",
        }))
      }
    />
  );
};

export default CandidatesPage;
