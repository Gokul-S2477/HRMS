import React, { useCallback, useEffect, useState, useMemo } from "react";
import API from "../../api/axios";
import { fetchEmployeeDirectory } from "./hrmShared";

type ShiftDefinition = {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_in_minutes: number;
};

type Employee = {
  id: string;
  name: string;
  department: string;
  designation: string;
  avatar?: string;
};

type RosterRecord = {
  id: string;
  data?: {
    employee_id: string;
    employee_name: string;
    week_start: string;
    assignments: Record<string, string>; // dateStr -> shiftCode
  };
};

const getMonday = (d: Date): string => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  return mon.toISOString().slice(0, 10);
};

const getWeekDays = (mondayStr: string) => {
  const days = [];
  const monday = new Date(mondayStr);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      dateStr: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
    });
  }
  return days;
};

const shiftColorStyle = (code: string) => {
  switch (String(code).toUpperCase()) {
    case "OFF":
      return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
    case "GENERAL":
      return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
    case "MORNING":
      return { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" };
    case "EVENING":
      return { bg: "#fef9c3", text: "#a16207", border: "#fef08a" };
    case "NIGHT":
      return { bg: "#f3e8ff", text: "#6b21a8", border: "#e9d5ff" };
    default:
      return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" };
  }
};

const ShiftScheduler: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [rosters, setRosters] = useState<RosterRecord[]>([]);
  const [currentWeekMonday, setCurrentWeekMonday] = useState<string>(getMonday(new Date()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Track temporary unsaved cell edits
  // Map structure: { [employeeId]: { [dateStr]: shiftCode } }
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  const weekDays = useMemo(() => getWeekDays(currentWeekMonday), [currentWeekMonday]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empList, shiftListRes, rosterListRes] = await Promise.all([
        fetchEmployeeDirectory(),
        API.get("/data/shift-definitions/"),
        API.get("/data/shift-roster/"),
      ]);

      setEmployees(empList);
      
      // Parse shift definitions
      const parsedShifts = (shiftListRes.data?.results || shiftListRes.data || []).map((r: any) => ({
        id: r.id,
        name: r.data?.name || r.name || "",
        code: r.data?.code || r.code || "",
        start_time: r.data?.start_time || r.start_time || "",
        end_time: r.data?.end_time || r.end_time || "",
        grace_in_minutes: r.data?.grace_in_minutes || r.grace_in_minutes || 15,
      }));
      setShifts(parsedShifts);

      // Store rosters
      const rosterData = (rosterListRes.data?.results || rosterListRes.data || []).map((r: any) => ({
        id: r.id,
        data: r.data,
      }));
      setRosters(rosterData);
      setEdits({}); // Reset edits on reload
    } catch (error) {
      console.error("Failed to load shift roster components", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWeekChange = (offset: number) => {
    const currentMon = new Date(currentWeekMonday);
    currentMon.setDate(currentMon.getDate() + offset * 7);
    setCurrentWeekMonday(getMonday(currentMon));
  };

  const setTodayWeek = () => {
    setCurrentWeekMonday(getMonday(new Date()));
  };

  // Get active shift code for a cell (uses edits first, then backend rosters)
  const getCellShift = (employeeId: string, dateStr: string) => {
    if (edits[employeeId]?.[dateStr] !== undefined) {
      return edits[employeeId][dateStr];
    }
    const record = rosters.find(
      (r) =>
        String(r.data?.employee_id) === String(employeeId) &&
        r.data?.week_start === currentWeekMonday
    );
    return record?.data?.assignments?.[dateStr] || "Off";
  };

  const handleCellChange = (employeeId: string, dateStr: string, shiftCode: string) => {
    setEdits((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [dateStr]: shiftCode,
      },
    }));
  };

  const handleSave = async () => {
    const editKeys = Object.keys(edits);
    if (editKeys.length === 0) {
      window.alert("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      for (const employeeId of editKeys) {
        const employeeEdits = edits[employeeId];
        const employee = employees.find((e) => String(e.id) === String(employeeId));
        if (!employee) continue;

        // Find existing record
        const existingRecord = rosters.find(
          (r) =>
            String(r.data?.employee_id) === String(employeeId) &&
            r.data?.week_start === currentWeekMonday
        );

        const currentAssignments = existingRecord?.data?.assignments || {};
        const updatedAssignments = {
          ...currentAssignments,
          ...employeeEdits,
        };

        const payload = {
          employee_id: employee.id,
          employee_name: employee.name,
          week_start: currentWeekMonday,
          assignments: updatedAssignments,
        };

        if (existingRecord) {
          // Update
          await API.put(`/data/shift-roster/${existingRecord.id}/`, { data: payload });
        } else {
          // Create
          await API.post("/data/shift-roster/", { data: payload });
        }
      }
      window.alert("Roster saved successfully!");
      loadData();
    } catch (error) {
      console.error("Failed to save shift roster", error);
      window.alert("Unable to save shift roster.");
    } finally {
      setSaving(false);
    }
  };

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.designation.toLowerCase().includes(search.toLowerCase());
      const matchesDept = !departmentFilter || e.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, search, departmentFilter]);

  const hasUnsavedChanges = Object.keys(edits).length > 0;

  return (
    <div className="card payroll-panel">
      <div className="card-body">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
          <div>
            <h5 className="mb-1" style={{ fontWeight: "700" }}>Weekly Shift Planner</h5>
            <p className="text-muted small mb-0">Assign daily work rotations, shifts, and off days for team coverage.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => handleWeekChange(-1)}>
              <i className="ti ti-chevron-left" />
            </button>
            <button className="btn btn-sm btn-light" onClick={setTodayWeek}>Today</button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => handleWeekChange(1)}>
              <i className="ti ti-chevron-right" />
            </button>
            <span className="fw-semibold px-2 py-1 bg-primary-subtle text-primary rounded" style={{ fontSize: "13px" }}>
              Week of {new Date(currentWeekMonday).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 mb-4 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 260 }}
            placeholder="Search employee, designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ maxWidth: 200 }}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <div className="ms-auto d-flex align-items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-warning small fw-bold">
                <i className="ti ti-alert-triangle me-1" />
                Unsaved changes detected
              </span>
            )}
            <button
              className="btn btn-primary px-4"
              style={{ borderRadius: "10px", fontWeight: "600" }}
              disabled={saving || !hasUnsavedChanges}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save Roster"}
            </button>
          </div>
        </div>

        <div className="table-responsive border rounded-4" style={{ overflow: "visible" }}>
          <table className="table align-middle mb-0 text-center">
            <thead>
              <tr className="bg-light">
                <th className="text-start ps-4" style={{ minWidth: "220px" }}>Employee</th>
                {weekDays.map((day) => (
                  <th key={day.dateStr} style={{ minWidth: "120px" }}>
                    <div className="small fw-bold text-dark">{day.name}</div>
                    <div className="text-muted" style={{ fontSize: "11px" }}>{day.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-5 text-muted">
                    Loading Roster Planner...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-5 text-muted">
                    No employees matching filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="text-start ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar avatar-sm bg-primary-subtle text-primary rounded-circle fw-bold" style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-semibold text-dark" style={{ fontSize: "13.5px" }}>{emp.name}</div>
                          <div className="text-muted" style={{ fontSize: "11px" }}>{emp.designation}</div>
                        </div>
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const activeShift = getCellShift(emp.id, day.dateStr);
                      const style = shiftColorStyle(activeShift);
                      return (
                        <td key={day.dateStr} className="p-2">
                          <select
                            className="form-select border-0 text-center"
                            style={{
                              backgroundColor: style.bg,
                              color: style.text,
                              fontWeight: "600",
                              fontSize: "12.5px",
                              borderRadius: "8px",
                              padding: "6px 8px",
                              cursor: "pointer",
                              textAlignLast: "center"
                            }}
                            value={activeShift}
                            onChange={(e) => handleCellChange(emp.id, day.dateStr, e.target.value)}
                          >
                            <option value="Off" style={{ backgroundColor: "#ffffff", color: "#475569" }}>Off</option>
                            <option value="General" style={{ backgroundColor: "#ffffff", color: "#0369a1" }}>General</option>
                            {shifts.map((s) => (
                              <option key={s.id} value={s.code} style={{ backgroundColor: "#ffffff", color: "#1e293b" }}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ShiftScheduler;
