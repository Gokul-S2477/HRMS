import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import {
  HrmEmptyState,
  HrmHero,
  formatDateTimeLabel,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "../hrm/hrmShared";

const normalizeList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const DISTRIBUTION_OPTIONS = [
  { value: "all", label: "All Employees" },
  { value: "dept", label: "Specific Department" },
  { value: "role", label: "Specific Role" },
];

const defaultForm = {
  title: "",
  description: "",
  distribution_type: "all",
  target_department_id: "",
  target_role: "",
  file: null as File | null,
};

const ESignDesk: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [distFilter, setDistFilter] = useState("");
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, deptRes] = await Promise.all([
        API.get("/esign-documents/"),
        API.get("/departments/"),
      ]);
      setRecords(normalizeList(docsRes.data));
      setDepartments(normalizeList(deptRes.data));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    records.filter((record) => {
      if (!smartSearchMatch(record, search)) return false;
      if (distFilter && record.distribution_type !== distFilter) return false;
      return true;
    }), [records, search, distFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.reduce((sum, r) =>
      sum + (r.signatures || []).filter((s: any) => s.status === "pending").length, 0);
    const signed = records.reduce((sum, r) =>
      sum + (r.signatures || []).filter((s: any) => s.status === "signed").length, 0);
    const allSigned = records.filter((r) =>
      (r.signatures || []).length > 0 &&
      (r.signatures || []).every((s: any) => s.status === "signed")).length;
    return [
      { label: "Documents", value: total, meta: "Total e-sign requests" },
      { label: "Pending Signatures", value: pending, meta: "Awaiting employee action" },
      { label: "Signed", value: signed, meta: "Collected signatures" },
      { label: "Fully Complete", value: allSigned, meta: "All recipients signed" },
    ];
  }, [records]);

  const handleField = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { alert("Document title is required."); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("distribution_type", form.distribution_type);
      if (form.distribution_type === "dept" && form.target_department_id) {
        formData.append("target_department_id", form.target_department_id);
      }
      if (form.distribution_type === "role" && form.target_role) {
        formData.append("target_role", form.target_role);
      }
      if (form.file) formData.append("file", form.file);
      await API.post("/esign-documents/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({ ...defaultForm });
      setShowModal(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to create e-sign request.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this e-sign document?")) return;
    try {
      await API.delete(`/esign-documents/${id}/`);
      load();
    } catch {
      alert("Could not delete.");
    }
  };

  const openSigModal = (doc: any) => { setSelectedDoc(doc); setShowSigModal(true); };

  const sigSummary = (doc: any) => {
    const sigs = doc.signatures || [];
    const signed = sigs.filter((s: any) => s.status === "signed").length;
    return `${signed}/${sigs.length}`;
  };

  const completionPct = (doc: any) => {
    const sigs = doc.signatures || [];
    if (!sigs.length) return 0;
    return Math.round((sigs.filter((s: any) => s.status === "signed").length / sigs.length) * 100);
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Documents"
          title="E-Sign Desk"
          subtitle="Upload documents, select target recipients, and track signature collection across your organisation in real time."
          action={
            <div className="d-flex gap-2 align-items-center">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setForm({ ...defaultForm }); setShowModal(true); }}
              >
                <i className="ti ti-file-plus me-2" />
                Create E-Sign Request
              </button>
              <CollapseHeader />
            </div>
          }
          stats={stats}
        >
          <span className="employee-chip"><i className="ti ti-shield-lock" /> Legally trackable signature chain</span>
          <span className="employee-chip"><i className="ti ti-users" /> Multi-target distribution</span>
          <span className="employee-chip"><i className="ti ti-clock-check" /> Real-time completion tracking</span>
        </HrmHero>

        {/* Toolbar */}
        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Document Registry</h5>
              <div className="payroll-table-subtitle">All e-sign documents, status, and completion progress.</div>
            </div>
            <div className="payroll-table-controls">
              <input
                className="form-control"
                style={{ minWidth: 260 }}
                placeholder="Search documents, uploader, distribution…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-select"
                style={{ minWidth: 180 }}
                value={distFilter}
                onChange={(e) => setDistFilter(e.target.value)}
              >
                <option value="">All distributions</option>
                {DISTRIBUTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button className="btn btn-outline-secondary" onClick={() => { setSearch(""); setDistFilter(""); }}>
                <i className="ti ti-filter-off" />
              </button>
            </div>
          </div>

          <div className="card-body">
            {loading ? (
              <div className="payroll-empty">
                <i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite" }} />
                <p>Loading documents…</p>
              </div>
            ) : filtered.length === 0 ? (
              <HrmEmptyState
                title="No e-sign documents yet"
                description="Create your first e-sign request to start distributing documents for digital signature collection."
              />
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Distribution</th>
                      <th>Uploaded By</th>
                      <th>Progress</th>
                      <th>Created</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((doc) => {
                      const pct = completionPct(doc);
                      return (
                        <tr key={doc.id}>
                          <td>
                            <div className="payroll-avatar-block">
                              <span className="payroll-avatar-icon">
                                <i className="ti ti-file-certificate" />
                              </span>
                              <div>
                                <div className="payroll-primary-text">{doc.title}</div>
                                <div className="payroll-secondary-text">{doc.description || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`payroll-badge ${doc.distribution_type === "all" ? "info" : "accent"}`}>
                              {DISTRIBUTION_OPTIONS.find((o) => o.value === doc.distribution_type)?.label || doc.distribution_type}
                            </span>
                            {doc.target_department_name && (
                              <div className="payroll-secondary-text mt-1">{doc.target_department_name}</div>
                            )}
                            {doc.target_role && (
                              <div className="payroll-secondary-text mt-1">{doc.target_role}</div>
                            )}
                          </td>
                          <td>
                            <div className="payroll-primary-text">
                              {doc.uploaded_by?.full_name || doc.uploaded_by?.username || "—"}
                            </div>
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="payroll-secondary-text" style={{ fontSize: 12 }}>
                                {sigSummary(doc)} signed
                              </span>
                              <span
                                className={`payroll-badge ${pct === 100 ? "success" : pct > 0 ? "warning" : "danger"}`}
                                style={{ fontSize: 11 }}
                              >
                                {pct}%
                              </span>
                            </div>
                            <div className="finance-progress-track">
                              <div
                                className={`finance-progress-bar ${pct === 100 ? "success" : pct > 50 ? "" : "warning"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                          <td className="payroll-secondary-text">
                            {formatDateTimeLabel(doc.created_at)}
                          </td>
                          <td>
                            <div className="d-flex justify-content-end gap-2">
                              {doc.file && (
                                <a
                                  href={doc.file}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-secondary"
                                  title="View Document"
                                >
                                  <i className="ti ti-eye" />
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openSigModal(doc)}
                                title="View Signatures"
                              >
                                <i className="ti ti-signature me-1" />
                                Signatures
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(doc.id)}
                                title="Delete"
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1} style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="ti ti-file-plus me-2 text-primary" />
                    Create E-Sign Request
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Document Title *</label>
                      <input
                        className="form-control"
                        placeholder="e.g. Q2 NDA Agreement"
                        value={form.title}
                        onChange={(e) => handleField("title", e.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Brief description of the document purpose…"
                        value={form.description}
                        onChange={(e) => handleField("description", e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Distribution</label>
                      <select
                        className="form-select"
                        value={form.distribution_type}
                        onChange={(e) => handleField("distribution_type", e.target.value)}
                      >
                        {DISTRIBUTION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {form.distribution_type === "dept" && (
                      <div className="col-md-6">
                        <label className="form-label">Target Department</label>
                        <select
                          className="form-select"
                          value={form.target_department_id}
                          onChange={(e) => handleField("target_department_id", e.target.value)}
                        >
                          <option value="">Select department…</option>
                          {departments.map((d: any) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {form.distribution_type === "role" && (
                      <div className="col-md-6">
                        <label className="form-label">Target Role</label>
                        <input
                          className="form-control"
                          placeholder="e.g. hr, employee, stakeholder"
                          value={form.target_role}
                          onChange={(e) => handleField("target_role", e.target.value)}
                        />
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label">Upload Document (PDF/Word)</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.doc,.docx,.png,.jpg"
                        onChange={(e) => handleField("file", e.target.files?.[0] || null)}
                      />
                      <span className="finance-form-hint">Accepted: PDF, Word (.docx), or image files. Max 20 MB.</span>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? (
                      <><i className="ti ti-loader-2 me-2" style={{ animation: "spin 1s linear infinite" }} />Sending…</>
                    ) : (
                      <><i className="ti ti-send me-2" />Distribute Document</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1040 }} />
        </>
      )}

      {/* SIGNATURES MODAL */}
      {showSigModal && selectedDoc && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1} style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="ti ti-signature me-2 text-primary" />
                    Signatures — {selectedDoc.title}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowSigModal(false)} />
                </div>
                <div className="modal-body">
                  {(selectedDoc.signatures || []).length === 0 ? (
                    <div className="payroll-empty">
                      <i className="ti ti-users-group" />
                      <p>No signature slots generated yet. Check the distribution settings.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Status</th>
                            <th>Signed At</th>
                            <th>IP Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedDoc.signatures || []).map((sig: any) => (
                            <tr key={sig.id}>
                              <td>
                                <div className="payroll-primary-text">
                                  {sig.employee_name || `Employee #${sig.employee}`}
                                </div>
                              </td>
                              <td>
                                <span className={`payroll-badge ${sig.status === "signed" ? "success" : "warning"}`}>
                                  {sig.status === "signed" ? "Signed" : "Pending"}
                                </span>
                              </td>
                              <td className="payroll-secondary-text">
                                {sig.signed_at ? formatDateTimeLabel(sig.signed_at) : "—"}
                              </td>
                              <td className="payroll-secondary-text">{sig.ip_address || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowSigModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1040 }} />
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ESignDesk;
