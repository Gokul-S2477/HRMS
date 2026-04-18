import React from "react";

import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";

const fields = [
  { name: "name", label: "Category Name", required: true },
  { name: "description", label: "Description", type: "textarea", colClass: "col-12", rows: 4 },
  { name: "is_active", label: "Active", type: "select", options: [{ value: true, label: "Active" }, { value: false, label: "Inactive" }], required: true },
];

const AssetCategoriesPage = () => (
  <CrudOpsWorkspace
    endpoint="/asset-categories/"
    title="Asset Categories"
    subtitle="Keep the hardware and statutory inventory catalog structured so assignment and return flows stay clean."
    kicker="Asset Library"
    buttonLabel="Add Category"
    searchPlaceholder="Smart search category name or notes"
    emptyTitle="No asset categories yet"
    emptyDescription="Create categories such as Laptop, ID Card, Phone, or Accessory to organize the assignment desk."
    fields={fields}
    filters={[
      { name: "is_active", label: "State", accessor: "is_active", options: [{ value: true, label: "Active" }, { value: false, label: "Inactive" }] },
    ]}
    columns={[
      { label: "Category", render: (record) => record.name },
      { label: "Description", render: (record) => record.description || "-" },
      { label: "State", render: (record) => <span className={`payroll-badge ${record.is_active ? "success" : "danger"}`}>{record.is_active ? "Active" : "Inactive"}</span> },
    ]}
    defaultForm={{ name: "", description: "", is_active: true }}
    buildPayload={(form) => ({ ...form, is_active: String(form.is_active) === "true" || form.is_active === true })}
    normalizeForm={(record) => ({ ...record, is_active: record.is_active })}
    statsBuilder={(records) => [
      { label: "Categories", value: records.length, meta: "Tracked asset groups" },
      { label: "Active", value: records.filter((item) => item.is_active).length, meta: "Available for assignment" },
      { label: "Inactive", value: records.filter((item) => !item.is_active).length, meta: "Hidden from issue desk" },
      { label: "Coverage", value: new Set(records.map((item) => item.name)).size, meta: "Catalog breadth" },
    ]}
  />
);

export default AssetCategoriesPage;
