import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import all_routes from "../../router/all_routes";
import {
  calculateAge,
  calculateTenureLabel,
  employeeAvatarSrc,
  employeeFullName,
  employeeSummary,
  formatDisplayDate,
  normalizeList,
  profileCompletion,
} from "./employeeShared";

type Dept = { id: number; name: string };
type Desig = { id: number; title: string };

type Employee = {
  id: number;
  emp_code?: string;
  first_name?: string;
  last_name?: string | null;
  email?: string;
  phone?: string | null;
  date_of_birth?: string | null;
  joining_date?: string | null;
  department?: Dept | null;
  designation?: Desig | null;
  is_active?: boolean;
  employment_type?: string | null;
  role?: string | null;
  photo?: string | null;
  created_at?: string | null;
  address?: string | null;
  about?: string | null;
  personal_info?: Record<string, unknown> | null;
  bank_info?: Record<string, unknown> | null;
  family_info?: Record<string, unknown> | null;
  education?: unknown[] | null;
  experience?: unknown[] | null;
  projects?: unknown[] | null;
  assets?: unknown[] | null;
};

const EmployeeGrid: React.FC = () => {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [designations, setDesignations] = useState<Desig[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterDesig, setFilterDesig] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"recent" | "name_asc" | "name_desc" | "joining_asc" | "joining_desc" | "completion_desc">("recent");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(9);

  const loadMeta = async () => {
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

  const loadEmployees = async () => {
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
    loadMeta();
    loadEmployees();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = [...employees];

    if (query) {
      list = list.filter((employee) => {
        const fullName = employeeFullName(employee).toLowerCase();
        return (
          fullName.includes(query) ||
          String(employee.emp_code || "").toLowerCase().startsWith(query) ||
          String(employee.email || "").toLowerCase().includes(query) ||
          String(employee.department?.name || "").toLowerCase().includes(query) ||
          String(employee.designation?.title || "").toLowerCase().includes(query)
        );
      });
    }

    if (filterDept) list = list.filter((employee) => String(employee.department?.id || "") === filterDept);
    if (filterDesig) list = list.filter((employee) => String(employee.designation?.id || "") === filterDesig);
    if (filterStatus === "active") list = list.filter((employee) => employee.is_active);
    if (filterStatus === "inactive") list = list.filter((employee) => !employee.is_active);

    if (sortBy === "name_asc") {
      list.sort((left, right) => employeeFullName(left).localeCompare(employeeFullName(right)));
    } else if (sortBy === "name_desc") {
      list.sort((left, right) => employeeFullName(right).localeCompare(employeeFullName(left)));
    } else if (sortBy === "joining_asc") {
      list.sort((left, right) => new Date(left.joining_date || "").getTime() - new Date(right.joining_date || "").getTime());
    } else if (sortBy === "joining_desc") {
      list.sort((left, right) => new Date(right.joining_date || "").getTime() - new Date(left.joining_date || "").getTime());
    } else if (sortBy === "completion_desc") {
      list.sort((left, right) => profileCompletion(right) - profileCompletion(left));
    } else {
      list.sort((left, right) => new Date(right.created_at || "").getTime() - new Date(left.created_at || "").getTime());
    }

    return list;
  }, [employees, filterDept, filterDesig, filterStatus, search, sortBy]);

  const totals = useMemo(() => employeeSummary(employees), [employees]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search, filterDept, filterDesig, filterStatus, sortBy, rowsPerPage]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const toggleStatus = async (employee: Employee) => {
    try {
      await API.patch(`/employees/${employee.id}/`, { is_active: !employee.is_active });
      await loadEmployees();
    } catch (error) {
      console.error("Failed to update employee status", error);
      window.alert("Unable to update employee status.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker"><i className="ti ti-layout-grid" /> Talent Snapshot</span>
                <h1 className="payroll-title">Employee Grid</h1>
                <p className="payroll-subtitle">A faster visual view for HR teams to scan profile health, availability, and onboarding maturity at a glance.</p>
                <div className="employee-chip-row">
                  <span className="employee-chip"><i className="ti ti-user-check" /> {totals.active} active profiles</span>
                  <span className="employee-chip"><i className="ti ti-user-plus" /> {totals.newJoiners} recent joiners</span>
                  <span className="employee-chip"><i className="ti ti-chart-donut" /> {totals.averageCompletion}% average completion</span>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button" onClick={() => navigate(all_routes.employeeList)}>
                    <i className="ti ti-list-details me-1" /> List View
                  </button>
                  <button className="btn btn-primary" type="button" onClick={() => navigate(all_routes.employeeAdd)}>
                    <i className="ti ti-plus me-1" /> Add Employee
                  </button>
                  <div className="head-icons"><CollapseHeader /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card payroll-panel mb-4">
          <div className="card-body">
            <div className="payroll-toolbar">
              <div>
                <label className="form-label">Search</label>
                <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, department, or code" />
              </div>
              <div>
                <label className="form-label">Department</label>
                <select className="form-select" value={filterDept} onChange={(event) => setFilterDept(event.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Designation</label>
                <select className="form-select" value={filterDesig} onChange={(event) => setFilterDesig(event.target.value)}>
                  <option value="">All designations</option>
                  {designations.map((designation) => <option key={designation.id} value={String(designation.id)}>{designation.title}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as "all" | "active" | "inactive")}>
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="form-label">Sort</label>
                <select className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
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
                  {[6, 9, 12, 18].map((size) => <option key={size} value={size}>{size} cards</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card payroll-panel">
            <div className="card-body text-center py-5">Loading employee grid...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card payroll-panel">
            <div className="card-body">
              <div className="payroll-empty">
                <i className="ti ti-users-group" />
                <h6 className="mb-2">No employees available for this view</h6>
                <p className="mb-0">Adjust the search or filters to bring profiles back into the grid.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="employee-card-grid mb-4">
              {paged.map((employee) => {
                const completion = profileCompletion(employee);
                return (
                  <div className="employee-directory-card" key={employee.id}>
                    {/* ID Card Lanyard Header */}
                    <div className="employee-id-banner" />

                    <div className="card-body">
                      {/* Floating status badge */}
                      <button
                        type="button"
                        className={`employee-status-badge ${employee.is_active ? "success" : "danger"}`}
                        onClick={() => toggleStatus(employee)}
                      >
                        <i className="ti ti-point-filled" />
                        {employee.is_active ? "Active" : "Inactive"}
                      </button>

                      {/* Centered Avatar Frame */}
                      <div className="employee-avatar-frame">
                        <img
                          src={employeeAvatarSrc(employee)}
                          alt={employee.first_name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(employeeFullName(employee))}&background=F26522&color=fff&size=128`;
                          }}
                        />
                      </div>

                      {/* ID Text Metadata */}
                      <div className="employee-name">{employeeFullName(employee)}</div>
                      <span className="employee-code">{employee.emp_code || "Employee code pending"}</span>

                      {/* ID Card Fields block */}
                      <div className="employee-id-fields">
                        <div className="employee-id-field-row">
                          <i className="ti ti-building" />
                          <span>{employee.department?.name || "Department pending"}</span>
                        </div>
                        <div className="employee-id-field-row">
                          <i className="ti ti-id-badge-2" />
                          <span>{employee.designation?.title || employee.role || "Designation pending"}</span>
                        </div>
                        <div className="employee-id-field-row">
                          <i className="ti ti-mail" />
                          <span>{employee.email || "-"}</span>
                        </div>
                        <div className="employee-id-field-row">
                          <i className="ti ti-phone" />
                          <span>{employee.phone || "-"}</span>
                        </div>
                      </div>

                      {/* Onboarding Stack */}
                      <div className="employee-onboarding-stack">
                        <div className="employee-onboarding-header">
                          <span>Profile completion</span>
                          <span>{completion}%</span>
                        </div>
                        <div className="employee-progress-track">
                          <div
                            className={`employee-progress-bar ${completion >= 85 ? "success" : completion >= 60 ? "warning" : "danger"}`}
                            style={{ width: `${Math.max(completion, 6)}%` }}
                          />
                        </div>
                        <div className="d-flex justify-content-between payroll-secondary-text" style={{ fontSize: "11px" }}>
                          <span>{employee.employment_type || "Employment type pending"}</span>
                          <span>{calculateTenureLabel(employee.joining_date)}</span>
                        </div>
                      </div>

                      {/* Badges row */}
                      <div className="employee-id-badges-row">
                        <div className="employee-badge-item-soft">
                          <i className="ti ti-calendar" /> {formatDisplayDate(employee.joining_date)}
                        </div>
                        <div className="employee-badge-item-soft">
                          <i className="ti ti-user-heart" /> {calculateAge(employee.date_of_birth) || "-"} yrs
                        </div>
                      </div>

                      {/* Card Action buttons */}
                      <div className="employee-id-actions">
                        <button
                          type="button"
                          className="btn btn-white flex-fill"
                          onClick={() => navigate(all_routes.employeeDetailsView.replace(":id", String(employee.id)))}
                        >
                          <i className="ti ti-eye me-1" /> Profile
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary flex-fill"
                          onClick={() => navigate(`${all_routes.employeeAdd}?id=${employee.id}`)}
                        >
                          <i className="ti ti-edit me-1" /> Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <p className="mb-0 payroll-secondary-text">Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filtered.length)} of {filtered.length} employees</p>
              <div className="d-flex gap-2">
                <button className="btn btn-light" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                <button className="btn btn-light" type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeGrid;
