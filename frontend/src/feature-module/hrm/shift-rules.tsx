import React, { useState } from "react";

import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import ShiftScheduler from "./ShiftScheduler";

type CrudRecord = any;

const fields = [
  { name: "name", label: "Shift Name", required: true },
  { name: "code", label: "Code", required: true },
  { name: "start_time", label: "Start Time", type: "time", required: true },
  { name: "end_time", label: "End Time", type: "time", required: true },
  { name: "grace_in_minutes", label: "Late Grace", type: "number", min: 0, required: true },
  { name: "grace_out_minutes", label: "Early Grace", type: "number", min: 0, required: true },
  { name: "standard_hours", label: "Standard Hours", type: "number", min: 0, step: "0.25", required: true },
  { name: "overtime_threshold_hours", label: "OT Threshold", type: "number", min: 0, step: "0.25", required: true },
  { name: "is_active", label: "Active", type: "select", options: [{ value: true, label: "Active" }, { value: false, label: "Inactive" }], required: true },
];

const ShiftRulesPage = () => {
  const [activeTab, setActiveTab] = useState<"roster" | "rules">("roster");

  return (
    <CrudOpsWorkspace
      endpoint="/shift-definitions/"
      title={activeTab === "roster" ? "Weekly Shift Roster" : "Shift Rules & Timings"}
      subtitle={activeTab === "roster" ? "Assign daily rotations and shift schedules to employees for the week." : "Control shift timings, grace windows, and overtime thresholds that drive attendance."}
      kicker="Shift Engine"
      buttonLabel="Add Shift"
      searchPlaceholder="Smart search shift, code, timing"
      emptyTitle="No shift rules yet"
      emptyDescription="Define active shifts so attendance, timesheets, and overtime calculations stay consistent."
      fields={fields}
      allowCreate={activeTab === "rules"}
      hideDefaultLayout={activeTab === "roster"}
      filters={[
        { name: "is_active", label: "State", accessor: "is_active", options: [{ value: true, label: "Active" }, { value: false, label: "Inactive" }] },
      ]}
      columns={[
        { label: "Shift", render: (record: CrudRecord) => <div><div className="fw-semibold">{record.name}</div><div className="text-muted small">{record.code}</div></div> },
        { label: "Timing", render: (record: CrudRecord) => `${record.start_time} - ${record.end_time}` },
        { label: "Grace", render: (record: CrudRecord) => `${record.grace_in_minutes}/${record.grace_out_minutes} mins` },
        { label: "Hours", render: (record: CrudRecord) => <div><div>{record.standard_hours}h standard</div><div className="text-muted small">OT after {record.overtime_threshold_hours}h</div></div> },
        { label: "Status", render: (record: CrudRecord) => <span className={`payroll-badge ${record.is_active ? "success" : "danger"}`}>{record.is_active ? "Active" : "Inactive"}</span> },
      ]}
      defaultForm={{ name: "", code: "", start_time: "09:00", end_time: "18:00", grace_in_minutes: 15, grace_out_minutes: 15, standard_hours: 8, overtime_threshold_hours: 8.5, is_active: true }}
      normalizeForm={(record: CrudRecord) => ({ ...record, is_active: record.is_active })}
      buildPayload={(form: CrudRecord) => ({ ...form, is_active: String(form.is_active) === "true" || form.is_active === true })}
      statsBuilder={(records: CrudRecord[]) => [
        { label: "Shift Rules", value: records.length, meta: "Configured schedules" },
        { label: "Active Shifts", value: records.filter((item: CrudRecord) => item.is_active).length, meta: "Usable in operations" },
        { label: "Avg Standard Hours", value: records.length ? (records.reduce((sum: number, item: CrudRecord) => sum + Number(item.standard_hours || 0), 0) / records.length).toFixed(1) : "0.0", meta: "Expected paid time" },
        { label: "OT Ready", value: records.filter((item: CrudRecord) => Number(item.overtime_threshold_hours || 0) > Number(item.standard_hours || 0)).length, meta: "Supports overtime triggers" },
      ]}
    >
      <div className="card border-0 mb-4 bg-transparent" style={{ marginTop: "-20px" }}>
        <div className="d-flex gap-2">
          <button 
            type="button" 
            className={`btn ${activeTab === "roster" ? "btn-primary" : "btn-light"}`}
            style={{ borderRadius: "10px", fontWeight: "600" }}
            onClick={() => setActiveTab("roster")}
          >
            <i className="ti ti-calendar-event me-2" />
            Roster Planner
          </button>
          <button 
            type="button" 
            className={`btn ${activeTab === "rules" ? "btn-primary" : "btn-light"}`}
            style={{ borderRadius: "10px", fontWeight: "600" }}
            onClick={() => setActiveTab("rules")}
          >
            <i className="ti ti-settings me-2" />
            Shift Rules & Timings
          </button>
        </div>
      </div>
      {activeTab === "roster" && <ShiftScheduler />}
    </CrudOpsWorkspace>
  );
};

export default ShiftRulesPage;
