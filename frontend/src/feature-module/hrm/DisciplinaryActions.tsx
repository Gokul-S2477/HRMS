import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { formatDisplayDate, normalizeList } from "../mainMenu/employeeDashboard/employeeShared";

type DisciplinaryAction = {
  id: number;
  employee: {
    id: number;
    first_name: string;
    last_name?: string;
    emp_code: string;
    department?: { name: string };
    designation?: { title: string };
  };
  action_type: "verbal_warning" | "written_warning" | "suspension" | "termination_notice";
  incident_date: string;
  incident_description: string;
  issued_by?: {
    username: string;
    email: string;
  };
  issued_on: string;
  response_required_by?: string;
  employee_response?: string;
  status: "issued" | "acknowledged" | "closed" | "disputed";
  attachment_url?: string;
};

const ACTION_TYPES = [
  { value: "verbal_warning", label: "Verbal Warning" },
  { value: "written_warning", label: "Written Warning" },
  { value: "suspension", label: "Suspension" },
  { value: "termination_notice", label: "Termination Notice" },
];

const STATUS_TONES: Record<string, string> = {
  issued: "warning",
  acknowledged: "success",
  closed: "secondary",
  disputed: "danger",
};

const DisciplinaryActions: React.FC = () => {
  const { user, role } = useAuth();
  const isHR = role === "super_admin" || role === "hr";

  const [actions, setActions] = useState<DisciplinaryAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<DisciplinaryAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // HR Form to Issue Action
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [actionType, setActionType] = useState("written_warning");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [responseRequiredBy, setResponseRequiredBy] = useState("");

  // Employee Response Form
  const [responseFormOpen, setResponseFormOpen] = useState(false);
  const [empResponseText, setEmpResponseText] = useState("");
  const [responseStatus, setResponseStatus] = useState("acknowledged"); // acknowledged or disputed

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isHR ? "disciplinary-actions/" : `disciplinary-actions/?employee_id=${user?.employee_profile?.id || ""}`;
      const [actionsRes, employeesRes] = await Promise.all([
        API.get(endpoint),
        isHR ? API.get("employees/") : Promise.resolve({ data: [] }),
      ]);
      setActions(normalizeList<DisciplinaryAction>(actionsRes.data));
      if (isHR) {
        setEmployees(normalizeList<any>(employeesRes.data));
      }
    } catch (error) {
      console.error("Failed to load disciplinary action data", error);
    } finally {
      setLoading(false);
    }
  }, [isHR, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = actions.length;
    const awaitingResponse = actions.filter((a) => a.status === "issued").length;
    const closedCount = actions.filter((a) => a.status === "closed").length;
    const disputedCount = actions.filter((a) => a.status === "disputed").length;

    return {
      totalCount,
      awaitingResponse,
      closedCount,
      disputedCount,
    };
  }, [actions]);

  const handleIssueAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployeeId) {
      alert("Please select an employee.");
      return;
    }
    if (!incidentDescription || !incidentDate) {
      alert("Please fill in the incident description and date.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee: Number(targetEmployeeId),
        action_type: actionType,
        incident_date: incidentDate,
        incident_description: incidentDescription,
        response_required_by: responseRequiredBy || null,
        status: "issued",
      };

      await API.post("disciplinary-actions/", payload);
      alert("Disciplinary Action issued successfully!");
      setShowIssueModal(false);
      // Reset form
      setTargetEmployeeId("");
      setIncidentDescription("");
      setIncidentDate("");
      setResponseRequiredBy("");
      loadData();
    } catch (err) {
      console.error("Failed to issue disciplinary action:", err);
      alert("Failed to issue action.");
    } finally {
      setSaving(false);
    }
  };

  const handleEmployeeResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;
    if (!empResponseText.trim()) {
      alert("Please type a response statement.");
      return;
    }

    setSaving(true);
    try {
      await API.patch(`disciplinary-actions/${selectedAction.id}/`, {
        employee_response: empResponseText,
        status: responseStatus,
      });
      alert("Response submitted successfully.");
      setResponseFormOpen(false);
      setEmpResponseText("");
      // Update selected action details
      setSelectedAction((prev) =>
        prev
          ? {
              ...prev,
              employee_response: empResponseText,
              status: responseStatus as any,
            }
          : null
      );
      loadData();
    } catch (err) {
      console.error("Failed to submit employee response:", err);
      alert("Failed to submit response.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAction = async (actionId: number) => {
    if (!window.confirm("Are you sure you want to close this disciplinary case?")) return;
    try {
      await API.patch(`disciplinary-actions/${actionId}/`, { status: "closed" });
      alert("Disciplinary case closed successfully.");
      if (selectedAction?.id === actionId) {
        setSelectedAction((prev) => (prev ? { ...prev, status: "closed" } : null));
      }
      loadData();
    } catch (err) {
      console.error("Failed to close case:", err);
      alert("Failed to close case.");
    }
  };

  const downloadWarningLetter = (actionId: number) => {
    const host = API.defaults.baseURL || "";
    const cleanHost = host.endsWith("/") ? host.slice(0, -1) : host;
    // open the url in a new tab to trigger download
    window.open(`${cleanHost}/disciplinary-actions/${actionId}/letter-pdf/`, "_blank");
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        {/* Hero Header */}
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker">
                  <i className="ti ti-alert-octagon" /> Compliance & Conduct
                </span>
                <h1 className="payroll-title">Disciplinary & Conduct Registry</h1>
                <p className="payroll-subtitle">
                  Review and log verbal or written warnings, performance correction guidelines, and formal disciplinary suspension notices in a confidential workplace registry.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip">
                    <i className="ti ti-archive" /> {stats.totalCount} Recorded Cases
                  </span>
                  <span className="employee-chip bg-warning-light text-warning">
                    <i className="ti ti-clock" /> {stats.awaitingResponse} Awaiting Explanation
                  </span>
                  <span className="employee-chip bg-danger-light text-danger">
                    <i className="ti ti-alert-triangle" /> {stats.disputedCount} Disputed Cases
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-circle-check" /> {stats.closedCount} Resolved Cases
                  </span>
                </div>
              </div>
              <div className="col-lg-4 text-lg-end">
                <div className="payroll-hero-actions">
                  {isHR && (
                    <button className="btn btn-primary" onClick={() => setShowIssueModal(true)}>
                      <i className="ti ti-alert-circle me-1" /> Issue Warning / Notice
                    </button>
                  )}
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Left Column: Disciplinary Actions List */}
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Incident Records</h5>
                  <div className="payroll-table-subtitle">
                    Confidential log of all warnings, suspension letters, and active responses.
                  </div>
                </div>
              </div>

              <div className="payroll-table-shell">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                    <p className="mt-2 text-muted">Retrieving records...</p>
                  </div>
                ) : actions.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ti ti-checklist text-muted display-4 mb-3" />
                    <h6>No incidents logged</h6>
                    <p className="text-muted">There are no disciplinary actions logged for this profile scope.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          {isHR && <th>Employee</th>}
                          <th>Warning Type</th>
                          <th>Incident Date</th>
                          <th>Issued Date</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actions.map((act) => (
                          <tr
                            key={act.id}
                            className={`cursor-pointer ${selectedAction?.id === act.id ? "table-active" : ""}`}
                            onClick={() => setSelectedAction(act)}
                          >
                            {isHR && (
                              <td>
                                <div className="payroll-primary-text">
                                  {act.employee ? `${act.employee.first_name} ${act.employee.last_name || ""}`.trim() : "Unknown"}
                                </div>
                                <div className="payroll-secondary-text">{act.employee?.emp_code}</div>
                              </td>
                            )}
                            <td>
                              <div className="payroll-primary-text text-capitalize">
                                {act.action_type.replace("_", " ")}
                              </div>
                              <div className="payroll-secondary-text">ID: DISC-{act.id}</div>
                            </td>
                            <td>{formatDisplayDate(act.incident_date)}</td>
                            <td>{formatDisplayDate(act.issued_on)}</td>
                            <td>{act.response_required_by ? formatDisplayDate(act.response_required_by) : "-"}</td>
                            <td>
                              <span className={`badge bg-${STATUS_TONES[act.status]}-light text-${STATUS_TONES[act.status]} px-3 py-2 text-capitalize`}>
                                {act.status}
                              </span>
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-light me-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadWarningLetter(act.id);
                                }}
                                title="Download Letter PDF"
                              >
                                <i className="ti ti-download" /> PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Incident Details Sidebar */}
          <div className="col-xl-4">
            {selectedAction ? (
              <div className="card employee-section-card">
                <div className="card-header border-bottom d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-0 text-capitalize">{selectedAction.action_type.replace("_", " ")}</h5>
                    <p className="payroll-table-subtitle mb-0">Record: DISC-{selectedAction.id}</p>
                  </div>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => downloadWarningLetter(selectedAction.id)}
                  >
                    <i className="ti ti-file-text me-1" /> PDF Letter
                  </button>
                </div>
                <div className="card-body">
                  <div className="employee-summary-list mb-4">
                    <div className="employee-summary-row">
                      <span>Employee Name</span>
                      <strong>
                        {selectedAction.employee
                          ? `${selectedAction.employee.first_name} ${selectedAction.employee.last_name || ""}`.trim()
                          : "-"}
                      </strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Employee Code</span>
                      <strong>{selectedAction.employee?.emp_code || "-"}</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Incident Date</span>
                      <strong>{formatDisplayDate(selectedAction.incident_date)}</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Issued On</span>
                      <strong>{formatDisplayDate(selectedAction.issued_on)}</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Status</span>
                      <strong>
                        <span className={`badge bg-${STATUS_TONES[selectedAction.status]}-light text-${STATUS_TONES[selectedAction.status]} text-capitalize`}>
                          {selectedAction.status}
                        </span>
                      </strong>
                    </div>
                  </div>

                  <h6 className="mb-2">Incident / Performance Violation Details</h6>
                  <div className="p-3 border rounded-4 bg-light mb-4">
                    <p className="mb-0 text-secondary" style={{ whiteSpace: "pre-line" }}>
                      {selectedAction.incident_description}
                    </p>
                  </div>

                  {selectedAction.employee_response ? (
                    <>
                      <h6 className="mb-2">Employee Explanation / Statement</h6>
                      <div className="p-3 border rounded-4 bg-success-light-gradient mb-4">
                        <p className="mb-0 text-dark" style={{ whiteSpace: "pre-line" }}>
                          {selectedAction.employee_response}
                        </p>
                      </div>
                    </>
                  ) : (
                    selectedAction.status === "issued" && (
                      <div className="alert alert-info rounded-4 mb-4">
                        <i className="ti ti-info-circle me-1" />
                        Awaiting employee explanation statement.
                      </div>
                    )
                  )}

                  {/* Employee Self-Service Action: Submit Explanation */}
                  {user?.employee_profile?.id && String(selectedAction.employee.id) === String(user.employee_profile.id) && selectedAction.status === "issued" && !responseFormOpen && (
                    <button
                      className="btn btn-warning w-100 mb-3"
                      onClick={() => setResponseFormOpen(true)}
                    >
                      <i className="ti ti-message-2 me-1" /> Submit Official Response
                    </button>
                  )}

                  {/* Employee Response form */}
                  {responseFormOpen && (
                    <form onSubmit={handleEmployeeResponse} className="border rounded-4 p-3 bg-light mb-4">
                      <h6 className="mb-3">Submit Warning Response</h6>
                      <div className="mb-3">
                        <label className="form-label">Response Statement</label>
                        <textarea
                          className="form-control"
                          rows={4}
                          placeholder="Type your explanation or response to this notice..."
                          value={empResponseText}
                          onChange={(e) => setEmpResponseText(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Status after submission</label>
                        <div className="d-flex gap-3">
                          <label className="d-flex align-items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="response_status"
                              value="acknowledged"
                              checked={responseStatus === "acknowledged"}
                              onChange={() => setResponseStatus("acknowledged")}
                            />
                            Acknowledge Notice
                          </label>
                          <label className="d-flex align-items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="response_status"
                              value="disputed"
                              checked={responseStatus === "disputed"}
                              onChange={() => setResponseStatus("disputed")}
                            />
                            Dispute Notice
                          </label>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-light flex-grow-1"
                          onClick={() => setResponseFormOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-sm btn-primary flex-grow-1"
                          disabled={saving}
                        >
                          {saving ? "Submitting..." : "Submit Response"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* HR Action: Close case */}
                  {isHR && selectedAction.status !== "closed" && (
                    <button
                      className="btn btn-secondary w-100"
                      onClick={() => handleCloseAction(selectedAction.id)}
                    >
                      <i className="ti ti-circle-check me-1" /> Close & File Case
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="card employee-section-card h-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
                <i className="ti ti-shield-alert display-4 text-muted mb-3" />
                <h5>Incident Log Profile</h5>
                <p className="text-muted">Select a record from the log to view details, employee responses, or HR closure status.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HR modal to Issue Notice */}
      {showIssueModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Issue Disciplinary Notice</h5>
                  <button type="button" className="btn-close" onClick={() => setShowIssueModal(false)} />
                </div>
                <form onSubmit={handleIssueAction}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Target Employee</label>
                        <select
                          className="form-select"
                          value={targetEmployeeId}
                          onChange={(e) => setTargetEmployeeId(e.target.value)}
                          required
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name || ""} ({emp.emp_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Notice Type</label>
                        <select
                          className="form-select"
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value)}
                        >
                          {ACTION_TYPES.map((at) => (
                            <option key={at.value} value={at.value}>
                              {at.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Date of Incident</label>
                        <input
                          type="date"
                          className="form-control"
                          value={incidentDate}
                          onChange={(e) => setIncidentDate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Response Required By Date (Optional)</label>
                        <input
                          type="date"
                          className="form-control"
                          value={responseRequiredBy}
                          onChange={(e) => setResponseRequiredBy(e.target.value)}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Description of Incident / Conduct Issues</label>
                        <textarea
                          className="form-control"
                          rows={6}
                          placeholder="Provide a detailed, objective account of the incident, performance issues, or violation rules..."
                          value={incidentDescription}
                          onChange={(e) => setIncidentDescription(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowIssueModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Issuing..." : "Issue Notice"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
};

export default DisciplinaryActions;
