import React, { useCallback, useEffect, useMemo, useState } from "react";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import API from "../../api/axios";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  fetchEmployeeDirectory,
  formatCurrency,
  formatDisplayDate,
  initialEmployeePayload,
  isDateInRange,
  smartSearchMatch,
  normalizeResourceRecords,
  selectEmployee,
  statusTone,
  toneClass,
} from "../hrm/hrmShared";

const MODE_CONFIG = {
  promotion: {
    kicker: "Promotion Planner",
    buttonLabel: "Add Promotion",
    emptyIcon: "ti ti-arrow-up-right-circle",
    emptyTitle: "No promotions logged yet",
    emptyDescription: "Track internal growth decisions with effective dates and compensation notes.",
    statusOptions: ["Planned", "Approved", "Completed"],
    reasonOptions: ["Career Growth", "Performance Reward", "Internal Mobility"],
    primaryDateKey: "promotion_date",
    primaryDateLabel: "Promotion Date",
  },
  resignation: {
    kicker: "Exit Pipeline",
    buttonLabel: "Add Resignation",
    emptyIcon: "ti ti-door-exit",
    emptyTitle: "No resignations logged yet",
    emptyDescription: "Capture notice windows, handovers, and final exit dates in one place.",
    statusOptions: ["Submitted", "Accepted", "Completed"],
    reasonOptions: ["Career Change", "Relocation", "Personal Reasons", "Further Study"],
    primaryDateKey: "resignation_date",
    primaryDateLabel: "Resignation Date",
  },
  termination: {
    kicker: "Compliance Tracker",
    buttonLabel: "Add Termination",
    emptyIcon: "ti ti-user-x",
    emptyTitle: "No termination cases logged yet",
    emptyDescription: "Track formal termination workflows, notice dates, and settlement progress.",
    statusOptions: ["Review", "Approved", "Completed"],
    reasonOptions: ["Retirement", "Layoff", "Insubordination", "Breach of Contract", "Lack of Skills", "Other"],
    primaryDateKey: "termination_date",
    primaryDateLabel: "Termination Date",
  },
};

const buildEmptyForm = (mode) => {
  if (mode === "promotion") {
    return {
      employee_id: "",
      employee_name: "",
      department: "",
      designation_from: "",
      designation_to: "",
      promotion_date: "",
      status: "Planned",
      change_reason: "Career Growth",
      salary_change: "",
      notes: "",
    };
  }
  if (mode === "resignation") {
    return {
      employee_id: "",
      employee_name: "",
      department: "",
      reason: "Career Change",
      notice_date: "",
      resignation_date: "",
      status: "Submitted",
      handover_status: "Pending",
      notes: "",
    };
  }
  return {
    employee_id: "",
    employee_name: "",
    department: "",
    termination_type: "Retirement",
    notice_date: "",
    termination_date: "",
    status: "Review",
    settlement_status: "Pending",
    reason: "",
    notes: "",
  };
};

const MovementWorkspace = ({ mode, resource, title, subtitle }) => {
  const config = MODE_CONFIG[mode];
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(buildEmptyForm(mode));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordResponse, employeeDirectory] = await Promise.all([
        API.get(resource),
        fetchEmployeeDirectory(),
      ]);
      setRecords(normalizeResourceRecords(recordResponse.data));
      setEmployees(employeeDirectory);
    } catch (error) {
      console.error(`Failed to load ${mode} records`, error);
      setRecords([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [mode, resource]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedEmployee = useMemo(
    () => selectEmployee(employees, form.employee_id),
    [employees, form.employee_id]
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))),
    [employees]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(buildEmptyForm(mode));
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      ...buildEmptyForm(mode),
      ...record.data,
      employee_id: record.data?.employee_id ? String(record.data.employee_id) : "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const updateEmployeeContext = (employeeId) => {
    const employee = selectEmployee(employees, employeeId);
    if (!employee) {
      setForm((current) => ({ ...current, employee_id: employeeId }));
      return;
    }
    setForm((current) => ({
      ...current,
      ...initialEmployeePayload(employee),
      ...(mode === "promotion" ? { designation_from: employee.designation || current.designation_from } : {}),
    }));
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    if (!form.employee_id) {
      window.alert("Select an employee first.");
      return;
    }
    const employee = selectEmployee(employees, form.employee_id);
    const payload = {
      ...form,
      employee_name: employee?.name || form.employee_name,
      department: employee?.department || form.department,
    };

    setSaving(true);
    try {
      if (editing) {
        await API.put(`${resource}${editing.id}/`, { data: payload });
      } else {
        await API.post(resource, { data: payload });
      }
      closeModal();
      setForm(buildEmptyForm(mode));
      loadData();
    } catch (error) {
      console.error(`Failed to save ${mode} record`, error);
      window.alert(`Unable to save the ${mode} record.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm(`Delete this ${mode} record?`)) return;
    try {
      await API.delete(`${resource}${id}/`);
      loadData();
    } catch (error) {
      console.error(`Failed to delete ${mode} record`, error);
      window.alert(`Unable to delete the ${mode} record.`);
    }
  };

  const filteredRecords = useMemo(() => {
    return [...records]
      .filter((record) => {
        const matchesSearch = smartSearchMatch(record.data || {}, search);
        const matchesStatus = !statusFilter || record.data?.status === statusFilter;
        const matchesDepartment = !departmentFilter || record.data?.department === departmentFilter;
        const matchesEmployee =
          !employeeFilter || String(record.data?.employee_id || "") === employeeFilter;
        const reasonValue =
          record.data?.reason || record.data?.change_reason || record.data?.termination_type || "";
        const matchesReason = !reasonFilter || reasonValue === reasonFilter;
        const targetDate =
          record.data?.promotion_date || record.data?.resignation_date || record.data?.termination_date || "";
        const matchesDate = isDateInRange(targetDate, dateFrom, dateTo);
        const matchesQuick =
          !quickFilter ||
          (quickFilter === "open" && record.data?.status !== "Completed") ||
          (quickFilter === "this-month" && (() => {
            if (!targetDate) return false;
            const date = new Date(targetDate);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          })()) ||
          (quickFilter === "with-notes" && !!record.data?.notes);
        return (
          matchesSearch &&
          matchesStatus &&
          matchesDepartment &&
          matchesEmployee &&
          matchesReason &&
          matchesDate &&
          matchesQuick
        );
      })
      .sort((left, right) => {
        const leftDate =
          left.data?.promotion_date || left.data?.resignation_date || left.data?.termination_date || "";
        const rightDate =
          right.data?.promotion_date || right.data?.resignation_date || right.data?.termination_date || "";
        return String(rightDate).localeCompare(String(leftDate));
      });
  }, [dateFrom, dateTo, departmentFilter, employeeFilter, quickFilter, reasonFilter, records, search, statusFilter]);

  const reasonOptions = useMemo(() => {
    const values = records
      .map(
        (record) =>
          record.data?.reason || record.data?.change_reason || record.data?.termination_type || ""
      )
      .filter(Boolean);
    return Array.from(new Set(values)).sort((left, right) => String(left).localeCompare(String(right)));
  }, [records]);

  const appliedFilters = activeFilterCount({
    search,
    statusFilter,
    departmentFilter,
    employeeFilter,
    reasonFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const stats = useMemo(() => {
    const completed = filteredRecords.filter((record) => record.data?.status === "Completed").length;
    const open = filteredRecords.length - completed;
    const thisMonth = filteredRecords.filter((record) => {
      const raw =
        record.data?.promotion_date || record.data?.resignation_date || record.data?.termination_date || "";
      if (!raw) return false;
      const date = new Date(raw);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    return [
      { label: `${title} Records`, value: filteredRecords.length, meta: "Movement history retained" },
      { label: "Open Cases", value: open, meta: "Items still in progress" },
      { label: "Completed", value: completed, meta: "Closed with context preserved" },
      { label: "This Month", value: thisMonth, meta: "Recent people movement" },
    ];
  }, [filteredRecords, title]);

  const sideItems = useMemo(
    () =>
      filteredRecords.slice(0, 5).map((record) => ({
        label: record.data?.employee_name || "Employee",
        meta: record.data?.department || record.data?.designation_to || record.data?.termination_type || "Pending",
        value: record.data?.status || "Pending",
        tone: statusTone(record.data?.status),
      })),
    [filteredRecords]
  );

  const tableColumns = mode === "promotion"
    ? ["Employee", "Current Role", "Next Role", "Effective Date", "Salary Change", "Status", "Actions"]
    : mode === "resignation"
    ? ["Employee", "Reason", "Notice Date", "Exit Date", "Handover", "Status", "Actions"]
    : ["Employee", "Type", "Notice Date", "Exit Date", "Settlement", "Status", "Actions"];

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker={config.kicker}
          title={title}
          subtitle={subtitle}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-circle-plus me-2" />
                {config.buttonLabel}
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-users" />
            Built for HR follow-up and clean audit trails
          </span>
          <span className="employee-chip">
            <i className="ti ti-file-check" />
            Workflow status stays attached to every record
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>{title} Register</h5>
                  <div className="payroll-table-subtitle">
                    Filter by department or status and keep every change visible in one workspace.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder={`Smart search ${mode} records`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="form-select"
                    value={employeeFilter}
                    onChange={(event) => setEmployeeFilter(event.target.value)}
                  >
                    <option value="">All employees</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                  >
                    <option value="">All departments</option>
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={reasonFilter}
                    onChange={(event) => setReasonFilter(event.target.value)}
                  >
                    <option value="">All reasons</option>
                    {reasonOptions.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {config.statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
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
                        setStatusFilter("");
                        setDepartmentFilter("");
                        setEmployeeFilter("");
                        setReasonFilter("");
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
                    { key: "open", label: "Open cases" },
                    { key: "this-month", label: "This month" },
                    { key: "with-notes", label: "With notes" },
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
                        {tableColumns.map((column) => (
                          <th key={column} className={column === "Actions" ? "text-end" : ""}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-5">
                            Loading {title.toLowerCase()} records...
                          </td>
                        </tr>
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <HrmEmptyState
                              icon={config.emptyIcon}
                              title={config.emptyTitle}
                              description={config.emptyDescription}
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record) => (
                          <tr key={record.id}>
                            <td>
                              <div className="payroll-avatar-block">
                                <span className="payroll-avatar-icon">
                                  <i className={mode === "promotion" ? "ti ti-rocket" : mode === "resignation" ? "ti ti-door-exit" : "ti ti-user-x"} />
                                </span>
                                <div>
                                  <div className="payroll-primary-text">{record.data?.employee_name || "Employee"}</div>
                                  <div className="payroll-secondary-text">{record.data?.department || "No department"}</div>
                                </div>
                              </div>
                            </td>
                            {mode === "promotion" ? (
                              <>
                                <td>{record.data?.designation_from || "-"}</td>
                                <td>{record.data?.designation_to || "-"}</td>
                                <td>{formatDisplayDate(record.data?.promotion_date)}</td>
                                <td>{record.data?.salary_change ? formatCurrency(record.data?.salary_change) : "-"}</td>
                              </>
                            ) : mode === "resignation" ? (
                              <>
                                <td>{record.data?.reason || "-"}</td>
                                <td>{formatDisplayDate(record.data?.notice_date)}</td>
                                <td>{formatDisplayDate(record.data?.resignation_date)}</td>
                                <td>{record.data?.handover_status || "Pending"}</td>
                              </>
                            ) : (
                              <>
                                <td>{record.data?.termination_type || "-"}</td>
                                <td>{formatDisplayDate(record.data?.notice_date)}</td>
                                <td>{formatDisplayDate(record.data?.termination_date)}</td>
                                <td>{record.data?.settlement_status || "Pending"}</td>
                              </>
                            )}
                            <td>
                              <span className={`payroll-badge ${toneClass(statusTone(record.data?.status))}`}>
                                {record.data?.status || config.statusOptions[0]}
                              </span>
                            </td>
                            <td className="text-end">
                              <button type="button" className="btn btn-sm btn-light me-2" onClick={() => openEdit(record)}>
                                <i className="ti ti-edit" />
                              </button>
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteRecord(record.id)}>
                                <i className="ti ti-trash" />
                              </button>
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
            <div className="row g-4">
              <div className="col-12">
                <HrmSideList title="Latest Updates" items={sideItems} emptyLabel="Recent movement updates will appear here." />
              </div>
              <div className="col-12">
                <div className="card payroll-section-card h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">Operational Notes</h5>
                    </div>
                    <div className="finance-stack-list">
                      <div className="finance-note-card">
                        <i className="ti ti-shield-check" />
                        Keep approvals, dates, and employee context together so follow-up work never relies on scattered notes.
                      </div>
                      <div className="finance-note-card">
                        <i className="ti ti-filter-check" />
                        Filters are tuned for HR teams who need to isolate active cases quickly.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? `Update ${title} Record` : config.buttonLabel}
        subtitle={`Capture ${mode} details with employee context, workflow status, and notes worth keeping with the record.`}
        onClose={closeModal}
        onSubmit={saveRecord}
        submitLabel={saving ? "Saving..." : editing ? "Save Changes" : config.buttonLabel}
        summary={
          <div className="payroll-summary-list">
            <div className="payroll-summary-highlight mb-3">
              <small>{selectedEmployee?.department || form.department || "Department pending"}</small>
              <h3>{selectedEmployee?.name || form.employee_name || "Select employee"}</h3>
            </div>
            <div className="payroll-summary-row">
              <span>Status</span>
              <strong>{form.status}</strong>
            </div>
            <div className="payroll-summary-row">
              <span>{config.primaryDateLabel}</span>
              <strong>{formatDisplayDate(form[config.primaryDateKey])}</strong>
            </div>
            {mode === "promotion" ? (
              <div className="payroll-summary-row">
                <span>Salary Change</span>
                <strong>{form.salary_change ? formatCurrency(form.salary_change) : "-"}</strong>
              </div>
            ) : null}
            {mode === "resignation" ? (
              <div className="payroll-summary-row">
                <span>Handover</span>
                <strong>{form.handover_status || "Pending"}</strong>
              </div>
            ) : null}
            {mode === "termination" ? (
              <div className="payroll-summary-row">
                <span>Settlement</span>
                <strong>{form.settlement_status || "Pending"}</strong>
              </div>
            ) : null}
          </div>
        }
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">{title} Details</h5>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Employee</label>
                <select
                  className="form-select"
                  value={form.employee_id}
                  onChange={(event) => updateEmployeeContext(event.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} • {employee.department || "No department"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Department</label>
                <input className="form-control" value={form.department || ""} readOnly />
              </div>

              {mode === "promotion" ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Current Designation</label>
                    <input
                      className="form-control"
                      value={form.designation_from || ""}
                      onChange={(event) => setForm((current) => ({ ...current, designation_from: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Promoted To</label>
                    <input
                      className="form-control"
                      value={form.designation_to || ""}
                      onChange={(event) => setForm((current) => ({ ...current, designation_to: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Promotion Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.promotion_date || ""}
                      onChange={(event) => setForm((current) => ({ ...current, promotion_date: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Reason</label>
                    <select
                      className="form-select"
                      value={form.change_reason || "Career Growth"}
                      onChange={(event) => setForm((current) => ({ ...current, change_reason: event.target.value }))}
                    >
                      {config.reasonOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Salary Change</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={form.salary_change || ""}
                      onChange={(event) => setForm((current) => ({ ...current, salary_change: event.target.value }))}
                      placeholder="2500"
                    />
                  </div>
                </>
              ) : null}

              {mode === "resignation" ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Reason</label>
                    <select
                      className="form-select"
                      value={form.reason || "Career Change"}
                      onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                    >
                      {config.reasonOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Handover Status</label>
                    <select
                      className="form-select"
                      value={form.handover_status || "Pending"}
                      onChange={(event) => setForm((current) => ({ ...current, handover_status: event.target.value }))}
                    >
                      {["Pending", "In Progress", "Completed"].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Notice Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.notice_date || ""}
                      onChange={(event) => setForm((current) => ({ ...current, notice_date: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Resignation Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.resignation_date || ""}
                      onChange={(event) => setForm((current) => ({ ...current, resignation_date: event.target.value }))}
                    />
                  </div>
                </>
              ) : null}

              {mode === "termination" ? (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Termination Type</label>
                    <select
                      className="form-select"
                      value={form.termination_type || "Retirement"}
                      onChange={(event) => setForm((current) => ({ ...current, termination_type: event.target.value }))}
                    >
                      {config.reasonOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Settlement Status</label>
                    <select
                      className="form-select"
                      value={form.settlement_status || "Pending"}
                      onChange={(event) => setForm((current) => ({ ...current, settlement_status: event.target.value }))}
                    >
                      {["Pending", "In Progress", "Completed"].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Notice Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.notice_date || ""}
                      onChange={(event) => setForm((current) => ({ ...current, notice_date: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Termination Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.termination_date || ""}
                      onChange={(event) => setForm((current) => ({ ...current, termination_date: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Reason</label>
                    <input
                      className="form-control"
                      value={form.reason || ""}
                      onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                      placeholder="Reason for termination"
                    />
                  </div>
                </>
              ) : null}

              <div className="col-md-6">
                <label className="form-label">Workflow Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {config.statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.notes || ""}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Add handover notes, approvals, or context."
                />
              </div>
            </div>
          </div>
        </div>
      </HrmModal>
    </div>
  );
};

export default MovementWorkspace;
