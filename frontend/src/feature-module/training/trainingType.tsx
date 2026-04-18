import React from "react";
import CatalogWorkspace, { renderStatusBadge } from "../hrm/CatalogWorkspace";

const STATUS_OPTIONS = ["Active", "Draft", "Archived"];
const CATEGORY_OPTIONS = ["Technical", "Compliance", "Leadership", "Communication"];

const TrainingType: React.FC = () => (
  <CatalogWorkspace
    resource="/data/training-types/"
    kicker="Training Catalog"
    title="Training Type"
    subtitle="Create a sharper training catalog with categories, audience notes, and status control for every learning type."
    buttonLabel="Add Training Type"
    emptyIcon="ti ti-school"
    emptyTitle="No training types defined"
    emptyDescription="Set up training categories first so sessions can reuse a structured learning catalog."
    initialForm={{
      type: "",
      category: "Technical",
      target_audience: "",
      description: "",
      status: "Active",
    }}
    fields={[
      { name: "type", label: "Type", placeholder: "React Essentials", required: true },
      { name: "category", label: "Category", type: "select", options: CATEGORY_OPTIONS },
      { name: "target_audience", label: "Target Audience", placeholder: "Frontend team, new joiners" },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { name: "description", label: "Description", type: "textarea", placeholder: "What this training covers and why it exists.", colClass: "col-12" },
    ]}
    filterOptions={[
      { name: "status", label: "All statuses", options: STATUS_OPTIONS },
      { name: "category", label: "All categories", options: CATEGORY_OPTIONS },
    ]}
    searchPlaceholder="Smart search training type, audience, category"
    quickFilters={[
      { key: "active", label: "Active", predicate: (record: any) => record.data?.status === "Active" },
      { key: "leadership", label: "Leadership", predicate: (record: any) => record.data?.category === "Leadership" },
    ]}
    columns={[
      {
        key: "type",
        label: "Training Type",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.type || "-"}</div>
            <div className="payroll-secondary-text">{record.data?.target_audience || "Audience pending"}</div>
          </div>
        ),
      },
      { key: "category", label: "Category", render: (record: any) => record.data?.category || "-" },
      { key: "description", label: "Description", render: (record: any) => record.data?.description || "-" },
      { key: "status", label: "Status", render: (record: any) => renderStatusBadge(record.data?.status) },
    ]}
    getStats={(records: any[]) => [
      { label: "Training Types", value: records.length, meta: "Reusable learning blueprints" },
      { label: "Active", value: records.filter((record) => record.data?.status === "Active").length, meta: "Ready to schedule" },
      { label: "Categories", value: new Set(records.map((record) => record.data?.category).filter(Boolean)).size, meta: "Coverage across learning themes" },
      { label: "Draft", value: records.filter((record) => record.data?.status === "Draft").length, meta: "Awaiting launch" },
    ]}
    getHighlights={(records: any[]) =>
      records.slice(0, 5).map((record) => ({
        label: record.data?.type || "Training Type",
        meta: record.data?.category || "Category pending",
        value: record.data?.status || "Draft",
        tone: record.data?.status === "Active" ? "success" : record.data?.status === "Draft" ? "warning" : "accent",
      }))
    }
    preparePayload={(form: any) => ({
      ...form,
      type: form.type.trim(),
      target_audience: form.target_audience.trim(),
      description: form.description.trim(),
    })}
  />
);

export default TrainingType;
