import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes as routes } from "../router/all_routes";
import { CRM_ENTITY_CONFIGS } from "./crmConfigs";
import {
  CRM_STAGE_ORDER,
  CRM_STAGE_PROBABILITY,
  fetchCrmCollections,
  getDealValue,
  getRecordOwner,
  getWeightedValue,
  isDueSoon,
  stageSummary,
  stageTone,
} from "./crmShared";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  formatCurrency,
  formatDisplayDate,
  isDateInRange,
  smartSearchMatch,
  statusTone,
  toneClass,
  toNumber,
} from "../hrm/hrmShared";

const dealConfig = CRM_ENTITY_CONFIGS.deal;

const trimPayload = (form) =>
  Object.entries(form).reduce(
    (accumulator, [key, value]) => ({
      ...accumulator,
      [key]: typeof value === "string" ? value.trim() : value,
    }),
    {}
  );

const CrmPipelinePage = () => {
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [stageFilter, setStageFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(dealConfig.initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const collections = await fetchCrmCollections(["deal", "lead"]);
      setDeals(collections.deal || []);
      setLeads(collections.lead || []);
    } catch (error) {
      console.error("Failed to load CRM pipeline", error);
      setDeals([]);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ownerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          deals
            .map((deal) => getRecordOwner(deal))
            .filter(Boolean)
            .concat(leads.map((lead) => getRecordOwner(lead)).filter(Boolean))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [deals, leads]
  );

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch = smartSearchMatch(deal.data || {}, search, [
        deal.created_at,
        deal.updated_at,
      ]);
      const matchesOwner = !ownerFilter || getRecordOwner(deal) === ownerFilter;
      const matchesStatus = !statusFilter || String(deal.data?.status || "") === statusFilter;
      const matchesStage = !stageFilter || String(deal.data?.stage || "") === stageFilter;
      const matchesDate = isDateInRange(deal.data?.expected_close_date, dateFrom, dateTo);
      const matchesQuick =
        !quickFilter ||
        (quickFilter === "closing-soon" && isDueSoon(deal.data?.expected_close_date, 14)) ||
        (quickFilter === "high-value" && getDealValue(deal) >= 40000) ||
        (quickFilter === "late-stage" &&
          ["Proposal", "Negotiation"].includes(String(deal.data?.stage || "")));
      return matchesSearch && matchesOwner && matchesStatus && matchesStage && matchesDate && matchesQuick;
    });
  }, [dateFrom, dateTo, deals, ownerFilter, quickFilter, search, stageFilter, statusFilter]);

  const appliedFilters = activeFilterCount({
    search,
    ownerFilter,
    statusFilter,
    stageFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const stages = useMemo(() => stageSummary(filteredDeals), [filteredDeals]);

  const stats = useMemo(() => {
    const openDeals = filteredDeals.filter((deal) => String(deal.data?.status || "") === "Open");
    const openValue = openDeals.reduce((sum, deal) => sum + getDealValue(deal), 0);
    const weightedForecast = openDeals.reduce((sum, deal) => sum + getWeightedValue(deal), 0);
    const closingSoon = openDeals.filter((deal) => isDueSoon(deal.data?.expected_close_date, 14)).length;
    const avgProbability = openDeals.length
      ? Math.round(
          openDeals.reduce((sum, deal) => sum + toNumber(deal.data?.probability), 0) / openDeals.length
        )
      : 0;
    return [
      { label: "Open Deals", value: openDeals.length, meta: "Active opportunities in motion" },
      { label: "Open Value", value: formatCurrency(openValue), meta: "Revenue still in play" },
      { label: "Weighted Forecast", value: formatCurrency(weightedForecast), meta: "Probability-adjusted pipeline" },
      { label: "Closing Soon", value: closingSoon, meta: `Average probability ${avgProbability}%` },
    ];
  }, [filteredDeals]);

  const topLeadItems = useMemo(
    () =>
      [...leads]
        .sort((left, right) => toNumber(right.data?.score) - toNumber(left.data?.score))
        .slice(0, 5)
        .map((lead) => ({
          label: lead.data?.lead_name || "Lead",
          meta: `${lead.data?.company_name || "Company pending"} - ${lead.data?.source || "Source pending"}`,
          value: `${toNumber(lead.data?.score)}`,
          tone: statusTone(lead.data?.status),
        })),
    [leads]
  );

  const closingSoonItems = useMemo(
    () =>
      filteredDeals
        .filter((deal) => isDueSoon(deal.data?.expected_close_date, 21))
        .sort((left, right) =>
          String(left.data?.expected_close_date || "").localeCompare(String(right.data?.expected_close_date || ""))
        )
        .slice(0, 5)
        .map((deal) => ({
          label: deal.data?.deal_name || "Opportunity",
          meta: `${deal.data?.company_name || "Company pending"} - ${getRecordOwner(deal)}`,
          value: formatDisplayDate(deal.data?.expected_close_date),
          tone: isDueSoon(deal.data?.expected_close_date, 7) ? "warning" : "accent",
        })),
    [filteredDeals]
  );

  const summaryContent = (
    <div className="payroll-summary-list">
      {dealConfig.summaryFields.map((field) => (
        <div key={field} className="payroll-summary-row">
          <span>{field.replace(/_/g, " ")}</span>
          <strong>{form[field] || "-"}</strong>
        </div>
      ))}
      <div className="payroll-summary-highlight mt-2">
        <small>Weighted Value</small>
        <h3>
          {formatCurrency(
            toNumber(form.value) *
              ((toNumber(form.probability) || CRM_STAGE_PROBABILITY[form.stage] || 0) / 100)
          )}
        </h3>
      </div>
    </div>
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...dealConfig.initialForm });
    setShowModal(true);
  };

  const openEdit = (deal) => {
    setEditing(deal);
    setForm({ ...dealConfig.initialForm, ...(deal.data || {}) });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setSaving(false);
  };

  const saveDeal = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = trimPayload({
        ...form,
        probability: String(toNumber(form.probability) || CRM_STAGE_PROBABILITY[form.stage] || 0),
      });
      if (editing) {
        await API.put(`${dealConfig.resource}${editing.id}/`, { data: payload });
      } else {
        await API.post(dealConfig.resource, { data: payload });
      }
      closeModal();
      setForm({ ...dealConfig.initialForm });
      await loadData();
    } catch (error) {
      console.error("Failed to save deal", error);
      window.alert("Unable to save the deal right now.");
      setSaving(false);
    }
  };

  const updateDeal = async (deal, patch) => {
    await API.put(`${dealConfig.resource}${deal.id}/`, {
      data: {
        ...(deal.data || {}),
        ...patch,
      },
    });
  };

  const moveStage = async (deal, direction) => {
    const currentIndex = CRM_STAGE_ORDER.indexOf(deal.data?.stage || "Discovery");
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= CRM_STAGE_ORDER.length) return;
    const nextStage = CRM_STAGE_ORDER[targetIndex];
    const nextStatus = nextStage === "Won" ? "Won" : nextStage === "Lost" ? "Lost" : "Open";
    try {
      await updateDeal(deal, {
        stage: nextStage,
        status: nextStatus,
        probability: String(CRM_STAGE_PROBABILITY[nextStage] ?? toNumber(deal.data?.probability)),
      });
      loadData();
    } catch (error) {
      console.error("Failed to move stage", error);
      window.alert("Unable to update the pipeline stage.");
    }
  };

  const setOutcome = async (deal, nextStatus) => {
    try {
      await updateDeal(deal, {
        status: nextStatus,
        stage: nextStatus === "Won" ? "Won" : nextStatus === "Lost" ? "Lost" : deal.data?.stage,
        probability: String(nextStatus === "Won" ? 100 : nextStatus === "Lost" ? 0 : toNumber(deal.data?.probability)),
      });
      loadData();
    } catch (error) {
      console.error("Failed to update outcome", error);
      window.alert("Unable to update the deal outcome.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell crm-shell">
        <HrmHero
          kicker="Pipeline Control"
          title="CRM Pipeline"
          subtitle="A board-first revenue view with weighted forecasting, stage movement, owner filtering, and quick opportunity updates."
          action={
            <>
              <div className="d-flex gap-2 flex-wrap">
                <Link to={routes.dealsGrid} className="btn btn-white">
                  <i className="ti ti-layout-grid me-2" />
                  Deals Grid
                </Link>
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <i className="ti ti-circle-plus me-2" />
                  Add Deal
                </button>
              </div>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-chart-funnel" />
            Weighted forecast and close-date visibility built in
          </span>
          <span className="employee-chip">
            <i className="ti ti-arrows-exchange" />
            Move deals stage-by-stage without leaving the board
          </span>
        </HrmHero>

        <div className="row g-4 align-items-start">
          <div className="col-xl-9">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Stage Board</h5>
                  <div className="payroll-table-subtitle">
                    Filter by owner, search across deals, and act on opportunities directly from the board.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder="Search opportunities"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="form-select"
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                  >
                    <option value="">All owners</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {dealConfig.statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={stageFilter}
                    onChange={(event) => setStageFilter(event.target.value)}
                  >
                    <option value="">All stages</option>
                    {CRM_STAGE_ORDER.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="form-control"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                  <input
                    type="date"
                    className="form-control"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                  <div className="payroll-filter-actions">
                    <span className="payroll-filter-meta">
                      Filters <strong>{appliedFilters}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => {
                        setSearch("");
                        setOwnerFilter("");
                        setStatusFilter("Open");
                        setStageFilter("");
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
                    { key: "closing-soon", label: "Closing soon" },
                    { key: "high-value", label: "High value" },
                    { key: "late-stage", label: "Late stage" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`payroll-chip-toggle secondary ${quickFilter === item.key ? "active" : ""}`}
                      onClick={() => setQuickFilter((current) => (current === item.key ? "" : item.key))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="py-5 text-center">Loading pipeline...</div>
                ) : filteredDeals.length === 0 ? (
                  <HrmEmptyState
                    icon="ti ti-chart-funnel"
                    title="No deals in this view"
                    description="Create a deal or relax the filters to see your pipeline stages populate."
                  />
                ) : (
                  <div className="crm-pipeline-board">
                    {stages.map((stage) => (
                      <div key={stage.stage} className="crm-pipeline-column">
                        <div className="crm-pipeline-column-header">
                          <div>
                            <span className={`payroll-badge ${toneClass(stageTone(stage.stage))}`}>{stage.stage}</span>
                            <h6>{stage.count} deal{stage.count === 1 ? "" : "s"}</h6>
                          </div>
                          <div className="text-end">
                            <strong>{stage.totalValueLabel}</strong>
                            <div className="payroll-secondary-text">Weighted {stage.weightedValueLabel}</div>
                          </div>
                        </div>
                        <div className="crm-pipeline-column-body">
                          {stage.deals.length === 0 ? (
                            <div className="crm-pipeline-empty">No deals in this stage.</div>
                          ) : (
                            stage.deals.map((deal) => {
                              const closeSoon = isDueSoon(deal.data?.expected_close_date, 7);
                              const probability = toNumber(deal.data?.probability) || CRM_STAGE_PROBABILITY[deal.data?.stage] || 0;
                              return (
                                <div key={deal.id} className="crm-pipeline-card">
                                  <div className="d-flex justify-content-between gap-2 mb-2">
                                    <div>
                                      <div className="payroll-primary-text">{deal.data?.deal_name || "Opportunity"}</div>
                                      <div className="payroll-secondary-text">
                                        {deal.data?.company_name || "Company pending"} - {deal.data?.contact_name || "Contact pending"}
                                      </div>
                                    </div>
                                    <span className={`payroll-badge ${toneClass(statusTone(deal.data?.status))}`}>
                                      {deal.data?.status || "Open"}
                                    </span>
                                  </div>
                                  <div className="crm-meta-grid mb-3">
                                    <div className="crm-meta-card">
                                      <span>Owner</span>
                                      <strong>{getRecordOwner(deal)}</strong>
                                    </div>
                                    <div className="crm-meta-card">
                                      <span>Value</span>
                                      <strong>{formatCurrency(deal.data?.value)}</strong>
                                    </div>
                                    <div className="crm-meta-card">
                                      <span>Close</span>
                                      <strong>{formatDisplayDate(deal.data?.expected_close_date)}</strong>
                                    </div>
                                  </div>
                                  <div className="crm-progress mb-2">
                                    <div
                                      className="crm-progress-bar"
                                      style={{ width: `${Math.min(100, probability)}%` }}
                                    />
                                  </div>
                                  <div className="d-flex justify-content-between align-items-center mb-3">
                                    <small className="payroll-secondary-text">Probability {probability}%</small>
                                    {closeSoon ? <span className="payroll-badge warning">Closing soon</span> : null}
                                  </div>
                                  <div className="payroll-secondary-text mb-3">{deal.data?.next_step || "Next step not added yet."}</div>
                                  <div className="d-flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-light"
                                      disabled={CRM_STAGE_ORDER.indexOf(deal.data?.stage || "Discovery") <= 0}
                                      onClick={() => moveStage(deal, -1)}
                                    >
                                      <i className="ti ti-arrow-left" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-light"
                                      disabled={CRM_STAGE_ORDER.indexOf(deal.data?.stage || "Discovery") >= CRM_STAGE_ORDER.length - 1}
                                      onClick={() => moveStage(deal, 1)}
                                    >
                                      <i className="ti ti-arrow-right" />
                                    </button>
                                    <button type="button" className="btn btn-sm btn-white" onClick={() => openEdit(deal)}>
                                      Edit
                                    </button>
                                    <Link to={`${routes.dealsDetails}?id=${deal.id}`} className="btn btn-sm btn-white">
                                      View
                                    </Link>
                                    {String(deal.data?.status || "") === "Open" ? (
                                      <>
                                        <button type="button" className="btn btn-sm btn-success" onClick={() => setOutcome(deal, "Won")}>
                                          Won
                                        </button>
                                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setOutcome(deal, "Lost")}>
                                          Lost
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-3">
            <div className="d-grid gap-4">
              <HrmSideList title="Closing Soon" items={closingSoonItems} emptyLabel="No close dates are approaching yet." />
              <HrmSideList title="Top Leads to Pull In" items={topLeadItems} emptyLabel="Lead scoring will surface here once leads are added." />
            </div>
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? "Update Deal" : "Add Deal"}
        subtitle="Capture owner, value, stage, and next-step clarity without leaving pipeline management."
        onClose={closeModal}
        onSubmit={saveDeal}
        submitLabel={saving ? "Saving..." : editing ? "Save Changes" : "Add Deal"}
        summary={summaryContent}
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">Deal Details</h5>
            </div>
            <div className="row g-3">
              {dealConfig.fields.map((field) => (
                <div key={field.name} className={field.colClass || "col-md-6"}>
                  <label className="form-label">{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      className="form-control"
                      rows={4}
                      value={form[field.name] || ""}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" ? (
                    <select
                      className="form-select"
                      value={form[field.name] || ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setForm((current) => ({
                          ...current,
                          [field.name]: nextValue,
                          probability:
                            field.name === "stage"
                              ? String(CRM_STAGE_PROBABILITY[nextValue] ?? toNumber(current.probability))
                              : current.probability,
                        }));
                      }}
                    >
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || "text"}
                      className="form-control"
                      value={form[field.name] || ""}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </HrmModal>
    </div>
  );
};

export default CrmPipelinePage;
