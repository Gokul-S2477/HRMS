import React from "react";
import CatalogWorkspace, { renderDateCell, renderStatusBadge } from "../hrm/CatalogWorkspace";

const STATUS_OPTIONS = ["Scheduled", "In Progress", "Completed"];
const RATING_OPTIONS = ["5 - Outstanding", "4 - Strong", "3 - Solid", "2 - Needs Support", "1 - Critical"];

const PerformanceAppraisal: React.FC = () => (
  <CatalogWorkspace
    resource="/data/performance-appraisals/"
    kicker="Appraisal Tracker"
    title="Performance Appraisal"
    subtitle="Manage appraisal outcomes with employee context, reviewer ownership, scores, and next-step notes."
    buttonLabel="Add Appraisal"
    emptyIcon="ti ti-chart-histogram"
    emptyTitle="No appraisals tracked yet"
    emptyDescription="Start logging appraisal cycles to keep employee growth conversations organized and searchable."
    initialForm={{
      employee_name: "",
      designation: "",
      department: "",
      reviewer: "",
      appraisal_date: "",
      rating: "4 - Strong",
      status: "Scheduled",
      summary: "",
    }}
    fields={[
      { name: "employee_name", label: "Employee Name", placeholder: "Asha Kumar", required: true },
      { name: "designation", label: "Designation", placeholder: "HR Manager" },
      { name: "department", label: "Department", placeholder: "Human Resources" },
      { name: "reviewer", label: "Reviewer", placeholder: "Leona Hart" },
      { name: "appraisal_date", label: "Appraisal Date", type: "date" },
      { name: "rating", label: "Rating", type: "select", options: RATING_OPTIONS },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { name: "summary", label: "Summary", type: "textarea", placeholder: "Key outcomes, coaching areas, and next review goals.", colClass: "col-12" },
    ]}
    filterOptions={[{ name: "status", label: "All statuses", options: STATUS_OPTIONS }]}
    dateField="appraisal_date"
    searchPlaceholder="Smart search employee, reviewer, department"
    quickFilters={[
      { key: "completed", label: "Completed", predicate: (record: any) => record.data?.status === "Completed" },
      { key: "needs-support", label: "Needs support", predicate: (record: any) => String(record.data?.rating || "").includes("Needs Support") || String(record.data?.rating || "").includes("Critical") },
    ]}
    columns={[
      {
        key: "employee_name",
        label: "Employee",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.employee_name || "-"}</div>
            <div className="payroll-secondary-text">
              {record.data?.designation || "Role pending"} • {record.data?.department || "Department pending"}
            </div>
          </div>
        ),
      },
      { key: "reviewer", label: "Reviewer", render: (record: any) => record.data?.reviewer || "-" },
      { key: "appraisal_date", label: "Appraisal Date", render: (record: any) => renderDateCell(record.data?.appraisal_date) },
      { key: "rating", label: "Rating", render: (record: any) => record.data?.rating || "-" },
      { key: "status", label: "Status", render: (record: any) => renderStatusBadge(record.data?.status) },
    ]}
    getStats={(records: any[]) => [
      { label: "Appraisals", value: records.length, meta: "Captured review outcomes" },
      { label: "Scheduled", value: records.filter((record) => record.data?.status === "Scheduled").length, meta: "Upcoming conversations" },
      { label: "Completed", value: records.filter((record) => record.data?.status === "Completed").length, meta: "Ready for follow-up plans" },
      { label: "In Progress", value: records.filter((record) => record.data?.status === "In Progress").length, meta: "Still being evaluated" },
    ]}
    getHighlights={(records: any[]) =>
      records.slice(0, 5).map((record) => ({
        label: record.data?.employee_name || "Employee",
        meta: record.data?.rating || "Rating pending",
        value: record.data?.status || "Scheduled",
        tone: record.data?.status === "Completed" ? "success" : record.data?.status === "In Progress" ? "warning" : "info",
      }))
    }
    preparePayload={(form: any) => ({
      ...form,
      employee_name: form.employee_name.trim(),
      designation: form.designation.trim(),
      department: form.department.trim(),
      reviewer: form.reviewer.trim(),
      summary: form.summary.trim(),
    })}
  />
);

export default PerformanceAppraisal;
