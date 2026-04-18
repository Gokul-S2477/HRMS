import React, { useCallback, useEffect, useMemo, useState } from "react";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import API from "../../api/axios";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  calculateHours,
  fetchEmployeeDirectory,
  formatDisplayDate,
  initialEmployeePayload,
  isDateInRange,
  smartSearchMatch,
  normalizeResourceRecords,
  selectEmployee,
  statusTone,
  toneClass,
} from "./hrmShared";

const STATUS_OPTIONS = ["Present", "Absent", "On Leave", "Half Day", "Late"];
const SHIFT_OPTIONS = ["General", "Morning", "Evening", "Night"];
const WORK_MODE_OPTIONS = ["Office", "Remote", "Hybrid"];

const emptyForm = {
  employee_id: "",
  employee_name: "",
  department: "",
  designation: "",
  date: "",
  status: "Present",
  check_in: "",
  check_out: "",
  shift: "General",
  work_mode: "Office",
  remarks: "",
};

const AttendanceWorkspace = ({ resource, title, subtitle, audienceLabel }) => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [attendanceResponse, employeeDirectory] = await Promise.all([
        API.get(resource),
        fetchEmployeeDirectory(),
      ]);
      setRecords(normalizeResourceRecords(attendanceResponse.data));
      setEmployees(employeeDirectory);
    } catch (error) {
      console.error(`Failed to load ${title.toLowerCase()}`, error);
      setRecords([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [resource, title]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  useEffect(() => {
    resetForm();
  }, []);

  const upsertEmployeeContext = (employeeId) => {
    const employee = selectEmployee(employees, employeeId);
    if (!employee) {
      setForm((current) => ({
        ...current,
        employee_id: employeeId,
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      ...initialEmployeePayload(employee),
    }));
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      employee_id: record.data?.employee_id ? String(record.data.employee_id) : "",
      employee_name: record.data?.employee_name || "",
      department: record.data?.department || "",
      designation: record.data?.designation || "",
      date: record.data?.date || "",
      status: record.data?.status || "Present",
      check_in: record.data?.check_in || "",
      check_out: record.data?.check_out || "",
      shift: record.data?.shift || "General",
      work_mode: record.data?.work_mode || "Office",
      remarks: record.data?.remarks || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const persistRecord = async (event) => {
    event.preventDefault();
    if (!form.employee_id || !form.date) {
      window.alert("Employee and attendance date are required.");
      return;
    }
    const employee = selectEmployee(employees, form.employee_id);
    const payload = {
      ...form,
      employee_name: employee?.name || form.employee_name || "",
      department: employee?.department || form.department || "",
      designation: employee?.designation || form.designation || "",
      work_hours: calculateHours(form.check_in, form.check_out),
      punctuality:
        form.status === "Late" || (form.check_in && form.check_in > "09:30")
          ? "Needs attention"
          : "On time",
    };

    setSaving(true);
    try {
      if (editing) {
        await API.put(`${resource}${editing.id}/`, { data: payload });
      } else {
        await API.post(resource, { data: payload });
      }
      closeModal();
      resetForm();
      loadData();
    } catch (error) {
      console.error("Failed to save attendance record", error);
      window.alert("Unable to save the attendance record.");
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (id) => {
    if (!window.confirm("Delete this attendance entry?")) return;
    try {
      await API.delete(`${resource}${id}/`);
      loadData();
    } catch (error) {
      console.error("Failed to delete attendance record", error);
      window.alert("Unable to delete the attendance record.");
    }
  };

  const filteredRecords = useMemo(() => {
    return [...records]
      .filter((record) => {
        const matchesSearch = smartSearchMatch(record.data || {}, search);
        const matchesStatus = !statusFilter || record.data?.status === statusFilter;
        const matchesEmployee =
          !employeeFilter || String(record.data?.employee_id || "") === employeeFilter;
        const matchesDepartment = !departmentFilter || record.data?.department === departmentFilter;
        const matchesShift = !shiftFilter || record.data?.shift === shiftFilter;
        const matchesWorkMode = !workModeFilter || record.data?.work_mode === workModeFilter;
        const matchesDate = isDateInRange(record.data?.date, dateFrom, dateTo);
        const hoursWorked = calculateHours(record.data?.check_in, record.data?.check_out);
        const matchesQuick =
          !quickFilter ||
          (quickFilter === "late" && record.data?.status === "Late") ||
          (quickFilter === "under-hours" && hoursWorked > 0 && hoursWorked < 8) ||
          (quickFilter === "remote" && record.data?.work_mode === "Remote") ||
          (quickFilter === "today" &&
            record.data?.date === new Date().toISOString().slice(0, 10));

        return (
          matchesSearch &&
          matchesStatus &&
          matchesEmployee &&
          matchesDepartment &&
          matchesShift &&
          matchesWorkMode &&
          matchesDate &&
          matchesQuick
        );
      })
      .sort((left, right) =>
        String(right.data?.date || "").localeCompare(String(left.data?.date || ""))
      );
  }, [
    records,
    search,
    statusFilter,
    employeeFilter,
    departmentFilter,
    shiftFilter,
    workModeFilter,
    dateFrom,
    dateTo,
    quickFilter,
  ]);

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(employees.map((employee) => employee.department).filter(Boolean))
      ).sort((left, right) => String(left).localeCompare(String(right))),
    [employees]
  );

  const appliedFilters = activeFilterCount({
    search,
    statusFilter,
    employeeFilter,
    departmentFilter,
    shiftFilter,
    workModeFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const stats = useMemo(() => {
    const present = filteredRecords.filter((record) => record.data?.status === "Present").length;
    const late = filteredRecords.filter((record) => record.data?.status === "Late").length;
    const onLeave = filteredRecords.filter((record) => record.data?.status === "On Leave").length;
    const averageHours =
      filteredRecords.length === 0
        ? 0
        : (
            filteredRecords.reduce(
              (sum, record) =>
                sum + calculateHours(record.data?.check_in, record.data?.check_out),
              0
            ) / filteredRecords.length
          ).toFixed(1);

    return [
      {
        label: "Tracked Entries",
        value: filteredRecords.length,
        meta: `${audienceLabel} attendance records`,
      },
      {
        label: "Present Days",
        value: present,
        meta: `${late} late arrivals flagged`,
      },
      {
        label: "Leave / Exceptions",
        value: onLeave,
        meta: "Half days and leaves stay visible",
      },
      {
        label: "Avg. Hours",
        value: `${averageHours}h`,
        meta: "Auto-calculated from check-in/out",
      },
    ];
  }, [audienceLabel, filteredRecords]);

  const sideHighlights = useMemo(() => {
    return filteredRecords.slice(0, 5).map((record) => ({
      label: record.data?.employee_name || "Employee",
      meta: `${formatDisplayDate(record.data?.date)} • ${record.data?.shift || "General"} shift`,
      value: record.data?.status || "Pending",
      tone: statusTone(record.data?.status),
    }));
  }, [filteredRecords]);

  const selectedEmployee = useMemo(
    () => selectEmployee(employees, form.employee_id),
    [employees, form.employee_id]
  );

  const workHours = calculateHours(form.check_in, form.check_out);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Attendance Workspace"
          title={title}
          subtitle={subtitle}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-circle-plus me-2" />
                Add Attendance
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-clock-hour-8" />
            Smart work-hour calculation
          </span>
          <span className="employee-chip">
            <i className="ti ti-calendar-check" />
            Quick date, employee, and status filters
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Attendance Register</h5>
                  <div className="payroll-table-subtitle">
                    Track {audienceLabel.toLowerCase()} shifts, punctuality, and worked hours in one place.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder="Smart search employee, department, shift, remarks"
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
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select className="form-select" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)}>
                    <option value="">All shifts</option>
                    {SHIFT_OPTIONS.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                  <select className="form-select" value={workModeFilter} onChange={(event) => setWorkModeFilter(event.target.value)}>
                    <option value="">All work modes</option>
                    {WORK_MODE_OPTIONS.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
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
                        setEmployeeFilter("");
                        setDepartmentFilter("");
                        setShiftFilter("");
                        setWorkModeFilter("");
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
                    { key: "late", label: "Late arrivals" },
                    { key: "under-hours", label: "Under 8h" },
                    { key: "remote", label: "Remote only" },
                    { key: "today", label: "Today" },
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
                        <th>Employee</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Shift</th>
                        <th>Work Hours</th>
                        <th>Notes</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-5">
                            Loading attendance records...
                          </td>
                        </tr>
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <HrmEmptyState
                              icon="ti ti-calendar-time"
                              title="No attendance entries yet"
                              description="Start logging attendance to see work-hour insights, punctuality trends, and daily coverage."
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record) => {
                          const hours = calculateHours(record.data?.check_in, record.data?.check_out);
                          return (
                            <tr key={record.id}>
                              <td>
                                <div className="payroll-avatar-block">
                                  <span className="payroll-avatar-icon">
                                    <i className="ti ti-user" />
                                  </span>
                                  <div>
                                    <div className="payroll-primary-text">
                                      {record.data?.employee_name || "Employee"}
                                    </div>
                                    <div className="payroll-secondary-text">
                                      {record.data?.department || "No department"} •{" "}
                                      {record.data?.designation || "Role pending"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="payroll-primary-text">
                                  {formatDisplayDate(record.data?.date)}
                                </div>
                                <div className="payroll-secondary-text">
                                  {record.data?.check_in || "--"} - {record.data?.check_out || "--"}
                                </div>
                              </td>
                              <td>
                                <span className={`payroll-badge ${toneClass(statusTone(record.data?.status))}`}>
                                  {record.data?.status || "Pending"}
                                </span>
                              </td>
                              <td>
                                <div className="payroll-primary-text">
                                  {record.data?.shift || "General"}
                                </div>
                                <div className="payroll-secondary-text">
                                  {record.data?.work_mode || "Office"}
                                </div>
                              </td>
                              <td>
                                <div className="payroll-primary-text">{hours.toFixed(1)} hrs</div>
                                <div className="payroll-secondary-text">
                                  {record.data?.punctuality || "Auto-tracked"}
                                </div>
                              </td>
                              <td className="payroll-secondary-text">
                                {record.data?.remarks || "No remarks"}
                              </td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light me-2"
                                  onClick={() => openEdit(record)}
                                >
                                  <i className="ti ti-edit" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => removeRecord(record.id)}
                                >
                                  <i className="ti ti-trash" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
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
                <HrmSideList
                  title="Latest Activity"
                  items={sideHighlights}
                  emptyLabel="New attendance activity will surface here."
                />
              </div>
              <div className="col-12">
                <div className="card payroll-section-card h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">Focus Areas</h5>
                    </div>
                    <div className="finance-stack-list">
                      <div className="finance-note-card">
                        <i className="ti ti-bell-ringing" />
                        Late arrivals are auto-highlighted when status is set to Late or check-in is after 09:30.
                      </div>
                      <div className="finance-note-card">
                        <i className="ti ti-clock-check" />
                        Worked hours are recalculated automatically whenever check-in or check-out changes.
                      </div>
                      <div className="finance-note-card">
                        <i className="ti ti-filter-check" />
                        Filters are built to help admins or employees quickly isolate days that need follow-up.
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
        title={editing ? `Edit ${title} Entry` : `Add ${title} Entry`}
        subtitle="Capture attendance with employee context, shift details, and calculated work hours."
        onClose={closeModal}
        onSubmit={persistRecord}
        submitLabel={saving ? "Saving..." : editing ? "Save Changes" : "Add Attendance"}
        summary={
          <div className="payroll-summary-list">
            <div className="payroll-summary-highlight mb-3">
              <small>{selectedEmployee?.name || "No employee selected"}</small>
              <h3>{workHours.toFixed(1)} hrs</h3>
            </div>
            <div className="payroll-summary-row">
              <span>Department</span>
              <strong>{selectedEmployee?.department || form.department || "-"}</strong>
            </div>
            <div className="payroll-summary-row">
              <span>Designation</span>
              <strong>{selectedEmployee?.designation || form.designation || "-"}</strong>
            </div>
            <div className="payroll-summary-row">
              <span>Punctuality</span>
              <strong>
                {form.status === "Late" || (form.check_in && form.check_in > "09:30")
                  ? "Needs attention"
                  : "On time"}
              </strong>
            </div>
            <div className="payroll-summary-row">
              <span>Work Mode</span>
              <strong>{form.work_mode}</strong>
            </div>
          </div>
        }
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">Attendance Details</h5>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Employee</label>
                <select
                  className="form-select"
                  value={form.employee_id}
                  onChange={(event) => upsertEmployeeContext(event.target.value)}
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
                <label className="form-label">Attendance Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Status</label>
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
              </div>
              <div className="col-md-4">
                <label className="form-label">Check In</label>
                <input
                  type="time"
                  className="form-control"
                  value={form.check_in}
                  onChange={(event) => setForm((current) => ({ ...current, check_in: event.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Check Out</label>
                <input
                  type="time"
                  className="form-control"
                  value={form.check_out}
                  onChange={(event) => setForm((current) => ({ ...current, check_out: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Shift</label>
                <select
                  className="form-select"
                  value={form.shift}
                  onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))}
                >
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Work Mode</label>
                <select
                  className="form-select"
                  value={form.work_mode}
                  onChange={(event) => setForm((current) => ({ ...current, work_mode: event.target.value }))}
                >
                  {WORK_MODE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.remarks}
                  onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                  placeholder="Add context for leave approvals, punctuality notes, or exceptions."
                />
              </div>
            </div>
          </div>
        </div>
      </HrmModal>
    </div>
  );
};

export default AttendanceWorkspace;
