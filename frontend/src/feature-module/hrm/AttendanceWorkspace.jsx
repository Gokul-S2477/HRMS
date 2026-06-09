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
  const [localIp, setLocalIp] = useState("");
  const [localCoords, setLocalCoords] = useState(null);
  const [coordsLoading, setCoordsLoading] = useState(false);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => setLocalIp(data.ip))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCoordsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocalCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setCoordsLoading(false);
        },
        () => {
          setCoordsLoading(false);
        },
        { timeout: 5000 }
      );
    } else {
      setCoordsLoading(false);
    }
  }, []);

  const getCoordinates = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            console.warn("Geolocation error", error);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        resolve(null);
      }
    });
  };

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [todayRecord, setTodayRecord] = useState(null);
  const [punchWorkMode, setPunchWorkMode] = useState("Office");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [breakTimer, setBreakTimer] = useState("00:00:00");

  const loadTodayPunch = useCallback(async () => {
    try {
      const res = await API.get("/data/attendance-employee/");
      const list = normalizeResourceRecords(res.data);
      const todayStr = new Date().toISOString().slice(0, 10);
      const found = list.find((r) => r.data?.date === todayStr);
      setTodayRecord(found || null);
    } catch (error) {
      console.error("Failed to load today's punch status", error);
    }
  }, []);

  useEffect(() => {
    loadTodayPunch();
  }, [loadTodayPunch]);

  useEffect(() => {
    if (!todayRecord || todayRecord.data?.check_out) {
      setElapsedTime("00:00:00");
      setBreakTimer("00:00:00");
      return;
    }
    const checkInStr = todayRecord.data?.check_in;
    if (!checkInStr) return;
    
    const [hours, minutes] = checkInStr.split(":").map(Number);
    const checkInDate = new Date();
    checkInDate.setHours(hours, minutes, 0, 0);

    const updateTimer = () => {
      const now = new Date();
      let diffMs = now.getTime() - checkInDate.getTime();
      if (diffMs < 0) diffMs = 0;
      
      let breakMs = 0;
      const breaks = todayRecord.data?.breaks || [];
      breaks.forEach((b) => {
        if (b.start) {
          const [sh, sm] = b.start.split(":").map(Number);
          const sDate = new Date();
          sDate.setHours(sh, sm, 0, 0);
          
          let eDate = new Date();
          if (b.end) {
            const [eh, em] = b.end.split(":").map(Number);
            eDate.setHours(eh, em, 0, 0);
          } else {
            eDate = now;
          }
          let bDiff = eDate.getTime() - sDate.getTime();
          if (bDiff > 0) breakMs += bDiff;
        }
      });

      const netMs = diffMs - breakMs;
      const totalSeconds = Math.max(0, Math.floor(netMs / 1000));
      const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const s = String(totalSeconds % 60).padStart(2, "0");
      setElapsedTime(`${h}:${m}:${s}`);

      if (todayRecord.data?.on_break && breaks.length > 0) {
        const lastBreak = breaks[breaks.length - 1];
        if (lastBreak.start) {
          const [sh, sm] = lastBreak.start.split(":").map(Number);
          const sDate = new Date();
          sDate.setHours(sh, sm, 0, 0);
          const bDiffSec = Math.max(0, Math.floor((now.getTime() - sDate.getTime()) / 1000));
          const bh = String(Math.floor(bDiffSec / 3600)).padStart(2, "0");
          const bm = String(Math.floor((bDiffSec % 3600) / 60)).padStart(2, "0");
          const bs = String(bDiffSec % 60).padStart(2, "0");
          setBreakTimer(`${bh}:${bm}:${bs}`);
        }
      } else {
        setBreakTimer("00:00:00");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  const handlePunchIn = async () => {
    setSaving(true);
    try {
      const coords = await getCoordinates();
      const payload = {
        date: new Date().toISOString().slice(0, 10),
        work_mode: punchWorkMode,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
      };
      await API.post("/data/attendance-employee/", { data: payload });
      loadTodayPunch();
      loadData();
    } catch (error) {
      console.error("Failed to clock in", error);
      window.alert(error?.response?.data?.detail || "Unable to clock in.");
    } finally {
      setSaving(false);
    }
  };

  const handleBreakStart = async () => {
    if (!todayRecord) return;
    setSaving(true);
    try {
      const payload = {
        action: "break_start",
      };
      await API.put(`/data/attendance-employee/${todayRecord.id}/`, { data: payload });
      loadTodayPunch();
      loadData();
    } catch (error) {
      console.error("Failed to start break", error);
      window.alert("Unable to start break.");
    } finally {
      setSaving(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!todayRecord) return;
    setSaving(true);
    try {
      const payload = {
        action: "break_end",
      };
      await API.put(`/data/attendance-employee/${todayRecord.id}/`, { data: payload });
      loadTodayPunch();
      loadData();
    } catch (error) {
      console.error("Failed to end break", error);
      window.alert("Unable to end break.");
    } finally {
      setSaving(false);
    }
  };

  const handlePunchOut = async () => {
    if (!todayRecord) return;
    if (!window.confirm("Are you sure you want to clock out for today?")) return;
    setSaving(true);
    try {
      const payload = {
        check_out: "force_server_time",
      };
      await API.put(`/data/attendance-employee/${todayRecord.id}/`, { data: payload });
      loadTodayPunch();
      loadData();
    } catch (error) {
      console.error("Failed to clock out", error);
      window.alert("Unable to clock out.");
    } finally {
      setSaving(false);
    }
  };

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
        const hoursWorked = record.data?.work_hours !== undefined && record.data?.work_hours !== null
          ? Number(record.data.work_hours)
          : calculateHours(record.data?.check_in, record.data?.check_out);
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
                sum + (record.data?.work_hours !== undefined && record.data?.work_hours !== null
                  ? Number(record.data.work_hours)
                  : calculateHours(record.data?.check_in, record.data?.check_out)),
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
                          const hours = record.data?.work_hours !== undefined && record.data?.work_hours !== null
                            ? Number(record.data.work_hours)
                            : calculateHours(record.data?.check_in, record.data?.check_out);
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
                                {record.data?.ip_address && (
                                  <div className="text-muted small mt-1" style={{ fontSize: "10.5px" }}>
                                    <i className="ti ti-network me-1" />
                                    IP: {record.data.ip_address} {record.data.ip_address_out ? ` / ${record.data.ip_address_out}` : ""}
                                  </div>
                                )}
                                {record.data?.discrepancy && (
                                  <div className="badge bg-danger-transparent text-danger mt-1 d-inline-flex align-items-center gap-1" title={Array.isArray(record.data.discrepancy_reasons) ? record.data.discrepancy_reasons.join(", ") : "Location or IP discrepancy"} style={{ fontSize: "10px", textTransform: "none" }}>
                                    <i className="ti ti-alert-triangle" /> Discrepancy
                                  </div>
                                )}
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
                                {record.data?.break_hours > 0 && (
                                  <div className="text-muted small" style={{ fontSize: "11px" }}>
                                    <i className="ti ti-coffee me-1" />
                                    Break: {Number(record.data.break_hours).toFixed(1)}h
                                  </div>
                                )}
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
                <div className="card border-primary-subtle shadow-sm mb-0" style={{ borderRadius: "18px", overflow: "hidden" }}>
                  <div className="card-header bg-primary-subtle py-3 border-0">
                    <h5 className="mb-0 text-primary d-flex align-items-center gap-2" style={{ fontSize: "15px", fontWeight: "700" }}>
                      <i className="ti ti-alarm-off" />
                      Live Punch Card
                    </h5>
                  </div>
                  <div className="card-body text-center p-4">
                    {todayRecord ? (
                      todayRecord.data?.check_out ? (
                        <div>
                          <div className="avatar avatar-lg bg-success-subtle text-success rounded-circle mb-3 mx-auto" style={{ width: "54px", height: "54px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <i className="ti ti-checkbox-check" style={{ fontSize: "24px" }} />
                          </div>
                          <h4 style={{ fontWeight: "800", color: "#1e293b" }}>Shift Completed</h4>
                          <p className="text-muted small mb-0">
                            Clocked In: <strong>{todayRecord.data?.check_in}</strong> • Clocked Out: <strong>{todayRecord.data?.check_out}</strong>
                          </p>
                          <div className="badge bg-success-subtle text-success mt-2 px-3 py-2" style={{ borderRadius: "8px" }}>
                            Worked {todayRecord.data?.work_hours || 0} hrs
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="pulse-timer mb-2" style={{ fontFamily: "monospace", fontSize: "32px", fontWeight: "800", color: todayRecord.data?.on_break ? "#ea580c" : "#0284c7", letterSpacing: "1px" }}>
                            {todayRecord.data?.on_break ? breakTimer : elapsedTime}
                          </div>
                          <p className="text-muted small mb-4">
                            {todayRecord.data?.on_break ? (
                              <span className="text-warning fw-bold d-block mb-1">
                                <i className="ti ti-coffee me-1" /> Currently on Break
                              </span>
                            ) : (
                              <span className="d-block mb-1">
                                Active Shift • Clocked in at <strong>{todayRecord.data?.check_in}</strong>
                              </span>
                            )}
                            {todayRecord.data?.ip_address && (
                              <span className="d-block text-muted" style={{ fontSize: "11px" }}>
                                <i className="ti ti-network me-1" /> IP Network: <strong>{todayRecord.data.ip_address}</strong>
                              </span>
                            )}
                            {todayRecord.data?.latitude && (
                              <span className="d-block text-muted" style={{ fontSize: "11px" }}>
                                <i className="ti ti-map-pin me-1" /> GPS Checked: <strong>{Number(todayRecord.data.latitude).toFixed(4)}, {Number(todayRecord.data.longitude).toFixed(4)}</strong>
                              </span>
                            )}
                            {todayRecord.data?.discrepancy && (
                              <div className="alert alert-danger mt-3 py-2 px-3 mb-0 text-start" style={{ fontSize: "11.5px", borderRadius: "10px" }}>
                                <i className="ti ti-alert-triangle me-1" /> <strong>Discrepancy Warning:</strong>
                                <ul className="ps-3 mb-0 mt-1">
                                  {todayRecord.data.discrepancy_reasons?.map((reason, idx) => (
                                    <li key={idx}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </p>
                          <div className="d-flex gap-2 mb-3">
                            {todayRecord.data?.on_break ? (
                              <button
                                type="button"
                                className="btn btn-warning w-100 py-2"
                                style={{ borderRadius: "12px", fontWeight: "700" }}
                                onClick={handleBreakEnd}
                                disabled={saving}
                              >
                                <i className="ti ti-player-play me-2" />
                                End Break
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline-warning w-100 py-2"
                                style={{ borderRadius: "12px", fontWeight: "700" }}
                                onClick={handleBreakStart}
                                disabled={saving}
                              >
                                <i className="ti ti-coffee me-2" />
                                Start Break
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger w-100 py-2.5"
                            style={{ borderRadius: "12px", fontWeight: "700" }}
                            onClick={handlePunchOut}
                            disabled={saving || todayRecord.data?.on_break}
                          >
                            <i className="ti ti-logout me-2" />
                            Clock Out
                          </button>
                        </div>
                      )
                    ) : (
                      <div>
                        <div className="text-muted small mb-2">
                          You are not clocked in yet. Select work mode and punch in to start your shift.
                        </div>
                        <div className="small text-muted mb-3">
                          {coordsLoading ? (
                            <span><span className="spinner-border spinner-border-sm me-1" role="status" /> Detecting location...</span>
                          ) : localCoords ? (
                            <span className="text-success fw-semibold"><i className="ti ti-map-pin me-1" /> GPS Active ({localCoords.latitude.toFixed(4)}, {localCoords.longitude.toFixed(4)})</span>
                          ) : (
                            <span className="text-warning fw-semibold"><i className="ti ti-alert-triangle me-1" /> GPS Offline (Required for Office mode)</span>
                          )}
                          {localIp && (
                            <div className="mt-1"><i className="ti ti-network me-1" /> Net IP: {localIp}</div>
                          )}
                        </div>
                        <div className="mb-3">
                          <select
                            className="form-select mx-auto"
                            style={{ maxWidth: "200px", borderRadius: "10px" }}
                            value={punchWorkMode}
                            onChange={(e) => setPunchWorkMode(e.target.value)}
                          >
                            <option value="Office">Office</option>
                            <option value="Remote">Remote</option>
                            <option value="Hybrid">Hybrid</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary w-100 py-2.5"
                          style={{ borderRadius: "12px", fontWeight: "700" }}
                          onClick={handlePunchIn}
                          disabled={saving}
                        >
                          <i className="ti ti-fingerprint me-2" />
                          Punch In
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
