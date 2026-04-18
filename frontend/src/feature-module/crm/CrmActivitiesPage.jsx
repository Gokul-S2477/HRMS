import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes as routes } from "../router/all_routes";
import { CRM_ACTIVITY_CONFIG } from "./crmConfigs";
import {
  buildActivityPreview,
  buildRelationOptions,
  fetchCrmCollections,
  getRecordOwner,
  isDueSoon,
  isOverdueActivity,
  relationPath,
} from "./crmShared";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  formatDisplayDate,
  formatDateTimeLabel,
  isDateInRange,
  normalizeResourceRecords,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "../hrm/hrmShared";

const initialForm = {
  subject: "",
  activity_type: "Call",
  channel: "Phone",
  relation_key: "",
  relation_type: "",
  relation_id: "",
  relation_name: "",
  owner: "",
  due_date: "",
  status: "Scheduled",
  outcome: "",
  notes: "",
};

const trimForm = (form) =>
  Object.entries(form).reduce(
    (accumulator, [key, value]) => ({
      ...accumulator,
      [key]: typeof value === "string" ? value.trim() : value,
    }),
    {}
  );

const CrmActivitiesPage = () => {
  const [activities, setActivities] = useState([]);
  const [collections, setCollections] = useState({ contact: [], company: [], deal: [], lead: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [relationFilter, setRelationFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [activityResponse, relatedCollections] = await Promise.all([
        API.get(CRM_ACTIVITY_CONFIG.resource).then((response) => normalizeResourceRecords(response.data)),
        fetchCrmCollections(["contact", "company", "deal", "lead"]),
      ]);
      setActivities(activityResponse);
      setCollections({
        contact: relatedCollections.contact || [],
        company: relatedCollections.company || [],
        deal: relatedCollections.deal || [],
        lead: relatedCollections.lead || [],
      });
    } catch (error) {
      console.error("Failed to load CRM activities", error);
      setActivities([]);
      setCollections({ contact: [], company: [], deal: [], lead: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const relationOptions = useMemo(() => buildRelationOptions(collections), [collections]);

  const ownerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          activities
            .map((activity) => activity.data?.owner)
            .filter(Boolean)
            .concat(collections.contact.map((item) => getRecordOwner(item)).filter(Boolean))
            .concat(collections.company.map((item) => getRecordOwner(item)).filter(Boolean))
            .concat(collections.deal.map((item) => getRecordOwner(item)).filter(Boolean))
            .concat(collections.lead.map((item) => getRecordOwner(item)).filter(Boolean))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [activities, collections]
  );

  const relationTypeOptions = useMemo(
    () =>
      Array.from(new Set(activities.map((activity) => activity.data?.relation_type).filter(Boolean))).sort(
        (left, right) => String(left).localeCompare(String(right))
      ),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    return [...activities]
      .filter((activity) => {
        const matchesSearch = smartSearchMatch(activity.data || {}, search, [
          activity.created_at,
          activity.updated_at,
        ]);
        const matchesStatus = !statusFilter || String(activity.data?.status || "") === statusFilter;
        const matchesType = !typeFilter || String(activity.data?.activity_type || "") === typeFilter;
        const matchesOwner = !ownerFilter || String(activity.data?.owner || "") === ownerFilter;
        const matchesRelation =
          !relationFilter || String(activity.data?.relation_type || "") === relationFilter;
        const matchesChannel =
          !channelFilter || String(activity.data?.channel || "") === channelFilter;
        const matchesDate = isDateInRange(activity.data?.due_date, dateFrom, dateTo);
        const matchesQuick =
          !quickFilter ||
          (quickFilter === "overdue" && isOverdueActivity(activity)) ||
          (quickFilter === "due-soon" && isDueSoon(activity.data?.due_date, 7)) ||
          (quickFilter === "unlinked" && !activity.data?.relation_id);
        return (
          matchesSearch &&
          matchesStatus &&
          matchesType &&
          matchesOwner &&
          matchesRelation &&
          matchesChannel &&
          matchesDate &&
          matchesQuick
        );
      })
      .sort((left, right) =>
        String(left.data?.due_date || left.updated_at || "").localeCompare(
          String(right.data?.due_date || right.updated_at || "")
        )
      );
  }, [
    activities,
    channelFilter,
    dateFrom,
    dateTo,
    ownerFilter,
    quickFilter,
    relationFilter,
    search,
    statusFilter,
    typeFilter,
  ]);

  const stats = useMemo(() => {
    const completed = filteredActivities.filter((activity) => String(activity.data?.status || "") === "Completed").length;
    const scheduled = filteredActivities.filter((activity) => String(activity.data?.status || "") === "Scheduled").length;
    const dueSoon = filteredActivities.filter((activity) => isDueSoon(activity.data?.due_date, 7)).length;
    const overdue = filteredActivities.filter((activity) => isOverdueActivity(activity)).length;
    return [
      { label: "Scheduled", value: scheduled, meta: "Planned relationship actions" },
      { label: "Completed", value: completed, meta: "Closed loops and follow-ups" },
      { label: "Due This Week", value: dueSoon, meta: "Upcoming work that needs ownership" },
      { label: "Overdue", value: overdue, meta: "Needs attention now" },
    ];
  }, [filteredActivities]);

  const agendaItems = useMemo(
    () =>
      filteredActivities.slice(0, 6).map((activity) => ({
        label: activity.data?.subject || "Activity",
        meta: `${activity.data?.relation_name || "Unlinked"} - ${activity.data?.owner || "Unassigned"}`,
        value: formatDisplayDate(activity.data?.due_date),
        tone: isOverdueActivity(activity) ? "danger" : statusTone(activity.data?.status),
      })),
    [filteredActivities]
  );

  const summaryContent = (
    <div className="payroll-summary-list">
      {[
        { label: "Subject", value: form.subject || "-" },
        { label: "Type", value: form.activity_type || "-" },
        { label: "Linked To", value: form.relation_name || "-" },
        { label: "Owner", value: form.owner || "-" },
        { label: "Due", value: form.due_date ? formatDisplayDate(form.due_date) : "-" },
      ].map((item) => (
        <div key={item.label} className="payroll-summary-row">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
      <div className="finance-note-card mt-2">
        <i className="ti ti-bolt" />
        {buildActivityPreview({ data: form })}
      </div>
    </div>
  );

  const appliedFilters = activeFilterCount({
    search,
    statusFilter,
    typeFilter,
    ownerFilter,
    relationFilter,
    channelFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...initialForm });
    setShowModal(true);
  };

  const openEdit = (activity) => {
    const relationKey = activity.data?.relation_type && activity.data?.relation_id
      ? `${activity.data.relation_type}:${activity.data.relation_id}`
      : "";
    setEditing(activity);
    setForm({ ...initialForm, ...(activity.data || {}), relation_key: relationKey });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setSaving(false);
  };

  const saveActivity = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = trimForm({ ...form });
      delete payload.relation_key;
      if (editing) {
        await API.put(`${CRM_ACTIVITY_CONFIG.resource}${editing.id}/`, { data: payload });
      } else {
        await API.post(CRM_ACTIVITY_CONFIG.resource, { data: payload });
      }
      closeModal();
      setForm({ ...initialForm });
      await loadData();
    } catch (error) {
      console.error("Failed to save CRM activity", error);
      window.alert("Unable to save the CRM activity right now.");
      setSaving(false);
    }
  };

  const updateStatus = async (activity, nextStatus) => {
    try {
      await API.put(`${CRM_ACTIVITY_CONFIG.resource}${activity.id}/`, {
        data: {
          ...(activity.data || {}),
          status: nextStatus,
        },
      });
      loadData();
    } catch (error) {
      console.error("Failed to update activity status", error);
      window.alert("Unable to update the activity status.");
    }
  };

  const deleteActivity = async (activityId) => {
    if (!window.confirm("Delete this activity?")) return;
    try {
      await API.delete(`${CRM_ACTIVITY_CONFIG.resource}${activityId}/`);
      loadData();
    } catch (error) {
      console.error("Failed to delete activity", error);
      window.alert("Unable to delete the activity.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell crm-shell">
        <HrmHero
          kicker="Activity Command"
          title="CRM Activities"
          subtitle="A cleaner action queue for calls, demos, follow-ups, and tasks with linked CRM records, owner accountability, and quick completion flows."
          action={
            <>
              <div className="d-flex gap-2 flex-wrap">
                <Link to={routes.analytics} className="btn btn-white">
                  <i className="ti ti-report-analytics me-2" />
                  Analytics
                </Link>
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <i className="ti ti-circle-plus me-2" />
                  Add Activity
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
            <i className="ti ti-calendar-due" />
            Relation-aware agenda with overdue and due-soon visibility
          </span>
          <span className="employee-chip">
            <i className="ti ti-checkup-list" />
            Quick completion and cancellation built into the activity stream
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Activity Stream</h5>
                  <div className="payroll-table-subtitle">
                    Search across owners, linked records, notes, and subjects to keep follow-up work moving.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder="Search activities"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="">All types</option>
                    {CRM_ACTIVITY_CONFIG.typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    {CRM_ACTIVITY_CONFIG.statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select className="form-select" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                    <option value="">All owners</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                  <select className="form-select" value={relationFilter} onChange={(event) => setRelationFilter(event.target.value)}>
                    <option value="">All relation types</option>
                    {relationTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select className="form-select" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                    <option value="">All channels</option>
                    {CRM_ACTIVITY_CONFIG.channelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
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
                        setTypeFilter("");
                        setOwnerFilter("");
                        setRelationFilter("");
                        setChannelFilter("");
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
                    { key: "overdue", label: "Overdue" },
                    { key: "due-soon", label: "Due soon" },
                    { key: "unlinked", label: "Unlinked" },
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
                  <div className="py-5 text-center">Loading CRM activities...</div>
                ) : filteredActivities.length === 0 ? (
                  <HrmEmptyState
                    icon="ti ti-activity-heartbeat"
                    title="No activities in this view"
                    description="Create calls, emails, demos, and tasks to build a richer CRM activity stream."
                  />
                ) : (
                  <div className="crm-activity-stack">
                    {filteredActivities.map((activity) => {
                      const detailLink = relationPath(activity.data?.relation_type, activity.data?.relation_id, routes);
                      return (
                        <div key={activity.id} className="crm-activity-card">
                          <div className="d-flex justify-content-between gap-3 flex-wrap mb-3">
                            <div>
                              <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <span className={`payroll-badge ${toneClass(statusTone(activity.data?.status))}`}>
                                  {activity.data?.status || "Scheduled"}
                                </span>
                                <span className="payroll-badge info">{activity.data?.activity_type || "Task"}</span>
                                {isOverdueActivity(activity) ? <span className="payroll-badge danger">Overdue</span> : null}
                              </div>
                              <div className="payroll-primary-text fs-5">{activity.data?.subject || "Activity"}</div>
                              <div className="payroll-secondary-text">
                                {activity.data?.channel || "Channel pending"} - owned by {activity.data?.owner || "Unassigned"}
                              </div>
                            </div>
                            <div className="text-end">
                              <div className="payroll-primary-text">{formatDisplayDate(activity.data?.due_date)}</div>
                              <div className="payroll-secondary-text">{formatDateTimeLabel(activity.updated_at || activity.created_at)}</div>
                            </div>
                          </div>

                          <div className="crm-meta-grid mb-3">
                            <div className="crm-meta-card">
                              <span>Linked Record</span>
                              <strong>{activity.data?.relation_name || "Not linked yet"}</strong>
                            </div>
                            <div className="crm-meta-card">
                              <span>Type</span>
                              <strong>{activity.data?.activity_type || "Task"}</strong>
                            </div>
                            <div className="crm-meta-card">
                              <span>Owner</span>
                              <strong>{activity.data?.owner || "Unassigned"}</strong>
                            </div>
                          </div>

                          {activity.data?.notes ? <div className="finance-note-card mb-3"><i className="ti ti-notes" />{activity.data.notes}</div> : null}

                          <div className="d-flex gap-2 flex-wrap">
                            {detailLink ? (
                              <Link to={detailLink} className="btn btn-sm btn-white">
                                <i className="ti ti-link me-2" />
                                Open Linked Record
                              </Link>
                            ) : null}
                            <button type="button" className="btn btn-sm btn-light" onClick={() => openEdit(activity)}>
                              <i className="ti ti-edit me-2" />
                              Edit
                            </button>
                            {String(activity.data?.status || "") !== "Completed" ? (
                              <button type="button" className="btn btn-sm btn-success" onClick={() => updateStatus(activity, "Completed")}>
                                Complete
                              </button>
                            ) : null}
                            {String(activity.data?.status || "") !== "Cancelled" ? (
                              <button type="button" className="btn btn-sm btn-warning" onClick={() => updateStatus(activity, "Cancelled")}>
                                Cancel
                              </button>
                            ) : null}
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteActivity(activity.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="d-grid gap-4">
              <HrmSideList title="Agenda" items={agendaItems} emptyLabel="Your upcoming CRM agenda will appear here." />
            </div>
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? "Update Activity" : "Add Activity"}
        subtitle="Link activity work to the right CRM record so follow-up context stays intact."
        onClose={closeModal}
        onSubmit={saveActivity}
        submitLabel={saving ? "Saving..." : editing ? "Save Changes" : "Add Activity"}
        summary={summaryContent}
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">Activity Details</h5>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Subject</label>
                <input
                  className="form-control"
                  value={form.subject}
                  onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Security review call"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Activity Type</label>
                <select
                  className="form-select"
                  value={form.activity_type}
                  onChange={(event) => setForm((current) => ({ ...current, activity_type: event.target.value }))}
                >
                  {CRM_ACTIVITY_CONFIG.typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Channel</label>
                <select
                  className="form-select"
                  value={form.channel}
                  onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}
                >
                  {CRM_ACTIVITY_CONFIG.channelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {CRM_ACTIVITY_CONFIG.statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Linked Record</label>
                <select
                  className="form-select"
                  value={form.relation_key}
                  onChange={(event) => {
                    const selected = relationOptions.find((option) => option.value === event.target.value);
                    setForm((current) => ({
                      ...current,
                      relation_key: event.target.value,
                      relation_type: selected?.relation_type || "",
                      relation_id: selected?.relation_id || "",
                      relation_name: selected?.relation_name || "",
                    }));
                  }}
                >
                  <option value="">Select linked record</option>
                  {relationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Owner</label>
                <input
                  className="form-control"
                  value={form.owner}
                  onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                  placeholder="Marcus Reed"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.due_date}
                  onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Outcome</label>
                <input
                  className="form-control"
                  value={form.outcome}
                  onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))}
                  placeholder="Follow-up agreed, proposal requested"
                />
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Capture key discussion notes, blockers, and next steps."
                />
              </div>
            </div>
          </div>
        </div>
      </HrmModal>
    </div>
  );
};

export default CrmActivitiesPage;
