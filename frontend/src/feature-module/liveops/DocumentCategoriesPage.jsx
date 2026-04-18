import React from "react";

import CrudOpsWorkspace from "./CrudOpsWorkspace";

const DocumentCategoriesPage = () => (
  <CrudOpsWorkspace
    endpoint="/document-categories/"
    title="Document Categories"
    subtitle="Define the identity, compliance, and employee-file categories used across onboarding, renewals, and verification workflows."
    kicker="Administration"
    buttonLabel="Add Category"
    searchPlaceholder="Smart search name, code, description"
    emptyTitle="No document categories yet"
    emptyDescription="Create reusable categories so employee files, onboarding checklists, and compliance reminders stay organized."
    fields={[
      { name: "name", label: "Category Name", required: true },
      { name: "code", label: "Code", required: true },
      { name: "visibility", label: "Visibility", type: "select", options: [
        { value: "employee", label: "Employee Visible" },
        { value: "hr", label: "HR Only" },
        { value: "private", label: "Private" },
      ] },
      { name: "is_active", label: "Active", type: "select", options: [
        { value: true, label: "Active" },
        { value: false, label: "Inactive" },
      ] },
      { name: "is_mandatory", label: "Mandatory", type: "select", options: [
        { value: true, label: "Mandatory" },
        { value: false, label: "Optional" },
      ] },
      { name: "requires_expiry", label: "Requires Expiry", type: "select", options: [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
      ] },
      { name: "description", label: "Description", type: "textarea", colClass: "col-12" },
    ]}
    filters={[
      { name: "visibility", label: "Visibility", options: [
        { value: "employee", label: "Employee Visible" },
        { value: "hr", label: "HR Only" },
        { value: "private", label: "Private" },
      ] },
    ]}
    columns={[
      { label: "Category", render: (record) => <div><div className="fw-semibold">{record.name}</div><div className="text-muted small">{record.code}</div></div> },
      { label: "Description", render: (record) => record.description || "-" },
      { label: "Rules", render: (record) => <div><div>{record.visibility}</div><div className="text-muted small">{record.requires_expiry ? "Expiry tracked" : "No expiry"}</div></div> },
      { label: "Status", render: (record) => <span className={`payroll-badge ${record.is_active ? "success" : "danger"}`}>{record.is_active ? "Active" : "Inactive"}</span> },
    ]}
    defaultForm={{
      name: "",
      code: "",
      visibility: "employee",
      is_active: true,
      is_mandatory: false,
      requires_expiry: false,
      description: "",
    }}
    normalizeForm={(record) => ({
      ...record,
      is_active: Boolean(record.is_active),
      is_mandatory: Boolean(record.is_mandatory),
      requires_expiry: Boolean(record.requires_expiry),
    })}
    buildPayload={(form) => ({
      ...form,
      is_active: String(form.is_active) === "true" || form.is_active === true,
      is_mandatory: String(form.is_mandatory) === "true" || form.is_mandatory === true,
      requires_expiry: String(form.requires_expiry) === "true" || form.requires_expiry === true,
    })}
    statsBuilder={(records) => [
      { label: "Categories", value: records.length, meta: "Document buckets" },
      { label: "Mandatory", value: records.filter((item) => item.is_mandatory).length, meta: "Required for people ops" },
      { label: "Expiry Tracked", value: records.filter((item) => item.requires_expiry).length, meta: "Renewal aware" },
      { label: "Employee Visible", value: records.filter((item) => item.visibility === "employee").length, meta: "Visible in self service" },
    ]}
  />
);

export default DocumentCategoriesPage;
