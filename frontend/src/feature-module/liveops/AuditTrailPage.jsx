import React from "react";

import CrudOpsWorkspace from "./CrudOpsWorkspace";
import { formatDateTimeLabel } from "../hrm/hrmShared";

const AuditTrailPage = () => (
  <CrudOpsWorkspace
    endpoint="/audit-logs/"
    title="Audit Trail"
    subtitle="Review who changed what, when they changed it, and which module or workflow generated the action across the HRMS."
    kicker="Governance"
    buttonLabel="Add Entry"
    searchPlaceholder="Smart search scope, action, actor, summary"
    emptyTitle="No audit events yet"
    emptyDescription="Actions across recruitment, payroll, leave, onboarding, and approvals will appear here automatically."
    allowCreate={false}
    allowEdit={false}
    canDelete={false}
    filters={[
      { name: "scope", label: "Scope", options: [
        { value: "approvals", label: "Approvals" },
        { value: "documents", label: "Documents" },
        { value: "onboarding", label: "Onboarding" },
        { value: "recruitment", label: "Recruitment" },
      ] },
    ]}
    columns={[
      { label: "Summary", render: (record) => <div><div className="fw-semibold">{record.summary || `${record.scope} ${record.action}`}</div><div className="text-muted small">{record.target_type} • {record.target_id || "-"}</div></div> },
      { label: "Actor", render: (record) => record.actor_user?.display_name || record.actor_user?.username || record.actor_email || "System" },
      { label: "Scope", render: (record) => <span className="payroll-badge accent">{record.scope}</span> },
      { label: "Time", render: (record) => formatDateTimeLabel(record.created_at) },
    ]}
    defaultForm={{}}
    statsBuilder={(records) => [
      { label: "Events", value: records.length, meta: "Matching current filters" },
      { label: "Approval Actions", value: records.filter((item) => item.scope === "approvals").length, meta: "Queue decisions" },
      { label: "Recruitment", value: records.filter((item) => item.scope === "recruitment").length, meta: "Hiring workflow changes" },
      { label: "Onboarding", value: records.filter((item) => item.scope === "onboarding").length, meta: "Landing workflow changes" },
    ]}
    highlightsBuilder={(records) => records.slice(0, 6).map((item) => ({
      label: item.summary || `${item.scope} ${item.action}`,
      meta: formatDateTimeLabel(item.created_at),
      value: item.scope,
      tone: "info",
    }))}
  />
);

export default AuditTrailPage;
