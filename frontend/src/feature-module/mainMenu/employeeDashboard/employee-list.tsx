import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import all_routes from "../../router/all_routes";
import {
  calculateTenureLabel,
  employeeAvatarSrc,
  employeeFullName,
  employeeSummary,
  formatDisplayDate,
  profileCompletion,
  normalizeList,
} from "./employeeShared";

type Dept = { id: number; name: string };
type Desig = { id: number; title: string };

type Employee = {
  id: number;
  emp_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  joining_date?: string | null;
  employment_type?: string | null;
  role?: string | null;
  department?: Dept | null;
  designation?: Desig | null;
  salary?: number | null;
  is_active?: boolean;
  photo?: string | null;
  created_at?: string | null;
  about?: string | null;
  personal_info?: Record<string, unknown> | null;
  bank_info?: Record<string, unknown> | null;
  family_info?: Record<string, unknown> | null;
  education?: unknown[] | null;
  experience?: unknown[] | null;
  projects?: unknown[] | null;
  assets?: unknown[] | null;
  permissions?: Record<string, unknown> | null;
};

const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [designations, setDesignations] = useState<Desig[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState(() => params.get("search") || "");
  const [selectedDept, setSelectedDept] = useState(() => params.get("department") || "");
  const [selectedDesig, setSelectedDesig] = useState(() => params.get("designation") || "");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">(
    () => (params.get("status") as "all" | "active" | "inactive") || "all"
  );
  const [sortBy, setSortBy] = useState("recent");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const fetchMeta = async () => {
    try {
      const [departmentRes, designationRes] = await Promise.all([
        API.get("/departments/"),
        API.get("/designations/"),
      ]);
      setDepartments(normalizeList<Dept>(departmentRes.data));
      setDesignations(normalizeList<Desig>(designationRes.data));
    } catch (error) {
      console.error("Failed to load employee metadata", error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await API.get("/employees/");
      setEmployees(normalizeList<Employee>(response.data));
    } catch (error) {
      console.error("Failed to load employees", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
    fetchEmployees();
  }, []);

  const filtered = useMemo(() => {
    let list = [...employees];
    const query = search.trim().toLowerCase();

    if (query) {
      list = list.filter((employee) => {
        const fullName = employeeFullName(employee).toLowerCase();
        return (
          fullName.includes(query) ||
          String(employee.emp_code || "").toLowerCase().includes(query) ||
          String(employee.email || "").toLowerCase().includes(query) ||
          String(employee.phone || "").toLowerCase().includes(query) ||
          String(employee.department?.name || "").toLowerCase().includes(query) ||
          String(employee.designation?.title || "").toLowerCase().includes(query) ||
          String(employee.role || "").toLowerCase().includes(query)
        );
      });
    }

    if (selectedDept) {
      list = list.filter((employee) => String(employee.department?.id || "") === selectedDept);
    }

    if (selectedDesig) {
      list = list.filter((employee) => String(employee.designation?.id || "") === selectedDesig);
    }

    if (selectedStatus === "active") list = list.filter((employee) => employee.is_active);
    if (selectedStatus === "inactive") list = list.filter((employee) => !employee.is_active);

    if (sortBy === "name_asc") {
      list.sort((left, right) => employeeFullName(left).localeCompare(employeeFullName(right)));
    } else if (sortBy === "name_desc") {
      list.sort((left, right) => employeeFullName(right).localeCompare(employeeFullName(left)));
    } else if (sortBy === "completion_desc") {
      list.sort((left, right) => profileCompletion(right) - profileCompletion(left));
    } else if (sortBy === "joining_desc") {
      list.sort((left, right) => new Date(right.joining_date || "").getTime() - new Date(left.joining_date || "").getTime());
    } else if (sortBy === "joining_asc") {
      list.sort((left, right) => new Date(left.joining_date || "").getTime() - new Date(right.joining_date || "").getTime());
    } else {
      list.sort((left, right) => new Date(right.created_at || "").getTime() - new Date(left.created_at || "").getTime());
    }

    return list;
  }, [employees, search, selectedDept, selectedDesig, selectedStatus, sortBy]);

  const totals = useMemo(() => employeeSummary(employees), [employees]);
  const averageCompletion = useMemo(() => employeeSummary(filtered).averageCompletion, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(page * rowsPerPage, filtered.length);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedDept, selectedDesig, selectedStatus, sortBy, rowsPerPage]);

  const exportCSV = () => {
    const rows = filtered.map((employee) => ({
      emp_code: employee.emp_code,
      name: employeeFullName(employee),
      email: employee.email,
      phone: employee.phone || "",
      department: employee.department?.name || "",
      designation: employee.designation?.title || "",
      joining_date: employee.joining_date || "",
      completion: `${profileCompletion(employee)}%`,
      status: employee.is_active ? "Active" : "Inactive",
    }));

    if (!rows.length) return;

    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `employee-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleStatus = async (employee: Employee) => {
    try {
      await API.patch(`/employees/${employee.id}/`, { is_active: !employee.is_active });
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to update employee status", error);
      window.alert("Unable to update employee status right now.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this employee?")) return;
    try {
      await API.delete(`/employees/${id}/`);
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to delete employee", error);
      window.alert("Delete failed.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker">
                  <i className="ti ti-users-group" /> Employee Directory
                </span>
                <h1 className="payroll-title">Employee List</h1>
                <p className="payroll-subtitle">
                  Manage the full employee directory with cleaner filters, profile completeness visibility, and quick actions for HR operations.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip"><i className="ti ti-briefcase" /> {departments.length} departments connected</span>
                  <span className="employee-chip"><i className="ti ti-id-badge-2" /> {designations.length} designations ready</span>
                  <span className="employee-chip"><i className="ti ti-chart-radar" /> {totals.averageCompletion}% average profile completion</span>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button" onClick={() => navigate(all_routes.employeeGrid)}>
                    <i className="ti ti-layout-grid me-1" /> Grid View
                  </button>
                  <button className="btn btn-white" type="button" onClick={exportCSV}>
                    <i className="ti ti-file-export me-1" /> Export
                  </button>
                  <button className="btn btn-primary" type="button" onClick={() => navigate(all_routes.employeeAdd)}>
                    <i className="ti ti-plus me-1" /> Add Employee
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3 mt-1">
              {[
                { label: "Total Employees", value: totals.total, meta: "Directory size", icon: "ti ti-users" },
                { label: "Active Workforce", value: totals.active, meta: "Currently active", icon: "ti ti-user-check" },
                { label: "New Joiners", value: totals.newJoiners, meta: "Joined in last 30 days", icon: "ti ti-user-plus" },
                { label: "Profile Completion", value: `${totals.averageCompletion}%`, meta: "Average across all profiles", icon: "ti ti-chart-arcs-3" },
              ].map((item) => (
                <div className="col-md-6 col-xl-3" key={item.label}>
                  <div className="employee-kpi-card">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <span className="payroll-stat-label">{item.label}</span>
                          <h3 className="payroll-stat-value mb-1">{item.value}</h3>
                          <div className="payroll-stat-meta">{item.meta}</div>
                        </div>
                        <span className="employee-kpi-icon"><i className={item.icon} /></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card payroll-panel mb-4">
          <div className="card-body">
            <div className="payroll-toolbar">
              <div>
                <label className="form-label">Search</label>
                <input className="form-control" placeholder="Search by name, email, code, team, or role" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div>
                <label className="form-label">Department</label>
                <select className="form-select" value={selectedDept} onChange={(event) => setSelectedDept(event.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={String(department.id)}>{department.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Designation</label>
                <select className="form-select" value={selectedDesig} onChange={(event) => setSelectedDesig(event.target.value)}>
                  <option value="">All designations</option>
                  {designations.map((designation) => (
                    <option key={designation.id} value={String(designation.id)}>{designation.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as "all" | "active" | "inactive")}>
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="form-label">Sort Order</label>
                <select className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="recent">Most recent</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                  <option value="completion_desc">Highest completion</option>
                  <option value="joining_desc">Newest joiner</option>
                  <option value="joining_asc">Oldest joiner</option>
                </select>
              </div>
              <div>
                <label className="form-label">Rows</label>
                <select className="form-select" value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size} rows</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card payroll-panel payroll-table-card employee-directory-table">
          <div className="payroll-table-header">
            <div>
              <h5>Employee Register</h5>
              <div className="payroll-table-subtitle">Track directory health, profile quality, and employment status from one place.</div>
            </div>
            <div className="payroll-table-controls">
              <span className="payroll-kpi-pill"><i className="ti ti-filter-check" /> {filtered.length} filtered</span>
              <span className="payroll-kpi-pill"><i className="ti ti-chart-donut" /> {averageCompletion}% avg completion</span>
            </div>
          </div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Team</th>
                    <th>Contact</th>
                    <th>Onboarding</th>
                    <th>Profile</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-5">Loading employee directory...</td></tr>
                  ) : paged.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="payroll-empty">
                          <i className="ti ti-users-group" />
                          <h6 className="mb-2">No employees match the current view</h6>
                          <p className="mb-0">Try a different filter or add a new employee profile.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paged.map((employee) => {
                      const completion = profileCompletion(employee);
                      return (
                        <tr key={employee.id}>
                          <td>
                            <div className="employee-identity">
                              <img
                                src={employeeAvatarSrc(employee)}
                                alt={employee.first_name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(employeeFullName(employee))}&background=F26522&color=fff&size=128`;
                                }}
                              />
                              <div>
                                <div className="payroll-primary-text">{employeeFullName(employee)}</div>
                                <div className="payroll-secondary-text">{employee.emp_code || "-"}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="finance-stack-list">
                              {employee.department?.name ? <strong>{employee.department.name}</strong> : <span>-</span>}
                              <span className="payroll-secondary-text">{employee.designation?.title || employee.role || "Role pending"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="employee-contact-list">
                              <span className="employee-contact-item"><i className="ti ti-mail" /> {employee.email || "-"}</span>
                              <span className="employee-contact-item"><i className="ti ti-phone" /> {employee.phone || "-"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="finance-stack-list">
                              <span className="payroll-primary-text">{formatDisplayDate(employee.joining_date)}</span>
                              <span className="payroll-secondary-text">{employee.employment_type || "Employment type pending"}</span>
                              <span className="payroll-secondary-text">{calculateTenureLabel(employee.joining_date)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="finance-metric-stack">
                              <div className="d-flex justify-content-between align-items-center gap-3">
                                <span className="payroll-secondary-text">Completion</span>
                                <strong>{completion}%</strong>
                              </div>
                              <div className="finance-progress-track">
                                <div className={`finance-progress-bar ${completion >= 85 ? "success" : completion >= 60 ? "warning" : "danger"}`} style={{ width: `${Math.max(completion, 6)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <button type="button" className={`payroll-badge ${employee.is_active ? "success" : "danger"}`} onClick={() => toggleStatus(employee)}>
                              <i className="ti ti-point-filled" />
                              {employee.is_active ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="text-end">
                            <button type="button" className="btn btn-sm btn-white me-2" onClick={() => navigate(all_routes.employeeDetailsView.replace(":id", String(employee.id)))}>
                              <i className="ti ti-eye" />
                            </button>
                            <button type="button" className="btn btn-sm btn-white me-2" onClick={() => navigate(`${all_routes.employeeAdd}?id=${employee.id}`)}>
                              <i className="ti ti-edit" />
                            </button>
                            <button type="button" className="btn btn-sm btn-white text-danger" onClick={() => handleDelete(employee.id)}>
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

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pt-4">
              <p className="mb-0 payroll-secondary-text">Showing {rangeStart} to {rangeEnd} of {filtered.length} employees</p>
              <div className="d-flex gap-2">
                <button className="btn btn-light" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                <button className="btn btn-light" type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;
