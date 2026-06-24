import React, { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { all_routes } from "../../router/all_routes";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Chart } from "primereact/chart";
import { Calendar } from 'primereact/calendar';
import ProjectModals from "../../../core/modals/projectModal";
import RequestModals from "../../../core/modals/requestModal";
import TodoModal from "../../../core/modals/todoModal";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import UpcomingReminderBanner from "../../liveops/UpcomingReminderBanner";
import API from "../../../api/axios";
import { useAuth } from "../../../core/auth/AuthContext";

const AdminDashboard = () => {
  const routes = all_routes;
  const { user } = useAuth();

  const [date, setDate] = useState(new Date());
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Todo Checkbox State
  const [todos, setTodos] = useState<any[]>([]);

  // Fetch Dashboard Stats
  const fetchStats = async () => {
    try {
      const res = await API.get("/dashboard/admin/");
      setStats(res.data);
      if (res.data.todos) {
        setTodos(res.data.todos);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Toggle Todo completion
  const handleToggleTodo = async (todoId: string, currentStatus: boolean) => {
    try {
      // Optimistically update frontend state
      setTodos(prev => prev.map(t => t.id === todoId ? { ...t, is_completed: !currentStatus } : t));
      
      // Patch to database
      await API.patch(`/productivity/todos/${todoId}/`, {
        data: {
          is_completed: !currentStatus
        }
      });
    } catch (err) {
      console.error("Error toggling todo completion:", err);
      // Revert if API failed
      fetchStats();
    }
  };

  // 1. Employees By Department Chart
  const [empDepartment, setEmpDepartment] = useState<any>({
    chart: {
      height: 235,
      type: 'bar',
      padding: { top: 0, left: 0, right: 0, bottom: 0 },
      toolbar: { show: false }
    },
    fill: {
      colors: ['#F26522'],
      opacity: 1,
    },
    colors: ['#F26522'],
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 5,
      padding: { top: -20, left: 0, right: 0, bottom: 0 }
    },
    plotOptions: {
      bar: {
        borderRadius: 5,
        horizontal: true,
        barHeight: '35%',
        endingShape: 'rounded'
      }
    },
    dataLabels: { enabled: false },
    series: [{ data: [80, 110, 80, 20, 60, 100], name: 'Employee' }],
    xaxis: {
      categories: ['UI/UX', 'Development', 'Management', 'HR', 'Testing', 'Marketing'],
      labels: { style: { colors: '#111827', fontSize: '13px' } }
    }
  });

  useEffect(() => {
    if (stats && stats.department_chart) {
      setEmpDepartment((prev: any) => ({
        ...prev,
        series: [{ data: stats.department_chart.counts, name: 'Employee' }],
        xaxis: {
          ...prev.xaxis,
          categories: stats.department_chart.labels
        }
      }));
    }
  }, [stats]);

  // 2. Sales vs Expenses stacked bar chart
  const [salesIncome, setSalesIncome] = useState<any>({
    chart: {
      height: 290,
      type: 'bar',
      stacked: true,
      toolbar: { show: false }
    },
    colors: ['#FF6F28', '#E5E7EB'],
    responsive: [{
      breakpoint: 480,
      options: {
        legend: { position: 'bottom', offsetX: -10, offsetY: 0 }
      }
    }],
    plotOptions: {
      bar: {
        borderRadius: 5,
        borderRadiusWhenStacked: 'all',
        horizontal: false,
        endingShape: 'rounded'
      },
    },
    series: [
      { name: 'Income', data: [40, 30, 45, 80, 85, 90, 80, 80, 80, 85, 20, 80] },
      { name: 'Expenses', data: [60, 70, 55, 20, 15, 10, 20, 20, 20, 15, 80, 20] }
    ],
    xaxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      labels: { style: { colors: '#6B7280', fontSize: '13px' } }
    },
    yaxis: {
      labels: { offsetX: -15, style: { colors: '#6B7280', fontSize: '13px' } }
    },
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 5,
      padding: { left: -8 },
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
  });

  useEffect(() => {
    if (stats && stats.sales_income_chart) {
      setSalesIncome((prev: any) => ({
        ...prev,
        series: [
          { name: 'Income', data: stats.sales_income_chart.income },
          { name: 'Expenses', data: stats.sales_income_chart.expenses }
        ]
      }));
    }
  }, [stats]);

  // Headcount Trend Area Chart
  const [headcountTrend, setHeadcountTrend] = useState<any>({
    chart: {
      height: 290,
      type: 'area',
      toolbar: { show: false }
    },
    colors: ['#03C95A'],
    stroke: {
      curve: 'smooth',
      width: 3
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 5,
      padding: { left: -8, right: 8 }
    },
    dataLabels: { enabled: false },
    series: [{ name: 'Headcount', data: [] }],
    xaxis: {
      categories: [],
      labels: { style: { colors: '#6B7280', fontSize: '13px' } }
    },
    yaxis: {
      labels: { offsetX: -15, style: { colors: '#6B7280', fontSize: '13px' } }
    }
  });

  useEffect(() => {
    if (stats && stats.headcount_trend) {
      setHeadcountTrend((prev: any) => ({
        ...prev,
        series: [{ name: 'Headcount', data: stats.headcount_trend.counts }],
        xaxis: {
          ...prev.xaxis,
          categories: stats.headcount_trend.labels
        }
      }));
    }
  }, [stats]);


  // 3. Attendance Donut chart (PrimeReact)
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  useEffect(() => {
    const isStatsAvailable = stats && stats.attendance_overview;
    const data = {
      labels: ['Late', 'Present', 'Permission', 'Absent'],
      datasets: [
        {
          label: 'Attendance status',
          data: isStatsAvailable 
            ? [
                stats.attendance_overview.late,
                stats.attendance_overview.present,
                stats.attendance_overview.permission,
                stats.attendance_overview.absent
              ]
            : [40, 20, 30, 10],
          backgroundColor: ['#FFC107', '#03C95A', '#1B84FF', '#E70D0D'],
          borderWidth: 5,
          borderRadius: 10,
          borderColor: '#fff',
          hoverBorderWidth: 0,
          cutout: '60%',
        }
      ]
    };
    const options = {
      rotation: -100,
      circumference: 200,
      layout: {
        padding: { top: -20, bottom: -20 }
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    };

    setChartData(data);
    setChartOptions(options);
  }, [stats]);

  // 4. Projects Status Donut chart (PrimeReact)
  const [semidonutData, setSemidonutData] = useState({});
  const [semidonutOptions, setSemidonutOptions] = useState({});

  useEffect(() => {
    const isStatsAvailable = stats && stats.projects_status;
    const data = {
      labels: ["Ongoing", "Onhold", "Completed", "Overdue"],
      datasets: [
        {
          label: 'Projects Status',
          data: isStatsAvailable
            ? [
                stats.projects_status.ongoing,
                stats.projects_status.onhold,
                stats.projects_status.completed,
                stats.projects_status.overdue
              ]
            : [20, 40, 20, 10],
          backgroundColor: ['#FFC107', '#1B84FF', '#03C95A', '#E70D0D'],
          borderWidth: -10,
          borderColor: 'transparent',
          hoverBorderWidth: 0,
          cutout: '75%',
          spacing: -30,
        },
      ],
    };

    const options = {
      rotation: -100,
      circumference: 185,
      layout: {
        padding: { top: -20, bottom: 20 }
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      elements: {
        arc: { borderWidth: -30, borderRadius: 30 }
      },
    };

    setSemidonutData(data);
    setSemidonutOptions(options);
  }, [stats]);

  if (loading) {
    return (
      <div className="page-wrapper d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading Dashboard...</span>
          </div>
          <p className="mt-3 text-muted">Aggregating live HRMS Command Center statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Admin Dashboard</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Dashboard</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Admin Dashboard
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
              <div className="me-2 mb-2">
                <div className="dropdown">
                  <Link to="#"
                    className="dropdown-toggle btn btn-white d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-file-export me-1" />
                    Export
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link
                        to="#"
                        className="dropdown-item rounded-1"
                      >
                        <i className="ti ti-file-type-pdf me-1" />
                        Export as PDF
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className="dropdown-item rounded-1"
                      >
                        <i className="ti ti-file-type-xls me-1" />
                        Export as Excel{" "}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mb-2">
                <div className="input-icon w-120 position-relative">
                  <span className="input-icon-addon">
                    <i className="ti ti-calendar text-gray-9" />
                  </span>
                  <Calendar value={date} onChange={(e: any) => setDate(e.value)} view="year" dateFormat="yy" className="Calendar-form" />
                </div>
              </div>
              <div className="ms-2 head-icons">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          <UpcomingReminderBanner />
          {/* Welcome Wrap */}
          <div className="card border-0">
            <div className="card-body d-flex align-items-center justify-content-between flex-wrap pb-1">
              <div className="d-flex align-items-center mb-3">
                {user?.employee_profile?.id ? (
                  <Link
                    to={routes.employeeDetailsView.replace(":id", String(user.employee_profile.id))}
                    className="avatar avatar-xl flex-shrink-0"
                  >
                    <ImageWithBasePath
                      src="assets/img/profiles/avatar-31.jpg"
                      className="rounded-circle"
                      alt="img"
                    />
                  </Link>
                ) : (
                  <span className="avatar avatar-xl flex-shrink-0">
                    <ImageWithBasePath
                      src="assets/img/profiles/avatar-31.jpg"
                      className="rounded-circle"
                      alt="img"
                    />
                  </span>
                )}
                <div className="ms-3">
                  <h3 className="mb-2">
                    Welcome Back, {user?.first_name || user?.username || "Adrian"}{" "}
                    <Link
                      to={user?.employee_profile?.id ? routes.employeeDetailsView.replace(":id", String(user.employee_profile.id)) : "#"}
                      className="edit-icon"
                    >
                      <i className="ti ti-edit fs-14" />
                    </Link>
                  </h3>
                  <p>
                    You have{" "}
                    <Link to={routes.approvalInbox} className="text-primary text-decoration-underline fw-semibold">
                      {stats?.pending_approvals ?? 0} Pending Approvals
                    </Link>{" "}
                    &amp;{" "}
                    <Link to={routes.leaveadmin} className="text-primary text-decoration-underline fw-semibold">
                      {stats?.pending_leave_requests ?? 0} Leave Requests
                    </Link>
                  </p>
                </div>
              </div>
              <div className="d-flex align-items-center flex-wrap mb-1">
                <Link
                  to="#"
                  className="btn btn-secondary btn-md me-2 mb-2"
                  data-bs-toggle="modal" data-inert={true}
                  data-bs-target="#add_project"
                >
                  <i className="ti ti-square-rounded-plus me-1" />
                  Add Project
                </Link>
                <Link
                  to="#"
                  className="btn btn-primary btn-md mb-2"
                  data-bs-toggle="modal" data-inert={true}
                  data-bs-target="#add_leaves"
                >
                  <i className="ti ti-square-rounded-plus me-1" />
                  Add Requests
                </Link>
              </div>
            </div>
          </div>
          {/* /Welcome Wrap */}
          <div className="row">
            {/* Widget Info */}
            <div className="col-xxl-8 d-flex">
              <div className="row flex-fill">
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-primary mb-2">
                        <i className="ti ti-calendar-share fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Attendance
                      </h6>
                      <h3 className="mb-3">
                        {stats ? `${(stats.attendance_overview?.present ?? 0) + (stats.attendance_overview?.late ?? 0)}/${stats.active_employees ?? 0}` : "92/99"}{" "}
                        <span className="fs-12 fw-medium text-success">
                          <i className="fa-solid fa-caret-up me-1" />
                          +2.1%
                        </span>
                      </h3>
                      <Link to={routes.attendanceadmin} className="link-default">
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-secondary mb-2">
                        <i className="ti ti-browser fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Total Project's
                      </h6>
                      <h3 className="mb-3">
                        {stats ? `${stats.projects_status?.completed ?? 0}/${stats.total_projects ?? 0}` : "90/94"}{" "}
                        <span className="fs-12 fw-medium text-danger">
                          <i className="fa-solid fa-caret-down me-1" />
                          -2.1%
                        </span>
                      </h3>
                      <Link to={routes.projectlist} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-info mb-2">
                        <i className="ti ti-users-group fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Total Clients
                      </h6>
                      <h3 className="mb-3">
                        {stats ? `${stats.total_clients ?? 0}` : "69"}{" "}
                        <span className="fs-12 fw-medium text-danger">
                          <i className="fa-solid fa-caret-down me-1" />
                          -11.2%
                        </span>
                      </h3>
                      <Link to={routes.clientlist} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-pink mb-2">
                        <i className="ti ti-checklist fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Total Tasks
                      </h6>
                      <h3 className="mb-3">
                        {stats ? `${stats.todos?.filter((t: any) => t.is_completed).length ?? 0}/${stats.total_tasks ?? 0}` : "25/28"}{" "}
                        <span className="fs-12 fw-medium text-success">
                          <i className="fa-solid fa-caret-down me-1" />
                          +11.2%
                        </span>
                      </h3>
                      <Link to={routes.todo} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-purple mb-2">
                        <i className="ti ti-moneybag fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Earnings
                      </h6>
                      <h3 className="mb-3">
                        ${stats?.earnings?.toLocaleString() ?? "2,144"}{" "}
                        <span className="fs-12 fw-medium text-success">
                          <i className="fa-solid fa-caret-up me-1" />
                          +10.2%
                        </span>
                      </h3>
                      <Link to={routes.expenses} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-danger mb-2">
                        <i className="ti ti-browser fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Profit This Week
                      </h6>
                      <h3 className="mb-3">
                        ${stats?.profit_this_week?.toLocaleString() ?? "5,544"}{" "}
                        <span className="fs-12 fw-medium text-success">
                          <i className="fa-solid fa-caret-up me-1" />
                          +2.1%
                        </span>
                      </h3>
                      <Link to={routes.payments} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-success mb-2">
                        <i className="ti ti-users-group fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        Job Applicants
                      </h6>
                      <h3 className="mb-3">
                        {stats?.job_applicants ?? 98}{" "}
                        <span className="fs-12 fw-medium text-success">
                          <i className="fa-solid fa-caret-up me-1" />
                          +2.1%
                        </span>
                      </h3>
                      <Link to={routes.joblist} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 d-flex">
                  <div className="card flex-fill">
                    <div className="card-body">
                      <span className="avatar rounded-circle bg-dark mb-2">
                        <i className="ti ti-user-star fs-16" />
                      </span>
                      <h6 className="fs-13 fw-medium text-default mb-1">
                        New Hire
                      </h6>
                      <h3 className="mb-3">
                        {stats?.new_hires ?? 45}{" "}
                        <span className="fs-12 fw-medium text-danger">
                          <i className="fa-solid fa-caret-down me-1" />
                          -11.2%
                        </span>
                      </h3>
                      <Link to={routes.candidateslist} className="link-default">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Widget Info */}
            {/* Employees By Department */}
            <div className="col-xxl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Employees By Department</h5>
                  <div className="dropdown mb-2">
                    <Link to="#"
                      className="btn btn-white border btn-sm d-inline-flex align-items-center"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-calendar me-1" />
                      This Week
                    </Link>
                    <ul className="dropdown-menu  dropdown-menu-end p-3">
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          This Week
                        </Link>
                      </li>
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          Last Week
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  <ReactApexChart
                    id="emp-department"
                    options={empDepartment}
                    series={empDepartment.series}
                    type="bar"
                    height={220}
                  />
                  <p className="fs-13">
                    <i className="ti ti-circle-filled me-2 fs-8 text-primary" />
                    No of Employees increased by{" "}
                    <span className="text-success fw-bold">+20%</span> from last
                    Week
                  </p>
                </div>
              </div>
            </div>
            {/* /Employees By Department */}
          </div>
          <div className="row">
            {/* Total Employee */}
            <div className="col-xxl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Employee Status</h5>
                  <div className="dropdown mb-2">
                    <Link to="#"
                      className="btn btn-white border btn-sm d-inline-flex align-items-center"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-calendar me-1" />
                      This Week
                    </Link>
                    <ul className="dropdown-menu  dropdown-menu-end p-3">
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          This Week
                        </Link>
                      </li>
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          Today
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <p className="fs-13 mb-3">Total Employee</p>
                    <h3 className="mb-3">{stats?.total_employees ?? 0}</h3>
                  </div>
                  {(() => {
                    const full = stats?.employment_types?.fulltime ?? 0;
                    const contract = stats?.employment_types?.contract ?? 0;
                    const probation = stats?.employment_types?.probation ?? 0;
                    const wfh = stats?.employment_types?.wfh ?? 0;
                    const totalType = (full + contract + probation + wfh) || 1;
                    const fullPct = Math.round((full / totalType) * 100);
                    const contractPct = Math.round((contract / totalType) * 100);
                    const probationPct = Math.round((probation / totalType) * 100);
                    const wfhPct = Math.round((wfh / totalType) * 100);
                    return (
                      <>
                        <div className="progress-stacked emp-stack mb-3">
                          <div
                            className="progress"
                            role="progressbar"
                            aria-label="Segment one"
                            aria-valuenow={fullPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{ width: `${fullPct}%` }}
                          >
                            <div className="progress-bar bg-warning" />
                          </div>
                          <div
                            className="progress"
                            role="progressbar"
                            aria-label="Segment two"
                            aria-valuenow={contractPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{ width: `${contractPct}%` }}
                          >
                            <div className="progress-bar bg-secondary" />
                          </div>
                          <div
                            className="progress"
                            role="progressbar"
                            aria-label="Segment three"
                            aria-valuenow={probationPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{ width: `${probationPct}%` }}
                          >
                            <div className="progress-bar bg-danger" />
                          </div>
                          <div
                            className="progress"
                            role="progressbar"
                            aria-label="Segment four"
                            aria-valuenow={wfhPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{ width: `${wfhPct}%` }}
                          >
                            <div className="progress-bar bg-pink" />
                          </div>
                        </div>
                        <div className="border mb-3">
                          <div className="row gx-0">
                            <div className="col-6">
                              <div className="p-2 flex-fill border-end border-bottom">
                                <p className="fs-13 mb-2">
                                  <i className="ti ti-square-filled text-primary fs-12 me-2" />
                                  Fulltime <span className="text-gray-9">({fullPct}%)</span>
                                </p>
                                <h2 className="display-1">{full}</h2>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="p-2 flex-fill border-bottom text-end">
                                <p className="fs-13 mb-2">
                                  <i className="ti ti-square-filled me-2 text-secondary fs-12" />
                                  Contract <span className="text-gray-9">({contractPct}%)</span>
                                </p>
                                <h2 className="display-1">{contract}</h2>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="p-2 flex-fill border-end">
                                <p className="fs-13 mb-2">
                                  <i className="ti ti-square-filled me-2 text-danger fs-12" />
                                  Probation <span className="text-gray-9">({probationPct}%)</span>
                                </p>
                                <h2 className="display-1">{probation}</h2>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="p-2 flex-fill text-end">
                                <p className="fs-13 mb-2">
                                  <i className="ti ti-square-filled text-pink me-2 fs-12" />
                                  WFH <span className="text-gray-9">({wfhPct}%)</span>
                                </p>
                                <h2 className="display-1">{wfh}</h2>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  <h6 className="mb-2">Top Performer</h6>
                  {stats?.top_performer ? (
                    <div className="p-2 d-flex align-items-center justify-content-between border border-primary bg-primary-100 br-5 mb-4">
                      <div className="d-flex align-items-center overflow-hidden">
                        <span className="me-2">
                          <i className="ti ti-award-filled text-primary fs-24" />
                        </span>
                        <Link
                          to={routes.employeeDetailsView.replace(":id", String(stats.top_performer.id))}
                          className="avatar avatar-md me-2"
                        >
                          {stats.top_performer.photo ? (
                            <img
                              src={stats.top_performer.photo}
                              className="rounded-circle border border-white"
                              alt="img"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <ImageWithBasePath
                              src="assets/img/profiles/avatar-24.jpg"
                              className="rounded-circle border border-white"
                              alt="img"
                            />
                          )}
                        </Link>
                        <div>
                          <h6 className="text-truncate mb-1 fs-14 fw-medium">
                            <Link to={routes.employeeDetailsView.replace(":id", String(stats.top_performer.id))}>
                              {stats.top_performer.full_name}
                            </Link>
                          </h6>
                          <p className="fs-13">{stats.top_performer.designation}</p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="fs-13 mb-1">Performance</p>
                        <h5 className="text-primary">{stats.top_performer.score}</h5>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 d-flex align-items-center justify-content-between border border-primary bg-primary-100 br-5 mb-4">
                      <div className="d-flex align-items-center overflow-hidden">
                        <span className="me-2">
                          <i className="ti ti-award-filled text-primary fs-24" />
                        </span>
                        <Link
                          to={routes.employeeList}
                          className="avatar avatar-md me-2"
                        >
                          <ImageWithBasePath
                            src="assets/img/profiles/avatar-24.jpg"
                            className="rounded-circle border border-white"
                            alt="img"
                          />
                        </Link>
                        <div>
                          <h6 className="text-truncate mb-1 fs-14 fw-medium">
                            <Link to={routes.employeeList}>Daniel Esbella</Link>
                          </h6>
                          <p className="fs-13">IOS Developer</p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="fs-13 mb-1">Performance</p>
                        <h5 className="text-primary">99%</h5>
                      </div>
                    </div>
                  )}
                  <Link to={routes.employeeList} className="btn btn-light btn-md w-100">
                    View All Employees
                  </Link>
                </div>
              </div>
            </div>
            {/* /Total Employee */}
            {/* Attendance Overview */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Attendance Overview</h5>
                  <div className="dropdown mb-2">
                    <Link to="#"
                      className="btn btn-white border btn-sm d-inline-flex align-items-center"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-calendar me-1" />
                      Today
                    </Link>
                    <ul className="dropdown-menu  dropdown-menu-end p-3">
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          This Week
                        </Link>
                      </li>
                      <li>
                        <Link to="#"
                          className="dropdown-item rounded-1"
                        >
                          Today
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  <div className="chartjs-wrapper-demo position-relative mb-4">
                    <Chart type="doughnut" data={chartData} options={chartOptions} className="w-full attendence-chart md:w-30rem" />
                    <div className="position-absolute text-center attendance-canvas">
                      <p className="fs-13 mb-1">Total Attendance</p>
                      <h3>120</h3>
                    </div>
                  </div>
                  <h6 className="mb-3">Status</h6>
                  <div className="d-flex align-items-center justify-content-between">
                    <p className="f-13 mb-2">
                      <i className="ti ti-circle-filled text-success me-1" />
                      Present
                    </p>
                    <p className="f-13 fw-medium text-gray-9 mb-2">59%</p>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <p className="f-13 mb-2">
                      <i className="ti ti-circle-filled text-secondary me-1" />
                      Late
                    </p>
                    <p className="f-13 fw-medium text-gray-9 mb-2">21%</p>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <p className="f-13 mb-2">
                      <i className="ti ti-circle-filled text-warning me-1" />
                      Permission
                    </p>
                    <p className="f-13 fw-medium text-gray-9 mb-2">2%</p>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <p className="f-13 mb-2">
                      <i className="ti ti-circle-filled text-danger me-1" />
                      Absent
                    </p>
                    <p className="f-13 fw-medium text-gray-9 mb-2">15%</p>
                  </div>
                  <div className="bg-light br-5 box-shadow-xs p-2 pb-0 d-flex align-items-center justify-content-between flex-wrap">
                    <div className="d-flex align-items-center">
                      <p className="mb-2 me-2">Total Absenties</p>
                      <div className="avatar-list-stacked avatar-group-sm mb-2">
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/profiles/avatar-27.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/profiles/avatar-30.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath src="assets/img/profiles/avatar-14.jpg" alt="img" />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath src="assets/img/profiles/avatar-29.jpg" alt="img" />
                        </span>
                        <Link
                          className="avatar bg-primary avatar-rounded text-fixed-white fs-10"
                          to="#"
                        >
                          +1
                        </Link>
                      </div>
                    </div>
                    <Link to={routes.leaveadmin}
                      className="fs-13 link-primary text-decoration-underline mb-2"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            {/* /Attendance Overview */}
            {/* Clock-In/Out */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Clock-In/Out</h5>
                  <div className="d-flex align-items-center">
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white btn-sm d-inline-flex align-items-center border-0 fs-13 me-2"
                        data-bs-toggle="dropdown"
                      >
                        All Departments
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Finance
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Development
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Marketing
                          </Link>
                        </li>
                      </ul>
                    </div>
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        Today
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Today
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3 p-2 border border-dashed br-5">
                      <div className="d-flex align-items-center">
                        <Link to="#"
                          className="avatar flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/profiles/avatar-24.jpg"
                            className="rounded-circle border border-2"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2">
                          <h6 className="fs-14 fw-medium text-truncate">
                            Daniel Esbella
                          </h6>
                          <p className="fs-13">UI/UX Designer</p>
                        </div>
                      </div>
                      <div className="d-flex align-items-center">
                        <Link to="#" className="link-default me-2">
                          <i className="ti ti-clock-share" />
                        </Link>
                        <span className="fs-10 fw-medium d-inline-flex align-items-center badge badge-success">
                          <i className="ti ti-circle-filled fs-5 me-1" />
                          09:15
                        </span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-3 p-2 border br-5">
                      <div className="d-flex align-items-center">
                        <Link to="#"
                          className="avatar flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/profiles/avatar-23.jpg"
                            className="rounded-circle border border-2"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2">
                          <h6 className="fs-14 fw-medium">Doglas Martini</h6>
                          <p className="fs-13">Project Manager</p>
                        </div>
                      </div>
                      <div className="d-flex align-items-center">
                        <Link to="#" className="link-default me-2">
                          <i className="ti ti-clock-share" />
                        </Link>
                        <span className="fs-10 fw-medium d-inline-flex align-items-center badge badge-success">
                          <i className="ti ti-circle-filled fs-5 me-1" />
                          09:36
                        </span>
                      </div>
                    </div>
                    <div className="mb-3 p-2 border br-5">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar flex-shrink-0"
                          >
                            <ImageWithBasePath
                              src="assets/img/profiles/avatar-27.jpg"
                              className="rounded-circle border border-2"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2">
                            <h6 className="fs-14 fw-medium text-truncate">
                              Brian Villalobos
                            </h6>
                            <p className="fs-13">PHP Developer</p>
                          </div>
                        </div>
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="link-default me-2"
                          >
                            <i className="ti ti-clock-share" />
                          </Link>
                          <span className="fs-10 fw-medium d-inline-flex align-items-center badge badge-success">
                            <i className="ti ti-circle-filled fs-5 me-1" />
                            09:15
                          </span>
                        </div>
                      </div>
                      <div className="d-flex align-items-center justify-content-between flex-wrap mt-2 border br-5 p-2 pb-0">
                        <div>
                          <p className="mb-1 d-inline-flex align-items-center">
                            <i className="ti ti-circle-filled text-success fs-5 me-1" />
                            Clock in
                          </p>
                          <h6 className="fs-13 fw-normal mb-2">10:30 AM</h6>
                        </div>
                        <div>
                          <p className="mb-1 d-inline-flex align-items-center">
                            <i className="ti ti-circle-filled text-danger fs-5 me-1" />
                            Clock Out
                          </p>
                          <h6 className="fs-13 fw-normal mb-2">09:45 AM</h6>
                        </div>
                        <div>
                          <p className="mb-1 d-inline-flex align-items-center">
                            <i className="ti ti-circle-filled text-warning fs-5 me-1" />
                            Production
                          </p>
                          <h6 className="fs-13 fw-normal mb-2">09:21 Hrs</h6>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h6 className="mb-2">Late</h6>
                  <div className="d-flex align-items-center justify-content-between mb-3 p-2 border border-dashed br-5">
                    <div className="d-flex align-items-center">
                      <span className="avatar flex-shrink-0">
                        <ImageWithBasePath
                          src="assets/img/profiles/avatar-29.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </span>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate">
                          Anthony Lewis{" "}
                          <span className="fs-10 fw-medium d-inline-flex align-items-center badge badge-success">
                            <i className="ti ti-clock-hour-11 me-1" />
                            30 Min
                          </span>
                        </h6>
                        <p className="fs-13">Marketing Head</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="link-default me-2">
                        <i className="ti ti-clock-share" />
                      </Link>
                      <span className="fs-10 fw-medium d-inline-flex align-items-center badge badge-danger">
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        08:35
                      </span>
                    </div>
                  </div>
                  <Link to={routes.attendancereport}
                    className="btn btn-light btn-md w-100"
                  >
                    View All Attendance
                  </Link>
                </div>
              </div>
            </div>
            {/* /Clock-In/Out */}
          </div>
          <div className="row">
            {/* Jobs Applicants */}
            <div className="col-xxl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Jobs Applicants</h5>
                  <Link to={routes.joblist} className="btn btn-light btn-md mb-2">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  <ul
                    className="nav nav-tabs tab-style-1 nav-justified d-sm-flex d-block p-0 mb-4"
                    role="tablist"
                  >
                    <li className="nav-item" role="presentation">
                      <Link
                        className="nav-link fw-medium"
                        data-bs-toggle="tab"
                        data-bs-target="#openings"
                        aria-current="page"
                        to="#openings"
                        aria-selected="true"
                        role="tab"
                      >
                        Openings
                      </Link>
                    </li>
                    <li className="nav-item" role="presentation">
                      <Link
                        className="nav-link fw-medium active"
                        data-bs-toggle="tab"
                        data-bs-target="#applicants"
                        to="#applicants"
                        aria-selected="false"
                        tabIndex={-1}
                        role="tab"
                      >
                        Applicants
                      </Link>
                    </li>
                  </ul>
                  <div className="tab-content">
                    <div className="tab-pane fade" id="openings">
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0 bg-gray-100"
                          >
                            <ImageWithBasePath
                              src="assets/img/icons/apple.svg"
                              className="img-fluid rounded-circle w-auto h-auto"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">Senior IOS Developer</Link>
                            </p>
                            <span className="fs-12">No of Openings : 25 </span>
                          </div>
                        </div>
                        <Link to="#"
                          className="btn btn-light btn-sm p-0 btn-icon d-flex align-items-center justify-content-center"
                        >
                          <i className="ti ti-edit" />
                        </Link>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0 bg-gray-100"
                          >
                            <ImageWithBasePath
                              src="assets/img/icons/php.svg"
                              className="img-fluid w-auto h-auto"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">Junior PHP Developer</Link>
                            </p>
                            <span className="fs-12">No of Openings : 20 </span>
                          </div>
                        </div>
                        <Link to="#"
                          className="btn btn-light btn-sm p-0 btn-icon d-flex align-items-center justify-content-center"
                        >
                          <i className="ti ti-edit" />
                        </Link>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0 bg-gray-100"
                          >
                            <ImageWithBasePath
                              src="assets/img/icons/react.svg"
                              className="img-fluid w-auto h-auto"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">
                                Junior React Developer{" "}
                              </Link>
                            </p>
                            <span className="fs-12">No of Openings : 30 </span>
                          </div>
                        </div>
                        <Link to="#"
                          className="btn btn-light btn-sm p-0 btn-icon d-flex align-items-center justify-content-center"
                        >
                          <i className="ti ti-edit" />
                        </Link>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-0">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0 bg-gray-100"
                          >
                            <ImageWithBasePath
                              src="assets/img/icons/laravel-icon.svg"
                              className="img-fluid w-auto h-auto"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">
                                Senior Laravel Developer
                              </Link>
                            </p>
                            <span className="fs-12">No of Openings : 40 </span>
                          </div>
                        </div>
                        <Link to="#"
                          className="btn btn-light btn-sm p-0 btn-icon d-flex align-items-center justify-content-center"
                        >
                          <i className="ti ti-edit" />
                        </Link>
                      </div>
                    </div>
                    <div className="tab-pane fade show active" id="applicants">
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0"
                          >
                            <ImageWithBasePath
                              src="assets/img/users/user-09.jpg"
                              className="img-fluid rounded-circle"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">Brian Villalobos</Link>
                            </p>
                            <span className="fs-13 d-inline-flex align-items-center">
                              Exp : 5+ Years
                              <i className="ti ti-circle-filled fs-4 mx-2 text-primary" />
                              USA
                            </span>
                          </div>
                        </div>
                        <span className="badge badge-secondary badge-xs">
                          UI/UX Designer
                        </span>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0"
                          >
                            <ImageWithBasePath
                              src="assets/img/users/user-32.jpg"
                              className="img-fluid rounded-circle"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">Anthony Lewis</Link>
                            </p>
                            <span className="fs-13 d-inline-flex align-items-center">
                              Exp : 4+ Years
                              <i className="ti ti-circle-filled fs-4 mx-2 text-primary" />
                              USA
                            </span>
                          </div>
                        </div>
                        <span className="badge badge-info badge-xs">
                          Python Developer
                        </span>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0"
                          >
                            <ImageWithBasePath
                              src="assets/img/users/user-32.jpg"
                              className="img-fluid rounded-circle"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">Stephan Peralt</Link>
                            </p>
                            <span className="fs-13 d-inline-flex align-items-center">
                              Exp : 6+ Years
                              <i className="ti ti-circle-filled fs-4 mx-2 text-primary" />
                              USA
                            </span>
                          </div>
                        </div>
                        <span className="badge badge-pink badge-xs">
                          Android Developer
                        </span>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mb-0">
                        <div className="d-flex align-items-center">
                          <Link to="#"
                            className="avatar overflow-hidden flex-shrink-0"
                          >
                            <ImageWithBasePath
                              src="assets/img/users/user-34.jpg"
                              className="img-fluid rounded-circle"
                              alt="img"
                            />
                          </Link>
                          <div className="ms-2 overflow-hidden">
                            <p className="text-dark fw-medium text-truncate mb-0">
                              <Link to="#">Doglas Martini</Link>
                            </p>
                            <span className="fs-13 d-inline-flex align-items-center">
                              Exp : 2+ Years
                              <i className="ti ti-circle-filled fs-4 mx-2 text-primary" />
                              USA
                            </span>
                          </div>
                        </div>
                        <span className="badge badge-purple badge-xs">
                          React Developer
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Jobs Applicants */}
            {/* Employees */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Employees</h5>
                  <Link to={routes.employeeList} className="btn btn-light btn-md mb-2">
                    View All
                  </Link>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-nowrap mb-0">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Department</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-32.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-medium">
                                  <Link to="#">Anthony Lewis</Link>
                                </h6>
                                <span className="fs-12">Finance</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-secondary-transparent badge-xs">
                              Finance
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-09.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-medium">
                                  <Link to="#">Brian Villalobos</Link>
                                </h6>
                                <span className="fs-12">PHP Developer</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-danger-transparent badge-xs">
                              Development
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-01.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-medium">
                                  <Link to="#">Stephan Peralt</Link>
                                </h6>
                                <span className="fs-12">Executive</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-info-transparent badge-xs">
                              Marketing
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-34.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-medium">
                                  <Link to="#">Doglas Martini</Link>
                                </h6>
                                <span className="fs-12">Project Manager</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-purple-transparent badge-xs">
                              Manager
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border-0">
                            <div className="d-flex align-items-center">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-37.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-medium">
                                  <Link to="#">Anthony Lewis</Link>
                                </h6>
                                <span className="fs-12">UI/UX Designer</span>
                              </div>
                            </div>
                          </td>
                          <td className="border-0">
                            <span className="badge badge-pink-transparent badge-xs">
                              UI/UX Design
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            {/* /Employees */}
            {/* Todo */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Todo</h5>
                  <div className="d-flex align-items-center">
                    <div className="dropdown mb-2 me-2">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        Today
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Today
                          </Link>
                        </li>
                      </ul>
                    </div>
                    <Link to="#"
                      className="btn btn-primary btn-icon btn-xs rounded-circle d-flex align-items-center justify-content-center p-0 mb-2"
                      data-bs-toggle="modal" data-inert={true}
                      data-bs-target="#add_todo"
                    >
                      <i className="ti ti-plus fs-16" />
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {todos && todos.length > 0 ? (
                    todos.map((todo: any, index: number) => (
                      <div key={todo.id || index} className={`d-flex align-items-center todo-item border p-2 br-5 mb-2 ${todo.is_completed ? 'todo-strike' : ''}`}>
                        <i className="ti ti-grid-dots me-2" />
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`todo-${todo.id}`}
                            checked={todo.is_completed || false}
                            onChange={() => handleToggleTodo(todo.id, todo.is_completed)}
                          />
                          <label className="form-check-label fw-medium" htmlFor={`todo-${todo.id}`}>
                            {todo.title}
                          </label>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted">No todos found</div>
                  )}
                </div>
              </div>
            </div>
            {/* /Todo */}
          </div>
          <div className="row">
            {/* Sales Overview */}
            <div className="col-xl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Sales Overview</h5>
                  <div className="d-flex align-items-center">
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white border-0 btn-sm d-inline-flex align-items-center fs-13 me-2"
                        data-bs-toggle="dropdown"
                      >
                        All Departments
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            UI/UX Designer
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            HR Manager
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Junior Tester
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body pb-0">
                  <div className="d-flex align-items-center justify-content-between flex-wrap">
                    <div className="d-flex align-items-center mb-1">
                      <p className="fs-13 text-gray-9 me-3 mb-0">
                        <i className="ti ti-square-filled me-2 text-primary" />
                        Income
                      </p>
                      <p className="fs-13 text-gray-9 mb-0">
                        <i className="ti ti-square-filled me-2 text-gray-2" />
                        Expenses
                      </p>
                    </div>
                    <p className="fs-13 mb-1">Last Updated at 11:30PM</p>
                  </div>
                  <ReactApexChart
                    id="sales-income"
                    options={salesIncome}
                    series={salesIncome.series}
                    type="bar"
                    height={270}
                  />
                </div>
              </div>
            </div>
            {/* /Sales Overview */}
            {/* Invoices */}
            <div className="col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Invoices</h5>
                  <div className="d-flex align-items-center">
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white btn-sm d-inline-flex align-items-center fs-13 me-2 border-0"
                        data-bs-toggle="dropdown"
                      >
                        Invoices
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Invoices
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Paid
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Unpaid
                          </Link>
                        </li>
                      </ul>
                    </div>
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Today
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body pt-2">
                  <div className="table-responsive pt-1">
                    <table className="table table-nowrap table-borderless mb-0">
                      <tbody>
                        {stats?.top_invoices && stats.top_invoices.length > 0 ? (
                          stats.top_invoices.map((inv: any, index: number) => (
                            <tr key={inv.id || index}>
                              <td className="px-0">
                                <div className="d-flex align-items-center">
                                  <Link to={`${routes.invoices}`} className="avatar">
                                    <ImageWithBasePath
                                      src={`assets/img/users/user-${39 + (index % 10)}.jpg`}
                                      className="img-fluid rounded-circle"
                                      alt="img"
                                    />
                                  </Link>
                                  <div className="ms-2">
                                    <h6 className="fw-medium">
                                      <Link to={`${routes.invoices}`}>
                                        {inv.project_name}
                                      </Link>
                                    </h6>
                                    <span className="fs-13 d-inline-flex align-items-center">
                                      {inv.invoice_no}
                                      <i className="ti ti-circle-filled fs-4 mx-1 text-primary" />
                                      {inv.client_name}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <p className="fs-13 mb-1">Payment</p>
                                <h6 className="fw-medium">${inv.amount}</h6>
                              </td>
                              <td className="px-0 text-end">
                                <span className={`badge badge-${inv.status === 'Paid' ? 'success' : 'danger'}-transparent badge-xs d-inline-flex align-items-center`}>
                                  <i className="ti ti-circle-filled fs-5 me-1" />
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="text-center py-3 text-muted">
                              No invoices found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Link to={routes.invoices}
                    className="btn btn-light btn-md w-100 mt-2"
                  >
                    View All
                  </Link>
                </div>
              </div>
            </div>
            {/* /Invoices */}
          </div>
          <div className="row">
            {/* Projects */}
            <div className="col-xxl-8 col-xl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Projects</h5>
                  <div className="d-flex align-items-center">
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Today
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-nowrap mb-0">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Team</th>
                          <th>Hours</th>
                          <th>Deadline</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats?.top_projects && stats.top_projects.length > 0 ? (
                          stats.top_projects.map((proj: any, index: number) => {
                            let progressPct = 40;
                            if (proj.hours && proj.hours.includes('/')) {
                              const parts = proj.hours.split('/');
                              const spent = parseFloat(parts[0]);
                              const total = parseFloat(parts[1]);
                              if (total > 0) {
                                progressPct = Math.round((spent / total) * 100);
                              }
                            }
                            const priorityClass = proj.priority === 'High' ? 'danger' : proj.priority === 'Medium' ? 'pink' : 'success';
                            const isLastRow = index === stats.top_projects.length - 1;
                            const tdClass = isLastRow ? "border-0" : "";
                            return (
                              <tr key={proj.id || index}>
                                <td className={tdClass}>
                                  <Link to={`${routes.projectlist}`} className="link-default">
                                    {proj.project_id}
                                  </Link>
                                </td>
                                <td className={tdClass}>
                                  <h6 className="fw-medium">
                                    <Link to={`${routes.projectlist}`}>
                                      {proj.project_name}
                                    </Link>
                                  </h6>
                                </td>
                                <td className={tdClass}>
                                  <div className="avatar-list-stacked avatar-group-sm">
                                    <span className="avatar avatar-rounded">
                                      <ImageWithBasePath
                                        className="border border-white"
                                        src={`assets/img/profiles/avatar-0${2 + (index % 5)}.jpg`}
                                        alt="img"
                                      />
                                    </span>
                                    <span className="avatar avatar-rounded">
                                      <ImageWithBasePath
                                        className="border border-white"
                                        src={`assets/img/profiles/avatar-0${3 + (index % 5)}.jpg`}
                                        alt="img"
                                      />
                                    </span>
                                    <span className="avatar avatar-rounded">
                                      <ImageWithBasePath
                                        className="border border-white"
                                        src={`assets/img/profiles/avatar-0${5 + (index % 5)}.jpg`}
                                        alt="img"
                                      />
                                    </span>
                                  </div>
                                </td>
                                <td className={tdClass}>
                                  <p className="mb-1">{proj.hours}</p>
                                  <div
                                    className="progress progress-xs w-100"
                                    role="progressbar"
                                    aria-valuenow={progressPct}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  >
                                    <div
                                      className="progress-bar bg-primary"
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                </td>
                                <td className={tdClass}>{proj.deadline}</td>
                                <td className={tdClass}>
                                  <span className={`badge badge-${priorityClass} d-inline-flex align-items-center badge-xs`}>
                                    <i className="ti ti-point-filled me-1" />
                                    {proj.priority}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center py-3 text-muted">
                              No projects found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            {/* /Projects */}
            {/* Tasks Statistics */}
            <div className="col-xxl-4 col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Tasks Statistics</h5>
                  <div className="d-flex align-items-center">
                    <div className="dropdown mb-2">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#"
                            className="dropdown-item rounded-1"
                          >
                            Today
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="chartjs-wrapper-demo position-relative mb-4">
                    <Chart type="doughnut" data={semidonutData} options={semidonutOptions} className="w-full md:w-30rem semi-donut-chart" />
                    <div className="position-absolute text-center attendance-canvas">
                      <p className="fs-13 mb-1">Total Tasks</p>
                      <h3>124/165</h3>
                    </div>
                  </div>
                  <div className="d-flex align-items-center flex-wrap">
                    <div className="border-end text-center me-2 pe-2 mb-3">
                      <p className="fs-13 d-inline-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-10 me-1 text-warning" />
                        Ongoing
                      </p>
                      <h5>24%</h5>
                    </div>
                    <div className="border-end text-center me-2 pe-2 mb-3">
                      <p className="fs-13 d-inline-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-10 me-1 text-info" />
                        On Hold{" "}
                      </p>
                      <h5>10%</h5>
                    </div>
                    <div className="border-end text-center me-2 pe-2 mb-3">
                      <p className="fs-13 d-inline-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-10 me-1 text-danger" />
                        Overdue
                      </p>
                      <h5>16%</h5>
                    </div>
                    <div className="text-center me-2 pe-2 mb-3">
                      <p className="fs-13 d-inline-flex align-items-center mb-1">
                        <i className="ti ti-circle-filled fs-10 me-1 text-success" />
                        Ongoing
                      </p>
                      <h5>40%</h5>
                    </div>
                  </div>
                  <div className="bg-dark br-5 p-3 pb-0 d-flex align-items-center justify-content-between">
                    <div className="mb-2">
                      <h4 className="text-success">389/689 hrs</h4>
                      <p className="fs-13 mb-0">Spent on Overall Tasks This Week</p>
                    </div>
                    <Link to={routes.todo}
                      className="btn btn-sm btn-light mb-2 text-nowrap"
                    >
                      View All
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            {/* /Tasks Statistics */}
          </div>
          <div className="row">
            {/* Schedules */}
            <div className="col-xxl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Schedules</h5>
                  <Link to={routes.candidateslist} className="btn btn-light btn-md mb-2">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  <div className="bg-light p-3 br-5 mb-4">
                    <span className="badge badge-secondary badge-xs mb-1">
                      UI/ UX Designer
                    </span>
                    <h6 className="mb-2 text-truncate">
                      Interview Candidates - UI/UX Designer
                    </h6>
                    <div className="d-flex align-items-center flex-wrap">
                      <p className="fs-13 mb-1 me-2">
                        <i className="ti ti-calendar-event me-2" />
                        Thu, 15 Feb 2025
                      </p>
                      <p className="fs-13 mb-1">
                        <i className="ti ti-clock-hour-11 me-2" />
                        01:00 PM - 02:20 PM
                      </p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between border-top mt-2 pt-3">
                      <div className="avatar-list-stacked avatar-group-sm">
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-49.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-13.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-11.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-22.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-58.jpg"
                            alt="img"
                          />
                        </span>
                        <Link
                          className="avatar bg-primary avatar-rounded text-fixed-white fs-10 fw-medium"
                          to="#"
                        >
                          +3
                        </Link>
                      </div>
                      <Link to="#" className="btn btn-primary btn-xs">
                        Join Meeting
                      </Link>
                    </div>
                  </div>
                  <div className="bg-light p-3 br-5 mb-0">
                    <span className="badge badge-dark badge-xs mb-1">
                      IOS Developer
                    </span>
                    <h6 className="mb-2 text-truncate">
                      Interview Candidates - IOS Developer
                    </h6>
                    <div className="d-flex align-items-center flex-wrap">
                      <p className="fs-13 mb-1 me-2">
                        <i className="ti ti-calendar-event me-2" />
                        Thu, 15 Feb 2025
                      </p>
                      <p className="fs-13 mb-1">
                        <i className="ti ti-clock-hour-11 me-2" />
                        02:00 PM - 04:20 PM
                      </p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between border-top mt-2 pt-3">
                      <div className="avatar-list-stacked avatar-group-sm">
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-49.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-13.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-11.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-22.jpg"
                            alt="img"
                          />
                        </span>
                        <span className="avatar avatar-rounded">
                          <ImageWithBasePath
                            className="border border-white"
                            src="assets/img/users/user-58.jpg"
                            alt="img"
                          />
                        </span>
                        <Link
                          className="avatar bg-primary avatar-rounded text-fixed-white fs-10 fw-medium"
                          to="#"
                        >
                          +3
                        </Link>
                      </div>
                      <Link to="#" className="btn btn-primary btn-xs">
                        Join Meeting
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Schedules */}
            {/* Recent Activities */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Recent Activities</h5>
                  <Link to={routes.activity} className="btn btn-light btn-md mb-2">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  <div className="recent-item">
                    <div className="d-flex justify-content-between">
                      <div className="d-flex align-items-center w-100">
                        <Link to="#"
                          className="avatar  flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/users/user-38.jpg"
                            className="rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-center justify-content-between">
                            <h6 className="fs-medium text-truncate">
                              <Link to="#">Matt Morgan</Link>
                            </h6>
                            <p className="fs-13">05:30 PM</p>
                          </div>
                          <p className="fs-13">
                            Added New Project{" "}
                            <span className="text-primary">HRMS Dashboard</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="recent-item">
                    <div className="d-flex justify-content-between">
                      <div className="d-flex align-items-center w-100">
                        <Link to="#"
                          className="avatar  flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/users/user-01.jpg"
                            className="rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-center justify-content-between">
                            <h6 className="fs-medium text-truncate">
                              <Link to="#">Jay Ze</Link>
                            </h6>
                            <p className="fs-13">05:00 PM</p>
                          </div>
                          <p className="fs-13">Commented on Uploaded Document</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="recent-item">
                    <div className="d-flex justify-content-between">
                      <div className="d-flex align-items-center w-100">
                        <Link to="#"
                          className="avatar  flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/users/user-19.jpg"
                            className="rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-center justify-content-between">
                            <h6 className="fs-medium text-truncate">
                              <Link to="#">Mary Donald</Link>
                            </h6>
                            <p className="fs-13">05:30 PM</p>
                          </div>
                          <p className="fs-13">Approved Task Projects</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="recent-item">
                    <div className="d-flex justify-content-between">
                      <div className="d-flex align-items-center w-100">
                        <Link to="#"
                          className="avatar  flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/users/user-11.jpg"
                            className="rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-center justify-content-between">
                            <h6 className="fs-medium text-truncate">
                              <Link to="#">George David</Link>
                            </h6>
                            <p className="fs-13">06:00 PM</p>
                          </div>
                          <p className="fs-13">
                            Requesting Access to Module Tickets
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="recent-item">
                    <div className="d-flex justify-content-between">
                      <div className="d-flex align-items-center w-100">
                        <Link to="#"
                          className="avatar  flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/users/user-20.jpg"
                            className="rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-center justify-content-between">
                            <h6 className="fs-medium text-truncate">
                              <Link to="#">Aaron Zeen</Link>
                            </h6>
                            <p className="fs-13">06:30 PM</p>
                          </div>
                          <p className="fs-13">Downloaded App Reportss</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="recent-item">
                    <div className="d-flex justify-content-between">
                      <div className="d-flex align-items-center w-100">
                        <Link to="#"
                          className="avatar  flex-shrink-0"
                        >
                          <ImageWithBasePath
                            src="assets/img/users/user-08.jpg"
                            className="rounded-circle"
                            alt="img"
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-center justify-content-between">
                            <h6 className="fs-medium text-truncate">
                              <Link to="#">Hendry Daniel</Link>
                            </h6>
                            <p className="fs-13">05:30 PM</p>
                          </div>
                          <p className="fs-13">
                            Completed New Project <span>HMS</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Recent Activities */}
            {/* Birthdays */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Birthdays This Week</h5>
                  <Link to={routes.employeeList}
                    className="btn btn-light btn-md mb-2"
                  >
                    View All
                  </Link>
                </div>
                <div className="card-body pb-1" style={{ maxHeight: "330px", overflowY: "auto" }}>
                  {stats?.birthdays_this_week && stats.birthdays_this_week.length > 0 ? (
                    stats.birthdays_this_week.map((bday: any, index: number) => (
                      <div key={bday.id || index} className="bg-light p-2 border border-dashed rounded-top mb-3">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="avatar">
                              <ImageWithBasePath
                                src={`assets/img/users/user-${10 + (index % 10)}.jpg`}
                                className="rounded-circle"
                                alt="img"
                              />
                            </span>
                            <div className="ms-2 overflow-hidden">
                              <h6 className="fs-medium mb-1">
                                <Link to={routes.employeeDetailsView.replace(":id", String(bday.id))}>
                                  {bday.name}
                                </Link>
                              </h6>
                              <p className="fs-13 text-muted mb-0">{bday.birthday}</p>
                            </div>
                          </div>
                          <Link
                            to="#"
                            className="btn btn-secondary btn-xs"
                          >
                            <i className="ti ti-cake me-1" />
                            Send
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted">
                      <i className="ti ti-cake text-primary fs-32 mb-2" />
                      <p className="mb-0">No birthdays this week.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Birthdays */}
          </div>

          <div className="row">
            {/* Headcount Growth Trend Chart */}
            <div className="col-xxl-8 col-xl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Headcount Growth Trend</h5>
                  <span className="fs-12 text-muted">Last 6 Months Headcount</span>
                </div>
                <div className="card-body">
                  <ReactApexChart
                    id="headcount-trend"
                    options={headcountTrend}
                    series={headcountTrend.series}
                    type="area"
                    height={290}
                  />
                </div>
              </div>
            </div>
            {/* Probation Alerts */}
            <div className="col-xxl-4 col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header pb-2 d-flex align-items-center justify-content-between flex-wrap">
                  <h5 className="mb-2">Probation Reviews Due</h5>
                  <Link to={routes.employeeList} className="btn btn-light btn-md mb-2">
                    View Employees
                  </Link>
                </div>
                <div className="card-body pb-1" style={{ maxHeight: "330px", overflowY: "auto" }}>
                  {stats?.probation_alerts && stats.probation_alerts.length > 0 ? (
                    stats.probation_alerts.map((alert: any, index: number) => (
                      <div key={alert.id || index} className="p-3 border border-dashed rounded mb-3 d-flex align-items-center justify-content-between" style={{ borderColor: '#FFC107' }}>
                        <div className="d-flex align-items-center">
                          <span className="avatar avatar-md bg-warning-transparent rounded-circle me-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(255, 193, 7, 0.15)', color: '#FFC107', width: '40px', height: '40px' }}>
                            <i className="ti ti-alert-triangle fs-18" />
                          </span>
                          <div>
                            <h6 className="fs-14 fw-medium text-default mb-1">
                              <Link to={routes.employeeDetailsView.replace(":id", String(alert.id))}>
                                {alert.name}
                              </Link>
                            </h6>
                            <p className="fs-12 text-muted mb-0">Emp Code: {alert.emp_code} | Due: {alert.probation_end_date}</p>
                          </div>
                        </div>
                        <Link to={routes.employeeDetailsView.replace(":id", String(alert.id))} className="btn btn-warning btn-xs text-white">
                          Confirm
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-5 text-muted">
                      <i className="ti ti-circle-check text-success fs-32 mb-2" />
                      <p className="mb-0">All employees confirmed. No pending probation reviews.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
          <p className="mb-0">2014 - 2025 © SmartHR.</p>
          <p>
            Designed &amp; Developed By{" "}
            <Link to="#" className="text-primary">
              Dreams
            </Link>
          </p>
        </div>
      </div>
      {/* /Page Wrapper */}
      <ProjectModals />
      <RequestModals />
      <TodoModal />
    </>

  );
};

export default AdminDashboard;

