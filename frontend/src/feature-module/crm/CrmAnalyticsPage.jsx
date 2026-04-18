import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes as routes } from "../router/all_routes";
import {
  HrmEmptyState,
  HrmHero,
  HrmSideList,
  activeFilterCount,
  formatCurrency,
  formatDisplayDate,
  isDateInRange,
  smartSearchMatch,
} from "../hrm/hrmShared";
import UpcomingReminderBanner from "../liveops/UpcomingReminderBanner";
import {
  fetchCrmCollections,
  getDealValue,
  getWeightedValue,
  isDueSoon,
  isOverdueActivity,
  ownerLeaderboard,
  stageSummary,
  summarizeSources,
} from "./crmShared";

const percentage = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

const CrmAnalyticsPage = () => {
  const [collections, setCollections] = useState({
    contact: [],
    company: [],
    deal: [],
    lead: [],
    activity: [],
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCrmCollections(["contact", "company", "deal", "lead", "activity"]);
      setCollections({
        contact: result.contact || [],
        company: result.company || [],
        deal: result.deal || [],
        lead: result.lead || [],
        activity: result.activity || [],
      });
    } catch (error) {
      console.error("Failed to load CRM analytics", error);
      setCollections({ contact: [], company: [], deal: [], lead: [], activity: [] });
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
          [...collections.contact, ...collections.company, ...collections.deal, ...collections.lead, ...collections.activity]
            .map((record) => record.data?.owner || record.data?.account_owner)
            .filter(Boolean)
        )
      ).sort((left, right) => String(left).localeCompare(String(right))),
    [collections]
  );

  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...collections.contact, ...collections.deal, ...collections.lead]
            .map((record) => record.data?.source)
            .filter(Boolean)
        )
      ).sort((left, right) => String(left).localeCompare(String(right))),
    [collections]
  );

  const filteredCollections = useMemo(() => {
    const filterRecord = (record, dateFields = []) => {
      const owner = record.data?.owner || record.data?.account_owner || "";
      const source = record.data?.source || "";
      const matchesSearch = smartSearchMatch(record.data || {}, search, [record.created_at, record.updated_at]);
      const matchesOwner = !ownerFilter || owner === ownerFilter;
      const matchesSource = !sourceFilter || source === sourceFilter;
      const dateValue = dateFields.map((field) => record.data?.[field] || record[field]).find(Boolean);
      const matchesDate = isDateInRange(dateValue, dateFrom, dateTo);
      return matchesSearch && matchesOwner && matchesSource && matchesDate;
    };

    return {
      contact: collections.contact.filter((record) => filterRecord(record, ["next_follow_up", "last_contact_date"])),
      company: collections.company.filter((record) => filterRecord(record, ["updated_at", "created_at"])),
      deal: collections.deal.filter((record) => filterRecord(record, ["expected_close_date"])),
      lead: collections.lead.filter((record) => filterRecord(record, ["next_follow_up"])),
      activity: collections.activity.filter((record) => filterRecord(record, ["due_date"])),
    };
  }, [collections, dateFrom, dateTo, ownerFilter, search, sourceFilter]);

  const openDeals = useMemo(
    () => filteredCollections.deal.filter((deal) => String(deal.data?.status || "") === "Open"),
    [filteredCollections.deal]
  );

  const wonDeals = useMemo(
    () => filteredCollections.deal.filter((deal) => String(deal.data?.status || "") === "Won"),
    [filteredCollections.deal]
  );

  const qualifiedLeads = useMemo(
    () =>
      filteredCollections.lead.filter((lead) =>
        ["Qualified", "Working", "Converted"].includes(String(lead.data?.status || ""))
      ),
    [filteredCollections.lead]
  );

  const overdueActivities = useMemo(
    () => filteredCollections.activity.filter((activity) => isOverdueActivity(activity)),
    [filteredCollections.activity]
  );

  const stats = useMemo(() => {
    const openValue = openDeals.reduce((sum, deal) => sum + getDealValue(deal), 0);
    const weightedValue = openDeals.reduce((sum, deal) => sum + getWeightedValue(deal), 0);
    const wonValue = wonDeals.reduce((sum, deal) => sum + getDealValue(deal), 0);
    const conversionRate = percentage(
      filteredCollections.lead.filter((lead) => String(lead.data?.status || "") === "Converted").length,
      filteredCollections.lead.length
    );
    return [
      { label: "Pipeline Value", value: formatCurrency(openValue), meta: "Open opportunity value" },
      { label: "Forecast", value: formatCurrency(weightedValue), meta: "Weighted revenue outlook" },
      { label: "Won Revenue", value: formatCurrency(wonValue), meta: "Closed-won value" },
      { label: "Lead Conversion", value: `${conversionRate}%`, meta: `${qualifiedLeads.length} qualified signals` },
    ];
  }, [filteredCollections.lead, openDeals, qualifiedLeads.length, wonDeals]);

  const sourceRows = useMemo(() => {
    const sources = summarizeSources([...filteredCollections.lead, ...filteredCollections.contact]);
    const total = sources.reduce((sum, item) => sum + item.value, 0);
    return sources.slice(0, 6).map((item) => ({
      ...item,
      percent: percentage(item.value, total),
    }));
  }, [filteredCollections.contact, filteredCollections.lead]);

  const stageRows = useMemo(() => {
    const stages = stageSummary(filteredCollections.deal);
    const total = stages.reduce((sum, stage) => sum + stage.count, 0);
    return stages.map((stage) => ({
      ...stage,
      percent: percentage(stage.count, total),
    }));
  }, [filteredCollections.deal]);

  const ownerRows = useMemo(
    () => ownerLeaderboard(filteredCollections.deal, filteredCollections.lead, filteredCollections.contact).slice(0, 6),
    [filteredCollections.contact, filteredCollections.deal, filteredCollections.lead]
  );

  const attentionItems = useMemo(() => {
    const dueDeals = openDeals
      .filter((deal) => isDueSoon(deal.data?.expected_close_date, 10))
      .map((deal) => ({
        label: deal.data?.deal_name || "Opportunity",
        meta: `${deal.data?.company_name || "Company pending"} - closes ${formatDisplayDate(deal.data?.expected_close_date)}`,
        value: formatCurrency(deal.data?.value),
        tone: "warning",
      }));

    const overdueItems = overdueActivities.map((activity) => ({
      label: activity.data?.subject || "Activity",
      meta: `${activity.data?.relation_name || "Relationship pending"} - due ${formatDisplayDate(activity.data?.due_date)}`,
      value: activity.data?.status || "Overdue",
      tone: "danger",
    }));

    return [...overdueItems, ...dueDeals].slice(0, 6);
  }, [openDeals, overdueActivities]);

  const activityItems = useMemo(() => {
    const completed = filteredCollections.activity.filter((activity) => String(activity.data?.status || "") === "Completed").length;
    const scheduled = filteredCollections.activity.filter((activity) => String(activity.data?.status || "") === "Scheduled").length;
    const cancelled = filteredCollections.activity.filter((activity) => String(activity.data?.status || "") === "Cancelled").length;
    const total = Math.max(filteredCollections.activity.length, 1);
    return [
      { label: "Scheduled", value: scheduled, percent: percentage(scheduled, total) },
      { label: "Completed", value: completed, percent: percentage(completed, total) },
      { label: "Overdue", value: overdueActivities.length, percent: percentage(overdueActivities.length, total) },
      { label: "Cancelled", value: cancelled, percent: percentage(cancelled, total) },
    ];
  }, [filteredCollections.activity, overdueActivities.length]);

  const spotlightItems = useMemo(
    () =>
      ownerRows.slice(0, 5).map((owner) => ({
        label: owner.owner,
        meta: `${owner.dealCount} deals - ${owner.leadCount} leads - ${owner.contactCount} contacts`,
        value: formatCurrency(owner.weightedValue),
        tone: owner.weightedValue > 0 ? "success" : "accent",
      })),
    [ownerRows]
  );

  const appliedFilters = activeFilterCount({ search, ownerFilter, sourceFilter, dateFrom, dateTo });

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell crm-shell">
        <UpcomingReminderBanner compact />
        <HrmHero
          kicker="Revenue Insight"
          title="CRM Analytics"
          subtitle="A live CRM performance layer for conversion, pipeline health, owner productivity, activity execution, and source quality."
          action={
            <>
              <div className="d-flex gap-2 flex-wrap">
                <Link to={routes.pipeline} className="btn btn-white">
                  <i className="ti ti-chart-funnel me-2" />
                  Pipeline
                </Link>
                <Link to={routes.activity} className="btn btn-primary">
                  <i className="ti ti-activity me-2" />
                  Activities
                </Link>
              </div>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-report-analytics" />
            Conversion, owner load, and source performance in one place
          </span>
          <span className="employee-chip">
            <i className="ti ti-bolt" />
            Attention queue surfaces deals and tasks that need action now
          </span>
        </HrmHero>

        <div className="card payroll-section-card mb-4">
          <div className="card-body">
            <div className="payroll-table-header p-0 border-0">
              <div>
                <h5>Analytics Filters</h5>
                <div className="payroll-table-subtitle">
                  Focus the analytics on specific owners, sources, date windows, and smart search terms.
                </div>
              </div>
              <div className="payroll-table-controls">
                <input
                  className="form-control"
                  style={{ minWidth: 220 }}
                  placeholder="Smart search across CRM"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select className="form-select" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                  <option value="">All owners</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
                <select className="form-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  <option value="">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
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
                      setOwnerFilter("");
                      setSourceFilter("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card payroll-section-card">
            <div className="card-body py-5 text-center">Loading CRM analytics...</div>
          </div>
        ) : filteredCollections.contact.length + filteredCollections.company.length + filteredCollections.deal.length + filteredCollections.lead.length + filteredCollections.activity.length === 0 ? (
          <div className="card payroll-section-card">
            <div className="card-body">
              <HrmEmptyState
                icon="ti ti-report-analytics"
                title="No CRM data available in this view"
                description="Try clearing the filters or adding CRM data to populate the analytics layer."
              />
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-xl-8">
              <div className="card payroll-section-card mb-4">
                <div className="card-body">
                  <div className="payroll-section-header">
                    <h5 className="payroll-section-title">Funnel Snapshot</h5>
                  </div>
                  <div className="crm-funnel-grid">
                    {[
                      { label: "Leads", value: filteredCollections.lead.length, meta: `${qualifiedLeads.length} qualified` },
                      { label: "Open Deals", value: openDeals.length, meta: formatCurrency(openDeals.reduce((sum, deal) => sum + getDealValue(deal), 0)) },
                      { label: "Won Deals", value: wonDeals.length, meta: formatCurrency(wonDeals.reduce((sum, deal) => sum + getDealValue(deal), 0)) },
                      { label: "Activities", value: filteredCollections.activity.length, meta: `${overdueActivities.length} overdue` },
                    ].map((step, index) => (
                      <div key={step.label} className="crm-funnel-step">
                        <span className="crm-funnel-index">0{index + 1}</span>
                        <strong>{step.value}</strong>
                        <span>{step.label}</span>
                        <small>{step.meta}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-md-6">
                  <div className="card payroll-section-card h-100">
                    <div className="card-body">
                      <div className="payroll-section-header">
                        <h5 className="payroll-section-title">Source Performance</h5>
                      </div>
                      <div className="crm-bar-list">
                        {sourceRows.map((row) => (
                          <div key={row.label} className="crm-bar-row">
                            <div className="d-flex justify-content-between gap-2 mb-2">
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                            </div>
                            <div className="crm-bar-track">
                              <div className="crm-bar-fill" style={{ width: `${row.percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card payroll-section-card h-100">
                    <div className="card-body">
                      <div className="payroll-section-header">
                        <h5 className="payroll-section-title">Stage Mix</h5>
                      </div>
                      <div className="crm-bar-list">
                        {stageRows.map((row) => (
                          <div key={row.stage} className="crm-bar-row">
                            <div className="d-flex justify-content-between gap-2 mb-2">
                              <span>{row.stage}</span>
                              <strong>{row.count}</strong>
                            </div>
                            <div className="crm-bar-track">
                              <div className="crm-bar-fill alt" style={{ width: `${row.percent}%` }} />
                            </div>
                            <small className="payroll-secondary-text">{row.totalValueLabel}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card payroll-section-card h-100">
                    <div className="card-body">
                      <div className="payroll-section-header">
                        <h5 className="payroll-section-title">Owner Leaderboard</h5>
                      </div>
                      <div className="payroll-summary-list">
                        {ownerRows.map((owner) => (
                          <div key={owner.owner} className="payroll-summary-row">
                            <div>
                              <div className="payroll-primary-text">{owner.owner}</div>
                              <div className="payroll-secondary-text">
                                {owner.dealCount} deals - {owner.leadCount} leads - {owner.contactCount} contacts
                              </div>
                            </div>
                            <span className="payroll-badge success">{formatCurrency(owner.weightedValue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card payroll-section-card h-100">
                    <div className="card-body">
                      <div className="payroll-section-header">
                        <h5 className="payroll-section-title">Activity Health</h5>
                      </div>
                      <div className="crm-bar-list">
                        {activityItems.map((item) => (
                          <div key={item.label} className="crm-bar-row">
                            <div className="d-flex justify-content-between gap-2 mb-2">
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                            <div className="crm-bar-track">
                              <div className="crm-bar-fill" style={{ width: `${item.percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-4">
              <div className="d-grid gap-4">
                <HrmSideList title="Attention Queue" items={attentionItems} emptyLabel="Nothing urgent at the moment." />
                <HrmSideList title="Owner Spotlight" items={spotlightItems} emptyLabel="Owner performance will appear here." />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrmAnalyticsPage;
