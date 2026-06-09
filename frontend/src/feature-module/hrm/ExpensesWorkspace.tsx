import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  fetchEmployeeDirectory,
  formatDisplayDate,
  isDateInRange,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "./hrmShared";

type ExpenseRecord = {
  id: string;
  employee?: {
    id: number;
    full_name: string;
    designation_title: string;
    emp_code: string;
  };
  title: string;
  category: string;
  amount: number | string;
  claim_date: string;
  receipt_file: string | null;
  status: string;
  reviewer_note: string;
  processed_in_payroll_id: number | null;
  created_at: string;
  updated_at: string;
};

type EmployeeOption = {
  id: string | number;
  name: string;
};

type ExpenseForm = {
  employee_id: string;
  title: string;
  category: string;
  amount: string;
  claim_date: string;
  receipt_file: File | null;
  status: string;
  reviewer_note: string;
};

type ExpensesWorkspaceProps = {
  resource: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  audience: string;
  mode: "employee" | "approval";
};

const STATUS_OPTIONS = ["Draft", "Pending", "Approved", "Rejected"];
const CATEGORY_OPTIONS = ["Travel", "Food", "Client", "Software", "Other"];

const emptyForm: ExpenseForm = {
  employee_id: "",
  title: "",
  category: "Other",
  amount: "",
  claim_date: "",
  receipt_file: null,
  status: "Pending",
  reviewer_note: "",
};

const formatCurrencyLocal = (value: number | string) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
};

const ExpensesWorkspace: React.FC<ExpensesWorkspaceProps> = ({
  resource,
  title,
  subtitle,
  buttonLabel,
  audience,
  mode,
}) => {
  const { role } = useAuth();
  const isEmployeeMode = mode === "employee";
  const canReview = mode === "approval";
  const canCreate = isEmployeeMode;

  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const expenseRes = await API.get(resource);
      const list = Array.isArray(expenseRes.data) ? expenseRes.data : expenseRes.data?.results || [];
      setRecords(list);

      if (canReview) {
        const employeeDirectory = (await fetchEmployeeDirectory()) as EmployeeOption[];
        setEmployees(Array.isArray(employeeDirectory) ? employeeDirectory : []);
      }
    } catch (error) {
      console.error("Failed to load expense records", error);
      setRecords([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [canReview, resource]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setForm({
      ...emptyForm,
      claim_date: new Date().toISOString().slice(0, 10),
    });
    setReceiptPreviewUrl(null);
    setShowModal(true);
  };

  const openEdit = (record: ExpenseRecord) => {
    setEditing(record);
    setForm({
      employee_id: record.employee?.id ? String(record.employee.id) : "",
      title: record.title,
      category: record.category,
      amount: String(record.amount),
      claim_date: record.claim_date,
      receipt_file: null,
      status: record.status,
      reviewer_note: record.reviewer_note || "",
    });
    setReceiptPreviewUrl(record.receipt_file);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setReceiptPreviewUrl(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setForm((current) => ({ ...current, receipt_file: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title || !form.amount || !form.claim_date) {
      window.alert("Title, amount, and date are required.");
      return;
    }

    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("category", form.category);
    formData.append("amount", form.amount);
    formData.append("claim_date", form.claim_date);
    
    if (form.receipt_file) {
      formData.append("receipt_file", form.receipt_file);
    }
    
    if (canReview) {
      formData.append("status", form.status);
      formData.append("reviewer_note", form.reviewer_note);
    } else {
      formData.append("status", "Pending");
    }

    setSaving(true);
    try {
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      if (editing) {
        await API.put(`${resource}${editing.id}/`, formData, config);
      } else {
        await API.post(resource, formData, config);
      }
      closeModal();
      setForm({ ...emptyForm });
      loadData();
    } catch (error: any) {
      console.error("Failed to save expense claim", error);
      window.alert(error?.response?.data?.detail || "Unable to save the expense record.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense claim?")) return;
    try {
      await API.delete(`${resource}${id}/`);
      loadData();
    } catch (error) {
      console.error("Failed to delete claim", error);
      window.alert("Unable to delete this claim.");
    }
  };

  const viewReceipt = (url: string) => {
    setActiveReceiptUrl(url);
    setShowReceiptModal(true);
  };

  const filteredRecords = useMemo(() => {
    return [...records]
      .filter((record) => {
        const matchesSearch = smartSearchMatch(record, search) ||
          (record.employee?.full_name || "").toLowerCase().includes(search.toLowerCase());
        const matchesEmployee = !employeeFilter || String(record.employee?.id || "") === employeeFilter;
        const matchesStatus = !statusFilter || record.status === statusFilter;
        const matchesCategory = !categoryFilter || record.category === categoryFilter;
        const matchesDate = isDateInRange(record.claim_date, dateFrom, dateTo);
        
        const matchesQuick =
          !quickFilter ||
          (quickFilter === "pending" && record.status === "Pending") ||
          (quickFilter === "high-amount" && Number(record.amount) >= 500) ||
          (quickFilter === "processed" && record.processed_in_payroll_id !== null) ||
          (quickFilter === "unprocessed" && record.processed_in_payroll_id === null && record.status === "Approved") ||
          (quickFilter === "has-receipt" && !!record.receipt_file);
          
        return (
          matchesSearch &&
          matchesEmployee &&
          matchesStatus &&
          matchesCategory &&
          matchesDate &&
          matchesQuick
        );
      })
      .sort((a, b) => b.claim_date.localeCompare(a.claim_date));
  }, [records, search, employeeFilter, statusFilter, categoryFilter, dateFrom, dateTo, quickFilter]);

  const stats = useMemo(() => {
    const totalAmount = filteredRecords
      .reduce((sum, record) => sum + Number(record.amount), 0);
    const approvedAmount = filteredRecords
      .filter((record) => record.status === "Approved")
      .reduce((sum, record) => sum + Number(record.amount), 0);
    const pendingCount = filteredRecords.filter((record) => record.status === "Pending").length;
    const processedCount = filteredRecords.filter((record) => record.processed_in_payroll_id !== null).length;

    return [
      {
        label: `${audience} Claims`,
        value: filteredRecords.length,
        meta: "Total claims submitted",
      },
      {
        label: "Total Amount",
        value: formatCurrencyLocal(totalAmount),
        meta: "Combined claim value",
      },
      {
        label: "Approved Reimbursements",
        value: formatCurrencyLocal(approvedAmount),
        meta: `${processedCount} processed in payroll`,
      },
      {
        label: "Pending Review",
        value: pendingCount,
        meta: "Claims awaiting HR review",
      },
    ];
  }, [audience, filteredRecords]);

  const highlights = useMemo(
    () =>
      filteredRecords.slice(0, 5).map((record) => ({
        label: record.title,
        meta: `${record.category} / ${record.employee?.full_name || "Self"}`,
        value: formatCurrencyLocal(record.amount),
        tone: statusTone(record.status),
      })),
    [filteredRecords]
  );

  const appliedFilters = activeFilterCount({
    search,
    employeeFilter,
    statusFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Reimbursement Desk"
          title={title}
          subtitle={subtitle}
          action={
            <>
              {canCreate ? (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <i className="ti ti-circle-plus me-2" />
                  {buttonLabel}
                </button>
              ) : null}
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-receipt" />
            Upload claims, attach receipt files, and track real-time approvals.
          </span>
          <span className="employee-chip">
            <i className="ti ti-currency-dollar" />
            Approved claims automatically roll over into monthly payslip payouts.
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header flex-column align-items-stretch">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5>{canReview ? "Claims Review Ledger" : "My Expense History"}</h5>
                    <div className="payroll-table-subtitle">
                      {canReview
                        ? "Verify receipts, approve/reject claims, and integrate them with the active employee payroll runs."
                        : "Submit receipts and track refund approvals from the corporate finance audit team."}
                    </div>
                  </div>
                </div>

                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder="Search claim, employee, note..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {canReview ? (
                    <select
                      className="form-select"
                      value={employeeFilter}
                      onChange={(event) => setEmployeeFilter(event.target.value)}
                    >
                      <option value="">All employees</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={String(employee.id)}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  
                  <select className="form-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="">All categories</option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <input type="date" className="form-control" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  <input type="date" className="form-control" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />

                  <div className="payroll-filter-actions">
                    <span className="payroll-filter-meta">
                      Filters <strong>{appliedFilters}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => {
                        setSearch("");
                        setEmployeeFilter("");
                        setStatusFilter("");
                        setCategoryFilter("");
                        setDateFrom("");
                        setDateTo("");
                        setQuickFilter("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="payroll-filter-actions mt-3">
                  {[
                    { key: "pending", label: "Pending Claims" },
                    { key: "high-amount", label: "High Value ($500+)" },
                    { key: "has-receipt", label: "With Receipt Doc" },
                    { key: "unprocessed", label: "Approved but Unpaid" },
                    { key: "processed", label: "Processed in Payroll" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`payroll-chip-toggle ${quickFilter === item.key ? "active" : ""}`}
                      onClick={() => setQuickFilter((current) => (current === item.key ? "" : item.key))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="payroll-table-shell">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        {canReview && <th>Employee</th>}
                        <th>Claim Title</th>
                        <th>Category</th>
                        <th>Claim Date</th>
                        <th className="text-end">Amount</th>
                        <th>Receipt</th>
                        <th>Status</th>
                        <th>Payroll Sync</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={canReview ? 9 : 8} className="text-center py-5">
                            Loading expense claims...
                          </td>
                        </tr>
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={canReview ? 9 : 8}>
                            <HrmEmptyState
                              icon="ti ti-receipt-off"
                              title="No expense claims found"
                              description="Reimbursement logs and receipt audit details will appear in this workspace."
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record) => (
                          <tr key={record.id}>
                            {canReview && (
                              <td>
                                <div className="payroll-primary-text">{record.employee?.full_name || "-"}</div>
                                <div className="payroll-secondary-text">Code: {record.employee?.emp_code || "-"}</div>
                              </td>
                            )}
                            <td>
                              <div className="payroll-primary-text">{record.title}</div>
                              {record.reviewer_note && (
                                <div className="payroll-secondary-text text-truncate" style={{ maxWidth: "180px" }} title={record.reviewer_note}>
                                  Note: {record.reviewer_note}
                                </div>
                              )}
                            </td>
                            <td>{record.category}</td>
                            <td>{formatDisplayDate(record.claim_date)}</td>
                            <td className="text-end fw-semibold text-dark">{formatCurrencyLocal(record.amount)}</td>
                            <td>
                              {record.receipt_file ? (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline-primary d-inline-flex align-items-center"
                                  onClick={() => viewReceipt(record.receipt_file!)}
                                >
                                  <i className="ti ti-paperclip me-1" /> View Receipt
                                </button>
                              ) : (
                                <span className="text-muted small">No receipt</span>
                              )}
                            </td>
                            <td>
                              <span className={`payroll-badge ${toneClass(statusTone(record.status))}`}>
                                {record.status}
                              </span>
                            </td>
                            <td>
                              {record.processed_in_payroll_id ? (
                                <span className="badge bg-success-transparent text-success">
                                  <i className="ti ti-check me-1" /> Processed (ID: {record.processed_in_payroll_id})
                                </span>
                              ) : record.status === "Approved" ? (
                                <span className="badge bg-warning-transparent text-warning">
                                  <i className="ti ti-refresh me-1" /> Queued for Payout
                                </span>
                              ) : (
                                <span className="text-muted small">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end gap-2">
                                {canReview ? (
                                  <button type="button" className="btn btn-sm btn-light" onClick={() => openEdit(record)}>
                                    <i className="ti ti-edit-circle me-1" /> Review
                                  </button>
                                ) : (
                                  <>
                                    {record.status !== "Approved" && record.processed_in_payroll_id === null ? (
                                      <>
                                        <button type="button" className="btn btn-sm btn-light" onClick={() => openEdit(record)}>
                                          Edit
                                        </button>
                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteRecord(record.id)}>
                                          Delete
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-muted small">Locked</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="d-flex flex-column gap-4">
              <HrmSideList
                title="Recent Activity"
                items={highlights}
                emptyLabel="No recent claims logged."
              />
            </div>
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? (canReview ? "Review Reimbursement Claim" : "Update Claim") : buttonLabel}
        subtitle={
          canReview
            ? "Inspect receipt details and update status. Approved claims automatically add to payroll calculations."
            : "Describe the reimbursement claim, upload receipt documents, and track approval status."
        }
        onClose={closeModal}
        onSubmit={saveRecord}
        submitLabel={saving ? "Saving..." : editing ? (canReview ? "Submit Review" : "Save Changes") : buttonLabel}
        summary={
          <div className="payroll-summary-list">
            {[
              { label: "Claim Title", value: form.title || "-" },
              { label: "Category", value: form.category || "-" },
              { label: "Claim Date", value: formatDisplayDate(form.claim_date) },
              { label: "Amount Requested", value: formatCurrencyLocal(form.amount) },
              { label: "Status", value: form.status || "Pending" },
            ].map((item) => (
              <div key={item.label} className="payroll-summary-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        }
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label">Claim Title</label>
                <input
                  className="form-control"
                  value={form.title}
                  readOnly={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="e.g., Client Dinner at City Bistro, Software SaaS License"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Expense Category</label>
                <select
                  className="form-select"
                  value={form.category}
                  disabled={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Claim Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.claim_date}
                  disabled={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, claim_date: event.target.value }))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Requested Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={form.amount}
                  disabled={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Review Status</label>
                {canReview ? (
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="form-control" value={form.status} readOnly />
                )}
              </div>

              <div className="col-md-12">
                <label className="form-label">Receipt File Upload</label>
                {!canReview ? (
                  <div className="d-flex flex-column gap-2">
                    <input type="file" className="form-control" onChange={handleFileChange} accept="image/*,application/pdf" />
                    {receiptPreviewUrl && (
                      <div className="mt-2 border rounded p-2 bg-light text-center" style={{ maxHeight: "200px", overflow: "hidden" }}>
                        {receiptPreviewUrl.startsWith("data:application/pdf") || receiptPreviewUrl.endsWith(".pdf") ? (
                          <div className="p-3"><i className="ti ti-file-pdf fs-1 text-danger mb-2" /><br />PDF File Attached</div>
                        ) : (
                          <img src={receiptPreviewUrl} alt="Receipt Preview" style={{ maxWidth: "100%", maxHeight: "180px", objectFit: "contain" }} />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded p-3 bg-light text-center">
                    {receiptPreviewUrl ? (
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={() => viewReceipt(receiptPreviewUrl)}
                      >
                        <i className="ti ti-paperclip me-1" /> Open Uploaded Receipt Document
                      </button>
                    ) : (
                      <span className="text-muted small">No receipt document attached.</span>
                    )}
                  </div>
                )}
              </div>

              {canReview && (
                <div className="col-md-12">
                  <label className="form-label">Reviewer Audit Remarks</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.reviewer_note}
                    onChange={(event) => setForm((current) => ({ ...current, reviewer_note: event.target.value }))}
                    placeholder="Enter audit notes regarding verification or rejection reasons..."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </HrmModal>

      {/* Receipt Preview Modal */}
      {showReceiptModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Receipt Document</h5>
                <button type="button" className="btn-close" onClick={() => setShowReceiptModal(false)}></button>
              </div>
              <div className="modal-body text-center bg-light" style={{ minHeight: "300px" }}>
                {activeReceiptUrl ? (
                  activeReceiptUrl.toLowerCase().includes(".pdf") ? (
                    <embed src={activeReceiptUrl} width="100%" height="500px" type="application/pdf" />
                  ) : (
                    <img src={activeReceiptUrl} alt="Receipt Details" style={{ maxWidth: "100%", maxHeight: "600px", objectFit: "contain" }} />
                  )
                ) : (
                  <span className="text-muted">Unable to load receipt.</span>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>Close View</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesWorkspace;
