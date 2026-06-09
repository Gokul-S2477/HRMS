import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";

type Dept = {
  id: number;
  name: string;
  description?: string | null;
};

type Policy = {
  id: number;
  title: string;
  description?: string | null;
  department_id?: number | null;
  department_detail?: Dept | null;
  file?: string | null;
  created_at?: string | null;
};

const Policies: React.FC = () => {
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<Policy | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [search, setSearch] = useState("");
  const [filterDeptId, setFilterDeptId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const response = await API.get("/departments/");
        setDepartments(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to load departments", error);
      }
    })();
  }, []);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/policies/", {
        params: {
          search: search || undefined,
          department: filterDeptId || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });
      setPolicies(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load policies", error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [filterDeptId, fromDate, search, toDate]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  useEffect(() => {
    setPage(1);
  }, [filterDeptId, fromDate, rowsPerPage, search, toDate]);

  const resetForm = () => {
    setTitle("");
    setDesc("");
    setFormDeptId("");
    setFile(null);
    setEditItem(null);
  };

  const openEdit = (policy: Policy) => {
    setEditItem(policy);
    setTitle(policy.title || "");
    setDesc(policy.description || "");
    setFormDeptId(String(policy.department_id ?? policy.department_detail?.id ?? ""));
    setFile(null);
    setShowEdit(true);
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return window.alert("Policy title is required.");

    const payload = new FormData();
    payload.append("title", title.trim());
    payload.append("description", desc || "");
    if (formDeptId) payload.append("department_id", formDeptId);
    if (file) payload.append("file", file);

    try {
      await API.post("/policies/", payload, { headers: { "Content-Type": "multipart/form-data" } });
      setShowAdd(false);
      resetForm();
      await loadPolicies();
    } catch (error) {
      console.error("Failed to add policy", error);
      window.alert("Unable to add policy.");
    }
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editItem) return;

    const payload = new FormData();
    payload.append("title", title.trim());
    payload.append("description", desc || "");
    if (formDeptId) payload.append("department_id", formDeptId);
    if (file) payload.append("file", file);

    try {
      await API.put(`/policies/${editItem.id}/`, payload, { headers: { "Content-Type": "multipart/form-data" } });
      setShowEdit(false);
      resetForm();
      await loadPolicies();
    } catch (error) {
      console.error("Failed to update policy", error);
      window.alert("Unable to update policy.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this policy?")) return;
    try {
      await API.delete(`/policies/${id}/`);
      await loadPolicies();
    } catch (error) {
      console.error("Failed to delete policy", error);
      window.alert("Unable to delete policy.");
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  };

  const summary = useMemo(() => {
    const total = policies.length;
    const withFiles = policies.filter((policy) => Boolean(policy.file)).length;
    const companyWide = policies.filter((policy) => !policy.department_detail?.name).length;
    const departmentSpecific = total - companyWide;
    return { total, withFiles, companyWide, departmentSpecific };
  }, [policies]);

  const pageCount = Math.max(1, Math.ceil(policies.length / rowsPerPage));
  const paged = policies.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const rangeStart = policies.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(page * rowsPerPage, policies.length);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4"><div className="card-body"><div className="row align-items-center g-4"><div className="col-lg-8 employee-hero-copy"><span className="payroll-kicker"><i className="ti ti-file-text" /> Policy Center</span><h1 className="payroll-title">Policies</h1><p className="payroll-subtitle">Give HR a cleaner policy hub with filtering, attachments, and department-aware publishing controls.</p></div><div className="col-lg-4"><div className="payroll-hero-actions"><button className="btn btn-primary" type="button" onClick={() => { resetForm(); setShowAdd(true); }}><i className="ti ti-plus me-1" /> Add Policy</button><div className="head-icons"><CollapseHeader /></div></div></div></div><div className="row g-3 mt-1">{[{ label: "Policies", value: summary.total, meta: "Total published entries", icon: "ti ti-files" }, { label: "With Attachments", value: summary.withFiles, meta: "Includes uploaded files", icon: "ti ti-paperclip" }, { label: "Company Wide", value: summary.companyWide, meta: "Applies across all departments", icon: "ti ti-building-estate" }, { label: "Department Specific", value: summary.departmentSpecific, meta: "Scoped to a team", icon: "ti ti-building-community" }].map((item) => <div className="col-md-6 col-xl-3" key={item.label}><div className="employee-kpi-card"><div className="card-body"><div className="d-flex justify-content-between align-items-start"><div><span className="payroll-stat-label">{item.label}</span><h3 className="payroll-stat-value mb-1">{item.value}</h3><div className="payroll-stat-meta">{item.meta}</div></div><span className="employee-kpi-icon"><i className={item.icon} /></span></div></div></div></div>)}</div></div></div>

        <div className="card payroll-panel mb-4"><div className="card-body"><div className="payroll-toolbar"><div><label className="form-label">Search</label><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or description" /></div><div><label className="form-label">Department</label><select className="form-select" value={filterDeptId} onChange={(event) => setFilterDeptId(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}</select></div><div><label className="form-label">From</label><input className="form-control" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div><div><label className="form-label">To</label><input className="form-control" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div><div><label className="form-label">Rows</label><select className="form-select" value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size} rows</option>)}</select></div></div></div></div>

        <div className="card payroll-panel payroll-table-card employee-directory-table"><div className="payroll-table-header"><div><h5>Policy Register</h5><div className="payroll-table-subtitle">Filter by department or date, then jump into attachments without leaving the page.</div></div><div className="payroll-table-controls"><span className="payroll-kpi-pill"><i className="ti ti-filter-check" /> {policies.length} policies</span></div></div><div className="payroll-table-shell"><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Policy</th><th>Department</th><th>Description</th><th>Created</th><th>Attachment</th><th className="text-end">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="text-center py-5">Loading policies...</td></tr> : paged.length === 0 ? <tr><td colSpan={6}><div className="payroll-empty"><i className="ti ti-file-text" /><h6 className="mb-2">No policies found</h6><p className="mb-0">Try a broader filter or publish a new policy.</p></div></td></tr> : paged.map((policy) => <tr key={policy.id}><td><div className="finance-stack-list"><strong>{policy.title}</strong><span className="payroll-secondary-text">Policy #{policy.id}</span></div></td><td>{policy.department_detail?.name || "All departments"}</td><td><span className="finance-clamp-text">{policy.description || "No summary added"}</span></td><td>{formatDate(policy.created_at)}</td><td>{policy.file ? (
                            <a
                              className="btn btn-sm btn-light-primary px-3 py-1.5 rounded-pill d-inline-flex align-items-center gap-1.5 font-weight-700"
                              href={policy.file}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                backgroundColor: "rgba(242, 101, 34, 0.08)",
                                color: "var(--hrms-accent, #F26522)",
                                border: "1px solid rgba(242, 101, 34, 0.15)",
                                fontSize: "12px",
                                transition: "all 0.2s ease"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "var(--hrms-accent, #F26522)";
                                e.currentTarget.style.color = "#ffffff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(242, 101, 34, 0.08)";
                                e.currentTarget.style.color = "var(--hrms-accent, #F26522)";
                              }}
                            >
                              <i className="ti ti-download" />
                              <span>Download</span>
                            </a>
                          ) : (
                            <span className="text-muted small d-inline-flex align-items-center gap-1">
                              <i className="ti ti-file-off" />
                              <span>No file</span>
                            </span>
                          )}</td><td className="text-end"><button type="button" className="btn btn-sm btn-white me-2" onClick={() => openEdit(policy)}><i className="ti ti-edit" /></button><button type="button" className="btn btn-sm btn-white text-danger" onClick={() => handleDelete(policy.id)}><i className="ti ti-trash" /></button></td></tr>)}</tbody></table></div><div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pt-4"><p className="mb-0 payroll-secondary-text">Showing {rangeStart} to {rangeEnd} of {policies.length} policies</p><div className="d-flex gap-2"><button className="btn btn-light" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button className="btn btn-light" type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div></div></div></div>
      </div>

      {(showAdd || showEdit) && <div className="modal-backdrop show"></div>}
      {(showAdd || showEdit) && (
        <div className="modal show d-block payroll-modal" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg"><div className="modal-content"><form onSubmit={showEdit ? handleEdit : handleAdd}><div className="modal-header"><div><span className="payroll-kicker"><i className="ti ti-file-text" /> {showEdit ? "Edit policy" : "New policy"}</span><h5 className="modal-title mb-0">{showEdit ? "Update Policy" : "Add Policy"}</h5></div><button type="button" className="btn-close" onClick={() => { setShowAdd(false); setShowEdit(false); resetForm(); }} /></div><div className="modal-body"><div className="payroll-modal-grid"><div className="card employee-section-card"><div className="card-body"><div className="row g-3"><div className="col-12"><label className="form-label">Title</label><input className="form-control" value={title} onChange={(event) => setTitle(event.target.value)} required /></div><div className="col-12"><label className="form-label">Department</label><select className="form-select" value={formDeptId} onChange={(event) => setFormDeptId(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}</select></div><div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={5} value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="What employees need to know about this policy" /></div><div className="col-12"><label className="form-label">Attachment</label><input type="file" className="form-control" onChange={(event) => setFile(event.target.files?.[0] || null)} /></div></div></div></div><div className="card employee-summary-card"><div className="card-body"><h6 className="payroll-section-title mb-3">Live Preview</h6><div className="employee-summary-list"><div className="employee-summary-row"><span>Title</span><strong>{title || "-"}</strong></div><div className="employee-summary-row"><span>Department</span><strong>{departments.find((department) => String(department.id) === formDeptId)?.name || "All departments"}</strong></div><div className="employee-summary-row"><span>Attachment</span><strong>{file?.name || (editItem?.file ? "Keep current file" : "None")}</strong></div></div><div className="finance-note-card mt-3"><i className="ti ti-sparkles" /><span>Department filtering and form department selection are separated now, so editing policies stays predictable.</span></div></div></div></div></div><div className="modal-footer"><button type="button" className="btn btn-light" onClick={() => { setShowAdd(false); setShowEdit(false); resetForm(); }}>Cancel</button><button type="submit" className="btn btn-primary">{showEdit ? "Save Changes" : "Create Policy"}</button></div></form></div></div>
        </div>
      )}
    </div>
  );
};

export default Policies;
