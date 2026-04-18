import React, { useCallback, useEffect, useMemo, useState } from "react";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import API from "../../api/axios";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  formatDisplayDate,
  isDateInRange,
  normalizeResourceRecords,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "./hrmShared";

const CatalogWorkspace = (props) => {
  const {
    resource,
    kicker,
    title,
    subtitle,
    buttonLabel,
    emptyIcon,
    emptyTitle,
    emptyDescription,
    initialForm,
    fields,
    columns,
    getStats = () => [],
    getHighlights = () => [],
    filterOptions = [],
    dateField = "",
    quickFilters = [],
    searchPlaceholder = "",
    prepareRecordForEdit = null,
    preparePayload = null,
  } = props;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState(
    filterOptions.reduce((accumulator, option) => ({ ...accumulator, [option.name]: "" }), {})
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get(resource);
      setRecords(normalizeResourceRecords(response.data));
    } catch (error) {
      console.error(`Failed to load ${title.toLowerCase()}`, error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [resource, title]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm(prepareRecordForEdit ? prepareRecordForEdit(record) : { ...initialForm, ...record.data });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = preparePayload ? preparePayload(form) : form;
      if (editing) {
        await API.put(`${resource}${editing.id}/`, { data });
      } else {
        await API.post(resource, { data });
      }
      closeModal();
      setForm(initialForm);
      loadData();
    } catch (error) {
      console.error(`Failed to save ${title.toLowerCase()} record`, error);
      window.alert(`Unable to save the ${title.toLowerCase()} record.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm(`Delete this ${title.toLowerCase()} record?`)) return;
    try {
      await API.delete(`${resource}${id}/`);
      loadData();
    } catch (error) {
      console.error(`Failed to delete ${title.toLowerCase()} record`, error);
      window.alert(`Unable to delete the ${title.toLowerCase()} record.`);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch = smartSearchMatch(record.data || {}, search, [
        record.created_at,
        record.updated_at,
      ]);
      const matchesFilters = filterOptions.every((option) => {
        const value = filters[option.name];
        if (!value) return true;
        return String(record.data?.[option.name] || "") === value;
      });
      const matchesDate = !dateField || isDateInRange(record.data?.[dateField], dateFrom, dateTo);
      const matchesQuick =
        !quickFilter || quickFilters.find((item) => item.key === quickFilter)?.predicate(record);
      return matchesSearch && matchesFilters && matchesDate && matchesQuick;
    });
  }, [dateField, dateFrom, dateTo, filterOptions, filters, quickFilter, quickFilters, records, search]);

  const appliedFilters = activeFilterCount({ search, ...filters, dateFrom, dateTo, quickFilter });

  const stats = getStats(filteredRecords);
  const highlights = getHighlights(filteredRecords);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-circle-plus me-2" />
                {buttonLabel}
              </button>
              <div className="head-icons">
                <CollapseHeader />
              </div>
            </>
          }
          stats={stats}
        />

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>{title} Register</h5>
                  <div className="payroll-table-subtitle">
                    Search, filter, and maintain structured records with a cleaner workspace.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder={searchPlaceholder || `Search ${title.toLowerCase()}`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {filterOptions.map((option) => (
                    <select
                      key={option.name}
                      className="form-select"
                      value={filters[option.name]}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, [option.name]: event.target.value }))
                      }
                    >
                      <option value="">{option.label}</option>
                      {option.options.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ))}
                  {dateField ? (
                    <>
                      <input type="date" className="form-control" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                      <input type="date" className="form-control" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    </>
                  ) : null}
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
                        setQuickFilter("");
                        setFilters(
                          filterOptions.reduce(
                            (accumulator, option) => ({ ...accumulator, [option.name]: "" }),
                            {}
                          )
                        );
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {quickFilters.length ? (
                  <div className="payroll-filter-actions mt-3">
                    {quickFilters.map((item) => (
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
                ) : null}
              </div>
              <div className="payroll-table-shell">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        {columns.map((column) => (
                          <th key={column.key} className={column.align === "end" ? "text-end" : ""}>
                            {column.label}
                          </th>
                        ))}
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={columns.length + 1} className="text-center py-5">
                            Loading {title.toLowerCase()}...
                          </td>
                        </tr>
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 1}>
                            <HrmEmptyState
                              icon={emptyIcon}
                              title={emptyTitle}
                              description={emptyDescription}
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record) => (
                          <tr key={record.id}>
                            {columns.map((column) => (
                              <td key={`${record.id}-${column.key}`} className={column.align === "end" ? "text-end" : ""}>
                                {column.render(record)}
                              </td>
                            ))}
                            <td className="text-end">
                              <button type="button" className="btn btn-sm btn-light me-2" onClick={() => openEdit(record)}>
                                <i className="ti ti-edit" />
                              </button>
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteRecord(record.id)}>
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
            <HrmSideList title="Highlights" items={highlights} emptyLabel="Highlights will appear once records are added." />
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? `Update ${title}` : buttonLabel}
        subtitle={`Manage ${title.toLowerCase()} records with a cleaner modal and contextual summary.`}
        onClose={closeModal}
        onSubmit={saveRecord}
        submitLabel={saving ? "Saving..." : editing ? "Save Changes" : buttonLabel}
        summary={
          <div className="payroll-summary-list">
            {fields.slice(0, 4).map((field) => (
              <div key={field.name} className="payroll-summary-row">
                <span>{field.label}</span>
                <strong>
                  {field.type === "date"
                    ? formatDisplayDate(form[field.name])
                    : field.type === "select" && field.name.toLowerCase().includes("status")
                    ? form[field.name] || "-"
                    : String(form[field.name] || "-")}
                </strong>
              </div>
            ))}
          </div>
        }
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">{title} Details</h5>
            </div>
            <div className="row g-3">
              {fields.map((field) => (
                <div key={field.name} className={field.colClass || "col-md-6"}>
                  <label className="form-label">{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      className="form-control"
                      rows={field.rows || 4}
                      value={form[field.name] || ""}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" ? (
                    <select
                      className="form-select"
                      value={form[field.name] || ""}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                    >
                      {field.options.map((option) => (
                        <option key={option.value || option} value={option.value || option}>
                          {option.label || option}
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

export const renderStatusBadge = (value) => (
  <span className={`payroll-badge ${toneClass(statusTone(value))}`}>{value || "Draft"}</span>
);

export const renderDateCell = (value, meta) => (
  <div>
    <div className="payroll-primary-text">{formatDisplayDate(value)}</div>
    {meta ? <div className="payroll-secondary-text">{meta}</div> : null}
  </div>
);

export default CatalogWorkspace;
