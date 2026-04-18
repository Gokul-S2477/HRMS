import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import API from "../../../api/axios";

type LeaveTypeRecord = {
  id: string;
  data: {
    name?: string;
    days?: number;
    status?: string;
  };
};

const RESOURCE = "/data/leave-types/";
const STATUS_OPTIONS = ["Active", "Inactive"];

const LeaveType = () => {
  const routes = all_routes;
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeRecord | null>(null);
  const [form, setForm] = useState({ name: "", days: 0, status: "Active" });

  const normalize = (data: any): LeaveTypeRecord[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get(RESOURCE);
      setLeaveTypes(normalize(res.data));
    } catch (err) {
      console.error("Failed to load leave types", err);
      setLeaveTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ name: "", days: 0, status: "Active" });
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) return alert("Leave type is required");
    try {
      await API.post(RESOURCE, { data: { ...form, name: form.name.trim() } });
      setShowAdd(false);
      resetForm();
      load();
    } catch (err) {
      console.error("Add leave type failed", err);
      alert("Failed to add leave type");
    }
  };

  const openEdit = (item: LeaveTypeRecord) => {
    setEditing(item);
    setForm({
      name: item.data?.name || "",
      days: item.data?.days || 0,
      status: item.data?.status || "Active",
    });
    setShowEdit(true);
  };

  const handleEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editing) return;
    try {
      await API.put(`${RESOURCE}${editing.id}/`, { data: { ...form, name: form.name.trim() } });
      setShowEdit(false);
      setEditing(null);
      resetForm();
      load();
    } catch (err) {
      console.error("Edit leave type failed", err);
      alert("Failed to update leave type");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this leave type?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      load();
    } catch (err) {
      console.error("Delete leave type failed", err);
      alert("Failed to delete leave type");
    }
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Settings</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Administration</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Settings
                  </li>
                </ol>
              </nav>
            </div>
            <div className="head-icons ms-2">
              <CollapseHeader />
            </div>
          </div>
          <ul className="nav nav-tabs nav-tabs-solid bg-transparent border-bottom mb-3">
            <li className="nav-item">
              <Link className="nav-link" to={routes.profilesettings}>
                <i className="ti ti-settings me-2" />
                General Settings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to={routes.bussinessSettings}>
                <i className="ti ti-world-cog me-2" />
                Website Settings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link active" to={routes.salarySettings}>
                <i className="ti ti-device-ipad-horizontal-cog me-2" />
                App Settings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to={routes.emailSettings}>
                <i className="ti ti-server-cog me-2" />
                System Settings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to={routes.paymentGateways}>
                <i className="ti ti-settings-dollar me-2" />
                Financial Settings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to={routes.customCss}>
                <i className="ti ti-settings-2 me-2" />
                Other Settings
              </Link>
            </li>
          </ul>
          <div className="row">
            <div className="col-xl-3 theiaStickySidebar">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex flex-column list-group settings-list">
                    <Link
                      to={routes.salarySettings}
                      className="d-inline-flex align-items-center rounded  py-2 px-3"
                    >
                      Salary Settings
                    </Link>
                    <Link
                      to={routes.approvalSettings}
                      className="d-inline-flex align-items-center rounded py-2 px-3"
                    >
                      Approval Settings
                    </Link>
                    <Link
                      to={routes.approvalSettings}
                      className="d-inline-flex align-items-center rounded py-2 px-3"
                    >
                      Invoice Settings
                    </Link>
                    <Link
                      to={routes.leaveType}
                      className="d-inline-flex align-items-center rounded active py-2 px-3"
                    >
                      <i className="ti ti-arrow-badge-right me-2" />
                      Leave Type
                    </Link>
                    <Link
                      to={routes.customFields}
                      className="d-inline-flex align-items-center rounded py-2 px-3"
                    >
                      Custom Fields
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-9">
              <div className="card">
                <div className="card-body">
                  <div className="border-bottom d-flex align-items-center justify-content-between pb-3 mb-3">
                    <h4>Leave Type</h4>
                    <button className="btn btn-primary d-flex align-items-center" onClick={() => setShowAdd(true)}>
                      <i className="ti ti-circle-plus me-2" />
                      Add Leave Type
                    </button>
                  </div>
                  <div className="card-body p-0">
                    <div className="card mb-0">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <h6>Leave Type List</h6>
                      </div>
                      <div className="table-responsive">
                        <table className="table">
                          <thead className="thead-light">
                            <tr>
                              <th>Leave Type</th>
                              <th>Leave Days</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {loading ? (
                              <tr>
                                <td colSpan={4} className="text-center py-4">Loading...</td>
                              </tr>
                            ) : leaveTypes.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-4">No leave types found.</td>
                              </tr>
                            ) : (
                              leaveTypes.map((t) => (
                                <tr key={t.id}>
                                  <td className="text-dark">{t.data?.name || "-"}</td>
                                  <td>{t.data?.days ?? "-"}</td>
                                  <td>
                                    <span className={`badge ${t.data?.status === "Active" ? "bg-success" : "bg-secondary"}`}>
                                      <i className="ti ti-point-filled" />
                                      {t.data?.status || "Inactive"}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="action-icon d-inline-flex">
                                      <button className="btn btn-sm btn-light me-2" onClick={() => openEdit(t)}>
                                        <i className="ti ti-edit" />
                                      </button>
                                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>
                                        <i className="ti ti-trash" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
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

      {showAdd && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content">
              <form onSubmit={handleAdd}>
                <div className="modal-header">
                  <h4 className="modal-title">Add Leave Type</h4>
                  <button type="button" className="btn-close custom-btn-close" onClick={() => setShowAdd(false)}>
                    <i className="ti ti-x" />
                  </button>
                </div>
                <div className="modal-body pb-0">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Leave Type</label>
                        <input
                          type="text"
                          className="form-control"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Number of days</label>
                        <input
                          type="number"
                          className="form-control"
                          value={form.days}
                          onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                          min={0}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Status</label>
                        <select
                          className="form-select"
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light me-2" onClick={() => setShowAdd(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Add Leave</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEdit && editing && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content">
              <form onSubmit={handleEdit}>
                <div className="modal-header">
                  <h4 className="modal-title">Edit Leave Type</h4>
                  <button type="button" className="btn-close custom-btn-close" onClick={() => { setShowEdit(false); setEditing(null); }}>
                    <i className="ti ti-x" />
                  </button>
                </div>
                <div className="modal-body pb-0">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Leave Type</label>
                        <input
                          type="text"
                          className="form-control"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Number of days</label>
                        <input
                          type="number"
                          className="form-control"
                          value={form.days}
                          onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                          min={0}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Status</label>
                        <select
                          className="form-select"
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light me-2" onClick={() => { setShowEdit(false); setEditing(null); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {(showAdd || showEdit) && <div className="modal-backdrop show" />}
    </div>
  );
};

export default LeaveType;
