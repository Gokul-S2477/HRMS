import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  formatCurrency,
  formatDateTimeLabel,
  isDateInRange,
  smartSearchMatch,
  toneClass,
} from "../hrm/hrmShared";
import { fetchCandidateOptions, fetchEmployeeOptions, fetchJobOptions, normalizeList } from "../liveops/liveHelpers";
import { splitCommaValues } from "../liveops/productivityShared";

const INTERVIEW_TYPES = [
  { value: "screening", label: "Screening" },
  { value: "technical", label: "Technical" },
  { value: "managerial", label: "Managerial" },
  { value: "behavioral", label: "Behavioral" },
  { value: "hr", label: "HR" },
  { value: "final", label: "Final" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

const DECISION_OPTIONS = [
  { value: "strong_hire", label: "Strong Hire" },
  { value: "hire", label: "Hire" },
  { value: "hold", label: "Hold" },
  { value: "reject", label: "Reject" },
];

const MODE_OPTIONS = [
  { value: "virtual", label: "Virtual" },
  { value: "onsite", label: "Onsite" },
  { value: "phone", label: "Phone" },
  { value: "panel", label: "Panel" },
];

const toneForDecision = (value) => {
  const key = String(value || "hold").toLowerCase();
  if (key === "strong_hire" || key === "hire") return "success";
  if (key === "reject") return "danger";
  return "warning";
};

const defaultForm = {
  candidate_id: "",
  round_name: "",
  interview_type: "screening",
  status: "scheduled",
  scheduled_for: "",
  completed_at: "",
  mode: "virtual",
  location_or_link: "",
  duration_minutes: 45,
  panel_members_text: "",
  discussion_topics_text: "",
  score: 0,
  decision: "hold",
  feedback_summary: "",
  strengths: "",
  concerns: "",
  salary_discussed: "false",
  salary_expectation: 0,
  salary_offered: 0,
  final_ctc_recommended: 0,
  negotiation_notes: "",
  next_step: "",
};

const RecruitmentInterviewsPage = () => {
  const location = useLocation();
  const queryCandidate = useMemo(() => new URLSearchParams(location.search).get("candidate") || "", [location.search]);

  const [interviews, setInterviews] = useState([]);
  const [candidateOptions, setCandidateOptions] = useState([]);
  const [jobOptions, setJobOptions] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState({
    candidate: queryCandidate,
    job: "",
    employee: "",
    interview_type: "",
    status: "",
    decision: "",
  });
  const [form, setForm] = useState({ ...defaultForm, candidate_id: queryCandidate || "" });

  useEffect(() => {
    setFilters((current) => ({ ...current, candidate: queryCandidate || current.candidate }));
    setForm((current) => ({ ...current, candidate_id: current.candidate_id || queryCandidate || "" }));
  }, [queryCandidate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [interviewResponse, nextCandidateOptions, nextJobOptions, nextEmployeeOptions] = await Promise.all([
        API.get("/recruitment/interviews/"),
        fetchCandidateOptions(),
        fetchJobOptions(),
        fetchEmployeeOptions(),
      ]);
      setInterviews(normalizeList(interviewResponse.data));
      setCandidateOptions(nextCandidateOptions);
      setJobOptions(nextJobOptions);
      setEmployeeOptions(nextEmployeeOptions);
    } catch (error) {
      console.error("Failed to load recruitment interviews", error);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const candidateLookup = useMemo(
    () => Object.fromEntries(candidateOptions.map((item) => [String(item.value), item.label])),
    [candidateOptions]
  );

  const filteredInterviews = useMemo(
    () =>
      interviews.filter((record) => {
        const matchesSearch = smartSearchMatch(record, search, [record.candidate?.full_name, record.job?.title, record.employee?.full_name]);
        const matchesCandidate = !filters.candidate || String(record.candidate?.id || "") === String(filters.candidate);
        const matchesJob = !filters.job || String(record.job?.id || "") === String(filters.job);
        const matchesEmployee = !filters.employee || String(record.employee?.id || "") === String(filters.employee);
        const matchesType = !filters.interview_type || String(record.interview_type || "") === filters.interview_type;
        const matchesStatus = !filters.status || String(record.status || "") === filters.status;
        const matchesDecision = !filters.decision || String(record.decision || "") === filters.decision;
        const matchesDate = isDateInRange(record.completed_at || record.scheduled_for || record.created_at, dateFrom, dateTo);
        return matchesSearch && matchesCandidate && matchesJob && matchesEmployee && matchesType && matchesStatus && matchesDecision && matchesDate;
      }),
    [dateFrom, dateTo, filters, interviews, search]
  );

  const stats = useMemo(() => {
    const completed = filteredInterviews.filter((item) => item.status === "completed").length;
    const scheduled = filteredInterviews.filter((item) => item.status === "scheduled").length;
    const hireSignals = filteredInterviews.filter((item) => ["strong_hire", "hire"].includes(item.decision)).length;
    const linkedEmployees = filteredInterviews.filter((item) => item.employee?.id).length;
    return [
      { label: "Interview Records", value: filteredInterviews.length, meta: "Every round stays searchable later" },
      { label: "Scheduled", value: scheduled, meta: "Upcoming interview blocks" },
      { label: "Completed", value: completed, meta: `${hireSignals} positive recommendation(s)` },
      { label: "Linked Employees", value: linkedEmployees, meta: "History preserved after joining" },
    ];
  }, [filteredInterviews]);

  const highlights = useMemo(
    () =>
      filteredInterviews
        .slice()
        .sort((left, right) => new Date(left.scheduled_for || left.completed_at || 0).getTime() - new Date(right.scheduled_for || right.completed_at || 0).getTime())
        .slice(0, 6)
        .map((item) => ({
          label: item.candidate?.full_name || "Candidate",
          meta: `${item.round_name || item.interview_type} · ${item.job?.title || "Role pending"}`,
          value: item.decision?.replace(/_/g, " ") || item.status,
          tone: toneForDecision(item.decision),
        })),
    [filteredInterviews]
  );

  const selectedCandidate = useMemo(
    () => interviews.find((item) => String(item.candidate?.id || "") === String(form.candidate_id))?.candidate || null,
    [form.candidate_id, interviews]
  );

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ ...defaultForm, candidate_id: queryCandidate || "" });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, candidate_id: queryCandidate || "" });
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      candidate_id: String(record.candidate?.id || ""),
      round_name: record.round_name || "",
      interview_type: record.interview_type || "screening",
      status: record.status || "scheduled",
      scheduled_for: record.scheduled_for ? String(record.scheduled_for).slice(0, 16) : "",
      completed_at: record.completed_at ? String(record.completed_at).slice(0, 16) : "",
      mode: record.mode || "virtual",
      location_or_link: record.location_or_link || "",
      duration_minutes: Number(record.duration_minutes || 45),
      panel_members_text: Array.isArray(record.panel_members) ? record.panel_members.join(", ") : "",
      discussion_topics_text: Array.isArray(record.discussion_topics) ? record.discussion_topics.join(", ") : "",
      score: Number(record.score || 0),
      decision: record.decision || "hold",
      feedback_summary: record.feedback_summary || "",
      strengths: record.strengths || "",
      concerns: record.concerns || "",
      salary_discussed: String(Boolean(record.salary_discussed)),
      salary_expectation: Number(record.salary_expectation || 0),
      salary_offered: Number(record.salary_offered || 0),
      final_ctc_recommended: Number(record.final_ctc_recommended || 0),
      negotiation_notes: record.negotiation_notes || "",
      next_step: record.next_step || "",
    });
    setShowModal(true);
  };

  const saveInterview = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        candidate_id: Number(form.candidate_id),
        round_name: form.round_name,
        interview_type: form.interview_type,
        status: form.status,
        scheduled_for: form.scheduled_for || null,
        completed_at: form.completed_at || null,
        mode: form.mode,
        location_or_link: form.location_or_link,
        duration_minutes: Number(form.duration_minutes || 45),
        panel_members: splitCommaValues(form.panel_members_text),
        discussion_topics: splitCommaValues(form.discussion_topics_text),
        score: Number(form.score || 0),
        decision: form.decision,
        feedback_summary: form.feedback_summary,
        strengths: form.strengths,
        concerns: form.concerns,
        salary_discussed: String(form.salary_discussed) === "true",
        salary_expectation: Number(form.salary_expectation || 0),
        salary_offered: Number(form.salary_offered || 0),
        final_ctc_recommended: Number(form.final_ctc_recommended || 0),
        negotiation_notes: form.negotiation_notes,
        next_step: form.next_step,
      };
      if (editing) {
        await API.put(`/recruitment/interviews/${editing.id}/`, payload);
      } else {
        await API.post("/recruitment/interviews/", payload);
      }
      closeModal();
      load();
    } catch (error) {
      console.error("Failed to save interview", error);
      window.alert(error?.response?.data?.detail || "Unable to save interview record.");
    } finally {
      setSaving(false);
    }
  };

  const deleteInterview = async (record) => {
    if (!window.confirm(`Delete the interview record for ${record.candidate?.full_name || "this candidate"}?`)) return;
    try {
      await API.delete(`/recruitment/interviews/${record.id}/`);
      load();
    } catch (error) {
      console.error("Failed to delete interview", error);
      window.alert("Unable to delete this interview record.");
    }
  };

  const filterCount = activeFilterCount({ search, dateFrom, dateTo, ...filters });

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell recruitment-shell">
        <HrmHero
          kicker="Interview Desk"
          title="Recruitment Interviews"
          subtitle="Keep every round structured: interviewer, decision, salary discussion, negotiation notes, and the full trail that remains visible even after the candidate becomes an employee."
          stats={stats}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-circle-plus me-2" />
                Log Interview
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
        >
          <span className="employee-chip"><i className="ti ti-history" />Cross-visible to HR, stakeholders, and super admin</span>
          <span className="employee-chip"><i className="ti ti-cash-banknote" />Negotiation, salary expectation, and next-step context saved with each round</span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-9">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Interview records</h5>
                  <div className="payroll-table-subtitle">Filter by candidate, employee, round, or decision and reopen context anytime.</div>
                </div>
                <div className="payroll-table-controls">
                  <input className="form-control" style={{ minWidth: 240 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate, round, interviewer, feedback, negotiation" />
                  <select className="form-select" value={filters.candidate} onChange={(event) => setFilters((current) => ({ ...current, candidate: event.target.value }))}>
                    <option value="">All candidates</option>
                    {candidateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={filters.job} onChange={(event) => setFilters((current) => ({ ...current, job: event.target.value }))}>
                    <option value="">All roles</option>
                    {jobOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={filters.employee} onChange={(event) => setFilters((current) => ({ ...current, employee: event.target.value }))}>
                    <option value="">All employees</option>
                    {employeeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={filters.interview_type} onChange={(event) => setFilters((current) => ({ ...current, interview_type: event.target.value }))}>
                    <option value="">All rounds</option>
                    {INTERVIEW_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                    <option value="">All states</option>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={filters.decision} onChange={(event) => setFilters((current) => ({ ...current, decision: event.target.value }))}>
                    <option value="">All decisions</option>
                    {DECISION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input type="date" className="form-control" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  <input type="date" className="form-control" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                  <div className="payroll-filter-actions">
                    <span className="payroll-filter-meta">Filters <strong>{filterCount}</strong></span>
                    <button type="button" className="btn btn-light" onClick={() => {
                      setSearch("");
                      setDateFrom("");
                      setDateTo("");
                      setFilters({ candidate: queryCandidate || "", job: "", employee: "", interview_type: "", status: "", decision: "" });
                    }}>Reset</button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-5 text-muted">Loading interview process...</div>
                ) : filteredInterviews.length === 0 ? (
                  <HrmEmptyState icon="ti ti-user-search" title="No interview records found" description="Start by logging interview rounds so candidate history stays available long after hiring decisions are made." />
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Round</th>
                          <th>Interviewer</th>
                          <th>Decision</th>
                          <th>Salary discussion</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInterviews.map((record) => (
                          <tr key={record.id}>
                            <td>
                              <div className="fw-semibold">{record.candidate?.full_name || "Candidate"}</div>
                              <div className="text-muted small">{record.job?.title || "Role pending"}</div>
                              <div className="text-muted small">{record.employee?.emp_code ? `${record.employee.emp_code} · ${record.employee.full_name}` : "Not yet linked to employee"}</div>
                            </td>
                            <td>
                              <div className="fw-semibold">{record.round_name || record.interview_type}</div>
                              <div className="text-muted small">{formatDateTimeLabel(record.completed_at || record.scheduled_for)}</div>
                              <div className="text-muted small text-capitalize">{record.mode || "virtual"} · {record.duration_minutes || 45} min</div>
                            </td>
                            <td>
                              <div>{record.taken_by?.display_name || record.taken_by?.username || "System"}</div>
                              <div className="text-muted small text-capitalize">{(record.taken_by_role || "hr").replace(/_/g, " ")}</div>
                            </td>
                            <td>
                              <span className={`payroll-badge ${toneClass(toneForDecision(record.decision))}`}>{String(record.decision || "hold").replace(/_/g, " ")}</span>
                              <div className="text-muted small mt-1">{record.status?.replace(/_/g, " ")}</div>
                              <div className="text-muted small">Score {record.score || 0}/100</div>
                            </td>
                            <td>
                              <div>{record.salary_discussed ? "Discussed" : "Not discussed"}</div>
                              <div className="text-muted small">Expected {formatCurrency(record.salary_expectation)}</div>
                              <div className="text-muted small">Offered {formatCurrency(record.salary_offered)}</div>
                            </td>
                            <td>
                              <div className="d-flex justify-content-end gap-2 flex-wrap">
                                <Link to={`${all_routes.candidateslist}?candidate=${record.candidate?.id || ""}`} className="btn btn-sm btn-light">Candidate</Link>
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(record)}>Edit</button>
                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteInterview(record)}>Delete</button>
                              </div>
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
          <div className="col-xl-3">
            <HrmSideList title="Upcoming focus" items={highlights} emptyLabel="No interviews match the current filters." />
          </div>
        </div>

        <HrmModal
          open={showModal}
          title={editing ? "Update Interview Record" : "Log Interview Round"}
          subtitle="Capture the interview flow once and keep it visible to HR and stakeholder reviewers throughout the hiring journey."
          onClose={closeModal}
          onSubmit={saveInterview}
          submitLabel={saving ? "Saving..." : editing ? "Save Interview" : "Create Interview"}
          summary={
            <div className="payroll-summary-list">
              <div className="payroll-summary-row"><span>Candidate</span><strong>{candidateLookup[String(form.candidate_id)] || "Select candidate"}</strong></div>
              <div className="payroll-summary-row"><span>Round</span><strong>{form.round_name || INTERVIEW_TYPES.find((item) => item.value === form.interview_type)?.label || "Round"}</strong></div>
              <div className="payroll-summary-row"><span>State</span><strong>{STATUS_OPTIONS.find((item) => item.value === form.status)?.label || "Scheduled"}</strong></div>
              <div className="payroll-summary-row"><span>Recommendation</span><strong>{DECISION_OPTIONS.find((item) => item.value === form.decision)?.label || "Hold"}</strong></div>
              <div className="payroll-summary-row"><span>Expected CTC</span><strong>{formatCurrency(form.salary_expectation || 0)}</strong></div>
              <div className="payroll-summary-row"><span>Recommended</span><strong>{formatCurrency(form.final_ctc_recommended || 0)}</strong></div>
              {selectedCandidate?.employee?.full_name ? <div className="payroll-summary-row"><span>Linked employee</span><strong>{selectedCandidate.employee.full_name}</strong></div> : null}
            </div>
          }
        >
          <div className="card payroll-section-card">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Candidate</label>
                  <select className="form-select" required value={form.candidate_id} onChange={(event) => setForm((current) => ({ ...current, candidate_id: event.target.value }))}>
                    <option value="">Select candidate</option>
                    {candidateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Round name</label>
                  <input className="form-control" value={form.round_name} onChange={(event) => setForm((current) => ({ ...current, round_name: event.target.value }))} placeholder="Example: Technical round 2" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Interview type</label>
                  <select className="form-select" value={form.interview_type} onChange={(event) => setForm((current) => ({ ...current, interview_type: event.target.value }))}>
                    {INTERVIEW_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Decision</label>
                  <select className="form-select" value={form.decision} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
                    {DECISION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Scheduled for</label>
                  <input type="datetime-local" className="form-control" value={form.scheduled_for} onChange={(event) => setForm((current) => ({ ...current, scheduled_for: event.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Completed at</label>
                  <input type="datetime-local" className="form-control" value={form.completed_at} onChange={(event) => setForm((current) => ({ ...current, completed_at: event.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Mode</label>
                  <select className="form-select" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))}>
                    {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Duration</label>
                  <input type="number" min={15} className="form-control" value={form.duration_minutes} onChange={(event) => setForm((current) => ({ ...current, duration_minutes: event.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Score / 100</label>
                  <input type="number" min={0} max={100} className="form-control" value={form.score} onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))} />
                </div>
                <div className="col-12">
                  <label className="form-label">Meeting link or location</label>
                  <input className="form-control" value={form.location_or_link} onChange={(event) => setForm((current) => ({ ...current, location_or_link: event.target.value }))} placeholder="Google Meet link, office room, or phone bridge" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Panel members</label>
                  <input className="form-control" value={form.panel_members_text} onChange={(event) => setForm((current) => ({ ...current, panel_members_text: event.target.value }))} placeholder="Asha Kumar, Nina Shah" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Discussion topics</label>
                  <input className="form-control" value={form.discussion_topics_text} onChange={(event) => setForm((current) => ({ ...current, discussion_topics_text: event.target.value }))} placeholder="React, system design, compensation" />
                </div>
                <div className="col-12">
                  <label className="form-label">Feedback summary</label>
                  <textarea className="form-control" rows={4} value={form.feedback_summary} onChange={(event) => setForm((current) => ({ ...current, feedback_summary: event.target.value }))} placeholder="Overall interview summary, candidate behaviour, and final readout." />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Strengths</label>
                  <textarea className="form-control" rows={4} value={form.strengths} onChange={(event) => setForm((current) => ({ ...current, strengths: event.target.value }))} placeholder="Problem solving, communication, domain depth..." />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Concerns</label>
                  <textarea className="form-control" rows={4} value={form.concerns} onChange={(event) => setForm((current) => ({ ...current, concerns: event.target.value }))} placeholder="Gaps, risks, follow-up checks, or blockers." />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Salary discussed</label>
                  <select className="form-select" value={form.salary_discussed} onChange={(event) => setForm((current) => ({ ...current, salary_discussed: event.target.value }))}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Expected CTC</label>
                  <input type="number" min={0} className="form-control" value={form.salary_expectation} onChange={(event) => setForm((current) => ({ ...current, salary_expectation: event.target.value }))} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Offered CTC</label>
                  <input type="number" min={0} className="form-control" value={form.salary_offered} onChange={(event) => setForm((current) => ({ ...current, salary_offered: event.target.value }))} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Recommended CTC</label>
                  <input type="number" min={0} className="form-control" value={form.final_ctc_recommended} onChange={(event) => setForm((current) => ({ ...current, final_ctc_recommended: event.target.value }))} />
                </div>
                <div className="col-12">
                  <label className="form-label">Negotiation notes</label>
                  <textarea className="form-control" rows={3} value={form.negotiation_notes} onChange={(event) => setForm((current) => ({ ...current, negotiation_notes: event.target.value }))} placeholder="Notice buyout, salary range discussion, flexibility, or joining constraints." />
                </div>
                <div className="col-12">
                  <label className="form-label">Next step</label>
                  <textarea className="form-control" rows={3} value={form.next_step} onChange={(event) => setForm((current) => ({ ...current, next_step: event.target.value }))} placeholder="Example: Move to final panel, send assignment, discuss offer, or close profile." />
                </div>
              </div>
            </div>
          </div>
        </HrmModal>
      </div>
    </div>
  );
};

export default RecruitmentInterviewsPage;
