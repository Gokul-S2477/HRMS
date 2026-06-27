import React, { useEffect, useState } from "react";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { HrmHero } from "../../hrm/hrmShared";

type LeaveTypeRecord = {
  id: string;
  data: {
    name?: string;
    days?: number;
    status?: string;
    designation_id?: string;
    designation_name?: string;
  };
};

type LeaveRow = {
  name: string;
  days: number;
  status: string;
};

const RESOURCE = "/data/leave-types/";
const STATUS_OPTIONS = ["Active", "Inactive"];

const emptyRow = (): LeaveRow => ({ name: "", days: 0, status: "Active" });

const LeaveType = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // For add/edit policy - one designation, multiple rows
  const [selectedDesignationId, setSelectedDesignationId] = useState("");
  const [selectedDesignationName, setSelectedDesignationName] = useState("All Designations");
  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([emptyRow()]);

  const normalize = (data: any): LeaveTypeRecord[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const load = async () => {
    setLoading(true);
    try {
      const [leaveRes, desigRes] = await Promise.all([
        API.get(RESOURCE),
        API.get("/designations/"),
      ]);
      setLeaveTypes(normalize(leaveRes.data));
      setDesignations(Array.isArray(desigRes.data) ? desigRes.data : desigRes.data?.results || []);
    } catch (err) {
      console.error("Failed to load leave types", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    setSelectedDesignationId("");
    setSelectedDesignationName("All Designations");
    setLeaveRows([emptyRow()]);
    setShowModal(true);
  };

  const handleDesignationChange = (idStr: string) => {
    if (!idStr || idStr === "all") {
      setSelectedDesignationId("");
      setSelectedDesignationName("All Designations");
    } else {
      const d = designations.find((x) => String(x.id) === idStr);
      setSelectedDesignationId(idStr);
      setSelectedDesignationName(d ? d.title : "");
    }
  };

  const addRow = () => setLeaveRows((prev) => [...prev, emptyRow()]);

  const removeRow = (idx: number) =>
    setLeaveRows((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: keyof LeaveRow, value: string | number) =>
    setLeaveRows((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const handleSave = async () => {
    const validRows = leaveRows.filter((r) => r.name.trim());
    if (!validRows.length) {
      alert("Please add at least one leave type with a name.");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        validRows.map((row) =>
          API.post(RESOURCE, {
            data: {
              name: row.name.trim(),
              days: row.days,
              status: row.status,
              designation_id: selectedDesignationId,
              designation_name: selectedDesignationName,
            },
          })
        )
      );
      setShowModal(false);
      load();
    } catch (err) {
      console.error("Save leave types failed", err);
      alert("Failed to save leave types.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this leave type?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      load();
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  // Group leave types by designation
  const grouped = leaveTypes.reduce((acc, t) => {
    const key = t.data?.designation_name || "All Designations";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, LeaveTypeRecord[]>);

  const heroStats = [
    { label: "Total Types", value: leaveTypes.length, meta: "Leave types configured" },
    { label: "Designations", value: Object.keys(grouped).length, meta: "Groups with leave policies" },
    { label: "Active", value: leaveTypes.filter((t) => t.data?.status === "Active").length, meta: "Currently active leave rules" },
    { label: "Scope", value: "Auto-Applied", meta: "On employee onboarding" },
  ];

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Leave Management"
          title="Leave Types"
          subtitle="Configure leave types per designation — e.g. HR gets 6 Casual Leave + 6 Sick Leave, Software Engineers get 12 Casual + 12 Sick + 15 Earned Leave. These are auto-applied during onboarding."
          action={
            <>
              <button className="btn btn-primary" onClick={openModal}>
                <i className="ti ti-circle-plus me-2" />
                Add Leave Policy
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={heroStats}
        />

        <div className="row g-4">
          {loading ? (
            <div className="col-12 text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="mt-2 text-muted">Loading leave policies...</p>
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="col-12">
              <div className="card payroll-section-card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-calendar-off fs-1 text-muted" />
                  <h5 className="mt-3">No Leave Policies Yet</h5>
                  <p className="text-muted">Click "Add Leave Policy" to configure leave types for your first designation.</p>
                  <button className="btn btn-primary mt-2" onClick={openModal}>
                    <i className="ti ti-circle-plus me-2" />
                    Add Leave Policy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([desigName, types]) => (
              <div className="col-md-6 col-xl-4" key={desigName}>
                <div className="card payroll-section-card h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div>
                        <h6 className="fw-bold mb-0">{desigName}</h6>
                        <small className="text-muted">{types.length} leave type(s)</small>
                      </div>
                      <span className="badge bg-primary-subtle text-primary rounded-pill">
                        {types.reduce((s, t) => s + (Number(t.data?.days) || 0), 0)} days/yr total
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Leave Type</th>
                            <th className="text-center">Days/Year</th>
                            <th className="text-center">Status</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {types.map((t) => (
                            <tr key={t.id}>
                              <td className="fw-semibold">{t.data?.name || "—"}</td>
                              <td className="text-center">
                                <span className="badge bg-info-subtle text-info fw-bold">{t.data?.days ?? "—"}</span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${t.data?.status === "Active" ? "bg-success" : "bg-secondary"}`}>
                                  {t.data?.status || "—"}
                                </span>
                              </td>
                              <td className="text-end">
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDelete(t.id)}
                                  title="Delete"
                                >
                                  <i className="ti ti-trash" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Policy Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h4 className="modal-title mb-0">Add Leave Policy</h4>
                  <small className="text-muted">Select a designation, then add each leave type with days/year</small>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>

              <div className="modal-body">
                {/* Step 1 — Designation */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">
                    <i className="ti ti-award me-2 text-primary" />
                    Step 1: Select Designation
                  </label>
                  <select
                    className="form-select"
                    value={selectedDesignationId}
                    onChange={(e) => handleDesignationChange(e.target.value)}
                  >
                    <option value="all">All Designations (Global Policy)</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                  <div className="form-text">
                    Leaves will be allocated to employees with the designation: <strong>{selectedDesignationName}</strong>
                  </div>
                </div>

                {/* Step 2 — Leave Rows */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    <i className="ti ti-calendar-plus me-2 text-primary" />
                    Step 2: Add Leave Types for <span className="text-primary">{selectedDesignationName}</span>
                  </label>

                  <div className="table-responsive">
                    <table className="table table-bordered align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ minWidth: 200 }}>Leave Type Name</th>
                          <th style={{ width: 120 }}>Days / Year</th>
                          <th style={{ width: 130 }}>Status</th>
                          <th style={{ width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveRows.map((row, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="e.g. Casual Leave (CL)"
                                value={row.name}
                                onChange={(e) => updateRow(idx, "name", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm text-center"
                                min={0}
                                max={365}
                                value={row.days}
                                onChange={(e) => updateRow(idx, "days", Number(e.target.value))}
                              />
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={row.status}
                                onChange={(e) => updateRow(idx, "status", e.target.value)}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="text-center">
                              {leaveRows.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeRow(idx)}
                                  title="Remove row"
                                >
                                  <i className="ti ti-x" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Row Button */}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm mt-3 d-flex align-items-center gap-2"
                    onClick={addRow}
                  >
                    <i className="ti ti-circle-plus" />
                    Add Another Leave Type
                  </button>
                </div>

                {/* Summary */}
                {leaveRows.some((r) => r.name.trim()) && (
                  <div className="alert alert-info d-flex align-items-center gap-2 mb-0">
                    <i className="ti ti-info-circle fs-5" />
                    <span>
                      <strong>{leaveRows.filter((r) => r.name.trim()).length}</strong> leave type(s) will be saved for{" "}
                      <strong>{selectedDesignationName}</strong> —{" "}
                      <strong>{leaveRows.reduce((s, r) => s + (Number(r.days) || 0), 0)}</strong> total days/year
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-device-floppy me-2" />
                      Save Leave Policy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveType;
