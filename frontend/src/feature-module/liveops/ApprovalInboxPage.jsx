import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmEmptyState, HrmHero, activeFilterCount, formatDateTimeLabel, smartSearchMatch, statusTone, toneClass } from "../hrm/hrmShared";

const ApprovalInboxPage = () => {
  const [counts, setCounts] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [decisionNote, setDecisionNote] = useState({});

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
    { label: "Payroll Queue", value: counts.payroll || 0, meta: "Payroll sign-off" },
    { label: "Final Settlements", value: counts.final_settlement || 0, meta: "Exit closures" },
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

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Approvals"
          title="Approval Inbox"
          subtitle="Review leave, timesheets, overtime, payroll, offboarding, and settlement actions from one operating queue with audit-backed decisions."
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
                <table className="table align-middle mb-0">
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
    </div>
  );
};

export default ApprovalInboxPage;
