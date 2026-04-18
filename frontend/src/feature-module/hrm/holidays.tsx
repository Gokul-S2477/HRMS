import React, { useCallback, useEffect, useMemo, useState } from "react";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import API from "../../api/axios";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  dayDifference,
  daysUntil,
  formatDisplayDate,
  isDateInRange,
  normalizeResourceRecords,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "./hrmShared";

type HolidayRecord = {
  id: string;
  data?: {
    title?: string;
    date?: string;
    description?: string;
    status?: string;
    type?: string;
    applies_to?: string;
    location?: string;
  };
};

const RESOURCE = "/data/holidays/";
const STATUS_OPTIONS = ["Active", "Inactive"];
const TYPE_OPTIONS = ["Public Holiday", "Company Holiday", "Wellness Break", "Regional Holiday"];
const APPLIES_TO_OPTIONS = ["All Teams", "Head Office", "Remote Team", "Field Staff"];

const emptyForm = {
  title: "",
  date: "",
  description: "",
  status: "Active",
  type: "Public Holiday",
  applies_to: "All Teams",
  location: "",
};

const Holidays: React.FC = () => {
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [appliesToFilter, setAppliesToFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HolidayRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get(RESOURCE);
      setHolidays(normalizeResourceRecords(response.data));
    } catch (error) {
      console.error("Failed to load holidays", error);
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (record: HolidayRecord) => {
    setEditing(record);
    setForm({
      title: record.data?.title || "",
      date: record.data?.date || "",
      description: record.data?.description || "",
      status: record.data?.status || "Active",
      type: record.data?.type || "Public Holiday",
      applies_to: record.data?.applies_to || "All Teams",
      location: record.data?.location || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const saveHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) {
      window.alert("Holiday title and date are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        data: {
          ...form,
          title: form.title.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
        },
      };
      if (editing) {
        await API.put(`${RESOURCE}${editing.id}/`, payload);
      } else {
        await API.post(RESOURCE, payload);
      }
      closeModal();
      setForm(emptyForm);
      loadHolidays();
    } catch (error) {
      console.error("Failed to save holiday", error);
      window.alert("Unable to save the holiday.");
    } finally {
      setSaving(false);
    }
  };

  const deleteHoliday = async (id: string) => {
    if (!window.confirm("Delete this holiday?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      loadHolidays();
    } catch (error) {
      console.error("Failed to delete holiday", error);
      window.alert("Unable to delete the holiday.");
    }
  };

  const filteredHolidays = useMemo(() => {
    return [...holidays]
      .filter((holiday) => {
        const matchesSearch = smartSearchMatch(holiday.data || {}, search);
        const matchesStatus = !statusFilter || holiday.data?.status === statusFilter;
        const matchesType = !typeFilter || holiday.data?.type === typeFilter;
        const matchesAppliesTo = !appliesToFilter || holiday.data?.applies_to === appliesToFilter;
        const matchesDate = isDateInRange(holiday.data?.date, dateFrom, dateTo);
        const matchesQuick =
          !quickFilter ||
          (quickFilter === "upcoming" && (() => {
            const distance = daysUntil(holiday.data?.date);
            return distance !== null && distance >= 0;
          })()) ||
          (quickFilter === "this-month" && (() => {
            if (!holiday.data?.date) return false;
            const date = new Date(holiday.data.date);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          })()) ||
          (quickFilter === "active" && holiday.data?.status === "Active");

        return matchesSearch && matchesStatus && matchesType && matchesAppliesTo && matchesDate && matchesQuick;
      })
      .sort((left, right) =>
        String(left.data?.date || "").localeCompare(String(right.data?.date || ""))
      );
  }, [appliesToFilter, dateFrom, dateTo, holidays, quickFilter, search, statusFilter, typeFilter]);

  const appliedFilters = activeFilterCount({
    search,
    statusFilter,
    typeFilter,
    appliesToFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const stats = useMemo(() => {
    const upcoming = filteredHolidays.filter((holiday) => {
      const distance = daysUntil(holiday.data?.date);
      return distance !== null && distance >= 0;
    });
    const thisMonth = filteredHolidays.filter((holiday) => {
      if (!holiday.data?.date) return false;
      const date = new Date(holiday.data.date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const active = filteredHolidays.filter((holiday) => holiday.data?.status === "Active").length;
    return [
      {
        label: "Holiday Calendar",
        value: filteredHolidays.length,
        meta: "Events across company and regional calendars",
      },
      {
        label: "Upcoming",
        value: upcoming.length,
        meta: "Future holidays still visible to planners",
      },
      {
        label: "This Month",
        value: thisMonth.length,
        meta: "Useful for staffing coverage reviews",
      },
      {
        label: "Active Rules",
        value: active,
        meta: "Inactive dates stay archived, not lost",
      },
    ];
  }, [filteredHolidays]);

  const highlightItems = useMemo(() => {
    return filteredHolidays
      .filter((holiday) => {
        const distance = daysUntil(holiday.data?.date);
        return distance !== null && distance >= 0;
      })
      .slice(0, 5)
      .map((holiday) => ({
        label: holiday.data?.title || "Holiday",
        meta: `${formatDisplayDate(holiday.data?.date)} • ${holiday.data?.applies_to || "All Teams"}`,
        value:
          daysUntil(holiday.data?.date) === 0
            ? "Today"
            : `${daysUntil(holiday.data?.date)} days`,
        tone: daysUntil(holiday.data?.date) === 0 ? "accent" : "info",
      }));
  }, [filteredHolidays]);

  const dateSpan =
    form.date && dayDifference(new Date().toISOString().slice(0, 10), form.date) !== null
      ? dayDifference(new Date().toISOString().slice(0, 10), form.date)
      : null;

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Holiday Planner"
          title="Holiday Calendar"
          subtitle="Plan company-wide and regional holidays with clearer visibility into coverage impact, event types, and upcoming observances."
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-circle-plus me-2" />
                Add Holiday
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-building-community" />
            Company, regional, and wellness holiday support
          </span>
          <span className="employee-chip">
            <i className="ti ti-sparkles" />
            Future event countdown built into the calendar view
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Holiday Register</h5>
                  <div className="payroll-table-subtitle">
                    Keep HR, operations, and managers aligned on business closures and optional observances.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder="Search title, description, audience"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="form-select"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    <option value="">All types</option>
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={appliesToFilter}
                    onChange={(event) => setAppliesToFilter(event.target.value)}
                  >
                    <option value="">All audiences</option>
                    {APPLIES_TO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
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
                        setAppliesToFilter("");
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
                    { key: "upcoming", label: "Upcoming" },
                    { key: "this-month", label: "This month" },
                    { key: "active", label: "Active" },
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
                        <th>Holiday</th>
                        <th>Date</th>
                        <th>Coverage</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="text-center py-5">
                            Loading holidays...
                          </td>
                        </tr>
                      ) : filteredHolidays.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <HrmEmptyState
                              icon="ti ti-calendar-event"
                              title="No holidays scheduled"
                              description="Add the next company or regional holiday to keep teams aligned and avoid scheduling collisions."
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredHolidays.map((holiday) => (
                          <tr key={holiday.id}>
                            <td>
                              <div className="payroll-avatar-block">
                                <span className="payroll-avatar-icon">
                                  <i className="ti ti-plane-arrival" />
                                </span>
                                <div>
                                  <div className="payroll-primary-text">{holiday.data?.title || "Holiday"}</div>
                                  <div className="payroll-secondary-text">
                                    {holiday.data?.type || "Public Holiday"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="payroll-primary-text">
                                {formatDisplayDate(holiday.data?.date)}
                              </div>
                              <div className="payroll-secondary-text">
                                {daysUntil(holiday.data?.date) === 0
                                  ? "Happening today"
                                  : daysUntil(holiday.data?.date) !== null
                                  ? `${daysUntil(holiday.data?.date)} days away`
                                  : "Date pending"}
                              </div>
                            </td>
                            <td>
                              <div className="payroll-primary-text">
                                {holiday.data?.applies_to || "All Teams"}
                              </div>
                              <div className="payroll-secondary-text">
                                {holiday.data?.location || "Location not specified"}
                              </div>
                            </td>
                            <td>
                              <span className={`payroll-badge ${toneClass(statusTone(holiday.data?.status))}`}>
                                {holiday.data?.status || "Inactive"}
                              </span>
                            </td>
                            <td className="payroll-secondary-text">
                              {holiday.data?.description || "No description added"}
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-light me-2"
                                onClick={() => openEdit(holiday)}
                              >
                                <i className="ti ti-edit" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => deleteHoliday(holiday.id)}
                              >
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

          <div className="col-xl-4">
            <div className="row g-4">
              <div className="col-12">
                <HrmSideList
                  title="Upcoming Observances"
                  items={highlightItems}
                  emptyLabel="Once future holidays are added, they will appear here with a countdown."
                />
              </div>
              <div className="col-12">
                <div className="card payroll-section-card h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">Why this helps</h5>
                    </div>
                    <div className="finance-stack-list">
                      <div className="finance-note-card">
                        <i className="ti ti-users-group" />
                        HR can separate company-wide closures from regional observances without losing visibility.
                      </div>
                      <div className="finance-note-card">
                        <i className="ti ti-calendar-search" />
                        Upcoming dates keep staffing and training schedules from colliding with holiday periods.
                      </div>
                      <div className="finance-note-card">
                        <i className="ti ti-map-pin" />
                        Location and applies-to metadata make it easier to manage hybrid or distributed teams.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? "Update Holiday" : "Add Holiday"}
        subtitle="Create a richer holiday entry with event type, team scope, and optional location notes."
        onClose={closeModal}
        onSubmit={saveHoliday}
        submitLabel={saving ? "Saving..." : editing ? "Save Holiday" : "Add Holiday"}
        summary={
          <div className="payroll-summary-list">
            <div className="payroll-summary-highlight mb-3">
              <small>{form.type || "Holiday Type"}</small>
              <h3>{form.title || "New Holiday"}</h3>
            </div>
            <div className="payroll-summary-row">
              <span>Date</span>
              <strong>{formatDisplayDate(form.date)}</strong>
            </div>
            <div className="payroll-summary-row">
              <span>Applies To</span>
              <strong>{form.applies_to || "All Teams"}</strong>
            </div>
            <div className="payroll-summary-row">
              <span>Status</span>
              <strong>{form.status}</strong>
            </div>
            <div className="payroll-summary-row">
              <span>Countdown</span>
              <strong>
                {dateSpan === null ? "-" : dateSpan === 0 ? "Today" : `${dateSpan} days`}
              </strong>
            </div>
          </div>
        }
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">Holiday Details</h5>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Holiday Title</label>
                <input
                  className="form-control"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Republic Day"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Holiday Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Holiday Type</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                >
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Applies To</label>
                <select
                  className="form-select"
                  value={form.applies_to}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, applies_to: event.target.value }))
                  }
                >
                  {APPLIES_TO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Location</label>
                <input
                  className="form-control"
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  placeholder="Head office / region"
                />
              </div>
              <div className="col-md-6">
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
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Add the purpose, observance notes, or staffing guidance."
                />
              </div>
            </div>
          </div>
        </div>
      </HrmModal>
    </div>
  );
};

export default Holidays;
