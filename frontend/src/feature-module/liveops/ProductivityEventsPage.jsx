import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmEmptyState, HrmHero, HrmModal, HrmSideList, activeFilterCount, formatDateTimeLabel, toneClass } from "../hrm/hrmShared";
import { eventCountdown, eventMatches, eventUrgency, normalizeListResponse, splitCommaValues } from "./productivityShared";
import UpcomingReminderBanner from "./UpcomingReminderBanner";

const EVENT_TYPES = [
  { value: "event", label: "Event" },
  { value: "reminder", label: "Reminder" },
  { value: "meeting", label: "Meeting" },
  { value: "interview", label: "Interview" },
  { value: "payroll", label: "Payroll" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const defaultForm = {
  title: "",
  event_type: "event",
  priority: "medium",
  starts_at: "",
  ends_at: "",
  remind_before_minutes: 30,
  location: "",
  attendees_text: "",
  notes: "",
  target_url: "",
  is_completed: false,
};

const ProductivityEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/productivity/events/");
      setEvents(normalizeListResponse(response.data));
    } catch (error) {
      console.error("Failed to load reminder events", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesSearch = eventMatches(event, search);
        const matchesType = !typeFilter || String(event.event_type || "") === typeFilter;
        const matchesPriority = !priorityFilter || String(event.priority || "") === priorityFilter;
        return matchesSearch && matchesType && matchesPriority;
      }),
    [events, priorityFilter, search, typeFilter]
  );

  const stats = useMemo(() => {
    const completed = filteredEvents.filter((item) => item.is_completed).length;
    const urgent = filteredEvents.filter((item) => item.priority === "urgent" && !item.is_completed).length;
    const interviews = filteredEvents.filter((item) => item.event_type === "interview").length;
    return [
      { label: "Events", value: filteredEvents.length, meta: "Meetings, reminders, and key deadlines" },
      { label: "Urgent", value: urgent, meta: "High-visibility reminders" },
      { label: "Interview events", value: interviews, meta: "Recruitment coordination" },
      { label: "Completed", value: completed, meta: "Closed events" },
    ];
  }, [filteredEvents]);

  const highlights = useMemo(
    () =>
      filteredEvents
        .filter((item) => !item.is_completed)
        .slice()
        .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime())
        .slice(0, 6)
        .map((item) => ({
          label: item.title,
          meta: `${item.event_type} · ${item.location || "No location"}`,
          value: eventCountdown(item.starts_at),
          tone: eventUrgency(item),
        })),
    [filteredEvents]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      title: record.title || "",
      event_type: record.event_type || "event",
      priority: record.priority || "medium",
      starts_at: record.starts_at ? String(record.starts_at).slice(0, 16) : "",
      ends_at: record.ends_at ? String(record.ends_at).slice(0, 16) : "",
      remind_before_minutes: Number(record.remind_before_minutes || 30),
      location: record.location || "",
      attendees_text: Array.isArray(record.attendees) ? record.attendees.join(", ") : "",
      notes: record.notes || "",
      target_url: record.target_url || "",
      is_completed: Boolean(record.is_completed),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        event_type: form.event_type,
        priority: form.priority,
        starts_at: form.starts_at,
        ends_at: form.ends_at || null,
        remind_before_minutes: Number(form.remind_before_minutes || 30),
        location: form.location,
        attendees: splitCommaValues(form.attendees_text),
        notes: form.notes,
        target_url: form.target_url,
        is_completed: Boolean(form.is_completed),
      };
      if (editing) {
        await API.put(`/productivity/events/${editing.id}/`, payload);
      } else {
        await API.post("/productivity/events/", payload);
      }
      closeModal();
      load();
    } catch (error) {
      console.error("Failed to save event", error);
      window.alert(error?.response?.data?.detail || "Unable to save reminder event.");
    } finally {
      setSaving(false);
    }
  };

  const completeEvent = async (record) => {
    try {
      await API.post(`/productivity/events/${record.id}/complete/`);
      load();
    } catch (error) {
      console.error("Failed to complete event", error);
    }
  };

  const deleteEvent = async (record) => {
    if (!window.confirm(`Delete the event "${record.title}"?`)) return;
    try {
      await API.delete(`/productivity/events/${record.id}/`);
      load();
    } catch (error) {
      console.error("Failed to delete event", error);
      window.alert("Unable to delete this event.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <UpcomingReminderBanner />
        <HrmHero
          kicker="Events & Reminders"
          title="Reminder Planner"
          subtitle="Create event reminders for interviews, payroll cut-offs, document deadlines, or follow-up meetings and keep a visible countdown waiting at login."
          stats={stats}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-calendar-event me-2" />
                New Event
              </button>
              <div className="head-icons"><CollapseHeader /></div>
            </>
          }
        >
          <span className="employee-chip"><i className="ti ti-bell-ringing-2" />Upcoming reminders appear as login banners for HR and stakeholders</span>
          <span className="employee-chip"><i className="ti ti-clock-hour-4" />Every event stores timing, attendees, and where to jump next</span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-9">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Reminder timeline</h5>
                  <div className="payroll-table-subtitle">A cleaner event desk for internal reminders, deadlines, and interview slots.</div>
                </div>
                <div className="payroll-table-controls">
                  <input className="form-control" style={{ minWidth: 240 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, notes, location, attendee" />
                  <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="">All event types</option>
                    {EVENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="">All priorities</option>
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <div className="payroll-filter-actions">
                    <span className="payroll-filter-meta">Filters <strong>{activeFilterCount({ search, typeFilter, priorityFilter })}</strong></span>
                    <button type="button" className="btn btn-light" onClick={() => { setSearch(""); setTypeFilter(""); setPriorityFilter(""); }}>Reset</button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-5 text-muted">Loading reminder events...</div>
                ) : filteredEvents.length === 0 ? (
                  <HrmEmptyState icon="ti ti-calendar-off" title="No reminder events yet" description="Create payroll deadlines, interview events, follow-up reminders, or stakeholder checkpoints." />
                ) : (
                  <div className="row g-3">
                    {filteredEvents.map((record) => (
                      <div className="col-md-6" key={record.id}>
                        <div className={`productivity-event-card ${toneClass(eventUrgency(record))}`}>
                          <div className="d-flex justify-content-between align-items-start gap-3">
                            <div>
                              <div className="productivity-note-meta">{record.event_type}</div>
                              <h5>{record.title}</h5>
                            </div>
                            <span className={`payroll-badge ${toneClass(eventUrgency(record))}`}>{record.priority}</span>
                          </div>
                          <div className="productivity-note-grid mt-3">
                            <div><span>Starts</span><strong>{formatDateTimeLabel(record.starts_at)}</strong></div>
                            <div><span>Countdown</span><strong>{eventCountdown(record.starts_at)}</strong></div>
                            <div><span>Reminder</span><strong>{record.remind_before_minutes || 30} min</strong></div>
                            <div><span>Location</span><strong>{record.location || "TBD"}</strong></div>
                          </div>
                          {record.notes ? <p className="productivity-note-copy mt-3">{record.notes}</p> : null}
                          {Array.isArray(record.attendees) && record.attendees.length ? <div className="d-flex gap-2 flex-wrap mt-2">{record.attendees.slice(0, 4).map((item) => <span className="productivity-tag" key={item}>{item}</span>)}</div> : null}
                          <div className="d-flex gap-2 flex-wrap mt-3">
                            <button type="button" className="btn btn-light btn-sm" onClick={() => openEdit(record)}>Edit</button>
                            {!record.is_completed ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => completeEvent(record)}>Mark done</button> : <span className="payroll-badge success">Completed</span>}
                            {record.target_url ? <a href={record.target_url} className="btn btn-outline-secondary btn-sm">Open link</a> : null}
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deleteEvent(record)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-xl-3">
            <HrmSideList title="Next reminders" items={highlights} emptyLabel="Upcoming events will surface here once scheduled." />
          </div>
        </div>

        <HrmModal
          open={showModal}
          title={editing ? "Update Event" : "Create Event"}
          subtitle="Set the timing, urgency, attendees, and next link so the app can remind you at login."
          onClose={closeModal}
          onSubmit={saveEvent}
          submitLabel={saving ? "Saving..." : editing ? "Save Event" : "Create Event"}
          summary={
            <div className="payroll-summary-list">
              <div className="payroll-summary-row"><span>Title</span><strong>{form.title || "Untitled event"}</strong></div>
              <div className="payroll-summary-row"><span>Type</span><strong>{EVENT_TYPES.find((item) => item.value === form.event_type)?.label || "Event"}</strong></div>
              <div className="payroll-summary-row"><span>Priority</span><strong>{PRIORITY_OPTIONS.find((item) => item.value === form.priority)?.label || "Medium"}</strong></div>
              <div className="payroll-summary-row"><span>Starts</span><strong>{form.starts_at ? formatDateTimeLabel(form.starts_at) : "Pending"}</strong></div>
              <div className="payroll-summary-row"><span>Reminder</span><strong>{form.remind_before_minutes || 30} minutes before</strong></div>
            </div>
          }
        >
          <div className="card payroll-section-card">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Event type</label>
                  <select className="form-select" value={form.event_type} onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}>
                    {EVENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Starts at</label>
                  <input type="datetime-local" className="form-control" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Ends at</label>
                  <input type="datetime-local" className="form-control" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Remind before</label>
                  <input type="number" min={5} className="form-control" value={form.remind_before_minutes} onChange={(event) => setForm((current) => ({ ...current, remind_before_minutes: event.target.value }))} />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Location or meeting link</label>
                  <input className="form-control" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Conference room, Meet link, or payroll desk" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Attendees</label>
                  <input className="form-control" value={form.attendees_text} onChange={(event) => setForm((current) => ({ ...current, attendees_text: event.target.value }))} placeholder="Asha Kumar, Nina Shah" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Target URL</label>
                  <input className="form-control" value={form.target_url} onChange={(event) => setForm((current) => ({ ...current, target_url: event.target.value }))} placeholder="/recruitment/interviews or /approvals/inbox" />
                </div>
                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="What should this remind you about, and what matters when the banner appears?" />
                </div>
              </div>
            </div>
          </div>
        </HrmModal>
      </div>
    </div>
  );
};

export default ProductivityEventsPage;
