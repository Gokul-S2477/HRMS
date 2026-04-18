import React from "react";

import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import { fetchEmployeeOptions, fetchShiftOptions } from "../liveops/liveHelpers";

type CrudRecord = any;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const fields = [
  { name: "employee_id", label: "Employee", type: "select", optionsKey: "employeeOptions" },
  { name: "shift_id", label: "Shift", type: "select", optionsKey: "shiftOptions" },
  { name: "work_date", label: "Work Date", type: "date", required: true },
  { name: "project_name", label: "Project / Focus" },
  { name: "task_summary", label: "Task Summary", type: "textarea", colClass: "col-12", rows: 4 },
  { name: "start_time", label: "Start Time", type: "time", required: true },
  { name: "end_time", label: "End Time", type: "time", required: true },
  { name: "break_minutes", label: "Break Minutes", type: "number", min: 0 },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, required: true },
  { name: "notes", label: "Notes", type: "textarea", colClass: "col-12", rows: 3 },
];

const TimesheetsPage = () => (
  <CrudOpsWorkspace
    endpoint="/timesheets/"
    title="Timesheets"
    subtitle="Track daily work blocks, shift adherence, late minutes, and payroll-impact hours from one advanced desk."
    kicker="Attendance Operations"
    buttonLabel="Add Timesheet"
    searchPlaceholder="Smart search employee, project, task, status"
    emptyTitle="No timesheets logged yet"
    emptyDescription="Capture worked hours, shift discipline, and approval flow in a cleaner operational register."
    fields={fields}
    filters={[
      { name: "status", label: "Status", accessor: "status", options: STATUS_OPTIONS },
      { name: "employee", label: "Employee", accessor: "employee.id", optionsKey: "employeeOptions" },
      { name: "shift", label: "Shift", accessor: "shift_detail.id", optionsKey: "shiftOptions" },
    ]}
    columns={[
      { label: "Employee", render: (record: CrudRecord) => <div><div className="fw-semibold">{record.employee?.full_name || "Employee"}</div><div className="text-muted small">{record.employee?.designation_title || "-"}</div></div> },
      { label: "Date", render: (record: CrudRecord) => <div><div>{record.work_date}</div><div className="text-muted small">{record.shift_detail?.name || "No shift"}</div></div> },
      { label: "Work Block", render: (record: CrudRecord) => `${record.start_time} - ${record.end_time}` },
      { label: "Hours", render: (record: CrudRecord) => <div><div>{record.hours_worked || 0}h</div><div className="text-muted small">Payroll {record.payroll_impact_hours || 0}h</div></div> },
      { label: "Punctuality", render: (record: CrudRecord) => <div><div>Late {record.late_minutes || 0}m</div><div className="text-muted small">Early {record.early_exit_minutes || 0}m</div></div> },
      { label: "Status", render: (record: CrudRecord) => <span className={`payroll-badge ${record.status === "approved" ? "success" : record.status === "rejected" ? "danger" : "warning"}`}>{record.status}</span> },
    ]}
    defaultForm={{ employee_id: "", shift_id: "", work_date: "", project_name: "", task_summary: "", start_time: "09:00", end_time: "18:00", break_minutes: 60, status: "submitted", notes: "" }}
    normalizeForm={(record: CrudRecord) => ({ ...record, employee_id: record.employee?.id || "", shift_id: record.shift_detail?.id || "" })}
    loadDependencies={async () => ({ employeeOptions: await fetchEmployeeOptions(), shiftOptions: await fetchShiftOptions() })}
    statsBuilder={(records: CrudRecord[]) => {
      const hours = records.reduce((sum: number, item: CrudRecord) => sum + Number(item.hours_worked || 0), 0);
      const submitted = records.filter((item: CrudRecord) => item.status === "submitted").length;
      const approved = records.filter((item: CrudRecord) => item.status === "approved").length;
      return [
        { label: "Timesheets", value: records.length, meta: "Tracked work logs" },
        { label: "Submitted", value: submitted, meta: `${approved} approved` },
        { label: "Total Hours", value: `${hours.toFixed(1)}h`, meta: "Logged time" },
        { label: "Late Flags", value: records.filter((item: CrudRecord) => Number(item.late_minutes || 0) > 0).length, meta: "Needs attention" },
      ];
    }}
  />
);

export default TimesheetsPage;
