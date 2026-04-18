import React from "react";

import CrudOpsWorkspace from "./CrudOpsWorkspace";
import { fetchAssetCategoryOptions, fetchEmployeeOptions } from "./liveHelpers";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "return_requested", label: "Return Requested" },
  { value: "returned", label: "Returned" },
  { value: "lost", label: "Lost" },
];

const fields = [
  { name: "asset_name", label: "Asset Name", required: true },
  { name: "asset_code", label: "Asset Code", required: true },
  { name: "category_id", label: "Category", type: "select", optionsKey: "categoryOptions" },
  { name: "assigned_to_id", label: "Assigned To", type: "select", optionsKey: "employeeOptions" },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, required: true },
  { name: "assigned_on", label: "Assigned On", type: "date" },
  { name: "due_return_on", label: "Due Return", type: "date" },
  { name: "returned_on", label: "Returned On", type: "date" },
  { name: "return_condition", label: "Condition" },
  { name: "notes", label: "Notes", type: "textarea", colClass: "col-12", rows: 4 },
];

const AssetsPage = () => (
  <CrudOpsWorkspace
    endpoint="/asset-assignments/"
    title="Assets"
    subtitle="Manage issue, return, and offboarding asset recovery with employee-aware assignment tracking."
    kicker="Asset Assignment Desk"
    buttonLabel="Add Asset"
    searchPlaceholder="Smart search asset, code, employee, category"
    emptyTitle="No assets tracked yet"
    emptyDescription="Create the asset register so assignment, return, and offboarding recovery all stay visible."
    fields={fields}
    filters={[
      { name: "status", label: "Status", accessor: "status", options: STATUS_OPTIONS },
      { name: "category", label: "Category", accessor: "category.id", optionsKey: "categoryOptions" },
      { name: "employee", label: "Employee", accessor: "assigned_to.id", optionsKey: "employeeOptions" },
    ]}
    columns={[
      { label: "Asset", render: (record) => <div><div className="fw-semibold">{record.asset_name}</div><div className="text-muted small">{record.asset_code}</div></div> },
      { label: "Category", render: (record) => record.category?.name || "-" },
      { label: "Assigned To", render: (record) => record.assigned_to?.full_name || "Unassigned" },
      { label: "Dates", render: (record) => <div><div>{record.assigned_on || "-"}</div><div className="text-muted small">Due {record.due_return_on || "-"}</div></div> },
      { label: "Status", render: (record) => <span className={`payroll-badge ${record.status === "assigned" ? "accent" : record.status === "returned" ? "success" : record.status === "lost" ? "danger" : "warning"}`}>{record.status}</span> },
    ]}
    defaultForm={{ asset_name: "", asset_code: "", category_id: "", assigned_to_id: "", status: "available", assigned_on: "", due_return_on: "", returned_on: "", return_condition: "", notes: "" }}
    normalizeForm={(record) => ({ ...record, category_id: record.category?.id || "", assigned_to_id: record.assigned_to?.id || "" })}
    loadDependencies={async () => ({
      employeeOptions: await fetchEmployeeOptions(),
      categoryOptions: await fetchAssetCategoryOptions(),
    })}
    statsBuilder={(records) => [
      { label: "Assets", value: records.length, meta: "Tracked inventory items" },
      { label: "Assigned", value: records.filter((item) => item.status === "assigned").length, meta: `${records.filter((item) => item.status === "return_requested").length} return request(s)` },
      { label: "Returned", value: records.filter((item) => item.status === "returned").length, meta: "Recovered items" },
      { label: "Unassigned", value: records.filter((item) => item.status === "available").length, meta: "Ready to issue" },
    ]}
  />
);

export default AssetsPage;
