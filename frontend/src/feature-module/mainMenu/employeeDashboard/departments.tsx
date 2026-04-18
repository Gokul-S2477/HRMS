import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import all_routes from "../../router/all_routes";

type Dept = {
  id: number;
  name: string;
  description?: string | null;
  employee_count?: number;
};

const DepartmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const response = await API.get("/departments/");
      setDepartments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load departments", error);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const processed = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = departments.filter(
      (department) =>
        department.name.toLowerCase().includes(query) ||
        String(department.description || "").toLowerCase().includes(query)
    );

    if (statusFilter === "active") {
      list = list.filter((department) => (department.employee_count || 0) > 0);
    } else if (statusFilter === "inactive") {
      list = list.filter((department) => (department.employee_count || 0) === 0);
    }

    list.sort((left, right) => {
      if (sortBy === "count") {
        const value = (left.employee_count || 0) - (right.employee_count || 0);
        return sortDir === "asc" ? value : -value;
      }
      const value = left.name.localeCompare(right.name);
      return sortDir === "asc" ? value : -value;
    });

    return list;
  }, [departments, search, sortBy, sortDir, statusFilter]);

  const summary = useMemo(() => {
    const total = departments.length;
    const staffed = departments.filter((department) => (department.employee_count || 0) > 0).length;
    const unstaffed = total - staffed;
    const averageHeadcount = total === 0 ? 0 : Math.round(departments.reduce((sum, department) => sum + (department.employee_count || 0), 0) / total);
    return { total, staffed, unstaffed, averageHeadcount };
  }, [departments]);

  const pageCount = Math.max(1, Math.ceil(processed.length / rowsPerPage));
  const paged = processed.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const rangeStart = processed.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(page * rowsPerPage, processed.length);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortDir, statusFilter, rowsPerPage]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const resetForm = () => {
    setNameInput("");
    setDescInput("");
  };

  const openEdit = (department: Dept) => {
    setEditing(department);
    setNameInput(department.name);
    setDescInput(department.description || "");
    setShowEdit(true);
  };

  const handleAdd = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!nameInput.trim()) return window.alert("Department name is required.");

    try {
      await API.post("/departments/", {
        name: nameInput.trim(),
        description: descInput.trim(),
      });
      setShowAdd(false);
      resetForm();
      await loadDepartments();
    } catch (error) {
      console.error("Failed to add department", error);
      window.alert("Unable to add department.");
    }
  };

  const handleEdit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!editing) return;

    try {
      await API.patch(`/departments/${editing.id}/`, {
        name: nameInput.trim(),
        description: descInput.trim(),
      });
      setShowEdit(false);
      setEditing(null);
      resetForm();
      await loadDepartments();
    } catch (error) {
      console.error("Failed to update department", error);
      window.alert("Unable to update department.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this department?")) return;
    try {
      await API.delete(`/departments/${id}/`);
      await loadDepartments();
    } catch (error) {
      console.error("Failed to delete department", error);
      window.alert("Unable to delete department.");
    }
  };

  const exportCSV = () => {
    const rows = processed.map((department) => ({
      department: department.name,
      employees: department.employee_count || 0,
      status: (department.employee_count || 0) > 0 ? "Staffed" : "Unstaffed",
      description: department.description || "",
    }));
    if (!rows.length) return;

    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `departments-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker"><i className="ti ti-building-community" /> Workforce Structure</span>
                <h1 className="payroll-title">Departments</h1>
                <p className="payroll-subtitle">Organize teams, monitor where headcount is sitting, and jump straight into the employee directory for any department.</p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button" onClick={exportCSV}><i className="ti ti-file-export me-1" /> Export</button>
                  <button className="btn btn-primary" type="button" onClick={() => setShowAdd(true)}><i className="ti ti-plus me-1" /> Add Department</button>
                  <div className="head-icons"><CollapseHeader /></div>
                </div>
              </div>
            </div>
            <div className="row g-3 mt-1">
              {[
                { label: "Departments", value: summary.total, meta: "Total structures configured", icon: "ti ti-building" },
                { label: "Staffed", value: summary.staffed, meta: "Departments with headcount", icon: "ti ti-users" },
                { label: "Unstaffed", value: summary.unstaffed, meta: "Needs hiring or cleanup", icon: "ti ti-user-off" },
                { label: "Avg Headcount", value: summary.averageHeadcount, meta: "Average employees per department", icon: "ti ti-chart-bar" },
              ].map((item) => (
                <div className="col-md-6 col-xl-3" key={item.label}>
                  <div className="employee-kpi-card"><div className="card-body"><div className="d-flex justify-content-between align-items-start"><div><span className="payroll-stat-label">{item.label}</span><h3 className="payroll-stat-value mb-1">{item.value}</h3><div className="payroll-stat-meta">{item.meta}</div></div><span className="employee-kpi-icon"><i className={item.icon} /></span></div></div></div>
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
                <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search department name or description" />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}>
                  <option value="all">All status</option>
                  <option value="active">Staffed</option>
                  <option value="inactive">Unstaffed</option>
                </select>
              </div>
              <div>
                <label className="form-label">Sort By</label>
                <select className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as "name" | "count")}>
                  <option value="name">Department name</option>
                  <option value="count">Employee count</option>
                </select>
              </div>
              <div>
                <label className="form-label">Direction</label>
                <select className="form-select" value={sortDir} onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
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
              <h5>Department Register</h5>
              <div className="payroll-table-subtitle">Each department stays linked to live employee counts so HR can spot gaps quickly.</div>
            </div>
            <div className="payroll-table-controls">
              <span className="payroll-kpi-pill"><i className="ti ti-filter-check" /> {processed.length} filtered</span>
            </div>
          </div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Description</th>
                    <th>Employees</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-5">Loading departments...</td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={5}><div className="payroll-empty"><i className="ti ti-building-community" /><h6 className="mb-2">No departments found</h6><p className="mb-0">Create a department or adjust the current filters.</p></div></td></tr>
                  ) : (
                    paged.map((department) => (
                      <tr key={department.id}>
                        <td>
                          <div className="finance-stack-list">
                            <strong>{department.name}</strong>
                            <span className="payroll-secondary-text">Dept ID #{department.id}</span>
                          </div>
                        </td>
                        <td><span className="finance-clamp-text">{department.description || "No description added"}</span></td>
                        <td><span className="payroll-primary-text">{department.employee_count || 0}</span></td>
                        <td>
                          <span className={`payroll-badge ${(department.employee_count || 0) > 0 ? "success" : "danger"}`}>
                            <i className="ti ti-point-filled" />
                            {(department.employee_count || 0) > 0 ? "Staffed" : "Unstaffed"}
                          </span>
                        </td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-white me-2" onClick={() => navigate(`${all_routes.employeeList}?department=${department.id}`)}>
                            <i className="ti ti-users me-1" /> Team
                          </button>
                          <button type="button" className="btn btn-sm btn-white me-2" onClick={() => openEdit(department)}><i className="ti ti-edit" /></button>
                          <button type="button" className="btn btn-sm btn-white text-danger" onClick={() => handleDelete(department.id)}><i className="ti ti-trash" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pt-4">
              <p className="mb-0 payroll-secondary-text">Showing {rangeStart} to {rangeEnd} of {processed.length} departments</p>
              <div className="d-flex gap-2">
                <button className="btn btn-light" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                <button className="btn btn-light" type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(showAdd || showEdit) && (
        <div className="modal show d-block payroll-modal" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={showEdit ? handleEdit : handleAdd}>
                <div className="modal-header">
                  <div>
                    <span className="payroll-kicker"><i className="ti ti-building-community" /> {showEdit ? "Edit department" : "New department"}</span>
                    <h5 className="modal-title mb-0">{showEdit ? "Update Department" : "Add Department"}</h5>
                  </div>
                  <button type="button" className="btn-close" onClick={() => { setShowAdd(false); setShowEdit(false); setEditing(null); resetForm(); }} />
                </div>
                <div className="modal-body">
                  <div className="payroll-modal-grid">
                    <div className="card employee-section-card"><div className="card-body"><div className="row g-3"><div className="col-12"><label className="form-label">Department Name</label><input className="form-control" value={nameInput} onChange={(event) => setNameInput(event.target.value)} required /></div><div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={5} value={descInput} onChange={(event) => setDescInput(event.target.value)} placeholder="What this department owns and how HR should use it" /></div></div></div></div>
                    <div className="card employee-summary-card"><div className="card-body"><h6 className="payroll-section-title mb-3">Live Preview</h6><div className="employee-summary-list"><div className="employee-summary-row"><span>Name</span><strong>{nameInput || "-"}</strong></div><div className="employee-summary-row"><span>Status</span><strong>{showEdit && editing && (editing.employee_count || 0) > 0 ? "Staffed" : "Ready"}</strong></div><div className="employee-summary-row"><span>Headcount</span><strong>{showEdit && editing ? editing.employee_count || 0 : 0}</strong></div></div><div className="finance-note-card mt-3"><i className="ti ti-sparkles" /><span>Use clear department names so downstream designation and employee filters stay clean.</span></div></div></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => { setShowAdd(false); setShowEdit(false); setEditing(null); resetForm(); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{showEdit ? "Save Changes" : "Create Department"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {(showAdd || showEdit) && <div className="modal-backdrop show"></div>}
    </div>
  );
};

export default DepartmentsPage;
