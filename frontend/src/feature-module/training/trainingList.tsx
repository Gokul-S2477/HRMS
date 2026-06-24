import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { formatDisplayDate, normalizeList } from "../mainMenu/employeeDashboard/employeeShared";

type TrainingProgram = {
  id: number;
  title: string;
  description?: string;
  trainer_name: string;
  training_type: "internal" | "external" | "online";
  start_date: string;
  end_date: string;
  duration_hours: number;
  venue?: string;
  cost_per_head: string;
  max_seats: number;
  status: "active" | "completed" | "cancelled";
  skills_covered?: string;
  is_mandatory: boolean;
};

type TrainingEnrollment = {
  id: number;
  program: TrainingProgram;
  employee: {
    id: number;
    first_name: string;
    last_name?: string;
    emp_code: string;
  };
  enrollment_date: string;
  status: "enrolled" | "completed" | "absent" | "cancelled";
  score?: string;
  certificate_url?: string;
  feedback?: string;
  completed_at?: string;
};

const STATUS_TONES: Record<string, string> = {
  enrolled: "info",
  completed: "success",
  absent: "danger",
  cancelled: "secondary",
};

const TrainingList: React.FC = () => {
  const { user, role } = useAuth();
  const isHR = role === "super_admin" || role === "hr";

  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // HR Enrollment Form Modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollProgramId, setEnrollProgramId] = useState("");
  const [enrollEmployeeId, setEnrollEmployeeId] = useState("");

  // HR Evaluation Modal (Completing Enrollment)
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalEnrollmentId, setEvalEnrollmentId] = useState<number | null>(null);
  const [evalScore, setEvalScore] = useState("");
  const [evalCertUrl, setEvalCertUrl] = useState("");
  const [evalFeedback, setEvalFeedback] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empProfileId = user?.employee_profile?.id || "";
      const enrollUrl = isHR ? "training-enrollments/" : `training-enrollments/?employee_id=${empProfileId}`;

      const [programsRes, enrollsRes, employeesRes] = await Promise.all([
        API.get("training-programs/"),
        API.get(enrollUrl),
        isHR ? API.get("employees/") : Promise.resolve({ data: [] }),
      ]);

      setPrograms(normalizeList<TrainingProgram>(programsRes.data));
      setEnrollments(normalizeList<TrainingEnrollment>(enrollsRes.data));
      setEmployees(normalizeList<any>(employeesRes.data));
    } catch (error) {
      console.error("Failed to load training data", error);
    } finally {
      setLoading(false);
    }
  }, [isHR, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const activeProgramsCount = programs.filter((p) => p.status === "active").length;
    const selfCompletedCount = enrollments.filter((e) => e.status === "completed").length;
    const selfPendingCount = enrollments.filter((e) => e.status === "enrolled").length;

    return {
      activeProgramsCount,
      selfCompletedCount,
      selfPendingCount,
      totalRegisteredCount: enrollments.length,
    };
  }, [programs, enrollments]);

  // Employee Self-Enrollment
  const handleSelfEnroll = async (programId: number) => {
    const finalEmpId = user?.employee_profile?.id;
    if (!finalEmpId) {
      alert("Employee profile is not linked to this account.");
      return;
    }
    if (!window.confirm("Do you want to enroll in this training program?")) return;

    setSaving(true);
    try {
      await API.post(`training-programs/${programId}/enroll/`, {
        employee_id: finalEmpId,
      });
      alert("Successfully enrolled in the program!");
      loadData();
    } catch (err: any) {
      console.error("Self enroll failed", err);
      const detail = err?.response?.data?.detail || "You are already registered or program is fully booked.";
      alert(`Enrollment failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  // HR Manual Enrollment
  const handleHREnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollProgramId || !enrollEmployeeId) {
      alert("Please select a training program and employee.");
      return;
    }
    setSaving(true);
    try {
      await API.post(`training-programs/${enrollProgramId}/enroll/`, {
        employee_id: Number(enrollEmployeeId),
      });
      alert("Employee enrolled successfully.");
      setShowEnrollModal(false);
      loadData();
    } catch (err: any) {
      console.error("HR enroll failed", err);
      const detail = err?.response?.data?.detail || "Employee is already registered or program is fully booked.";
      alert(`Registration failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  // HR Evaluation Submission
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalEnrollmentId) return;

    setSaving(true);
    try {
      await API.post(`training-enrollments/${evalEnrollmentId}/complete/`, {
        score: evalScore ? Number(evalScore) : null,
        certificate_url: evalCertUrl,
        feedback: evalFeedback,
      });

      alert("Training evaluation saved and certificate generated successfully.");
      setShowEvalModal(false);
      // Reset form
      setEvalScore("");
      setEvalCertUrl("");
      setEvalFeedback("");
      loadData();
    } catch (err) {
      console.error("Evaluation failed", err);
      alert("Failed to submit training evaluation.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEnrollmentStatus = async (enrollId: number, status: string) => {
    if (!window.confirm(`Mark this enrollment status as ${status}?`)) return;
    try {
      await API.patch(`training-enrollments/${enrollId}/`, { status });
      alert("Registration status updated.");
      loadData();
    } catch (error) {
      console.error("Status patch failed", error);
      alert("Failed to update status.");
    }
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
                  <i className="ti ti-school" /> Learning Operations
                </span>
                <h1 className="payroll-title">Training & Class Agenda</h1>
                <p className="payroll-subtitle">
                  Browse open development courses, self-register for upcoming online workshops, check grades, and retrieve training completion certificates.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip">
                    <i className="ti ti-calendar" /> {stats.activeProgramsCount} Upcoming Programs
                  </span>
                  <span className="employee-chip bg-info-light text-info">
                    <i className="ti ti-clock" /> {stats.selfPendingCount} Registered Sessions
                  </span>
                  <span className="employee-chip bg-success-light text-success">
                    <i className="ti ti-circle-check" /> {stats.selfCompletedCount} Programs Completed
                  </span>
                </div>
              </div>
              <div className="col-lg-4 text-lg-end">
                <div className="payroll-hero-actions">
                  {isHR && (
                    <button className="btn btn-primary" onClick={() => setShowEnrollModal(true)}>
                      <i className="ti ti-user-plus me-1" /> Register Employee
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
          {/* Left Column: Enrollments Logs / My Registered Sessions */}
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <h5>{isHR ? "Enrollment Management" : "My Training Programs"}</h5>
                <p className="payroll-table-subtitle">
                  {isHR
                    ? "Track employee learning paths, input scores, and upload completion certificates."
                    : "Track your learning timeline, scores, and download certificates."}
                </p>
              </div>

              <div className="payroll-table-shell">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : enrollments.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="ti ti-users-group display-4 mb-3" />
                    <h6>No active registrations</h6>
                    <p className="small">Register for an upcoming course to begin your learning trail.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          {isHR && <th>Employee</th>}
                          <th>Program Title</th>
                          <th>Enrollment Date</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollments.map((enr) => (
                          <tr key={enr.id}>
                            {isHR && (
                              <td>
                                <div className="payroll-primary-text">
                                  {enr.employee ? `${enr.employee.first_name} ${enr.employee.last_name || ""}`.trim() : "Unknown"}
                                </div>
                                <div className="payroll-secondary-text">{enr.employee?.emp_code}</div>
                              </td>
                            )}
                            <td>
                              <div className="payroll-primary-text">{enr.program?.title}</div>
                              <div className="payroll-secondary-text">{enr.program?.trainer_name}</div>
                            </td>
                            <td>{formatDisplayDate(enr.enrollment_date)}</td>
                            <td>{enr.score ? `${enr.score}%` : "-"}</td>
                            <td>
                              <span className={`badge bg-${STATUS_TONES[enr.status]}-light text-${STATUS_TONES[enr.status]} px-3 py-2 text-capitalize`}>
                                {enr.status}
                              </span>
                            </td>
                            <td className="text-end">
                              {/* HR completes and grades */}
                              {isHR && enr.status === "enrolled" && (
                                <button
                                  className="btn btn-sm btn-success me-1"
                                  onClick={() => {
                                    setEvalEnrollmentId(enr.id);
                                    setShowEvalModal(true);
                                  }}
                                >
                                  Complete & Grade
                                </button>
                              )}
                              {/* Employee certificate link */}
                              {enr.certificate_url && (
                                <a
                                  href={enr.certificate_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-outline-primary me-1"
                                >
                                  <i className="ti ti-file-text" /> Certificate
                                </a>
                              )}
                              {isHR && enr.status === "enrolled" && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleUpdateEnrollmentStatus(enr.id, "cancelled")}
                                >
                                  Cancel
                                </button>
                              )}
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

          {/* Right Column: Upcoming Program Registration Agenda */}
          <div className="col-xl-4">
            <div className="card employee-section-card">
              <div className="card-header border-bottom">
                <h5 className="mb-0">Upcoming Open Agenda</h5>
                <p className="payroll-table-subtitle mb-0">Browse and enroll in development courses.</p>
              </div>
              <div className="card-body">
                {programs.filter((p) => p.status === "active").length === 0 ? (
                  <p className="text-muted text-center py-4">No upcoming programs scheduled currently.</p>
                ) : (
                  <div className="d-grid gap-3" style={{ maxHeight: 600, overflowY: "auto" }}>
                    {programs
                      .filter((p) => p.status === "active")
                      .map((p) => {
                        const isMandatory = p.is_mandatory;
                        const isAlreadyRegistered = enrollments.some((e) => e.program?.id === p.id);

                        return (
                          <div key={p.id} className="border rounded-4 p-3 bg-light-gradient">
                            <div className="d-flex justify-content-between mb-2">
                              <span className={`badge bg-${isMandatory ? "danger" : "secondary"}-light text-${isMandatory ? "danger" : "secondary"} px-2 py-1`}>
                                {isMandatory ? "Mandatory" : "Optional"}
                              </span>
                              <small className="text-muted text-capitalize">{p.training_type}</small>
                            </div>
                            <h6 className="mb-1">{p.title}</h6>
                            <p className="small text-secondary mb-2">{p.description || "Course agenda details pending."}</p>
                            <div className="employee-summary-list mb-3 small">
                              <div className="employee-summary-row py-1">
                                <span>Duration</span>
                                <strong>{p.duration_hours} Hours</strong>
                              </div>
                              <div className="employee-summary-row py-1">
                                <span>Trainer</span>
                                <strong>{p.trainer_name}</strong>
                              </div>
                              <div className="employee-summary-row py-1">
                                <span>Timeline</span>
                                <strong>{formatDisplayDate(p.start_date)}</strong>
                              </div>
                            </div>
                            {!isAlreadyRegistered ? (
                              <button
                                className="btn btn-sm btn-primary w-100"
                                onClick={() => handleSelfEnroll(p.id)}
                                disabled={saving}
                              >
                                Self Enroll
                              </button>
                            ) : (
                              <button className="btn btn-sm btn-light w-100" disabled>
                                Enrolled
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Register Employee Modal (HR) */}
      {showEnrollModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Register Employee in Training</h5>
                  <button type="button" className="btn-close" onClick={() => setShowEnrollModal(false)} />
                </div>
                <form onSubmit={handleHREnroll}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Training Program</label>
                      <select
                        className="form-select"
                        value={enrollProgramId}
                        onChange={(e) => setEnrollProgramId(e.target.value)}
                        required
                      >
                        <option value="">Select Program</option>
                        {programs
                          .filter((p) => p.status === "active")
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} ({p.trainer_name})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Employee Profile</label>
                      <select
                        className="form-select"
                        value={enrollEmployeeId}
                        onChange={(e) => setEnrollEmployeeId(e.target.value)}
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
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowEnrollModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Registering..." : "Register Employee"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}

      {/* Evaluate & Complete Modal (HR) */}
      {showEvalModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Evaluate Training Completion</h5>
                  <button type="button" className="btn-close" onClick={() => setShowEvalModal(false)} />
                </div>
                <form onSubmit={handleSaveEvaluation}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Grade / Score (Percentage 0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="form-control"
                        placeholder="e.g. 85"
                        value={evalScore}
                        onChange={(e) => setEvalScore(e.target.value)}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Certificate URL / Drive Link</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://drive.google.com/..."
                        value={evalCertUrl}
                        onChange={(e) => setEvalCertUrl(e.target.value)}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Evaluation Feedback</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Provide details on completion feedback, exam notes..."
                        value={evalFeedback}
                        onChange={(e) => setEvalFeedback(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowEvalModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-success" disabled={saving}>
                      {saving ? "Saving..." : "Grade & Complete"}
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

export default TrainingList;
