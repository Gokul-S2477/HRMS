import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmEmptyState, HrmHero, activeFilterCount, formatDateTimeLabel, smartSearchMatch, statusTone, toneClass } from "../hrm/hrmShared";

const flattenFields = (obj, prefix = "") => {
  let result = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { [prefix]: obj };
  }
  for (let key in obj) {
    const newKey = prefix ? `${prefix} -> ${key}` : key;
    if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      Object.assign(result, flattenFields(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }
  return result;
};

const ApprovalInboxPage = () => {
  const [counts, setCounts] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [decisionNote, setDecisionNote] = useState({});
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/approvals/inbox/");
      setCounts(response.data?.counts || {});
      setItems(response.data?.items || []);
    } catch (error) {
      console.error("Failed to load approval inbox", error);
      setCounts({});
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (!smartSearchMatch(item, search)) return false;
    if (scopeFilter && item.scope !== scopeFilter) return false;
    return true;
  }), [items, scopeFilter, search]);

  const stats = useMemo(() => [
    { label: "Inbox Items", value: items.length, meta: `${filteredItems.length} visible after filters` },
    { label: "Leave Queue", value: counts.leave || 0, meta: "Employee requests" },
    { label: "Profile Updates", value: counts.profile_update || 0, meta: "Profile edit queue" },
    { label: "Payroll Queue", value: counts.payroll || 0, meta: "Payroll sign-off" },
  ], [counts, filteredItems.length, items.length]);

  const actOnItem = async (scope, id, decision) => {
    try {
      await API.post("/approvals/inbox/", {
        scope,
        id,
        decision,
        note: decisionNote[id] || "",
      });
      setDecisionNote((current) => ({ ...current, [id]: "" }));
      load();
    } catch (error) {
      window.alert(error?.response?.data?.detail || "Unable to process this approval.");
    }
  };

  const openComparisonModal = (item) => {
    setSelectedRequest(item);
    setShowModal(true);
  };

  const getDiffRows = (request) => {
    if (!request || !request.metadata) return [];
    const proposed = request.metadata.proposed_changes || {};
    const current = request.metadata.current_data || {};
    
    const flatProposed = flattenFields(proposed);
    const flatCurrent = flattenFields(current);
    
    const rows = [];
    Object.keys(flatProposed).forEach((key) => {
      let proposedVal = flatProposed[key];
      let currentVal = flatCurrent[key];
      
      if (Array.isArray(proposedVal)) {
        proposedVal = JSON.stringify(proposedVal, null, 2);
      }
      if (Array.isArray(currentVal)) {
        currentVal = JSON.stringify(currentVal, null, 2);
      }
      if (typeof proposedVal === "object" && proposedVal !== null) {
        proposedVal = JSON.stringify(proposedVal);
      }
      if (typeof currentVal === "object" && currentVal !== null) {
        currentVal = JSON.stringify(currentVal);
      }
      
      rows.push({
        field: key.replace(/_/g, " ").replace("->", " › "),
        current: currentVal !== undefined && currentVal !== null ? String(currentVal) : "—",
        proposed: proposedVal !== undefined && proposedVal !== null ? String(proposedVal) : "—",
        isChanged: String(proposedVal) !== String(currentVal),
      });
    });
    return rows;
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Approvals"
          title="Approval Inbox"
          subtitle="Review leave, profile updates, timesheets, overtime, payroll, offboarding, and settlement actions from one operating queue with audit-backed decisions."
          action={<div className="head-icons"><CollapseHeader /></div>}
          stats={stats}
        >
          <span className="employee-chip"><i className="ti ti-shield-check" /> Shared approval surface for HR and stakeholder review</span>
          <span className="employee-chip"><i className="ti ti-history" /> Every action is written to the audit trail</span>
        </HrmHero>

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Review Queue</h5>
              <div className="payroll-table-subtitle">Focused queue with decision notes, scope filters, and direct actions.</div>
            </div>
            <div className="payroll-table-controls">
              <input className="form-control" style={{ minWidth: 240 }} placeholder="Smart search employee, title, module" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className="form-select" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
                <option value="">All scopes</option>
                {Object.keys(counts).map((key) => <option key={key} value={key}>{key.replace(/_/g, " ")}</option>)}
              </select>
              <div className="payroll-filter-actions"><span className="payroll-filter-meta">Filters <strong>{activeFilterCount({ search, scopeFilter })}</strong></span></div>
            </div>
          </div>
          <div className="card-body">
            {loading ? <div className="text-center py-5 text-muted">Loading approval inbox...</div> : filteredItems.length === 0 ? <HrmEmptyState title="Approval inbox is clear" description="Once workflow items need review, they will show up here with direct approve or reject actions." /> : (
              <div className="table-responsive">
                <table className="table align-middle mb-0 text-nowrap">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Scope</th>
                      <th>Requested By</th>
                      <th>Submitted</th>
                      <th>Decision Note</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={`${item.scope}-${item.id}`}>
                        <td>
                          <div className="fw-semibold">{item.title}</div>
                          <div className="text-muted small">{item.employee_name} • {item.summary}</div>
                        </td>
                        <td><span className={`payroll-badge ${toneClass(statusTone(item.status))}`}>{item.scope.replace(/_/g, " ")}</span></td>
                        <td>{item.requested_by || "-"}</td>
                        <td>{formatDateTimeLabel(item.submitted_at)}</td>
                        <td style={{ minWidth: 260 }}>
                          <input className="form-control" placeholder="Optional note for this decision" value={decisionNote[item.id] || ""} onChange={(event) => setDecisionNote((current) => ({ ...current, [item.id]: event.target.value }))} />
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            {item.scope === "profile_update" && (
                              <button type="button" className="btn btn-sm btn-info" onClick={() => openComparisonModal(item)}>
                                <i className="ti ti-eye me-1" /> Review Changes
                              </button>
                            )}
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => actOnItem(item.scope, item.id, "approve")}>Approve</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => actOnItem(item.scope, item.id, "reject")}>Reject</button>
                            <button type="button" className="btn btn-sm btn-light" onClick={() => actOnItem(item.scope, item.id, "return")}>Return</button>
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

      {showModal && selectedRequest && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1} style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Review Profile Changes: {selectedRequest.employee_name}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <div className="modal-body" style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
                  <p className="text-muted">
                    Review the changes requested by <strong>{selectedRequest.employee_name}</strong> for their <strong>{String(selectedRequest.metadata.section).toUpperCase()}</strong> section.
                  </p>
                  
                  <div className="table-responsive border rounded-4 mb-3">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Field Name</th>
                          <th>Current Value</th>
                          <th>Proposed Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDiffRows(selectedRequest).map((row, idx) => (
                          <tr key={idx} style={row.isChanged ? { backgroundColor: "#e2f0d9" } : {}}>
                            <td>
                              <span className="fw-semibold text-capitalize text-dark">{row.field}</span>
                            </td>
                            <td>
                              <span className="text-muted" style={{ textDecoration: row.isChanged ? "line-through" : "none" }}>{row.current}</span>
                            </td>
                            <td>
                              <span className={row.isChanged ? "text-success fw-semibold" : "text-dark"}>{row.proposed}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Decision Comment / Note</label>
                    <input
                      className="form-control"
                      placeholder="Enter a reason or approval note..."
                      value={decisionNote[selectedRequest.id] || ""}
                      onChange={(e) =>
                        setDecisionNote((current) => ({
                          ...current,
                          [selectedRequest.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={async () => {
                      await actOnItem(selectedRequest.scope, selectedRequest.id, "reject");
                      setShowModal(false);
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      await actOnItem(selectedRequest.scope, selectedRequest.id, "approve");
                      setShowModal(false);
                    }}
                  >
                    Approve Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1040 }}></div>
        </>
      )}
    </div>
  );
};

export default ApprovalInboxPage;
