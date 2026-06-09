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

type LeaveRecord = {
  id: string;
  data?: Record<string, any>;
};

type EmployeeOption = {
  id: string | number;
  name: string;
};

type LeaveBalanceRecord = {
  id: number;
  leave_type?: string;
  available?: number | string;
  pending?: number | string;
  used?: number | string;
};

type LeaveForm = {
  employee_id: string;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  status: string;
  reason: string;
  notice_timing: string;
  approval_context: string;
  approval_note: string;
  approved_by: string;
  approved_role: string;
  approved_at: string;
  reviewed_by: string;
  reviewed_role: string;
  reviewed_at: string;
  requested_on: string;
};

type LeavesWorkspaceProps = {
  resource: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  audience: string;
  mode: "employee" | "approval";
};

const STATUS_OPTIONS = ["Pending", "Approved", "Rejected"];
const LEAVE_TYPE_OPTIONS = ["Casual", "Sick", "Earned", "Maternity", "Paternity", "Optional"];
const NOTICE_OPTIONS = ["Pre-informed", "Post-informed"];

const emptyForm: LeaveForm = {
  employee_id: "",
  employee_name: "",
  leave_type: "Casual",
  from_date: "",
  to_date: "",
  status: "Pending",
  reason: "",
  notice_timing: "",
  approval_context: "",
  approval_note: "",
  approved_by: "",
  approved_role: "",
  approved_at: "",
  reviewed_by: "",
  reviewed_role: "",
  reviewed_at: "",
  requested_on: "",
};

const leaveDays = (from?: string, to?: string) => {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return diff > 0 ? diff : 0;
};

const defaultApprovalContext = (noticeTiming: string) => {
  if (noticeTiming === "Pre-informed") return "Applied before leave";
  if (noticeTiming === "Post-informed") return "Reported after leave";
  return "";
};

const LeavesWorkspace: React.FC<LeavesWorkspaceProps> = ({
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
  const isStakeholderReviewer = role === "stakeholder";

  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [noticeFilter, setNoticeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LeaveRecord | null>(null);
  const [form, setForm] = useState<LeaveForm>(emptyForm);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"requests" | "ledger">("requests");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const leaveRes = await API.get(resource);
      const list = Array.isArray(leaveRes.data) ? leaveRes.data : leaveRes.data?.results || [];
      setRecords(list);

      const ledgerRes = await API.get("/leave-ledger/");
      const ledgerList = Array.isArray(ledgerRes.data) ? ledgerRes.data : ledgerRes.data?.results || [];
      setLedgerEntries(ledgerList);

      if (canReview) {
        const employeeDirectory = (await fetchEmployeeDirectory()) as EmployeeOption[];
        setEmployees(Array.isArray(employeeDirectory) ? employeeDirectory : []);
        setLeaveBalances([]);
      } else {
        setEmployees([]);
        const balanceRes = await API.get("/leave-balances/");
        const balanceList = Array.isArray(balanceRes.data) ? balanceRes.data : balanceRes.data?.results || [];
        setLeaveBalances(balanceList);
      }
    } catch (error) {
      console.error("Failed to load leave records", error);
      setRecords([]);
      setEmployees([]);
      setLeaveBalances([]);
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
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (record: LeaveRecord) => {
    setEditing(record);
    setForm({
      ...emptyForm,
      ...record.data,
      employee_id: record.data?.employee_id ? String(record.data.employee_id) : "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.from_date || !form.to_date) {
      window.alert("Leave dates are required.");
      return;
    }

    const requestedDays = leaveDays(form.from_date, form.to_date);
    if (requestedDays <= 0) {
      window.alert("Please select a valid date range.");
      return;
    }

    if (isEmployeeMode) {
      const balance = leaveBalances.find((item) => {
        const bt = (item.leave_type || "").toLowerCase();
        const ft = (form.leave_type || "").toLowerCase();
        return bt === ft || bt.includes(ft) || ft.includes(bt);
      });
      const available = balance ? Number(balance.available || 0) : 0;
      if (requestedDays > available) {
        window.alert(
          `Unable to submit request. You requested ${requestedDays} day(s), but your available ${form.leave_type} balance is only ${available} day(s).`
        );
        return;
      }
    }

    const employee = employees.find((item) => String(item.id) === String(form.employee_id));
    const payload: LeaveForm = {
      ...form,
      employee_name: employee?.name || form.employee_name,
    };

    if (isEmployeeMode) {
      payload.status = "Pending";
      payload.notice_timing = "";
      payload.approval_context = "";
      payload.approval_note = "";
      payload.approved_by = "";
      payload.approved_role = "";
      payload.approved_at = "";
      payload.reviewed_by = "";
      payload.reviewed_role = "";
      payload.reviewed_at = "";
    }

    if (canReview) {
      if (!payload.status) {
        window.alert("Choose a review status.");
        return;
      }
      if (!payload.notice_timing) {
        window.alert("Choose whether the leave was pre-informed or post-informed.");
        return;
      }
      payload.approval_context = payload.approval_context || defaultApprovalContext(payload.notice_timing);
    }

    setSaving(true);
    try {
      if (editing) {
        await API.put(`${resource}${editing.id}/`, { data: payload });
      } else {
        await API.post(resource, { data: payload });
      }
      closeModal();
      setForm({ ...emptyForm });
      loadData();
    } catch (error: any) {
      console.error("Failed to save leave record", error);
      window.alert(error?.response?.data?.detail || "Unable to save the leave record.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekText = nextWeek.toISOString().slice(0, 10);

    return [...records]
      .filter((record) => {
        const data = record.data || {};
        const days = leaveDays(data.from_date, data.to_date);
        const matchesSearch = smartSearchMatch(data, search);
        const matchesEmployee = !employeeFilter || String(data.employee_id || "") === employeeFilter;
        const matchesStatus = !statusFilter || data.status === statusFilter;
        const matchesLeaveType = !leaveTypeFilter || data.leave_type === leaveTypeFilter;
        const matchesNotice = !noticeFilter || data.notice_timing === noticeFilter;
        const matchesDate =
          (!dateFrom && !dateTo) ||
          isDateInRange(data.from_date, dateFrom, dateTo) ||
          isDateInRange(data.to_date, dateFrom, dateTo);
        const matchesQuick =
          !quickFilter ||
          (quickFilter === "pending" && data.status === "Pending") ||
          (quickFilter === "long-leave" && days >= 3) ||
          (quickFilter === "pre-informed" && data.notice_timing === "Pre-informed") ||
          (quickFilter === "post-informed" && data.notice_timing === "Post-informed") ||
          (quickFilter === "starting-soon" && isDateInRange(data.from_date, today, nextWeekText));
        return (
          matchesSearch &&
          matchesEmployee &&
          matchesStatus &&
          matchesLeaveType &&
          matchesNotice &&
          matchesDate &&
          matchesQuick
        );
      })
      .sort((left, right) => String(right.data?.from_date || "").localeCompare(String(left.data?.from_date || "")));
  }, [records, search, employeeFilter, statusFilter, leaveTypeFilter, noticeFilter, dateFrom, dateTo, quickFilter]);

  const stats = useMemo(() => {
    const pending = filteredRecords.filter((record) => record.data?.status === "Pending").length;
    const approved = filteredRecords.filter((record) => record.data?.status === "Approved").length;
    const preInformedDays = filteredRecords
      .filter((record) => record.data?.notice_timing === "Pre-informed" && record.data?.status === "Approved")
      .reduce((sum, record) => sum + leaveDays(record.data?.from_date, record.data?.to_date), 0);
    const postInformedDays = filteredRecords
      .filter((record) => record.data?.notice_timing === "Post-informed" && record.data?.status === "Approved")
      .reduce((sum, record) => sum + leaveDays(record.data?.from_date, record.data?.to_date), 0);

    return [
      {
        label: `${audience} Requests`,
        value: filteredRecords.length,
        meta: "Leave visibility across the workspace",
      },
      { label: "Pending", value: pending, meta: "Still awaiting review" },
      { label: "Approved", value: approved, meta: "Actioned by HR or stakeholder reviewer" },
      {
        label: "Pre / Post Informed Days",
        value: `${preInformedDays} / ${postInformedDays}`,
        meta: "Track compliant vs late leave notification",
      },
    ];
  }, [audience, filteredRecords]);

  const highlights = useMemo(
    () =>
      filteredRecords.slice(0, 5).map((record) => ({
        label: record.data?.employee_name || "Employee",
        meta: `${record.data?.leave_type || "Leave"} / ${record.data?.notice_timing || "Awaiting review"}`,
        value: record.data?.approved_by || record.data?.reviewed_by || record.data?.status || "Pending",
        tone: statusTone(record.data?.status),
      })),
    [filteredRecords]
  );

  const balanceHighlights = useMemo(
    () =>
      leaveBalances.map((balance) => ({
        label: balance.leave_type || "Leave Type",
        meta: `${balance.pending || 0} pending / ${balance.used || 0} used`,
        value: `${balance.available || 0} left`,
        tone: Number(balance.available || 0) > 0 ? "success" : "warning",
      })),
    [leaveBalances]
  );

  const appliedFilters = activeFilterCount({
    search,
    employeeFilter,
    statusFilter,
    leaveTypeFilter,
    noticeFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Leave Desk"
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
            <i className="ti ti-calendar-check" />
            {canReview
              ? "Approve or reject requests with informed-before vs informed-after tracking"
              : "Submit requests and see whether HR marked them pre-informed or post-informed"}
          </span>
          <span className="employee-chip">
            <i className="ti ti-users" />
            {canReview
              ? "Stakeholders and HR can action requests with reviewer audit history"
              : "Employees can only request leave from this desk"}
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header flex-column align-items-stretch">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5>{canReview ? "Leave Approval Register" : "My Leave Requests"}</h5>
                    <div className="payroll-table-subtitle">
                      {canReview
                        ? "Review requests, mark whether they were informed before or after leave, and keep reviewer visibility attached to each case."
                        : "Track each leave request and see who approved it and whether it was treated as pre-informed or post-informed."}
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTab === "requests" ? "btn-primary" : "btn-light"}`}
                      style={{ borderRadius: "8px", fontWeight: "600" }}
                      onClick={() => setActiveTab("requests")}
                    >
                      Leave Requests
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTab === "ledger" ? "btn-primary" : "btn-light"}`}
                      style={{ borderRadius: "8px", fontWeight: "600" }}
                      onClick={() => setActiveTab("ledger")}
                    >
                      Ledger History
                    </button>
                  </div>
                </div>

                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder={activeTab === "requests" ? "Smart search employee, reason, leave type" : "Search ledger entries..."}
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

                  {activeTab === "requests" && (
                    <>
                      <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="">All statuses</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <select className="form-select" value={leaveTypeFilter} onChange={(event) => setLeaveTypeFilter(event.target.value)}>
                        <option value="">All leave types</option>
                        {LEAVE_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <select className="form-select" value={noticeFilter} onChange={(event) => setNoticeFilter(event.target.value)}>
                        <option value="">All notice types</option>
                        {NOTICE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <input type="date" className="form-control" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                      <input type="date" className="form-control" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    </>
                  )}

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
                        setLeaveTypeFilter("");
                        setNoticeFilter("");
                        setDateFrom("");
                        setDateTo("");
                        setQuickFilter("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {activeTab === "requests" && (
                  <div className="payroll-filter-actions mt-3">
                    {[
                      { key: "pending", label: "Pending" },
                      { key: "long-leave", label: "3+ days" },
                      { key: "pre-informed", label: "Pre-informed" },
                      { key: "post-informed", label: "Post-informed" },
                      { key: "starting-soon", label: "Starting soon" },
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
                )}
              </div>

              <div className="payroll-table-shell">
                {activeTab === "requests" ? (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Leave Type</th>
                          <th>Duration</th>
                          <th>Days</th>
                          <th>Status</th>
                          <th>Notice Type</th>
                          <th>Reviewed By</th>
                          <th>Reason</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={9} className="text-center py-5">
                              Loading leave requests...
                            </td>
                          </tr>
                        ) : filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan={9}>
                              <HrmEmptyState
                                icon="ti ti-calendar-off"
                                title="No leave requests in this view"
                                description="Try clearing filters or ask an employee to submit a leave request to start the workflow."
                              />
                            </td>
                          </tr>
                        ) : (
                          filteredRecords.map((record) => (
                            <tr key={record.id}>
                              <td>
                                <div className="payroll-primary-text">{record.data?.employee_name || "-"}</div>
                                <div className="payroll-secondary-text">Employee ID {record.data?.employee_id || "-"}</div>
                              </td>
                              <td>{record.data?.leave_type || "-"}</td>
                              <td>
                                <div className="payroll-primary-text">{formatDisplayDate(record.data?.from_date)}</div>
                                <div className="payroll-secondary-text">to {formatDisplayDate(record.data?.to_date)}</div>
                              </td>
                              <td>{leaveDays(record.data?.from_date, record.data?.to_date) || "-"}</td>
                              <td>
                                <span className={`payroll-badge ${toneClass(statusTone(record.data?.status))}`}>
                                  {record.data?.status || "Pending"}
                                </span>
                              </td>
                              <td>
                                <div className="payroll-primary-text">{record.data?.notice_timing || "Awaiting review"}</div>
                                <div className="payroll-secondary-text">{record.data?.approval_context || "No reviewer note yet"}</div>
                              </td>
                              <td>
                                <div className="payroll-primary-text">{record.data?.approved_by || record.data?.reviewed_by || "-"}</div>
                                <div className="payroll-secondary-text">{record.data?.approved_role || record.data?.reviewed_role || "-"}</div>
                              </td>
                              <td>{record.data?.reason || "-"}</td>
                              <td className="text-end">
                                {canReview ? (
                                  <button type="button" className="btn btn-sm btn-light" onClick={() => openEdit(record)}>
                                    <i className="ti ti-checkup-list me-1" /> Review
                                  </button>
                                ) : (
                                  <span className="text-muted small">Request only</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Date</th>
                          {canReview && <th>Employee</th>}
                          <th>Leave Type</th>
                          <th>Transaction</th>
                          <th className="text-center">Adjustment (Days)</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={canReview ? 6 : 5} className="text-center py-5">
                              Loading leave ledger...
                            </td>
                          </tr>
                        ) : ledgerEntries.length === 0 ? (
                          <tr>
                            <td colSpan={canReview ? 6 : 5}>
                              <HrmEmptyState
                                icon="ti ti-history"
                                title="No ledger entries found"
                                description="Adjustments, approvals, and monthly accruals will be logged here."
                              />
                            </td>
                          </tr>
                        ) : (
                          ledgerEntries
                            .filter((entry) => {
                              const matchesSearch = smartSearchMatch(entry, search) ||
                                String(entry.employee_name || entry.employee?.first_name || "").toLowerCase().includes(search.toLowerCase());
                              const matchesEmployee = !employeeFilter || String(entry.employee?.id || entry.employee || "") === employeeFilter;
                              return matchesSearch && matchesEmployee;
                            })
                            .map((entry) => {
                              const isDebit = ["approved_debit", "pending_hold"].includes(entry.entry_type);
                              const daysNum = parseFloat(entry.days);
                              
                              let txLabel = entry.entry_type;
                              let txTone = "info";
                              if (entry.entry_type === "allocation") {
                                txLabel = "Accrual Credit";
                                txTone = "success";
                              } else if (entry.entry_type === "carry_forward") {
                                txLabel = "Carry Forward";
                                txTone = "success";
                              } else if (entry.entry_type === "pending_hold") {
                                txLabel = "Pending Hold";
                                txTone = "warning";
                              } else if (entry.entry_type === "approved_debit") {
                                txLabel = "Approved Debit";
                                txTone = "danger";
                              } else if (entry.entry_type === "adjustment") {
                                txLabel = "Adjustment";
                                txTone = daysNum >= 0 ? "success" : "danger";
                              }

                              return (
                                <tr key={entry.id}>
                                  <td>{formatDisplayDate(entry.created_at)}</td>
                                  {canReview && (
                                    <td>
                                      <div className="fw-semibold">
                                        {entry.employee?.first_name || entry.employee_name || "Employee"} {entry.employee?.last_name || ""}
                                      </div>
                                      <div className="text-muted small">Code: {entry.employee?.emp_code || "N/A"}</div>
                                    </td>
                                  )}
                                  <td>{entry.leave_type}</td>
                                  <td>
                                    <span className={`payroll-badge ${toneClass(txTone)}`}>
                                      {txLabel}
                                    </span>
                                  </td>
                                  <td className={`text-center fw-bold ${isDebit || (entry.entry_type === "adjustment" && daysNum < 0) ? "text-danger" : "text-success"}`}>
                                    {isDebit || (entry.entry_type === "adjustment" && daysNum < 0) ? "-" : "+"}
                                    {Math.abs(daysNum).toFixed(1)}
                                  </td>
                                  <td className="text-muted small">{entry.description || "System log"}</td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="d-flex flex-column gap-4">
              <HrmSideList
                title="Highlights"
                items={highlights}
                emptyLabel="Recent leave activity will appear here."
              />
              {!canReview ? (
                <HrmSideList
                  title="Leave Balances"
                  items={balanceHighlights}
                  emptyLabel="Leave balances will appear after your first request is calculated."
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? (canReview ? `Review ${title}` : `Update ${title}`) : buttonLabel}
        subtitle={
          canReview
            ? "Approve or reject the leave, capture whether it was informed before or after the leave date, and attach a reviewer note."
            : "Submit your leave request. Status and approval details are handled by HR or stakeholder reviewers."
        }
        onClose={closeModal}
        onSubmit={saveRecord}
        submitLabel={saving ? "Saving..." : editing ? (canReview ? "Save Review" : "Save Changes") : buttonLabel}
        summary={
          <div className="payroll-summary-list">
            {[
              { label: "Employee", value: form.employee_name || "Self-service request" },
              { label: "Leave Type", value: form.leave_type || "-" },
              {
                label: "Dates",
                value: form.from_date ? `${formatDisplayDate(form.from_date)} to ${formatDisplayDate(form.to_date)}` : "-",
              },
              { label: "Days", value: leaveDays(form.from_date, form.to_date) || "-" },
              { label: "Status", value: form.status || "Pending" },
              { label: "Notice", value: form.notice_timing || "Pending reviewer classification" },
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
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">{canReview ? "Request and Approval Details" : "Leave Request Details"}</h5>
            </div>
            <div className="row g-3">
              {canReview ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Employee</label>
                    <input className="form-control" value={form.employee_name || "-"} readOnly />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Requested On</label>
                    <input className="form-control" value={formatDisplayDate(form.requested_on) || "-"} readOnly />
                  </div>
                </>
              ) : null}
              <div className="col-md-6">
                <label className="form-label">Leave Type</label>
                <select
                  className="form-select"
                  value={form.leave_type}
                  disabled={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, leave_type: event.target.value }))}
                >
                  {LEAVE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Status</label>
                {canReview ? (
                  <select className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="form-control" value="Pending review" readOnly />
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.from_date}
                  disabled={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, from_date: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.to_date}
                  disabled={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, to_date: event.target.value }))}
                />
              </div>
              {canReview ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Leave Notice Type</label>
                    <select
                      className="form-select"
                      value={form.notice_timing}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notice_timing: event.target.value,
                          approval_context:
                            current.approval_context || !event.target.value
                              ? current.approval_context
                              : defaultApprovalContext(event.target.value),
                        }))
                      }
                    >
                      <option value="">Select notice type</option>
                      {NOTICE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Review Label</label>
                    <input
                      className="form-control"
                      value={form.approval_context}
                      onChange={(event) => setForm((current) => ({ ...current, approval_context: event.target.value }))}
                      placeholder="Applied before leave / Reported after leave"
                    />
                  </div>
                </>
              ) : null}
              <div className="col-12">
                <label className="form-label">Reason</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.reason}
                  readOnly={canReview}
                  onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Reason and handover context"
                />
              </div>
              {canReview ? (
                <div className="col-12">
                  <label className="form-label">Reviewer Note</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.approval_note}
                    onChange={(event) => setForm((current) => ({ ...current, approval_note: event.target.value }))}
                    placeholder={isStakeholderReviewer ? "Stakeholder review note" : "HR review note"}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </HrmModal>
    </div>
  );
};

export default LeavesWorkspace;






