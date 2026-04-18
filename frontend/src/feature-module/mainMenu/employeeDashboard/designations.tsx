import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import all_routes from "../../router/all_routes";

type Department = {
  id: number;
  name: string;
};

type Designation = {
  id: number;
  title: string;
  description?: string | null;
  department?: number | null;
  department_detail?: { id: number; name: string } | null;
};

const DesignationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeCounts, setEmployeeCounts] = useState<Record<number, number>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);

  const [titleInput, setTitleInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [deptInput, setDeptInput] = useState("");

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "count">("recent");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [designationRes, departmentRes, employeeRes] = await Promise.all([
        API.get("/designations/"),
        API.get("/departments/"),
        API.get("/employees/"),
      ]);

      const nextDesignations = Array.isArray(designationRes.data) ? designationRes.data : designationRes.data?.results || [];
      const nextDepartments = Array.isArray(departmentRes.data) ? departmentRes.data : departmentRes.data?.results || [];
      const employees = Array.isArray(employeeRes.data) ? employeeRes.data : employeeRes.data?.results || [];

      const counts: Record<number, number> = {};
      employees.forEach((employee: any) => {
        const id = employee.designation?.id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });

      setDesignations(nextDesignations);
      setDepartments(nextDepartments);
      setEmployeeCounts(counts);
    } catch (error) {
      console.error("Failed to load designations", error);
      setDesignations([]);
      setDepartments([]);
      setEmployeeCounts({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const processed = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = designations.filter(
      (designation) =>
        designation.title.toLowerCase().includes(query) ||
        String(designation.description || "").toLowerCase().includes(query) ||
        String(designation.department_detail?.name || "").toLowerCase().includes(query)
    );

    if (filterDept) {
      list = list.filter((designation) => String(designation.department_detail?.id || "") === filterDept);
    }

    if (statusFilter === "active") list = list.filter((designation) => (employeeCounts[designation.id] || 0) > 0);
    if (statusFilter === "inactive") list = list.filter((designation) => (employeeCounts[designation.id] || 0) === 0);

    if (sortBy === "name") {
      list.sort((left, right) => left.title.localeCompare(right.title));
    } else if (sortBy === "count") {
      list.sort((left, right) => (employeeCounts[right.id] || 0) - (employeeCounts[left.id] || 0));
    }

    return list;
  }, [designations, employeeCounts, filterDept, search, sortBy, statusFilter]);

  const summary = useMemo(() => {
    const total = designations.length;
    const staffed = designations.filter((designation) => (employeeCounts[designation.id] || 0) > 0).length;
    const open = total - staffed;
    const averageCoverage = total === 0 ? 0 : Math.round(designations.reduce((sum, designation) => sum + (employeeCounts[designation.id] || 0), 0) / total);
    return { total, staffed, open, averageCoverage };
  }, [designations, employeeCounts]);

  const pageCount = Math.max(1, Math.ceil(processed.length / rowsPerPage));
  const paged = processed.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const rangeStart = processed.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(page * rowsPerPage, processed.length);

  useEffect(() => {
    setPage(1);
  }, [filterDept, rowsPerPage, search, sortBy, statusFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const resetForm = () => {
    setTitleInput("");
    setDescInput("");
    setDeptInput("");
  };

  const openEdit = (designation: Designation) => {
    setEditing(designation);
    setTitleInput(designation.title);
    setDescInput(designation.description || "");
    setDeptInput(String(designation.department || designation.department_detail?.id || ""));
    setShowEdit(true);
  };

  const handleAdd = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!titleInput.trim()) return window.alert("Designation title is required.");

    try {
      await API.post("/designations/", {
        title: titleInput.trim(),
        description: descInput.trim() || "",
        department_id: deptInput ? Number(deptInput) : null,
      });
      setShowAdd(false);
      resetForm();
      await loadAll();
    } catch (error) {
      console.error("Failed to add designation", error);
      window.alert("Unable to add designation.");
    }
  };

  const handleEdit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!editing) return;

    try {
      await API.patch(`/designations/${editing.id}/`, {
        title: titleInput.trim(),
        description: descInput.trim() || "",
        department_id: deptInput ? Number(deptInput) : null,
      });
      setShowEdit(false);
      setEditing(null);
      resetForm();
      await loadAll();
    } catch (error) {
      console.error("Failed to update designation", error);
      window.alert("Unable to update designation.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this designation?")) return;
    try {
      await API.delete(`/designations/${id}/`);
      await loadAll();
    } catch (error) {
      console.error("Failed to delete designation", error);
      window.alert("Unable to delete designation.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker"><i className="ti ti-id-badge-2" /> Role Architecture</span>
                <h1 className="payroll-title">Designations</h1>
                <p className="payroll-subtitle">Keep role titles clean, link them to departments, and spot which positions still need people assigned.</p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-primary" type="button" onClick={() => setShowAdd(true)}><i className="ti ti-plus me-1" /> Add Designation</button>
                  <div className="head-icons"><CollapseHeader /></div>
                </div>
              </div>
            </div>
            <div className="row g-3 mt-1">
              {[
                { label: "Designations", value: summary.total, meta: "Total role titles", icon: "ti ti-id" },
                { label: "Assigned", value: summary.staffed, meta: "Roles with active coverage", icon: "ti ti-user-check" },
                { label: "Unassigned", value: summary.open, meta: "Roles with no linked employees", icon: "ti ti-user-question" },
                { label: "Avg Coverage", value: summary.averageCoverage, meta: "Employees per designation", icon: "ti ti-chart-bar" },
              ].map((item) => (
                <div className="col-md-6 col-xl-3" key={item.label}>
                  <div className="employee-kpi-card"><div className="card-body"><div className="d-flex justify-content-between align-items-start"><div><span className="payroll-stat-label">{item.label}</span><h3 className="payroll-stat-value mb-1">{item.value}</h3><div className="payroll-stat-meta">{item.meta}</div></div><span className="employee-kpi-icon"><i className={item.icon} /></span></div></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card payroll-panel mb-4"><div className="card-body"><div className="payroll-toolbar"><div><label className="form-label">Search</label><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, department, or description" /></div><div><label className="form-label">Department</label><select className="form-select" value={filterDept} onChange={(event) => setFilterDept(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}</select></div><div><label className="form-label">Status</label><select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}><option value="all">All status</option><option value="active">Assigned</option><option value="inactive">Unassigned</option></select></div><div><label className="form-label">Sort</label><select className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as "recent" | "name" | "count")}><option value="recent">Most recent</option><option value="name">Name A-Z</option><option value="count">Highest coverage</option></select></div><div><label className="form-label">Rows</label><select className="form-select" value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size} rows</option>)}</select></div></div></div></div>

        <div className="card payroll-panel payroll-table-card employee-directory-table">
          <div className="payroll-table-header"><div><h5>Designation Register</h5><div className="payroll-table-subtitle">Linked employee counts help HR understand which roles are active and which need staffing.</div></div><div className="payroll-table-controls"><span className="payroll-kpi-pill"><i className="ti ti-filter-check" /> {processed.length} filtered</span></div></div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Designation</th><th>Department</th><th>Coverage</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-5">Loading designations...</td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={5}><div className="payroll-empty"><i className="ti ti-id-badge-2" /><h6 className="mb-2">No designations found</h6><p className="mb-0">Try changing the filters or create a new role title.</p></div></td></tr>
                  ) : (
                    paged.map((designation) => {
                      const count = employeeCounts[designation.id] || 0;
                      return (
                        <tr key={designation.id}>
                          <td><div className="finance-stack-list"><strong>{designation.title}</strong><span className="payroll-secondary-text">{designation.description || "No description added"}</span></div></td>
                          <td>{designation.department_detail?.name || "Unassigned"}</td>
                          <td><span className="payroll-primary-text">{count}</span></td>
                          <td><span className={`payroll-badge ${count > 0 ? "success" : "danger"}`}><i className="ti ti-point-filled" />{count > 0 ? "Assigned" : "Open"}</span></td>
                          <td className="text-end"><button type="button" className="btn btn-sm btn-white me-2" onClick={() => navigate(`${all_routes.employeeList}?designation=${designation.id}`)}><i className="ti ti-users me-1" /> People</button><button type="button" className="btn btn-sm btn-white me-2" onClick={() => openEdit(designation)}><i className="ti ti-edit" /></button><button type="button" className="btn btn-sm btn-white text-danger" onClick={() => handleDelete(designation.id)}><i className="ti ti-trash" /></button></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pt-4"><p className="mb-0 payroll-secondary-text">Showing {rangeStart} to {rangeEnd} of {processed.length} designations</p><div className="d-flex gap-2"><button className="btn btn-light" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button className="btn btn-light" type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div></div>
          </div>
        </div>
      </div>

      {(showAdd || showEdit) && (
        <div className="modal show d-block payroll-modal" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg"><div className="modal-content"><form onSubmit={showEdit ? handleEdit : handleAdd}><div className="modal-header"><div><span className="payroll-kicker"><i className="ti ti-id-badge-2" /> {showEdit ? "Edit designation" : "New designation"}</span><h5 className="modal-title mb-0">{showEdit ? "Update Designation" : "Add Designation"}</h5></div><button type="button" className="btn-close" onClick={() => { setShowAdd(false); setShowEdit(false); setEditing(null); resetForm(); }} /></div><div className="modal-body"><div className="payroll-modal-grid"><div className="card employee-section-card"><div className="card-body"><div className="row g-3"><div className="col-12"><label className="form-label">Title</label><input className="form-control" value={titleInput} onChange={(event) => setTitleInput(event.target.value)} required /></div><div className="col-12"><label className="form-label">Department</label><select className="form-select" value={deptInput} onChange={(event) => setDeptInput(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div><div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={5} value={descInput} onChange={(event) => setDescInput(event.target.value)} placeholder="When this designation should be used in the org chart" /></div></div></div></div><div className="card employee-summary-card"><div className="card-body"><h6 className="payroll-section-title mb-3">Live Preview</h6><div className="employee-summary-list"><div className="employee-summary-row"><span>Title</span><strong>{titleInput || "-"}</strong></div><div className="employee-summary-row"><span>Department</span><strong>{departments.find((department) => String(department.id) === deptInput)?.name || "-"}</strong></div><div className="employee-summary-row"><span>Current Headcount</span><strong>{showEdit && editing ? employeeCounts[editing.id] || 0 : 0}</strong></div></div><div className="finance-note-card mt-3"><i className="ti ti-sparkles" /><span>Clean designation names make reporting and salary mapping more reliable later.</span></div></div></div></div></div><div className="modal-footer"><button type="button" className="btn btn-light" onClick={() => { setShowAdd(false); setShowEdit(false); setEditing(null); resetForm(); }}>Cancel</button><button type="submit" className="btn btn-primary">{showEdit ? "Save Changes" : "Create Designation"}</button></div></form></div></div>
        </div>
      )}
      {(showAdd || showEdit) && <div className="modal-backdrop show"></div>}
    </div>
  );
};

export default DesignationsPage;
