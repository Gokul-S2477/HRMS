import React from "react";
import CatalogWorkspace, { renderDateCell, renderStatusBadge } from "../hrm/CatalogWorkspace";

const STATUS_OPTIONS = ["Active", "Inactive", "Review"];

const PerformanceIndicator: React.FC = () => (
  <CatalogWorkspace
    resource="/data/performance-indicators/"
    kicker="Performance Signals"
    title="Performance Indicator"
    subtitle="Maintain KPI blueprints for roles and departments with a cleaner management experience and stronger visibility."
    buttonLabel="Add Indicator"
    emptyIcon="ti ti-target-arrow"
    emptyTitle="No indicators configured"
    emptyDescription="Start with a few KPI blueprints so managers can anchor reviews on consistent expectations."
    initialForm={{
      designation: "",
      department: "",
      approved_by: "",
      reviewer_role: "",
      created_date: "",
      metric_focus: "",
      status: "Active",
      notes: "",
    }}
    fields={[
      { name: "designation", label: "Designation", placeholder: "Senior Developer", required: true },
      { name: "department", label: "Department", placeholder: "Engineering", required: true },
      { name: "approved_by", label: "Approved By", placeholder: "Leona Hart" },
      { name: "reviewer_role", label: "Reviewer Role", placeholder: "HR Manager" },
      { name: "created_date", label: "Created Date", type: "date" },
      { name: "metric_focus", label: "Metric Focus", placeholder: "Delivery, quality, teamwork" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: STATUS_OPTIONS,
      },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Add extra context for how this indicator should be applied.",
        colClass: "col-12",
      },
    ]}
    filterOptions={[{ name: "status", label: "All statuses", options: STATUS_OPTIONS }]}
    dateField="created_date"
    searchPlaceholder="Smart search designation, department, reviewer"
    quickFilters={[
      { key: "active", label: "Active", predicate: (record: any) => record.data?.status === "Active" },
      { key: "review", label: "Under review", predicate: (record: any) => record.data?.status === "Review" },
    ]}
    columns={[
      {
        key: "designation",
        label: "Designation",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.designation || "-"}</div>
            <div className="payroll-secondary-text">{record.data?.metric_focus || "KPI focus pending"}</div>
          </div>
        ),
      },
      { key: "department", label: "Department", render: (record: any) => record.data?.department || "-" },
      {
        key: "approved_by",
        label: "Approved By",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.approved_by || "-"}</div>
            <div className="payroll-secondary-text">{record.data?.reviewer_role || "Role not set"}</div>
          </div>
        ),
      },
      {
        key: "created_date",
        label: "Created Date",
        render: (record: any) => renderDateCell(record.data?.created_date),
      },
      { key: "status", label: "Status", render: (record: any) => renderStatusBadge(record.data?.status) },
    ]}
    getStats={(records: any[]) => [
      { label: "Indicator Sets", value: records.length, meta: "Role-based KPI blueprints" },
      {
        label: "Active",
        value: records.filter((record) => record.data?.status === "Active").length,
        meta: "Ready for review cycles",
      },
      {
        label: "Departments",
        value: new Set(records.map((record) => record.data?.department).filter(Boolean)).size,
        meta: "Cross-functional coverage",
      },
      {
        label: "Under Review",
        value: records.filter((record) => record.data?.status === "Review").length,
        meta: "Pending calibration",
      },
    ]}
    getHighlights={(records: any[]) =>
      records.slice(0, 5).map((record) => ({
        label: record.data?.designation || "Designation",
        meta: record.data?.department || "Department pending",
        value: record.data?.status || "Draft",
        tone: record.data?.status === "Active" ? "success" : record.data?.status === "Review" ? "warning" : "accent",
      }))
    }
    preparePayload={(form: any) => ({
      ...form,
      designation: form.designation.trim(),
      department: form.department.trim(),
      approved_by: form.approved_by.trim(),
      reviewer_role: form.reviewer_role.trim(),
      metric_focus: form.metric_focus.trim(),
      notes: form.notes.trim(),
    })}
  />
);

export default PerformanceIndicator;
