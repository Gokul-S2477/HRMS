import React from "react";

import { useAuth } from "../../core/auth/AuthContext";
import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import { fetchJobOptions } from "../liveops/liveHelpers";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "accepted", label: "Accepted" },
  { value: "converted", label: "Converted" },
  { value: "declined", label: "Declined" },
];

const fields = [
  { name: "job_id", label: "Linked Job", type: "select", optionsKey: "jobOptions" },
  { name: "candidate_name", label: "Candidate", required: true },
  { name: "candidate_email", label: "Candidate Email", type: "email" },
  { name: "referrer_name", label: "Referrer", required: true },
  { name: "referrer_email", label: "Referrer Email", type: "email" },
  { name: "reward_status", label: "Reward Status" },
  { name: "status", label: "Referral Status", type: "select", options: STATUS_OPTIONS, required: true },
  { name: "referred_on", label: "Referred On", type: "date" },
  { name: "notes", label: "Notes", type: "textarea", colClass: "col-12", rows: 4 },
];

const columns = [
  { label: "Candidate", render: (record) => <div><div className="fw-semibold">{record.candidate_name}</div><div className="text-muted small">{record.candidate_email || "Email not shared"}</div></div>, text: (record) => record.candidate_name },
  { label: "Referrer", render: (record) => <div><div>{record.referrer_name}</div><div className="text-muted small">{record.referrer_email || "-"}</div></div>, text: (record) => record.referrer_name },
  { label: "Job", render: (record) => record.job?.title || "General talent pool", text: (record) => record.job?.title || "General talent pool" },
  { label: "Status", render: (record) => <span className={`payroll-badge ${record.status === "converted" ? "success" : record.status === "declined" ? "danger" : "warning"}`}>{record.status}</span>, text: (record) => record.status },
  { label: "Reward", render: (record) => record.reward_status || "pending", text: (record) => record.reward_status || "pending" },
];

const ReferralsPage = () => {
  const { role } = useAuth();
  const stakeholderView = role === "stakeholder";

  return (
    <CrudOpsWorkspace
      endpoint="/recruitment/referrals/"
      title="Referrals"
      subtitle="Run employee and stakeholder referrals with conversion visibility and reward tracking."
      kicker="Referral Desk"
      buttonLabel="Add Referral"
      searchPlaceholder="Smart search candidate, referrer, job, reward"
      emptyTitle="No referrals yet"
      emptyDescription="Track who referred whom, what job they were matched to, and whether the referral converted."
      fields={fields}
      filters={[
        { name: "status", label: "Status", accessor: "status", options: STATUS_OPTIONS },
        { name: "job", label: "Job", accessor: "job.id", optionsKey: "jobOptions" },
      ]}
      columns={columns}
      allowCreate={!stakeholderView}
      allowEdit={!stakeholderView}
      canDelete={!stakeholderView}
      defaultForm={{ job_id: "", candidate_name: "", candidate_email: "", referrer_name: "", referrer_email: "", reward_status: "pending", status: "new", referred_on: "", notes: "" }}
      loadDependencies={async () => ({ jobOptions: await fetchJobOptions() })}
      statsBuilder={(records) => {
        const converted = records.filter((item) => item.status === "converted").length;
        const active = records.filter((item) => ["new", "reviewing", "accepted"].includes(item.status)).length;
        return [
          { label: "Referrals", value: records.length, meta: "Tracked introductions" },
          { label: "Active Reviews", value: active, meta: `${converted} converted` },
          { label: "Referrers", value: new Set(records.map((item) => item.referrer_name).filter(Boolean)).size, meta: "Unique contributors" },
          { label: "Reward Queue", value: records.filter((item) => String(item.reward_status || "").toLowerCase() !== "paid").length, meta: "Still to settle" },
        ];
      }}
    />
  );
};

export default ReferralsPage;
