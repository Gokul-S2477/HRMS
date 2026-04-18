import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";

const RESOURCE = "/final-settlements/";

const normalize = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const toNumber = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusTone = (status) => {
  const key = String(status || "").toLowerCase();
  if (["paid", "closed"].includes(key)) return "success";
  if (["approved"].includes(key)) return "accent";
  if (["in_review"].includes(key)) return "warning";
  return "";
};

const FinalSettlementsPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get(RESOURCE);
      setRecords(normalize(response.data));
    } catch (error) {
      console.error("Failed to load final settlements", error);
      toast.error("Failed to load final settlements");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    let list = [...records];
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((item) =>
        [
          item.employee_name,
          item.employee_code,
          item.status,
          item.payroll_summary?.month,
          item.payroll_summary?.year,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
    }
    if (statusFilter) {
      list = list.filter((item) => item.status === statusFilter);
    }
    return list;
  }, [records, search, statusFilter]);

  const stats = useMemo(() => {
    const totalFinalPayable = filtered.reduce((sum, item) => sum + toNumber(item.final_payable), 0);
    const paid = records.filter((item) => item.status === "paid").length;
    const review = records.filter((item) => item.status === "in_review").length;
    return [
      { label: "Settlement Cases", value: records.length, meta: `${filtered.length} visible now` },
      { label: "Total Final Payable", value: formatAmount(totalFinalPayable), meta: "Across filtered cases" },
      { label: "Paid Cases", value: paid, meta: `${review} still under review` },
    ];
  }, [filtered, records]);

  const postAction = async (record, action, successMessage) => {
    try {
      await API.post(`${RESOURCE}${record.id}/${action}/`);
      toast.success(successMessage);
      loadRecords();
    } catch (error) {
      console.error(`Failed to ${action} settlement`, error);
      toast.error(`Failed to ${action.replace(/-/g, " ")} settlement`);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">Finance & Accounts</li>
                <li className="breadcrumb-item">Payroll</li>
                <li className="breadcrumb-item active">Final Settlements</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className="ti ti-file-invoice" /> Offboarding Payroll Control
                </span>
                <h1 className="payroll-title">Final Settlements</h1>
                <p className="payroll-subtitle">
                  Review notice recovery, leave encashment, gratuity, and final payout in one clean settlement register.
                </p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button" onClick={loadRecords}>
                    <i className="ti ti-refresh me-1" /> Refresh
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
            <div className="payroll-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {stats.map((card) => (
                <div className="card payroll-stat-card" key={card.label}>
                  <div className="card-body">
                    <span className="payroll-stat-label">{card.label}</span>
                    <h3 className="payroll-stat-value">{card.value}</h3>
                    <div className="payroll-stat-meta">{card.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Settlement Register</h5>
              <div className="payroll-table-subtitle">
                Offboarding-linked settlement cases with direct review, approval, and payout actions.
              </div>
            </div>
            <div className="payroll-table-controls">
              <input
                type="text"
                className="form-control"
                placeholder="Search by employee, code, cycle, or status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ minWidth: 260 }}
              />
              <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ minWidth: 180 }}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover table-center mb-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Settlement Mix</th>
                    <th>Final Payable</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5">Loading settlements...</td>
                    </tr>
                  ) : null}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="payroll-empty">
                          <i className="ti ti-file-search" />
                          <h6 className="mb-2">No final settlements available</h6>
                          <p className="mb-0">Approve resignation or termination cases to generate settlement records here.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {!loading &&
                    filtered.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="payroll-avatar-block">
                            <span className="payroll-avatar-icon">
                              <i className="ti ti-user-dollar" />
                            </span>
                            <div>
                              <div className="payroll-primary-text">{record.employee_name || "-"}</div>
                              <div className="payroll-secondary-text">
                                {record.employee_code || "-"} | Last day {formatDate(record.last_working_day)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="payroll-summary-list">
                            <div className="payroll-summary-row">
                              <span>Leave encashment</span>
                              <strong>{formatAmount(record.leave_encashment_amount)}</strong>
                            </div>
                            <div className="payroll-summary-row">
                              <span>Gratuity</span>
                              <strong>{formatAmount(record.gratuity_amount)}</strong>
                            </div>
                            <div className="payroll-summary-row">
                              <span>Notice recovery</span>
                              <strong>{formatAmount(record.notice_recovery_amount)}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="payroll-primary-text">{formatAmount(record.final_payable)}</div>
                          <div className="payroll-secondary-text">
                            Cycle {record.payroll_summary?.month || "-"} {record.payroll_summary?.year || ""}
                          </div>
                        </td>
                        <td>
                          <span className={`payroll-badge ${statusTone(record.status)}`}>
                            <i className="ti ti-shield-check" />
                            {String(record.status || "draft").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-white me-2" type="button" onClick={() => postAction(record, "recalculate", "Settlement recalculated")}>Recalculate</button>
                          {record.status !== "approved" && record.status !== "paid" ? (
                            <button className="btn btn-sm btn-primary me-2" type="button" onClick={() => postAction(record, "approve", "Settlement approved")}>Approve</button>
                          ) : null}
                          {record.status !== "paid" ? (
                            <button className="btn btn-sm btn-dark" type="button" onClick={() => postAction(record, "mark_paid", "Settlement marked as paid")}>Mark Paid</button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalSettlementsPage;
