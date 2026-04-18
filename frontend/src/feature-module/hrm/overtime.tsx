import React from "react";

import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import { fetchEmployeeOptions } from "../liveops/liveHelpers";

type CrudRecord = any;

const STATUS_OPTIONS = [
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

const fields = [
  { name: "employee_id", label: "Employee", type: "select", optionsKey: "employeeOptions" },
  { name: "work_date", label: "Work Date", type: "date", required: true },
  { name: "hours", label: "Overtime Hours", type: "number", min: 0, step: "0.25", required: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, required: true },
  { name: "reason", label: "Reason", type: "textarea", colClass: "col-12", rows: 3 },
  { name: "notes", label: "Reviewer Notes", type: "textarea", colClass: "col-12", rows: 3 },
];

const OvertimePage = () => (
  <CrudOpsWorkspace
    endpoint="/overtime-entries/"
    title="Overtime"
    subtitle="Track employee overtime requests, approval outcomes, and payroll-impact amount from one queue."
    kicker="Overtime Queue"
    buttonLabel="Add Overtime"
    searchPlaceholder="Smart search employee, reason, status"
    emptyTitle="No overtime requests yet"
    emptyDescription="Capture overtime approvals and see the payroll effect before the cycle closes."
    fields={fields}
    filters={[
      { name: "status", label: "Status", accessor: "status", options: STATUS_OPTIONS },
      { name: "employee", label: "Employee", accessor: "employee.id", optionsKey: "employeeOptions" },
    ]}
    columns={[
      { label: "Employee", render: (record: CrudRecord) => <div><div className="fw-semibold">{record.employee?.full_name || "Employee"}</div><div className="text-muted small">{record.employee?.department_name || "-"}</div></div> },
      { label: "Work Date", render: (record: CrudRecord) => record.work_date },
      { label: "Hours", render: (record: CrudRecord) => `${record.hours || 0}h` },
      { label: "Payroll", render: (record: CrudRecord) => `$${record.payroll_amount || 0}` },
      { label: "Status", render: (record: CrudRecord) => <span className={`payroll-badge ${record.status === "approved" || record.status === "paid" ? "success" : record.status === "rejected" ? "danger" : "warning"}`}>{record.status}</span> },
      { label: "Reason", render: (record: CrudRecord) => record.reason || "-" },
    ]}
    defaultForm={{ employee_id: "", work_date: "", hours: 1, status: "requested", reason: "", notes: "" }}
    normalizeForm={(record: CrudRecord) => ({ ...record, employee_id: record.employee?.id || "" })}
    loadDependencies={async () => ({ employeeOptions: await fetchEmployeeOptions() })}
    statsBuilder={(records: CrudRecord[]) => {
      const approvedHours = records
        .filter((item: CrudRecord) => ["approved", "paid"].includes(item.status))
        .reduce((sum: number, item: CrudRecord) => sum + Number(item.hours || 0), 0);
      const pending = records.filter((item: CrudRecord) => item.status === "requested").length;
      const payrollValue = records.reduce((sum: number, item: CrudRecord) => sum + Number(item.payroll_amount || 0), 0).toFixed(0);
      return [
        { label: "Requests", value: records.length, meta: `${pending} pending` },
        { label: "Approved Hours", value: `${approvedHours.toFixed(1)}h`, meta: "Approved or already paid" },
        { label: "Payroll Impact", value: `$${payrollValue}`, meta: "Estimated overtime value" },
        { label: "Paid", value: records.filter((item: CrudRecord) => item.status === "paid").length, meta: "Closed overtime items" },
      ];
    }}
  />
);

export default OvertimePage;
