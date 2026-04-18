import React from "react";

import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CrudOpsWorkspace from "./CrudOpsWorkspace";
import { fetchDocumentCategoryOptions, fetchEmployeeOptions } from "./liveHelpers";
import { formatDisplayDate } from "../hrm/hrmShared";

const loadDependencies = async () => {
  const [employees, categories] = await Promise.all([
    fetchEmployeeOptions(),
    fetchDocumentCategoryOptions(),
  ]);
  return { employees, categories };
};

const EmployeeDocumentsPage = () => {
  const { role } = useAuth();
  const canVerify = role === "hr" || role === "super_admin";

  return (
  <CrudOpsWorkspace
    endpoint="/employee-documents/"
    title="Employee Documents"
    subtitle="Track policy files, IDs, contracts, expiries, and review status for every employee with self-service visibility and HR verification."
    kicker="Document Management"
    buttonLabel="Add Document"
    searchPlaceholder="Smart search employee, category, title, number"
    emptyTitle="No employee documents yet"
    emptyDescription="Upload the first compliance or employee file to start verification, renewal, and onboarding flows."
    loadDependencies={loadDependencies}
    fields={[
      { name: "employee_id", label: "Employee", type: "select", optionsKey: "employees" },
      { name: "category_id", label: "Category", type: "select", optionsKey: "categories" },
      { name: "title", label: "Title", required: true },
      { name: "file_name", label: "File Name" },
      { name: "document_url", label: "Document URL", type: "url" },
      { name: "document_number", label: "Document Number" },
      { name: "status", label: "Status", type: "select", options: [
        { value: "pending", label: "Pending Review" },
        { value: "verified", label: "Verified" },
        { value: "rejected", label: "Rejected" },
        { value: "expired", label: "Expired" },
      ] },
      { name: "issued_on", label: "Issued On", type: "date" },
      { name: "expires_on", label: "Expires On", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", colClass: "col-12" },
    ]}
    filters={[
      { name: "status", label: "Status", options: [
        { value: "pending", label: "Pending Review" },
        { value: "verified", label: "Verified" },
        { value: "rejected", label: "Rejected" },
        { value: "expired", label: "Expired" },
      ] },
      { name: "category.id", label: "Category", accessor: "category.id", optionsKey: "categories" },
    ]}
    columns={[
      { label: "Employee", render: (record) => <div><div className="fw-semibold">{record.employee?.full_name || "Employee"}</div><div className="text-muted small">{record.employee?.department_name || record.category?.name || "-"}</div></div> },
      { label: "Document", render: (record) => <div><div className="fw-semibold">{record.title}</div><div className="text-muted small">{record.document_number || record.file_name || record.category?.name || "-"}</div></div> },
      { label: "Dates", render: (record) => <div><div>Issued: {formatDisplayDate(record.issued_on)}</div><div className="text-muted small">Expires: {formatDisplayDate(record.expires_on)}</div></div> },
      { label: "Status", render: (record) => <span className={`payroll-badge ${record.status === "verified" ? "success" : record.status === "pending" ? "warning" : "danger"}`}>{record.status}</span> },
    ]}
    defaultForm={{
      employee_id: "",
      category_id: "",
      title: "",
      file_name: "",
      document_url: "",
      document_number: "",
      status: "pending",
      issued_on: "",
      expires_on: "",
      notes: "",
    }}
    normalizeForm={(record) => ({
      employee_id: record.employee?.id ? String(record.employee.id) : "",
      category_id: record.category?.id ? String(record.category.id) : "",
      title: record.title || "",
      file_name: record.file_name || "",
      document_url: record.document_url || "",
      document_number: record.document_number || "",
      status: record.status || "pending",
      issued_on: record.issued_on || "",
      expires_on: record.expires_on || "",
      notes: record.notes || "",
    })}
    buildPayload={(form) => form}
    statsBuilder={(records) => [
      { label: "Documents", value: records.length, meta: "Employee file register" },
      { label: "Pending Review", value: records.filter((item) => item.status === "pending").length, meta: "Need HR action" },
      { label: "Verified", value: records.filter((item) => item.status === "verified").length, meta: "Compliance ready" },
      { label: "Expiring Soon", value: records.filter((item) => item.expiring_soon).length, meta: "Renewal watchlist" },
    ]}
    extraRowActions={(record, { refresh }) => (
      canVerify && record.status !== "verified" ? (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={async () => {
            try {
              await API.put(`/employee-documents/${record.id}/`, {
                employee_id: record.employee?.id || null,
                category_id: record.category?.id || null,
                title: record.title,
                file_name: record.file_name || "",
                document_url: record.document_url || "",
                document_number: record.document_number || "",
                status: "verified",
                issued_on: record.issued_on || null,
                expires_on: record.expires_on || null,
                notes: record.notes || "",
              });
              refresh();
            } catch (error) {
              window.alert(error?.response?.data?.detail || "Unable to verify document.");
            }
          }}
        >
          Verify
        </button>
      ) : null
    )}
  />
  );
};

export default EmployeeDocumentsPage;
