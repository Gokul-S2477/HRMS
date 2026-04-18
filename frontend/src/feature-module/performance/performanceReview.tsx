import React, { useCallback, useEffect, useMemo, useState } from "react";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import API from "../../api/axios";
import {
  HrmEmptyState,
  HrmHero,
  HrmSideList,
  activeFilterCount,
  fetchEmployeeDirectory,
  formatDisplayDate,
  isDateInRange,
  normalizeResourceRecords,
  selectEmployee,
  smartSearchMatch,
  toneClass,
} from "../hrm/hrmShared";

type ReviewRecord = {
  id: string;
  data?: Record<string, any>;
};

type ReviewForm = {
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  reviewer: string;
  review_cycle: string;
  review_date: string;
  status: string;
  quality: string;
  collaboration: string;
  ownership: string;
  attendance: string;
  growth: string;
  strengths: string;
  opportunities: string;
  manager_notes: string;
  employee_comments: string;
};

const RESOURCE = "/data/performance-reviews/";
const SCORE_FIELDS: Array<keyof Pick<ReviewForm, "quality" | "collaboration" | "ownership" | "attendance" | "growth">> = [
  "quality",
  "collaboration",
  "ownership",
  "attendance",
  "growth",
];
const STATUS_OPTIONS = ["Draft", "In Review", "Completed"];

const emptyForm: ReviewForm = {
  employee_id: "",
  employee_name: "",
  department: "",
  designation: "",
  reviewer: "",
  review_cycle: "Q1 2026",
  review_date: "",
  status: "Draft",
  quality: "3",
  collaboration: "3",
  ownership: "3",
  attendance: "3",
  growth: "3",
  strengths: "",
  opportunities: "",
  manager_notes: "",
  employee_comments: "",
};

const PerformanceReview: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewForm>(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewResponse, employeeDirectory] = await Promise.all([
        API.get(RESOURCE),
        fetchEmployeeDirectory(),
      ]);
      setReviews(normalizeResourceRecords(reviewResponse.data) as ReviewRecord[]);
      setEmployees(employeeDirectory);
    } catch (error) {
      console.error("Failed to load performance reviews", error);
      setReviews([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedEmployee = useMemo(
    () => selectEmployee(employees, form.employee_id),
    [employees, form.employee_id]
  );

  const updateEmployee = (employeeId: string) => {
    const employee = selectEmployee(employees, employeeId);
    if (!employee) {
      setForm((current) => ({ ...current, employee_id: employeeId }));
      return;
    }
    setForm((current) => ({
      ...current,
      employee_id: employeeId,
      employee_name: employee.name,
      department: employee.department,
      designation: employee.designation,
    }));
  };

  const overallScore = useMemo(() => {
    const total = SCORE_FIELDS.reduce((sum, field) => sum + Number(form[field] || 0), 0);
    return (total / SCORE_FIELDS.length).toFixed(1);
  }, [form]);

  const recommendation = useMemo(() => {
    const score = Number(overallScore);
    if (score >= 4.5) return "Promotion ready";
    if (score >= 3.5) return "Strong performer";
    if (score >= 2.5) return "Growth plan recommended";
    return "Immediate support needed";
  }, [overallScore]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesSearch = smartSearchMatch(review.data || {}, search);
      const matchesStatus = !statusFilter || review.data?.status === statusFilter;
      const matchesEmployee =
        !employeeFilter || String(review.data?.employee_id || "") === employeeFilter;
      const matchesCycle = !cycleFilter || review.data?.review_cycle === cycleFilter;
      const matchesDate = isDateInRange(review.data?.review_date, dateFrom, dateTo);
      const score = Number(review.data?.overall_score || 0);
      const matchesQuick =
        !quickFilter ||
        (quickFilter === "top-performers" && score >= 4) ||
        (quickFilter === "needs-support" && score > 0 && score < 3) ||
        (quickFilter === "completed" && review.data?.status === "Completed");
      return (
        matchesSearch &&
        matchesStatus &&
        matchesEmployee &&
        matchesCycle &&
        matchesDate &&
        matchesQuick
      );
    });
  }, [cycleFilter, dateFrom, dateTo, employeeFilter, quickFilter, reviews, search, statusFilter]);

  const cycleOptions = useMemo(
    () =>
      Array.from(
        new Set(reviews.map((review) => review.data?.review_cycle).filter(Boolean))
      ).sort(),
    [reviews]
  );

  const appliedFilters = activeFilterCount({
    search,
    statusFilter,
    employeeFilter,
    cycleFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const stats = useMemo(
    () => [
      { label: "Reviews Logged", value: filteredReviews.length, meta: "Saved review cycles" },
      {
        label: "Completed",
        value: filteredReviews.filter((review) => review.data?.status === "Completed").length,
        meta: "Ready for follow-up actions",
      },
      {
        label: "In Review",
        value: filteredReviews.filter((review) => review.data?.status === "In Review").length,
        meta: "Awaiting closure",
      },
      {
        label: "Average Score",
        value:
          filteredReviews.length === 0
            ? "0.0"
            : (
                filteredReviews.reduce(
                  (sum, review) => sum + Number(review.data?.overall_score || 0),
                  0
                ) / filteredReviews.length
              ).toFixed(1),
        meta: "Across saved reviews",
      },
    ],
    [filteredReviews]
  );

  const highlights = useMemo(
    () =>
      filteredReviews.slice(0, 5).map((review) => ({
        label: review.data?.employee_name || "Employee",
        meta: review.data?.review_cycle || "Review cycle",
        value: `${review.data?.overall_score || "0.0"}/5`,
        tone:
          Number(review.data?.overall_score || 0) >= 4
            ? "success"
            : Number(review.data?.overall_score || 0) >= 3
            ? "warning"
            : "danger",
      })),
    [filteredReviews]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.employee_id) {
      window.alert("Select an employee for the review.");
      return;
    }

    const payload = {
      ...form,
      employee_name: selectedEmployee?.name || form.employee_name,
      department: selectedEmployee?.department || form.department,
      designation: selectedEmployee?.designation || form.designation,
      overall_score: overallScore,
      recommendation,
    };

    setSaving(true);
    try {
      if (editingId) {
        await API.put(`${RESOURCE}${editingId}/`, { data: payload });
      } else {
        await API.post(RESOURCE, { data: payload });
      }
      resetForm();
      loadData();
    } catch (error) {
      console.error("Failed to save performance review", error);
      window.alert("Unable to save the performance review.");
    } finally {
      setSaving(false);
    }
  };

  const editReview = (review: ReviewRecord) => {
    setEditingId(review.id);
    setForm({
      ...emptyForm,
      ...review.data,
      employee_id: review.data?.employee_id ? String(review.data.employee_id) : "",
    });
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      if (editingId === id) resetForm();
      loadData();
    } catch (error) {
      console.error("Failed to delete performance review", error);
      window.alert("Unable to delete the performance review.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Review Builder"
          title="Performance Review"
          subtitle="A more useful review workspace with weighted scoring, recommendation guidance, and a searchable archive of completed conversations."
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={resetForm}>
                <i className="ti ti-circle-plus me-2" />
                New Review
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-chart-dots-3" />
            Live score calculation and recommendation
          </span>
          <span className="employee-chip">
            <i className="ti ti-search" />
            Searchable review history for managers and HR
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <form onSubmit={saveReview}>
              <div className="card payroll-section-card mb-4">
                <div className="card-body">
                  <div className="payroll-section-header">
                    <h5 className="payroll-section-title">
                      {editingId ? "Edit Review" : "Create Review"}
                    </h5>
                    <span className={`payroll-badge ${toneClass(form.status === "Completed" ? "success" : form.status === "In Review" ? "warning" : "accent")}`}>
                      {form.status}
                    </span>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Employee</label>
                      <select
                        className="form-select"
                        value={form.employee_id}
                        onChange={(event) => updateEmployee(event.target.value)}
                        required
                      >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} • {employee.department || "No department"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Reviewer</label>
                      <input
                        className="form-control"
                        value={form.reviewer}
                        onChange={(event) => setForm((current) => ({ ...current, reviewer: event.target.value }))}
                        placeholder="Leona Hart"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Review Cycle</label>
                      <input
                        className="form-control"
                        value={form.review_cycle}
                        onChange={(event) => setForm((current) => ({ ...current, review_cycle: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Review Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.review_date}
                        onChange={(event) => setForm((current) => ({ ...current, review_date: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card payroll-section-card mb-4">
                <div className="card-body">
                  <div className="payroll-section-header">
                    <h5 className="payroll-section-title">Scorecard</h5>
                  </div>
                  <div className="row g-3">
                    {SCORE_FIELDS.map((field) => (
                      <div className="col-md-4" key={field}>
                        <label className="form-label text-capitalize">{field}</label>
                        <select
                          className="form-select"
                          value={form[field]}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, [field]: event.target.value }))
                          }
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={String(value)}>
                              {value} / 5
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card payroll-section-card">
                <div className="card-body">
                  <div className="payroll-section-header">
                    <h5 className="payroll-section-title">Narrative Notes</h5>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Strengths</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.strengths}
                        onChange={(event) => setForm((current) => ({ ...current, strengths: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Opportunities</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.opportunities}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, opportunities: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Manager Notes</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.manager_notes}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, manager_notes: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Employee Comments</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.employee_comments}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, employee_comments: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                    {editingId ? (
                      <button type="button" className="btn btn-light" onClick={resetForm}>
                        Cancel Edit
                      </button>
                    ) : null}
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Saving..." : editingId ? "Save Review" : "Create Review"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="col-xl-4">
            <div className="row g-4">
              <div className="col-12">
                <div className="card payroll-section-card">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">Live Summary</h5>
                    </div>
                    <div className="payroll-summary-highlight mb-3">
                      <small>{selectedEmployee?.name || "Select employee"}</small>
                      <h3>{overallScore}/5</h3>
                    </div>
                    <div className="payroll-summary-list">
                      <div className="payroll-summary-row">
                        <span>Department</span>
                        <strong>{selectedEmployee?.department || form.department || "-"}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Designation</span>
                        <strong>{selectedEmployee?.designation || form.designation || "-"}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Recommendation</span>
                        <strong>{recommendation}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Review Date</span>
                        <strong>{formatDisplayDate(form.review_date)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <HrmSideList
                  title="Recent Reviews"
                  items={highlights}
                  emptyLabel="Saved reviews will appear here for quick access."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card payroll-panel payroll-table-card mt-4">
          <div className="payroll-table-header">
            <div>
              <h5>Review History</h5>
              <div className="payroll-table-subtitle">
                Search completed and in-progress reviews without leaving the page.
              </div>
            </div>
            <div className="payroll-table-controls">
              <input
                className="form-control"
                style={{ minWidth: 240 }}
                placeholder="Smart search employee, reviewer, cycle, notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select className="form-select" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select className="form-select" value={cycleFilter} onChange={(event) => setCycleFilter(event.target.value)}>
                <option value="">All cycles</option>
                {cycleOptions.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {cycle}
                  </option>
                ))}
              </select>
              <input type="date" className="form-control" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <input type="date" className="form-control" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              <div className="payroll-filter-actions">
                <span className="payroll-filter-meta">
                  Filters <strong>{appliedFilters}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setEmployeeFilter("");
                    setCycleFilter("");
                    setDateFrom("");
                    setDateTo("");
                    setQuickFilter("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="payroll-filter-actions mt-3">
              {[
                { key: "top-performers", label: "Top performers" },
                { key: "needs-support", label: "Needs support" },
                { key: "completed", label: "Completed" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`payroll-chip-toggle ${quickFilter === item.key ? "active" : ""}`}
                  onClick={() => setQuickFilter((current) => (current === item.key ? "" : item.key))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Cycle</th>
                    <th>Reviewer</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-5">
                        Loading reviews...
                      </td>
                    </tr>
                  ) : filteredReviews.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <HrmEmptyState
                          icon="ti ti-clipboard-text"
                          title="No reviews saved yet"
                          description="Create your first review to start building a searchable performance archive."
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredReviews.map((review) => (
                      <tr key={review.id}>
                        <td>
                          <div className="payroll-primary-text">{review.data?.employee_name || "-"}</div>
                          <div className="payroll-secondary-text">
                            {review.data?.designation || "Role pending"} • {review.data?.department || "Department pending"}
                          </div>
                        </td>
                        <td>{review.data?.review_cycle || "-"}</td>
                        <td>{review.data?.reviewer || "-"}</td>
                        <td>{formatDisplayDate(review.data?.review_date)}</td>
                        <td>{review.data?.overall_score || "0.0"}/5</td>
                        <td>
                          <span className={`payroll-badge ${toneClass(review.data?.status === "Completed" ? "success" : review.data?.status === "In Review" ? "warning" : "accent")}`}>
                            {review.data?.status || "Draft"}
                          </span>
                        </td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-light me-2" onClick={() => editReview(review)}>
                            <i className="ti ti-edit" />
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteReview(review.id)}>
                            <i className="ti ti-trash" />
                          </button>
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
  );
};

export default PerformanceReview;
