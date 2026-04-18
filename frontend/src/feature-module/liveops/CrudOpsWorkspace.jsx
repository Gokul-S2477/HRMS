import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  formatDisplayDate,
  isDateInRange,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "../hrm/hrmShared";

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const getValue = (input, accessor) => {
  if (!accessor) return input;
  return String(accessor)
    .split(".")
    .reduce((current, key) => (current == null ? undefined : current[key]), input);
};

const defaultSummary = (fields, form, deps) => (
  <div className="payroll-summary-list">
    {fields.map((field) => {
      const value = form[field.name];
      let displayValue = value;
      if (field.type === "select") {
        const options = typeof field.options === "function" ? field.options(deps) : field.options || deps?.[field.optionsKey] || [];
        displayValue = options.find((option) => String(option.value) === String(value))?.label || value || "-";
      }
      return (
        <div className="payroll-summary-row" key={field.name}>
          <span>{field.label}</span>
          <strong>{displayValue || "-"}</strong>
        </div>
      );
    })}
  </div>
);

const CrudOpsWorkspace = ({
  endpoint,
  title,
  subtitle,
  kicker,
  buttonLabel,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  fields,
  filters = [],
  columns,
  defaultForm,
  statsBuilder,
  highlightsBuilder = null,
  modalSubtitle = "",
  loadDependencies = null,
  buildPayload = null,
  normalizeForm = null,
  canDelete = true,
  allowCreate = true,
  allowEdit = true,
  extraRowActions = null,
  variant = "table",
  summaryBuilder = null,
}) => {
  const [records, setRecords] = useState([]);
  const [dependencies, setDependencies] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterState, setFilterState] = useState(
    filters.reduce((acc, item) => ({ ...acc, [item.name]: item.defaultValue || "" }), {})
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks = [API.get(endpoint)];
      if (loadDependencies) {
        tasks.push(loadDependencies());
      }
      const [recordResponse, extraDependencies] = await Promise.all(tasks);
      setRecords(normalizeList(recordResponse.data));
      setDependencies(extraDependencies || {});
    } catch (error) {
      console.error(`Failed to load ${title.toLowerCase()}`, error);
      setRecords([]);
      setDependencies({});
    } finally {
      setLoading(false);
    }
  }, [endpoint, loadDependencies, title]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm(normalizeForm ? normalizeForm(record, dependencies) : { ...defaultForm, ...record });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload ? buildPayload(form, dependencies, editing) : form;
      if (editing) {
        await API.put(`${endpoint}${editing.id}/`, payload);
      } else {
        await API.post(endpoint, payload);
      }
      closeModal();
      load();
    } catch (error) {
      console.error(`Failed to save ${title.toLowerCase()}`, error);
      window.alert(error?.response?.data?.detail || `Unable to save ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm(`Delete this ${title.toLowerCase()} record?`)) return;
    try {
      await API.delete(`${endpoint}${id}/`);
      load();
    } catch (error) {
      console.error(`Failed to delete ${title.toLowerCase()}`, error);
      window.alert(`Unable to delete this ${title.toLowerCase()} record.`);
    }
  };

  const hasAnyActions = Boolean(extraRowActions || allowEdit || canDelete);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (!smartSearchMatch(record, search)) return false;
      if (!isDateInRange(getValue(record, "created_at") || getValue(record, "work_date") || getValue(record, "posted_on") || getValue(record, "referred_on"), dateFrom, dateTo)) {
        if (dateFrom || dateTo) {
          const alternateDates = ["updated_at", "applied_on", "assigned_on", "due_return_on"];
          const matchedAlternate = alternateDates.some((accessor) => isDateInRange(getValue(record, accessor), dateFrom, dateTo));
          if (!matchedAlternate) return false;
        }
      }
      return filters.every((filter) => {
        const currentValue = filterState[filter.name];
        if (!currentValue) return true;
        return String(getValue(record, filter.accessor || filter.name) || "") === String(currentValue);
      });
    });
  }, [dateFrom, dateTo, filterState, filters, records, search]);

  const stats = useMemo(
    () => (statsBuilder ? statsBuilder(filteredRecords, dependencies) : [{ label: "Records", value: filteredRecords.length, meta: "Active records" }]),
    [dependencies, filteredRecords, statsBuilder]
  );

  const highlights = useMemo(
    () =>
      highlightsBuilder
        ? highlightsBuilder(filteredRecords, dependencies)
        : filteredRecords.slice(0, 5).map((item) => ({
            label: item.name || item.title || item.asset_name || item.candidate_name || "Record",
            meta: item.status || item.department_name || item.category?.name || formatDisplayDate(item.created_at),
            value: item.stage || item.status || item.asset_code || item.openings || "-",
            tone: statusTone(item.status || item.stage),
          })),
    [dependencies, filteredRecords, highlightsBuilder]
  );

  const appliedFilters = activeFilterCount({ search, dateFrom, dateTo, ...filterState });

  const renderField = (field) => {
    const options = typeof field.options === "function" ? field.options(dependencies) : field.options || dependencies?.[field.optionsKey] || [];
    const commonProps = {
      className: "form-control",
      value: form[field.name] ?? "",
      onChange: (event) => setForm((current) => ({ ...current, [field.name]: event.target.value })),
      required: Boolean(field.required),
      placeholder: field.placeholder || "",
    };

    if (field.type === "textarea") {
      return <textarea {...commonProps} rows={field.rows || 4} />;
    }

    if (field.type === "select") {
      return (
        <select className="form-select" value={form[field.name] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} required={Boolean(field.required)}>
          <option value="">{field.placeholder || `Select ${field.label}`}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return <input {...commonProps} type={field.type || "text"} step={field.step} min={field.min} max={field.max} />;
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          action={
            <>
{allowCreate ? (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-circle-plus me-2" />
                {buttonLabel}
              </button>
              ) : null}
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-sparkles" />
            Smart search, live filters, and cleaner operational actions
          </span>
          <span className="employee-chip">
            <i className="ti ti-shield-check" />
            Role-aware backend endpoints keep data access scoped correctly
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>{title} Workspace</h5>
                  <div className="payroll-table-subtitle">{subtitle}</div>
                </div>
                <div className="payroll-table-controls">
                  <input className="form-control" style={{ minWidth: 240 }} placeholder={searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
                  {filters.map((filter) => {
                    const options = typeof filter.options === "function" ? filter.options(dependencies) : filter.options || dependencies?.[filter.optionsKey] || [];
                    return (
                      <select key={filter.name} className="form-select" value={filterState[filter.name] || ""} onChange={(event) => setFilterState((current) => ({ ...current, [filter.name]: event.target.value }))}>
                        <option value="">{filter.placeholder || `All ${filter.label}`}</option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    );
                  })}
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
                        setDateFrom("");
                        setDateTo("");
                        setFilterState(filters.reduce((acc, item) => ({ ...acc, [item.name]: item.defaultValue || "" }), {}));
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <div className="card-body">
                {loading ? (
                  <div className="text-center py-5 text-muted">Loading {title.toLowerCase()}...</div>
                ) : filteredRecords.length === 0 ? (
                  <HrmEmptyState title={emptyTitle} description={emptyDescription} />
                ) : variant === "cards" ? (
                  <div className="row g-3">
                    {filteredRecords.map((record) => (
                      <div className="col-md-6" key={record.id}>
                        <div className="card payroll-section-card h-100">
                          <div className="card-body d-flex flex-column gap-3">
                            <div className="d-flex justify-content-between gap-3">
                              <div>
                                <h6 className="mb-1">{record.title || record.name || record.asset_name || record.candidate_name || record.first_name}</h6>
                                <div className="text-muted small">{record.department_name || record.location || record.referrer_name || record.asset_code || record.email || "Operational record"}</div>
                              </div>
                              {record.status || record.stage ? <span className={`payroll-badge ${toneClass(statusTone(record.status || record.stage))}`}>{record.status || record.stage}</span> : null}
                            </div>
                            <div className="payroll-summary-list">
                              {columns.slice(0, 4).map((column) => (
                                <div className="payroll-summary-row" key={column.label}>
                                  <span>{column.label}</span>
                                  <strong>{column.text ? column.text(record, dependencies) : "-"}</strong>
                                </div>
                              ))}
                            </div>
                            <div className="d-flex gap-2 mt-auto">
{extraRowActions ? extraRowActions(record, { refresh: load, dependencies }) : null}
                              {allowEdit ? <button type="button" className="btn btn-light w-100" onClick={() => openEdit(record)}>Edit</button> : null}
                              {canDelete ? <button type="button" className="btn btn-outline-danger w-100" onClick={() => deleteRecord(record.id)}>Delete</button> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          {columns.map((column) => (
                            <th key={column.label}>{column.label}</th>
                          ))}
{hasAnyActions ? <th className="text-end">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => (
                          <tr key={record.id}>
                            {columns.map((column) => (
                              <td key={column.label}>{column.render(record, dependencies)}</td>
                            ))}
{hasAnyActions ? (
                            <td>
                              <div className="d-flex justify-content-end gap-2 flex-wrap">
                                {extraRowActions ? extraRowActions(record, { refresh: load, dependencies }) : null}
                                {allowEdit ? <button type="button" className="btn btn-sm btn-light" onClick={() => openEdit(record)}>Edit</button> : null}
                                {canDelete ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteRecord(record.id)}>Delete</button> : null}
                              </div>
                            </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <HrmSideList title="Live Highlights" items={highlights} emptyLabel="No highlights yet." />
          </div>
        </div>

        <HrmModal
          open={showModal}
          title={editing ? `Edit ${title}` : `Add ${title}`}
          subtitle={modalSubtitle || `Manage ${title.toLowerCase()} from the live operations desk.`}
          summary={summaryBuilder ? summaryBuilder(fields, form, dependencies) : defaultSummary(fields, form, dependencies)}
          onClose={closeModal}
          onSubmit={saveRecord}
          submitLabel={saving ? "Saving..." : editing ? "Save Changes" : buttonLabel}
        >
          <div className="card payroll-section-card">
            <div className="card-body">
              <div className="row g-3">
                {fields.map((field) => (
                  <div className={field.colClass || "col-md-6"} key={field.name}>
                    <label className="form-label">{field.label}</label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </HrmModal>
      </div>
    </div>
  );
};

export default CrudOpsWorkspace;
