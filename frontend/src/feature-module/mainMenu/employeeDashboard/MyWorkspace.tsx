import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../../api/axios";
import { useAuth } from "../../../core/auth/AuthContext";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { all_routes } from "../../router/all_routes";

type EmployeeProfile = {
  id: number;
  emp_code?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: { name?: string } | null;
  designation?: { title?: string } | null;
  joining_date?: string | null;
  salary?: number | string | null;
  work_location?: string | null;
  work_shift?: string | null;
};

type LeaveBalanceSummary = {
  balances: Array<{
    leave_type: string;
    annual_allocation: number | string;
    carry_forward: number | string;
    available: number | string;
    used: number | string;
    pending: number | string;
  }>;
  pending_requests_count: number;
  pending_requests: Array<{
    id: string;
    leave_type: string;
    from_date: string;
    to_date: string;
    days: number;
    reason: string;
  }>;
};

type AttendanceRecord = {
  id: number;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: string;
  total_hours?: number;
  is_regularized: boolean;
  notes?: string;
};

type TrainingEnrollment = {
  id: number;
  program: {
    id: number;
    title: string;
    trainer_name?: string;
    start_date: string;
    end_date: string;
    training_type: string;
  };
  status: string;
  score?: number;
};

type Announcement = {
  id: number;
  title: string;
  body: string;
  priority: string;
  published_at: string;
  is_pinned: boolean;
  read_by: number[];
};

type OnboardingTask = {
  id: number;
  title: string;
  status: string; // "pending" / "completed"
};

type MemberNode = {
  id: number;
  first_name: string;
  last_name?: string;
  email: string;
  designation?: string;
  department?: string;
  photo?: string;
  children?: MemberNode[];
};

const normalizeList = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" });
};

const formatCurrency = (value: any) => {
  const num = Number(String(value ?? "").replace(/,/g, ""));
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(num) ? num : 0);
};

const MyWorkspace: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const routes = all_routes;

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [leaveSummary, setLeaveSummary] = useState<LeaveBalanceSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [trainings, setTrainings] = useState<TrainingEnrollment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([]);
  const [team, setTeam] = useState<{ manager: MemberNode | null; peers: MemberNode[] }>({ manager: null, peers: [] });
  const [payrolls, setPayrolls] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "danger" | "warning"; text: string } | null>(null);

  // Punch timer states
  const [punchWorkMode, setPunchWorkMode] = useState("Office");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [localIp, setLocalIp] = useState("");
  const [localCoords, setLocalCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [coordsLoading, setCoordsLoading] = useState(false);

  const employeeId = user?.employee_profile?.id;

  // Find today's attendance record
  const todayRecord = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return attendance.find((r) => r.work_date === todayStr) || null;
  }, [attendance]);

  // Handle shift elapsed timer
  useEffect(() => {
    if (!todayRecord || todayRecord.check_out_time) {
      setElapsedTime("00:00:00");
      return;
    }
    const checkInTime = todayRecord.check_in_time;
    if (!checkInTime) return;

    const [hours, minutes, seconds] = checkInTime.split(":").map(Number);
    const checkInDate = new Date();
    checkInDate.setHours(hours, minutes, seconds || 0, 0);

    const updateTimer = () => {
      const now = new Date();
      let diffMs = now.getTime() - checkInDate.getTime();
      if (diffMs < 0) diffMs = 0;
      const totalSec = Math.floor(diffMs / 1000);
      const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const s = String(totalSec % 60).padStart(2, "0");
      setElapsedTime(`${h}:${m}:${s}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  // Fetch coordinates on mount
  useEffect(() => {
    setCoordsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocalCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setCoordsLoading(false);
        },
        () => setCoordsLoading(false),
        { timeout: 5000 }
      );
    } else {
      setCoordsLoading(false);
    }
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setLocalIp(data.ip))
      .catch(() => {});
  }, []);

  const triggerAlert = (type: "success" | "danger" | "warning", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const loadData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [
        profileRes,
        leaveRes,
        attendanceRes,
        trainingRes,
        announcementRes,
        onboardingRes,
        treeRes,
        payrollRes
      ] = await Promise.all([
        API.get(`/employees/${employeeId}/`),
        API.get("/leave-balances/my-summary/"),
        API.get(`/attendance-records/?employee_id=${employeeId}`),
        API.get("/training-enrollments/"),
        API.get("/announcements/"),
        API.get("/onboarding/tasks/"),
        API.get("/employees/tree/"),
        API.get("/employee-payroll/")
      ]);

      setProfile(profileRes.data);
      setLeaveSummary(leaveRes.data);
      setAttendance(normalizeList<AttendanceRecord>(attendanceRes.data));
      setTrainings(normalizeList<TrainingEnrollment>(trainingRes.data));
      setAnnouncements(normalizeList<Announcement>(announcementRes.data));
      setOnboardingTasks(normalizeList<OnboardingTask>(onboardingRes.data).filter((t: any) => t.record?.employee === employeeId));
      setPayrolls(normalizeList<any>(payrollRes.data));

      // Parse reporting structure
      const findTeam = (nodes: MemberNode[], parent: MemberNode | null = null): boolean => {
        for (const n of nodes) {
          if (n.id === employeeId) {
            setTeam({
              manager: parent,
              peers: parent ? (parent.children || []).filter((c) => c.id !== employeeId) : []
            });
            return true;
          }
          if (n.children && n.children.length > 0) {
            if (findTeam(n.children, n)) return true;
          }
        }
        return false;
      };
      findTeam(normalizeList<MemberNode>(treeRes.data));

    } catch (err) {
      console.error("Failed to load workspace data", err);
      triggerAlert("danger", "Could not synchronize all self-service modules.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await refreshUser();
      if (active) loadData();
    };
    init();
    return () => { active = false; };
  }, [loadData]);

  // Clock In
  const handlePunchIn = async () => {
    setSaving(true);
    try {
      const payload = {
        work_date: new Date().toISOString().slice(0, 10),
        check_in_lat: localCoords?.latitude || null,
        check_in_lng: localCoords?.longitude || null,
        check_in_ip: localIp || null,
        check_in_method: punchWorkMode.toLowerCase() === "office" ? "manual" : "web",
        notes: `Work Mode: ${punchWorkMode}`
      };
      await API.post("/attendance-records/", payload);
      triggerAlert("success", "Successfully clocked in for today.");
      loadData();
    } catch (err: any) {
      console.error("Failed to clock in", err);
      triggerAlert("danger", err?.response?.data?.detail || "Clock-in failed. Please verify GPS coordinates.");
    } finally {
      setSaving(false);
    }
  };

  // Clock Out
  const handlePunchOut = async () => {
    if (!todayRecord) return;
    if (!window.confirm("Are you sure you want to clock out of your shift?")) return;
    setSaving(true);
    try {
      const payload = {
        check_out_lat: localCoords?.latitude || null,
        check_out_lng: localCoords?.longitude || null,
        check_out_ip: localIp || null
      };
      await API.put(`/attendance-records/${todayRecord.id}/`, payload);
      triggerAlert("success", "Successfully clocked out of your shift.");
      loadData();
    } catch (err: any) {
      console.error("Failed to clock out", err);
      triggerAlert("danger", "Clock-out failed.");
    } finally {
      setSaving(false);
    }
  };

  // Mark Announcement Read
  const handleMarkRead = async (announcementId: number) => {
    try {
      await API.post(`/announcements/${announcementId}/mark-read/`);
      triggerAlert("success", "Announcement marked as read.");
      // Locally update announcement list
      setAnnouncements((prev) =>
        prev.map((ann) =>
          ann.id === announcementId ? { ...ann, read_by: [...ann.read_by, user?.id || 0] } : ann
        )
      );
    } catch (err) {
      console.error("Failed to mark announcement as read", err);
      triggerAlert("danger", "Could not complete marking announcement as read.");
    }
  };

  // Download Payslip PDF
  const handleDownloadPayslip = async (payrollId: number) => {
    try {
      const response = await API.get(`/payroll/${payrollId}/payslip-pdf/`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payslip-${payrollId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      triggerAlert("success", "Payslip PDF downloaded successfully.");
    } catch (err) {
      console.error("Failed to fetch payslip PDF", err);
      triggerAlert("danger", "Payslip PDF is not ready or failed to generate.");
    }
  };

  const latestPayroll = useMemo(() => payrolls[0] || null, [payrolls]);

  if (loading) {
    return (
      <div className="page-wrapper d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3.5rem", height: "3.5rem" }}>
            <span className="visually-hidden">Syncing Workspace...</span>
          </div>
          <h4 className="fw-semibold text-dark">Opening My Workspace</h4>
          <p className="text-muted small">Configuring self-service widgets and syncing reports...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid">
          <div className="card shadow-sm border-0 p-5 text-center mt-5" style={{ borderRadius: "20px" }}>
            <div className="avatar avatar-xxl bg-warning-subtle text-warning mx-auto mb-4" style={{ width: "80px", height: "80px", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
              <i className="ti ti-user-x fs-1" />
            </div>
            <h2 className="fw-bold text-dark">No Associated Employee Profile</h2>
            <p className="text-muted mx-auto" style={{ maxWidth: "500px" }}>
              Your login credentials are not currently linked to an Employee record in the HRMS. Please reach out to your HR Administrator to establish the linkage so you can access attendance, leaves, and payroll records.
            </p>
            <div className="mt-4">
              <Link to={routes.adminDashboard} className="btn btn-primary px-4 py-2" style={{ borderRadius: "10px" }}>
                Go to Homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        {/* Banner Welcome */}
        <div className="card payroll-hero mb-4 border-0 shadow-sm" style={{ borderRadius: "20px" }}>
          <div className="card-body p-4">
            <div className="row g-4 align-items-center">
              <div className="col-xl-8">
                <span className="payroll-kicker bg-primary text-white px-3 py-1 rounded-pill mb-2 d-inline-flex align-items-center gap-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>
                  <i className="ti ti-user-check" /> Self-Service Portal
                </span>
                <h1 className="payroll-title fw-extrabold text-dark mb-2">Welcome back, {profile.first_name} {profile.last_name || ""}</h1>
                <p className="payroll-subtitle text-muted mb-0">
                  Manage your attendance, verify leave balances, download statutory payslips, and review outstanding onboarding activities.
                </p>
              </div>
              <div className="col-xl-4 text-xl-end">
                <div className="d-flex flex-wrap gap-2 justify-content-xl-end">
                  <Link to={routes.employeedetails} className="btn btn-white shadow-sm px-3.5 py-2 fw-semibold" style={{ borderRadius: "10px" }}>
                    <i className="ti ti-id-badge-2 me-1.5" /> My Profile
                  </Link>
                  {latestPayroll && (
                    <button onClick={() => handleDownloadPayslip(latestPayroll.id)} className="btn btn-primary shadow-sm px-3.5 py-2 fw-semibold" style={{ borderRadius: "10px" }}>
                      <i className="ti ti-download me-1.5" /> Download Payslip
                    </button>
                  )}
                  <CollapseHeader />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Alert Notification Banner */}
        {alertMsg && (
          <div className={`alert alert-${alertMsg.type} alert-dismissible fade show shadow-sm mb-4 border-0`} role="alert" style={{ borderRadius: "12px" }}>
            <div className="d-flex align-items-center gap-2">
              <i className={alertMsg.type === "success" ? "ti ti-circle-check fs-5" : "ti ti-alert-triangle fs-5"} />
              <span className="fw-semibold small">{alertMsg.text}</span>
            </div>
            <button type="button" className="btn-close" onClick={() => setAlertMsg(null)} aria-label="Close" />
          </div>
        )}

        {/* Stats Row */}
        <div className="row g-4 mb-4">
          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "16px" }}>
              <div className="card-body d-flex align-items-center gap-3">
                <div className="bg-primary-subtle text-primary rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ width: "54px", height: "54px" }}>
                  <i className="ti ti-calendar-event fs-3" />
                </div>
                <div>
                  <span className="text-muted small d-block">Pending Leaves</span>
                  <h4 className="fw-bold mb-0 text-dark">{leaveSummary?.pending_requests_count || 0} Requests</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "16px" }}>
              <div className="card-body d-flex align-items-center gap-3">
                <div className="bg-success-subtle text-success rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ width: "54px", height: "54px" }}>
                  <i className="ti ti-alarm fs-3" />
                </div>
                <div>
                  <span className="text-muted small d-block">Shift Duration</span>
                  <h4 className="fw-bold mb-0 text-dark">{todayRecord ? (todayRecord.check_out_time ? "Shift Completed" : elapsedTime) : "Not Clocked In"}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "16px" }}>
              <div className="card-body d-flex align-items-center gap-3">
                <div className="bg-info-subtle text-info rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ width: "54px", height: "54px" }}>
                  <i className="ti ti-wallet fs-3" />
                </div>
                <div>
                  <span className="text-muted small d-block">Current Salary</span>
                  <h4 className="fw-bold mb-0 text-dark">{formatCurrency(profile.salary)}</h4>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "16px" }}>
              <div className="card-body d-flex align-items-center gap-3">
                <div className="bg-warning-subtle text-warning rounded-3 p-3 d-flex align-items-center justify-content-center" style={{ width: "54px", height: "54px" }}>
                  <i className="ti ti-checkbox fs-3" />
                </div>
                <div>
                  <span className="text-muted small d-block">Pending Tasks</span>
                  <h4 className="fw-bold mb-0 text-dark">{onboardingTasks.filter((t) => t.status !== "completed").length} Checklist Items</h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Panels */}
        <div className="row g-4">
          {/* Left Main Dashboard */}
          <div className="col-xl-8">
            <div className="row g-4">
              {/* Punch Card Widget */}
              <div className="col-md-6">
                <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "18px" }}>
                  <div className="card-header bg-white border-0 py-3 d-flex align-items-center justify-content-between">
                    <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                      <i className="ti ti-fingerprint text-primary me-2" /> Attendance Punch Clock
                    </h5>
                    {todayRecord ? (
                      <span className={`badge ${todayRecord.check_out_time ? "bg-success-subtle text-success" : "bg-primary-subtle text-primary"} px-2.5 py-1.5`} style={{ borderRadius: "8px" }}>
                        {todayRecord.check_out_time ? "Shift Ended" : "Active Shift"}
                      </span>
                    ) : (
                      <span className="badge bg-danger-subtle text-danger px-2.5 py-1.5" style={{ borderRadius: "8px" }}>
                        Off Duty
                      </span>
                    )}
                  </div>
                  <div className="card-body text-center p-4">
                    {todayRecord ? (
                      todayRecord.check_out_time ? (
                        <div className="py-3">
                          <div className="avatar avatar-xl bg-success-subtle text-success rounded-circle mb-3 mx-auto" style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <i className="ti ti-check fs-2" />
                          </div>
                          <h5 className="fw-extrabold text-dark mb-1">Shift Completed</h5>
                          <p className="text-muted small mb-0">
                            Clocked In: <strong>{todayRecord.check_in_time}</strong> • Clocked Out: <strong>{todayRecord.check_out_time}</strong>
                          </p>
                          <div className="mt-3">
                            <span className="text-muted small">Total Hours worked: </span>
                            <span className="badge bg-light text-dark fw-bold px-3 py-2 fs-6" style={{ borderRadius: "8px" }}>{todayRecord.total_hours || 0} hrs</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="pulse-timer mb-2" style={{ fontFamily: "monospace", fontSize: "36px", fontWeight: "800", color: "#0052ea", letterSpacing: "1px" }}>
                            {elapsedTime}
                          </div>
                          <p className="text-muted small mb-4">
                            Active Shift • Checked in at <strong>{todayRecord.check_in_time}</strong>
                          </p>
                          <button
                            type="button"
                            className="btn btn-danger w-100 py-2.5"
                            style={{ borderRadius: "12px", fontWeight: "700" }}
                            onClick={handlePunchOut}
                            disabled={saving}
                          >
                            <i className="ti ti-logout me-1.5" /> Clock Out
                          </button>
                        </div>
                      )
                    ) : (
                      <div>
                        <div className="text-muted small mb-3">
                          You are currently clocked out. Select your work mode below and check-in to begin recording your day.
                        </div>
                        <div className="mb-3">
                          <select
                            className="form-select mx-auto"
                            style={{ maxWidth: "200px", borderRadius: "10px" }}
                            value={punchWorkMode}
                            onChange={(e) => setPunchWorkMode(e.target.value)}
                          >
                            <option value="Office">Office Location</option>
                            <option value="Remote">Remote (WFH)</option>
                            <option value="Hybrid">Hybrid Setup</option>
                          </select>
                        </div>
                        <div className="small text-muted mb-4">
                          {coordsLoading ? (
                            <span><span className="spinner-border spinner-border-sm me-1" /> Checking location...</span>
                          ) : localCoords ? (
                            <span className="text-success fw-bold"><i className="ti ti-map-pin me-1" /> GPS Checked ({localCoords.latitude.toFixed(4)}, {localCoords.longitude.toFixed(4)})</span>
                          ) : (
                            <span className="text-warning fw-bold"><i className="ti ti-alert-triangle me-1" /> Geofencing Offline</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary w-100 py-2.5"
                          style={{ borderRadius: "12px", fontWeight: "700" }}
                          onClick={handlePunchIn}
                          disabled={saving}
                        >
                          <i className="ti ti-fingerprint me-1.5" /> Clock In
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Leave Summary Panel */}
              <div className="col-md-6">
                <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "18px" }}>
                  <div className="card-header bg-white border-0 py-3 d-flex align-items-center justify-content-between">
                    <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                      <i className="ti ti-calendar-off text-primary me-2" /> Leave Entitlements
                    </h5>
                    <Link to={routes.leaveemployee} className="btn btn-link btn-sm p-0 fw-semibold text-primary">
                      Manage Leaves
                    </Link>
                  </div>
                  <div className="card-body p-4">
                    {leaveSummary && leaveSummary.balances.length > 0 ? (
                      <div className="row g-3">
                        {leaveSummary.balances.slice(0, 4).map((bal, idx) => (
                          <div key={idx} className="col-6">
                            <div className="border rounded-3 p-3 text-center bg-light">
                              <span className="text-muted small d-block mb-1">{bal.leave_type}</span>
                              <h4 className="fw-extrabold mb-0 text-dark">
                                {bal.available} <span className="small text-muted" style={{ fontSize: "11px" }}>/ {bal.annual_allocation}</span>
                              </h4>
                              <span className="text-muted" style={{ fontSize: "10.5px" }}>{bal.used} used</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <i className="ti ti-calendar-question fs-2 text-muted mb-2" />
                        <p className="text-muted small mb-0">No active leave balances mapped for {new Date().getFullYear()}.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* My Team Panel */}
              <div className="col-12">
                <div className="card shadow-sm border-0" style={{ borderRadius: "18px" }}>
                  <div className="card-header bg-white border-0 py-3">
                    <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                      <i className="ti ti-users-group text-primary me-2" /> My Collaboration Circle
                    </h5>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-4">
                      {/* Reporting Manager */}
                      <div className="col-md-5">
                        <div className="border rounded-4 p-3 h-100 bg-light">
                          <span className="badge bg-primary text-white mb-3" style={{ borderRadius: "6px" }}>Reporting Manager</span>
                          {team.manager ? (
                            <div className="d-flex align-items-center gap-3">
                              <div className="avatar avatar-md rounded-circle bg-primary-subtle text-primary fw-bold" style={{ width: "45px", height: "45px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {team.manager.first_name[0]}{team.manager.last_name ? team.manager.last_name[0] : ""}
                              </div>
                              <div>
                                <h6 className="fw-bold mb-0 text-dark">{team.manager.first_name} {team.manager.last_name || ""}</h6>
                                <span className="text-muted small d-block">{team.manager.designation || "Designation Not Specified"}</span>
                                <span className="text-muted small d-block">{team.manager.email}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted small py-2">No reporting manager assigned to your profile.</div>
                          )}
                        </div>
                      </div>

                      {/* Colleagues / Peers */}
                      <div className="col-md-7">
                        <div className="border rounded-4 p-3 h-100">
                          <span className="text-muted small d-block mb-3 fw-bold">Department Siblings ({team.peers.length})</span>
                          <div className="d-flex flex-wrap gap-2.5">
                            {team.peers.slice(0, 6).map((peer, idx) => (
                              <div key={idx} className="d-flex align-items-center gap-2 border rounded-pill px-3 py-2 bg-light shadow-sm" style={{ fontSize: "13px" }}>
                                <div className="avatar avatar-xs rounded-circle bg-secondary-subtle text-secondary fw-bold" style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
                                  {peer.first_name[0]}
                                </div>
                                <span className="fw-semibold text-dark">{peer.first_name} {peer.last_name || ""}</span>
                              </div>
                            ))}
                            {team.peers.length === 0 && (
                              <div className="text-muted small py-2">No active team peers located.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Dashboard */}
          <div className="col-xl-4">
            <div className="row g-4">
              {/* Company Announcements */}
              <div className="col-12">
                <div className="card shadow-sm border-0" style={{ borderRadius: "18px" }}>
                  <div className="card-header bg-white border-0 py-3">
                    <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                      <i className="ti ti-speakerphone text-primary me-2" /> Notice Board
                    </h5>
                  </div>
                  <div className="card-body p-4 pt-0">
                    <div className="d-flex flex-column gap-3" style={{ maxHeight: "350px", overflowY: "auto" }}>
                      {announcements.slice(0, 4).map((ann, idx) => {
                        const isRead = ann.read_by.includes(user?.id || 0);
                        return (
                          <div key={idx} className={`border rounded-4 p-3 position-relative ${ann.is_pinned ? "border-primary" : ""}`} style={{ backgroundColor: isRead ? "#ffffff" : "#f0f4ff" }}>
                            {ann.is_pinned && (
                              <span className="badge bg-primary text-white position-absolute end-0 top-0 m-2.5" style={{ fontSize: "9px" }}>
                                Pinned
                              </span>
                            )}
                            <span className={`badge ${ann.priority === "high" || ann.priority === "urgent" ? "bg-danger-subtle text-danger" : "bg-light text-muted"} mb-1.5`} style={{ fontSize: "9px" }}>
                              {ann.priority.toUpperCase()}
                            </span>
                            <h6 className="fw-bold text-dark mb-1">{ann.title}</h6>
                            <p className="text-muted mb-2" style={{ fontSize: "12px" }}>{ann.body}</p>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="text-muted" style={{ fontSize: "10.5px" }}>{formatDate(ann.published_at)}</span>
                              {!isRead && (
                                <button onClick={() => handleMarkRead(ann.id)} className="btn btn-outline-primary btn-xs py-1 px-2.5" style={{ borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                                  Mark as Read
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {announcements.length === 0 && (
                        <div className="text-center py-4 text-muted small">No announcements posted currently.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming Trainings */}
              <div className="col-12">
                <div className="card shadow-sm border-0" style={{ borderRadius: "18px" }}>
                  <div className="card-header bg-white border-0 py-3">
                    <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                      <i className="ti ti-school text-primary me-2" /> Assigned Trainings
                    </h5>
                  </div>
                  <div className="card-body p-4 pt-0">
                    <div className="d-flex flex-column gap-3">
                      {trainings.slice(0, 3).map((tr, idx) => (
                        <div key={idx} className="border rounded-4 p-3 bg-light">
                          <h6 className="fw-bold text-dark mb-1">{tr.program.title}</h6>
                          <div className="text-muted mb-2" style={{ fontSize: "12px" }}>
                            Instructor: {tr.program.trainer_name || "Internal"} • Type: {tr.program.training_type}
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted" style={{ fontSize: "11px" }}>
                              {formatDate(tr.program.start_date)}
                            </span>
                            <span className={`badge ${tr.status === "completed" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`} style={{ borderRadius: "6px" }}>
                              {tr.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                      {trainings.length === 0 && (
                        <div className="text-center py-3 text-muted small">No active training courses assigned.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Tasks / Onboarding Checklists */}
              <div className="col-12">
                <div className="card shadow-sm border-0" style={{ borderRadius: "18px" }}>
                  <div className="card-header bg-white border-0 py-3">
                    <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                      <i className="ti ti-list-check text-primary me-2" /> Pending Onboarding Tasks
                    </h5>
                  </div>
                  <div className="card-body p-4 pt-0">
                    <div className="d-flex flex-column gap-2.5">
                      {onboardingTasks.slice(0, 4).map((task, idx) => (
                        <div key={idx} className="d-flex align-items-center justify-content-between border rounded-3 p-2.5 bg-light" style={{ fontSize: "13px" }}>
                          <span className="fw-semibold text-dark">{task.title}</span>
                          <span className={`badge ${task.status === "completed" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`} style={{ borderRadius: "6px" }}>
                            {task.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                      {onboardingTasks.length === 0 && (
                        <div className="text-center py-3 text-muted small">No pending onboarding checklist items.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyWorkspace;
