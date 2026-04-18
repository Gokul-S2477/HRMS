import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactApexChart from "react-apexcharts";

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
  date_of_birth?: string | null;
  salary?: number | string | null;
  reporting_to?: number | null;
  work_location?: string | null;
  work_shift?: string | null;
  bank_info?: Record<string, any> | null;
};

type PayrollRecord = {
  id: number;
  month?: string;
  year?: number;
  net_salary?: number | string;
  gross_salary?: number | string;
  total_deductions?: number | string;
};

type ResourceRecord = {
  id: string;
  data?: Record<string, any>;
};

type LeaveBalanceRecord = {
  id: number;
  leave_type?: string;
  annual_allocation?: number | string;
  carry_forward?: number | string;
  available?: number | string;
  pending?: number | string;
  used?: number | string;
};

const normalizeList = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const toNumber = (value: any) => {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: any) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(toNumber(value));

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const leaveDays = (from?: string | null, to?: string | null) => {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return diff > 0 ? diff : 0;
};

const fullName = (profile?: EmployeeProfile | null) =>
  `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Employee";

const EmployeeDashboard: React.FC = () => {
  const routes = all_routes;
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [attendance, setAttendance] = useState<ResourceRecord[]>([]);
  const [leaves, setLeaves] = useState<ResourceRecord[]>([]);
  const [tickets, setTickets] = useState<ResourceRecord[]>([]);
  const [training, setTraining] = useState<ResourceRecord[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRecord[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const employeeId = user?.employee_profile?.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await refreshUser().catch(() => undefined);
      const selfEmployeeId = user?.employee_profile?.id || employeeId;
      if (!selfEmployeeId) {
        setProfile(null);
        return;
      }
      const [profileRes, payrollRes, attendanceRes, leaveRes, ticketRes, trainingRes, leaveBalanceRes, policiesRes] = await Promise.all([
        API.get(`/employees/${selfEmployeeId}/`),
        API.get("/employee-payroll/"),
        API.get("/data/attendance-employee/"),
        API.get("/data/leave-employee/"),
        API.get("/data/tickets/"),
        API.get("/data/training-sessions/"),
        API.get("/leave-balances/"),
        API.get("/policies/"),
      ]);
      setProfile(profileRes.data);
      setPayrolls(normalizeList<PayrollRecord>(payrollRes.data));
      setAttendance(normalizeList<ResourceRecord>(attendanceRes.data));
      setLeaves(normalizeList<ResourceRecord>(leaveRes.data));
      setTickets(normalizeList<ResourceRecord>(ticketRes.data));
      setTraining(normalizeList<ResourceRecord>(trainingRes.data));
      setLeaveBalances(normalizeList<LeaveBalanceRecord>(leaveBalanceRes.data));
      setPolicies(normalizeList<any>(policiesRes.data));
    } catch (error) {
      console.error("Failed to load employee workspace", error);
      setProfile(null);
      setPayrolls([]);
      setAttendance([]);
      setLeaves([]);
      setTickets([]);
      setTraining([]);
      setLeaveBalances([]);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, refreshUser, user?.employee_profile?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const attendanceSummary = useMemo(() => {
    const summary = { present: 0, late: 0, remote: 0, absent: 0 };
    attendance.forEach((record) => {
      const status = String(record.data?.status || "").toLowerCase();
      const workMode = String(record.data?.work_mode || "").toLowerCase();
      if (status.includes("late")) summary.late += 1;
      else if (status.includes("absent")) summary.absent += 1;
      else summary.present += 1;
      if (workMode.includes("remote") || workMode.includes("home")) summary.remote += 1;
    });
    return summary;
  }, [attendance]);

  const leaveSummary = useMemo(() => {
    const summary = { approved: 0, pending: 0, rejected: 0, preInformedDays: 0, postInformedDays: 0 };
    leaves.forEach((record) => {
      const status = String(record.data?.status || "pending").toLowerCase();
      if (status.includes("approved")) summary.approved += 1;
      else if (status.includes("reject")) summary.rejected += 1;
      else summary.pending += 1;

      if (status.includes("approved")) {
        const days = leaveDays(record.data?.from_date, record.data?.to_date);
        const noticeTiming = String(record.data?.notice_timing || "").toLowerCase();
        if (noticeTiming === "pre-informed") summary.preInformedDays += days;
        if (noticeTiming === "post-informed") summary.postInformedDays += days;
      }
    });
    return summary;
  }, [leaves]);

  const ticketSummary = useMemo(() => {
    const open = tickets.filter((item) => !String(item.data?.status || "").toLowerCase().includes("close") && !String(item.data?.status || "").toLowerCase().includes("solved")).length;
    return {
      open,
      total: tickets.length,
    };
  }, [tickets]);

  const latestPayroll = useMemo(() => payrolls[0] || null, [payrolls]);
  const leaveBalanceSummary = useMemo(() => {
    const available = leaveBalances.reduce((sum, item) => sum + toNumber(item.available), 0);
    const pending = leaveBalances.reduce((sum, item) => sum + toNumber(item.pending), 0);
    const used = leaveBalances.reduce((sum, item) => sum + toNumber(item.used), 0);
    return { available, pending, used };
  }, [leaveBalances]);
  const payrollChartSeries = useMemo(() => {
    const recent = [...payrolls].slice(0, 6).reverse();
    return [
      { name: "Net Salary", data: recent.map((item) => toNumber(item.net_salary)) },
      { name: "Deductions", data: recent.map((item) => toNumber(item.total_deductions)) },
    ];
  }, [payrolls]);

  const payrollChartOptions = useMemo(
    () => ({
      chart: { type: "area", toolbar: { show: false } },
      stroke: { curve: "smooth", width: 3 },
      dataLabels: { enabled: false },
      colors: ["#ff7a1a", "#1f6bff"],
      xaxis: {
        categories: [...payrolls].slice(0, 6).reverse().map((item) => `${item.month || ""} ${item.year || ""}`.trim()),
      },
      legend: { position: "top" },
    }),
    [payrolls]
  );

  const attendanceChart = useMemo(
    () => ({
      chart: { type: "donut", toolbar: { show: false } },
      dataLabels: { enabled: false },
      colors: ["#03c95a", "#ff7a1a", "#1f6bff", "#e70d0d"],
      labels: ["Present", "Late", "Remote", "Absent"],
      legend: { position: "bottom" },
    }),
    []
  );

  const leaveChart = useMemo(
    () => ({
      chart: { type: "bar", toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 8, columnWidth: "42%" } },
      dataLabels: { enabled: false },
      colors: ["#03c95a", "#ff7a1a", "#1f6bff"],
      xaxis: { categories: ["Pre-informed Days", "Post-informed Days", "Pending Requests"] },
    }),
    []
  );

  const stats = useMemo(() => {
    const attendanceTotal = attendance.length || 1;
    const punctuality = Math.round(((attendanceSummary.present + attendanceSummary.remote) / attendanceTotal) * 100);
    return [
      { label: "Latest Net Pay", value: latestPayroll ? formatCurrency(latestPayroll.net_salary) : formatCurrency(profile?.salary), meta: latestPayroll ? `${latestPayroll.month} ${latestPayroll.year}` : "Using current salary profile" },
      { label: "Punctuality", value: `${punctuality}%`, meta: `${attendanceSummary.late} late log(s) recorded` },
      { label: "Leave Requests", value: leaves.length, meta: `${leaveBalanceSummary.available} day(s) available / ${leaveBalanceSummary.pending} on hold` },
      { label: "Open Tickets", value: ticketSummary.open, meta: `${ticketSummary.total} total support request(s)` },
    ];
  }, [attendance.length, attendanceSummary, latestPayroll, leaveBalanceSummary.available, leaveBalanceSummary.pending, leaves.length, profile?.salary, ticketSummary]);

  const latestPayslipRoute = latestPayroll ? routes.payslipsView.replace(":id", String(latestPayroll.id)) : routes.payslips;

  if (!loading && !employeeId && !profile) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell employee-shell">
          <div className="card payroll-hero">
            <div className="card-body text-center py-5">
              <span className="payroll-kicker">
                <i className="ti ti-user-question"></i>
                Self-Service Setup Needed
              </span>
              <h1 className="payroll-title">No employee profile is linked to this login yet</h1>
              <p className="payroll-subtitle mx-auto">
                Ask HR or your super admin to link this account to an employee record in User Access so the self-service dashboard, payslips, attendance, and leave workflows can load correctly.
              </p>
              <div className="payroll-hero-actions justify-content-center mt-4">
                {user?.can_manage_accounts ? (
                  <Link to={routes.manageusers} className="btn btn-primary">
                    <i className="ti ti-shield-lock me-2"></i>
                    Open User Access
                  </Link>
                ) : null}
                <Link to={routes.adminDashboard} className="btn btn-white">
                  <i className="ti ti-layout-dashboard me-2"></i>
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row g-4 align-items-start">
              <div className="col-xl-8">
                <span className="payroll-kicker">
                  <i className="ti ti-layout-dashboard"></i>
                  Employee Self-Service
                </span>
                <h1 className="payroll-title">Welcome back, {fullName(profile)}</h1>
                <p className="payroll-subtitle">
                  Review your payroll, attendance, leave, support tickets, training, and policy updates from a single employee workspace built for day-to-day clarity.
                </p>
              </div>
              <div className="col-xl-4">
                <div className="payroll-hero-actions justify-content-xl-end">
                  <Link to={routes.employeedetails} className="btn btn-white">
                    <i className="ti ti-id-badge-2 me-2"></i>
                    Open My Profile
                  </Link>
                  <Link to={latestPayslipRoute} className="btn btn-primary">
                    <i className="ti ti-receipt-2 me-2"></i>
                    View Latest Payslip
                  </Link>
                  <CollapseHeader />
                </div>
              </div>
            </div>
            <div className="payroll-stat-grid mt-4">
              {stats.map((card) => (
                <div key={card.label} className="card payroll-stat-card">
                  <div className="card-body">
                    <span className="payroll-stat-label">{card.label}</span>
                    <h3 className="payroll-stat-value">{card.value}</h3>
                    <div className="payroll-stat-meta">{card.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-xl-4">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <div className="d-flex align-items-center gap-3 mb-4">
                  <span className="avatar avatar-xl">
                    <span className="avatar-title rounded-circle bg-primary-subtle text-primary fw-bold fs-4">
                      {fullName(profile).split(" ").filter(Boolean).slice(0, 2).map((item) => item[0]).join("") || "EM"}
                    </span>
                  </span>
                  <div>
                    <h4 className="mb-1">{fullName(profile)}</h4>
                    <div className="text-muted small">{profile?.designation?.title || "Employee"} / {profile?.department?.name || "Department pending"}</div>
                    <div className="small text-muted">{profile?.emp_code || "No employee code"}</div>
                  </div>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div>
                    <div className="text-muted small">Email</div>
                    <div className="fw-semibold">{profile?.email || user?.email || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted small">Phone</div>
                    <div className="fw-semibold">{profile?.phone || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted small">Joined</div>
                    <div className="fw-semibold">{formatDate(profile?.joining_date)}</div>
                  </div>
                  <div>
                    <div className="text-muted small">Work Setup</div>
                    <div className="fw-semibold">{profile?.work_location || "Onsite"} / {profile?.work_shift || "General shift"}</div>
                  </div>
                  <div>
                    <div className="text-muted small">Bank Snapshot</div>
                    <div className="fw-semibold">{profile?.bank_info?.bank_name || "Bank details pending"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <div className="row g-4">
                  <div className="col-lg-8">
                    <h5 className="mb-2">Salary trend</h5>
                    <div className="text-muted small mb-3">A quick view of take-home pay versus deductions across the latest payroll runs.</div>
                    <ReactApexChart options={payrollChartOptions as any} series={payrollChartSeries as any} type="area" height={280} />
                  </div>
                  <div className="col-lg-4">
                    <h5 className="mb-2">Attendance mix</h5>
                    <div className="text-muted small mb-3">See how your workdays are currently distributed.</div>
                    <ReactApexChart
                      options={attendanceChart as any}
                      series={[attendanceSummary.present, attendanceSummary.late, attendanceSummary.remote, attendanceSummary.absent] as any}
                      type="donut"
                      height={280}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <h5 className="mb-2">Leave health</h5>
                <div className="text-muted small mb-3">See how many approved leave days were informed before leave versus reported afterward.</div>
                <ReactApexChart
                  options={leaveChart as any}
                  series={[
                    {
                      name: "Leave Insight",
                      data: [leaveSummary.preInformedDays, leaveSummary.postInformedDays, leaveSummary.pending],
                    },
                  ] as any}
                  type="bar"
                  height={260}
                />
                <div className="payroll-summary-list mt-3">
                  <div className="payroll-summary-row">
                    <span>Available balance</span>
                    <strong>{leaveBalanceSummary.available}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Approved requests</span>
                    <strong>{leaveSummary.approved}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Pre-informed days</span>
                    <strong>{leaveSummary.preInformedDays}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Post-informed days</span>
                    <strong>{leaveSummary.postInformedDays}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Pending balance hold</span>
                    <strong>{leaveBalanceSummary.pending}</strong>
                  </div>
                </div>
                <Link to={routes.leaveemployee} className="btn btn-light w-100 mt-3">Manage My Leave</Link>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1">Recent support tickets</h5>
                    <div className="text-muted small">Follow up on open help requests.</div>
                  </div>
                  <Link to={routes.tickets} className="btn btn-light btn-sm">View all</Link>
                </div>
                <div className="d-flex flex-column gap-3">
                  {tickets.slice(0, 4).map((ticket) => (
                    <div key={ticket.id} className="border rounded-4 p-3">
                      <div className="d-flex justify-content-between gap-3">
                        <div>
                          <div className="fw-semibold">{ticket.data?.title || "Support ticket"}</div>
                          <div className="small text-muted">{ticket.data?.category || "General"} • {ticket.data?.status || "Open"}</div>
                        </div>
                        <span className="badge badge-soft-info">{ticket.data?.priority || "Normal"}</span>
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 ? <div className="text-muted">No tickets logged from this account yet.</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1">Training and policy updates</h5>
                    <div className="text-muted small">Stay aligned with upcoming learning and company rules.</div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="fw-semibold mb-2">Upcoming training</div>
                  <div className="d-flex flex-column gap-2">
                    {training.slice(0, 3).map((record) => (
                      <div key={record.id} className="border rounded-4 p-3">
                        <div className="fw-semibold">{record.data?.title || "Training session"}</div>
                        <div className="small text-muted">{record.data?.status || "Scheduled"} • {record.data?.start_date || record.data?.date || "Date pending"}</div>
                      </div>
                    ))}
                    {training.length === 0 ? <div className="text-muted">No upcoming training assigned yet.</div> : null}
                  </div>
                </div>
                <div>
                  <div className="fw-semibold mb-2">Latest policies</div>
                  <div className="d-flex flex-column gap-2">
                    {policies.slice(0, 3).map((policy: any) => (
                      <div key={policy.id} className="border rounded-4 p-3">
                        <div className="fw-semibold">{policy.title}</div>
                        <div className="small text-muted">{policy.department?.name || policy.department_detail?.name || "All departments"}</div>
                      </div>
                    ))}
                    {policies.length === 0 ? <div className="text-muted">No policy updates available.</div> : null}
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

export default EmployeeDashboard;





