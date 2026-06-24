import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { formatDisplayDate, normalizeList } from "../mainMenu/employeeDashboard/employeeShared";

type ReviewCycle = {
  id: number;
  name: string;
  period_start: string;
  period_end: string;
  status: "draft" | "active" | "completed";
  cycle_type: "annual" | "mid-year" | "quarterly";
};

type PerformanceReview = {
  id: number;
  cycle: number;
  cycle_detail?: ReviewCycle;
  employee: {
    id: number;
    first_name: string;
    last_name?: string;
    emp_code: string;
    department?: { name: string };
    designation?: { title: string };
  };
  reviewer?: {
    id: number;
    first_name: string;
    last_name?: string;
  };
  status: "pending" | "draft" | "submitted" | "finalized";
  self_rating?: string;
  manager_rating?: string;
  final_rating?: string;
  goals?: Array<{
    id: number;
    title: string;
    target?: string;
    achievement?: string;
    weight: string;
    rating?: string;
  }>;
  feedbacks?: Array<{
    id: number;
    feedback_type: "self" | "manager" | "peer";
    from_user?: { username: string };
    strengths?: string;
    improvements?: string;
    rating?: string;
  }>;
};

type PeerFeedback = {
  id: number;
  reviewer: {
    id: number;
    first_name: string;
    last_name?: string;
    emp_code: string;
  };
  reviewee: {
    id: number;
    first_name: string;
    last_name?: string;
    emp_code: string;
  };
  cycle: number;
  cycle_detail?: ReviewCycle;
  rating?: string;
  comments?: string;
  anonymous: boolean;
  created_at: string;
};

const STATUS_TONES: Record<string, string> = {
  pending: "warning",
  draft: "secondary",
  submitted: "info",
  finalized: "success",
};

const PerformanceReview: React.FC = () => {
  const { user, role } = useAuth();
  const isHR = role === "super_admin" || role === "hr";

  // Tab State
  const [activeTab, setActiveTab] = useState<"reviews" | "cycles" | "peerFeedback">("reviews");

  // Core Lists
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [peerFeedbacks, setPeerFeedbacks] = useState<PeerFeedback[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Selection Details
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);

  // Loading / Saving
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // HR Form to Create Review Cycle
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [cycleType, setCycleType] = useState<"annual" | "mid-year" | "quarterly">("annual");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");

  // HR Form to Assign Reviews
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCycleId, setAssignCycleId] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignReviewerId, setAssignReviewerId] = useState("");

  // Employee / Manager Rating Fields
  const [selfRating, setSelfRating] = useState("");
  const [managerRating, setManagerRating] = useState("");
  const [finalRating, setFinalRating] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");

  // Peer Request Form
  const [showPeerRequestModal, setShowPeerRequestModal] = useState(false);
  const [peerCycleId, setPeerCycleId] = useState("");
  const [peerRevieweeId, setPeerRevieweeId] = useState("");
  const [peerRatingText, setPeerRatingText] = useState("");
  const [peerComments, setPeerComments] = useState("");
  const [peerAnonymous, setPeerAnonymous] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empProfileId = user?.employee_profile?.id || "";
      const reviewsUrl = isHR ? "performance-reviews/" : `performance-reviews/?employee_id=${empProfileId}`;
      const peerUrl = isHR ? "peer-feedbacks/" : `peer-feedbacks/?reviewer_id=${empProfileId}`;

      const [reviewsRes, cyclesRes, peerRes, employeesRes] = await Promise.all([
        API.get(reviewsUrl),
        API.get("review-cycles/"),
        API.get(peerUrl),
        API.get("employees/"),
      ]);

      setReviews(normalizeList<PerformanceReview>(reviewsRes.data));
      setCycles(normalizeList<ReviewCycle>(cyclesRes.data));
      setPeerFeedbacks(normalizeList<PeerFeedback>(peerRes.data));
      setEmployees(normalizeList<any>(employeesRes.data));
    } catch (error) {
      console.error("Failed to load performance data", error);
    } finally {
      setLoading(false);
    }
  }, [isHR, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculated Stats
  const stats = useMemo(() => {
    const totalCycleCount = cycles.length;
    const completedCount = reviews.filter((r) => r.status === "finalized").length;
    const pendingCount = reviews.filter((r) => r.status === "pending" || r.status === "draft").length;

    let avgRating = 0.0;
    const ratings = reviews.map((r) => Number(r.final_rating || r.manager_rating || 0)).filter((r) => r > 0);
    if (ratings.length > 0) {
      avgRating = Number((ratings.reduce((sum, val) => sum + val, 0) / ratings.length).toFixed(1));
    }

    return {
      totalCycleCount,
      completedCount,
      pendingCount,
      avgRating,
    };
  }, [cycles, reviews]);

  // HR handlers
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleName || !cycleStart || !cycleEnd) {
      alert("Please fill in name, start date, and end date.");
      return;
    }
    setSaving(true);
    try {
      await API.post("review-cycles/", {
        name: cycleName,
        cycle_type: cycleType,
        period_start: cycleStart,
        period_end: cycleEnd,
        status: "draft",
      });
      alert("Review Cycle created successfully.");
      setShowCycleModal(false);
      setCycleName("");
      setCycleStart("");
      setCycleEnd("");
      loadData();
    } catch (error) {
      console.error("Failed to create review cycle", error);
      alert("Unable to create review cycle.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCycleStatus = async (cycleId: number, status: string) => {
    try {
      await API.patch(`review-cycles/${cycleId}/`, { status });
      alert(`Cycle status updated to ${status}.`);
      loadData();
    } catch (error) {
      console.error("Failed to update cycle status", error);
      alert("Failed to update cycle status.");
    }
  };

  const handleAssignReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCycleId || !assignEmployeeId) {
      alert("Please select a cycle and an employee.");
      return;
    }
    setSaving(true);
    try {
      await API.post("performance-reviews/", {
        cycle: Number(assignCycleId),
        employee: Number(assignEmployeeId),
        reviewer: assignReviewerId ? Number(assignReviewerId) : null,
        status: "pending",
      });
      alert("Performance review successfully assigned.");
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      console.error("Failed to assign performance review", error);
      alert("Failed to assign review (the employee might already be assigned in this cycle).");
    } finally {
      setSaving(false);
    }
  };

  // Submit Feedback / Ratings
  const handleSubmitReviewFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    setSaving(true);

    const isSelfReview = String(selectedReview.employee.id) === String(user?.employee_profile?.id);
    const isManagerReview = String(selectedReview.reviewer?.id) === String(user?.employee_profile?.id) || isHR;

    try {
      // 1. Submit Feedback
      const feedbackType = isSelfReview ? "self" : "manager";
      const ratingVal = isSelfReview ? selfRating : managerRating;
      await API.post("review-feedbacks/", {
        review: selectedReview.id,
        feedback_type: feedbackType,
        strengths,
        improvements,
        rating: ratingVal || null,
      });

      // 2. Patch Overall Review status & ratings
      const patchPayload: any = {};
      if (isSelfReview) {
        patchPayload.self_rating = ratingVal;
        if (selectedReview.status === "pending") {
          patchPayload.status = "draft";
        }
      }
      if (isManagerReview) {
        patchPayload.manager_rating = ratingVal;
        patchPayload.final_rating = finalRating || ratingVal;
        patchPayload.status = "finalized";
      }

      const reviewRes = await API.patch(`performance-reviews/${selectedReview.id}/`, patchPayload);
      alert("Review submission successful!");
      setSelectedReview(reviewRes.data);
      setStrengths("");
      setImprovements("");
      loadData();
    } catch (error) {
      console.error("Failed to submit feedback", error);
      alert("Failed to submit performance feedback.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPeerFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReviewerId = user?.employee_profile?.id;
    if (!finalReviewerId) {
      alert("Profile not linked.");
      return;
    }
    if (!peerCycleId || !peerRevieweeId) {
      alert("Please select cycle and colleague.");
      return;
    }
    setSaving(true);
    try {
      await API.post("peer-feedbacks/", {
        reviewer: Number(finalReviewerId),
        reviewee: Number(peerRevieweeId),
        cycle: Number(peerCycleId),
        rating: peerRatingText || null,
        comments: peerComments,
        anonymous: peerAnonymous,
      });
      alert("Peer feedback submitted successfully!");
      setShowPeerRequestModal(false);
      setPeerComments("");
      setPeerRatingText("");
      loadData();
    } catch (error) {
      console.error("Failed to submit peer feedback", error);
      alert("Failed to submit peer feedback (you may have already reviewed this colleague for this cycle).");
    } finally {
      setSaving(false);
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
                  <i className="ti ti-chart-dots" /> 360 Feedback Loops
                </span>
                <h1 className="payroll-title">Performance & Appraisal Workspace</h1>
                <p className="payroll-subtitle">
                  Configure evaluation cycles, set goals, submit employee self-ratings, submit manager reviews, and exchange constructive peer feedback loops anonymously or named.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip">
                    <i className="ti ti-calendar-event" /> {stats.totalCycleCount} Review Cycles
                  </span>
                  <span className="employee-chip bg-success-light text-success">
                    <i className="ti ti-circle-check" /> {stats.completedCount} Appraisals Completed
                  </span>
                  <span className="employee-chip bg-warning-light text-warning">
                    <i className="ti ti-progress" /> {stats.pendingCount} Reviews Pending
                  </span>
                  {stats.avgRating > 0 && (
                    <span className="employee-chip">
                      <i className="ti ti-star" /> {stats.avgRating}/5 Average Rating
                    </span>
                  )}
                </div>
              </div>
              <div className="col-lg-4 text-lg-end">
                <div className="payroll-hero-actions">
                  {isHR && (
                    <>
                      <button className="btn btn-outline-primary" onClick={() => setShowCycleModal(true)}>
                        <i className="ti ti-calendar-plus me-1" /> New Cycle
                      </button>
                      <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
                        <i className="ti ti-user-plus me-1" /> Assign Appraisals
                      </button>
                    </>
                  )}
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-2">
          <ul className="nav nav-tabs border-0" role="tablist">
            <li className="nav-item">
              <button
                className={`nav-link border-0 ${activeTab === "reviews" ? "active fw-bold text-primary" : ""}`}
                onClick={() => setActiveTab("reviews")}
              >
                Performance Reviews
              </button>
            </li>
            {isHR && (
              <li className="nav-item">
                <button
                  className={`nav-link border-0 ${activeTab === "cycles" ? "active fw-bold text-primary" : ""}`}
                  onClick={() => setActiveTab("cycles")}
                >
                  Appraisal Cycles (HR Admin)
                </button>
              </li>
            )}
            <li className="nav-item">
              <button
                className={`nav-link border-0 ${activeTab === "peerFeedback" ? "active fw-bold text-primary" : ""}`}
                onClick={() => setActiveTab("peerFeedback")}
              >
                Peer & 360 Feedback
              </button>
            </li>
          </ul>

          {activeTab === "peerFeedback" && (
            <button className="btn btn-sm btn-outline-primary" onClick={() => setShowPeerRequestModal(true)}>
              <i className="ti ti-plus me-1" /> Submit Peer Feedback
            </button>
          )}
        </div>

        {/* Tab Panels */}
        {activeTab === "reviews" && (
          <div className="row g-4">
            {/* Reviews List */}
            <div className="col-xl-8">
              <div className="card payroll-panel payroll-table-card">
                <div className="payroll-table-header">
                  <h5>Evaluation Logs</h5>
                  <p className="payroll-table-subtitle">Select a review from the logs to inspect goals, narrative comments, and submit reviews.</p>
                </div>
                <div className="payroll-table-shell">
                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" />
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="ti ti-file-text display-4 mb-3" />
                      <h6>No appraisals logged</h6>
                      <p className="small">Appraisal assignments will appear here once initiated.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Review Cycle</th>
                            <th>Reviewer</th>
                            <th>Self Rating</th>
                            <th>Manager Rating</th>
                            <th>Final Score</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviews.map((r) => (
                            <tr
                              key={r.id}
                              className={`cursor-pointer ${selectedReview?.id === r.id ? "table-active" : ""}`}
                              onClick={() => {
                                setSelectedReview(r);
                                setSelfRating(r.self_rating || "");
                                setManagerRating(r.manager_rating || "");
                                setFinalRating(r.final_rating || "");
                              }}
                            >
                              <td>
                                <div className="payroll-primary-text">
                                  {r.employee ? `${r.employee.first_name} ${r.employee.last_name || ""}`.trim() : "Unknown"}
                                </div>
                                <div className="payroll-secondary-text">{r.employee?.designation?.title}</div>
                              </td>
                              <td>{r.cycle_detail?.name || `Cycle #${r.cycle}`}</td>
                              <td>{r.reviewer ? `${r.reviewer.first_name} ${r.reviewer.last_name || ""}`.trim() : "Auto"}</td>
                              <td>{r.self_rating ? `${r.self_rating}/5` : "-"}</td>
                              <td>{r.manager_rating ? `${r.manager_rating}/5` : "-"}</td>
                              <td>
                                <strong>{r.final_rating ? `${r.final_rating}/5` : "-"}</strong>
                              </td>
                              <td>
                                <span className={`badge bg-${STATUS_TONES[r.status] || "secondary"}-light text-${STATUS_TONES[r.status] || "secondary"} px-3 py-2 text-capitalize`}>
                                  {r.status}
                                </span>
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

            {/* Appraisal Details Panel */}
            <div className="col-xl-4">
              {selectedReview ? (
                <div className="card employee-section-card">
                  <div className="card-header border-bottom">
                    <h5 className="mb-0">Appraisal Workspace</h5>
                    <p className="payroll-table-subtitle mb-0">Cycle: {selectedReview.cycle_detail?.name}</p>
                  </div>
                  <div className="card-body">
                    {/* Details Stack */}
                    <div className="employee-summary-list mb-4">
                      <div className="employee-summary-row">
                        <span>Employee</span>
                        <strong>{`${selectedReview.employee.first_name} ${selectedReview.employee.last_name || ""}`.trim()}</strong>
                      </div>
                      <div className="employee-summary-row">
                        <span>Manager</span>
                        <strong>{selectedReview.reviewer ? `${selectedReview.reviewer.first_name} ${selectedReview.reviewer.last_name || ""}`.trim() : "-"}</strong>
                      </div>
                      <div className="employee-summary-row">
                        <span>Status</span>
                        <strong className="text-capitalize">{selectedReview.status}</strong>
                      </div>
                    </div>

                    {/* Narrative feed */}
                    {selectedReview.feedbacks && selectedReview.feedbacks.length > 0 && (
                      <div className="mb-4">
                        <h6>Recorded Feedbacks</h6>
                        <div className="d-grid gap-2">
                          {selectedReview.feedbacks.map((f) => (
                            <div key={f.id} className="p-3 border rounded-4 bg-light">
                              <div className="d-flex justify-content-between mb-1">
                                <span className="badge bg-secondary-light text-secondary text-capitalize">{f.feedback_type} Feedback</span>
                                {f.rating && <strong className="small">{f.rating}/5</strong>}
                              </div>
                              {f.strengths && <p className="mb-1 small"><strong>Strengths: </strong>{f.strengths}</p>}
                              {f.improvements && <p className="mb-0 small"><strong>Areas for growth: </strong>{f.improvements}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action form */}
                    {selectedReview.status !== "finalized" && (
                      <form onSubmit={handleSubmitReviewFeedback} className="border-top pt-3">
                        <h6 className="mb-3">Submit Rating & Evaluation Comments</h6>
                        {String(selectedReview.employee.id) === String(user?.employee_profile?.id) && (
                          <div className="mb-3">
                            <label className="form-label">Self Rating (1-5)</label>
                            <select className="form-select" value={selfRating} onChange={(e) => setSelfRating(e.target.value)} required>
                              <option value="">Select rating</option>
                              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n.toFixed(2)}>{n}/5</option>)}
                            </select>
                          </div>
                        )}
                        {(String(selectedReview.reviewer?.id) === String(user?.employee_profile?.id) || isHR) && (
                          <>
                            <div className="mb-3">
                              <label className="form-label">Manager Rating (1-5)</label>
                              <select className="form-select" value={managerRating} onChange={(e) => setManagerRating(e.target.value)} required>
                                <option value="">Select rating</option>
                                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n.toFixed(2)}>{n}/5</option>)}
                              </select>
                            </div>
                            <div className="mb-3">
                              <label className="form-label">Final Core Score (1-5)</label>
                              <select className="form-select" value={finalRating} onChange={(e) => setFinalRating(e.target.value)} required>
                                <option value="">Select final rating</option>
                                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n.toFixed(2)}>{n}/5</option>)}
                              </select>
                            </div>
                          </>
                        )}

                        <div className="mb-3">
                          <label className="form-label">Constructive Strengths Summary</label>
                          <textarea className="form-control" rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Narrate key competencies and success highlights..." required />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Areas for Growth / Performance Support</label>
                          <textarea className="form-control" rows={3} value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Identify development goals or support needed..." required />
                        </div>

                        <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                          {saving ? "Saving..." : "Submit Appraisal Form"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <div className="card employee-section-card h-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
                  <i className="ti ti-chart-infographic display-4 text-muted mb-3" />
                  <h5>Evaluation Board</h5>
                  <p className="text-muted">Select an evaluation from the list to display details, goals, narrative reviews, and ratings forms.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Cycles */}
        {activeTab === "cycles" && isHR && (
          <div className="card payroll-panel payroll-table-card">
            <div className="payroll-table-header">
              <h5>Appraisal & Review Cycles</h5>
              <p className="payroll-table-subtitle">Establish active dates and status parameters for company-wide evaluations.</p>
            </div>
            <div className="payroll-table-shell">
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Cycle Name</th>
                      <th>Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td className="text-capitalize">{c.cycle_type}</td>
                        <td>{formatDisplayDate(c.period_start)}</td>
                        <td>{formatDisplayDate(c.period_end)}</td>
                        <td>
                          <span className={`badge bg-${c.status === "active" ? "success" : c.status === "completed" ? "secondary" : "warning"}-light text-${c.status === "active" ? "success" : c.status === "completed" ? "secondary" : "warning"} px-3 py-2 text-capitalize`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="text-end">
                          {c.status === "draft" && (
                            <button className="btn btn-sm btn-success me-1" onClick={() => handleUpdateCycleStatus(c.id, "active")}>
                              Activate
                            </button>
                          )}
                          {c.status === "active" && (
                            <button className="btn btn-sm btn-secondary me-1" onClick={() => handleUpdateCycleStatus(c.id, "completed")}>
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab Peer Feedback */}
        {activeTab === "peerFeedback" && (
          <div className="card payroll-panel payroll-table-card">
            <div className="payroll-table-header">
              <h5>Peer Evaluations</h5>
              <p className="payroll-table-subtitle">Exchanged peer evaluations (showing anonymous feedback ratings where selected).</p>
            </div>
            <div className="payroll-table-shell">
              {peerFeedbacks.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ti ti-messages display-4 mb-3" />
                  <h6>No peer feedback exchange logged</h6>
                  <p className="small">Submit feedback for colleague profiles to begin building peer history.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Colleague</th>
                        <th>Cycle</th>
                        <th>Rating</th>
                        <th>Comments</th>
                        <th>Anonymity</th>
                        <th>Submitted On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peerFeedbacks.map((f) => (
                        <tr key={f.id}>
                          <td>
                            {f.anonymous ? (
                              <span className="text-muted italic">Anonymous Colleague</span>
                            ) : (
                              <strong>
                                {f.reviewer ? `${f.reviewer.first_name} ${f.reviewer.last_name || ""}`.trim() : "-"}
                              </strong>
                            )}
                          </td>
                          <td>{f.cycle_detail?.name || `Cycle #${f.cycle}`}</td>
                          <td><strong>{f.rating ? `${f.rating}/5` : "-"}</strong></td>
                          <td>{f.comments}</td>
                          <td>
                            <span className={`badge bg-${f.anonymous ? "danger" : "secondary"}-light text-${f.anonymous ? "danger" : "secondary"} px-2 py-1`}>
                              {f.anonymous ? "Anonymous" : "Named"}
                            </span>
                          </td>
                          <td>{formatDisplayDate(f.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cycle Modal */}
      {showCycleModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">New Appraisal Cycle</h5>
                  <button type="button" className="btn-close" onClick={() => setShowCycleModal(false)} />
                </div>
                <form onSubmit={handleCreateCycle}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Cycle Name</label>
                      <input className="form-control" placeholder="e.g. Annual Cycle 2026" value={cycleName} onChange={(e) => setCycleName(e.target.value)} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Type</label>
                      <select className="form-select" value={cycleType} onChange={(e: any) => setCycleType(e.target.value)}>
                        <option value="annual">Annual</option>
                        <option value="mid-year">Mid-Year</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Start Date</label>
                      <input type="date" className="form-control" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">End Date</label>
                      <input type="date" className="form-control" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} required />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowCycleModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Create Cycle"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}

      {/* Assign Appraisal Modal */}
      {showAssignModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Assign Appraisals</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAssignModal(false)} />
                </div>
                <form onSubmit={handleAssignReview}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Review Cycle</label>
                      <select className="form-select" value={assignCycleId} onChange={(e) => setAssignCycleId(e.target.value)} required>
                        <option value="">Select Cycle</option>
                        {cycles.filter((c) => c.status === "active").map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Employee Profile</label>
                      <select className="form-select" value={assignEmployeeId} onChange={(e) => setAssignEmployeeId(e.target.value)} required>
                        <option value="">Select Employee</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name || ""} ({emp.emp_code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Assigned Reviewer / Manager</label>
                      <select className="form-select" value={assignReviewerId} onChange={(e) => setAssignReviewerId(e.target.value)}>
                        <option value="">Auto (Direct Manager)</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name || ""}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowAssignModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Assigning..." : "Assign Appraisal"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}

      {/* Peer Request Modal */}
      {showPeerRequestModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Submit Peer Feedback</h5>
                  <button type="button" className="btn-close" onClick={() => setShowPeerRequestModal(false)} />
                </div>
                <form onSubmit={handleApplyPeerFeedback}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Review Cycle</label>
                      <select className="form-select" value={peerCycleId} onChange={(e) => setPeerCycleId(e.target.value)} required>
                        <option value="">Select Cycle</option>
                        {cycles.filter((c) => c.status === "active").map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Select Peer Colleague</label>
                      <select className="form-select" value={peerRevieweeId} onChange={(e) => setPeerRevieweeId(e.target.value)} required>
                        <option value="">Select Colleague</option>
                        {employees.filter((emp) => String(emp.id) !== String(user?.employee_profile?.id)).map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name || ""} ({emp.emp_code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Competency Rating (1-5)</label>
                      <select className="form-select" value={peerRatingText} onChange={(e) => setPeerRatingText(e.target.value)} required>
                        <option value="">Select Rating</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n.toFixed(2)}>{n}/5</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Constructive Comments</label>
                      <textarea className="form-control" rows={4} placeholder="Summarize strengths, growth opportunities, collaboration styles..." value={peerComments} onChange={(e) => setPeerComments(e.target.value)} required />
                    </div>
                    <div className="mb-3 form-check">
                      <input type="checkbox" className="form-check-input" id="peerAnonCheck" checked={peerAnonymous} onChange={(e) => setPeerAnonymous(e.target.checked)} />
                      <label className="form-check-label cursor-pointer" htmlFor="peerAnonCheck">Submit Anonymously (Colleague won't see your name)</label>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowPeerRequestModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Submitting..." : "Submit Feedback"}</button>
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

export default PerformanceReview;
