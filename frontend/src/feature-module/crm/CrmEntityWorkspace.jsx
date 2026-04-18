import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  matchesAnyDateRange,
  normalizeResourceRecords,
  smartSearchMatch,
  statusTone,
  toneClass,
} from "../hrm/hrmShared";
import { CRM_ENTITY_CONFIGS } from "./crmConfigs";

const CrmEntityWorkspace = ({ entityKey, variant = "grid" }) => {
  const config = CRM_ENTITY_CONFIGS[entityKey];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [secondaryFilter, setSecondaryFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(config.initialForm);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get(config.resource);
      setRecords(normalizeResourceRecords(response.data));
    } catch (error) {
      console.error(`Failed to load ${config.plural.toLowerCase()}`, error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [config.plural, config.resource]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const openCreate = () => {
    setEditing(null);
    setForm(config.initialForm);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({ ...config.initialForm, ...(record.data || {}) });
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
      const payload = Object.entries(form).reduce(
        (accumulator, [key, value]) => ({
          ...accumulator,
          [key]: typeof value === "string" ? value.trim() : value,
        }),
        {}
      );
      if (editing) {
        await API.put(`${config.resource}${editing.id}/`, { data: payload });
      } else {
        await API.post(config.resource, { data: payload });
      }
      closeModal();
      setForm(config.initialForm);
      loadRecords();
    } catch (error) {
      console.error(`Failed to save ${config.singular.toLowerCase()}`, error);
      window.alert(`Unable to save the ${config.singular.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    try {
      await API.delete(`${config.resource}${id}/`);
      loadRecords();
    } catch (error) {
      console.error(`Failed to delete ${config.singular.toLowerCase()}`, error);
      window.alert(`Unable to delete the ${config.singular.toLowerCase()}.`);
    }
  };

  const extraAction = async (record) => {
    if (entityKey !== "lead") return;
    try {
      await API.post(CRM_ENTITY_CONFIGS.deal.resource, {
        data: {
          deal_name: `${record.data?.company_name || record.data?.lead_name || "New"} Opportunity`,
          company_name: record.data?.company_name || "",
          contact_name: record.data?.lead_name || "",
          value: record.data?.expected_value || "",
          stage: "Qualified",
          probability: "45",
          owner: record.data?.owner || "",
          expected_close_date: record.data?.next_follow_up || "",
          status: "Open",
          source: record.data?.source || "Outbound",
          next_step: "Discovery call",
          notes: `Converted from lead ${record.data?.lead_name || ""}`,
        },
      });
      await API.put(`${config.resource}${record.id}/`, {
        data: {
          ...(record.data || {}),
          status: "Converted",
          stage: "Converted",
        },
      });
      loadRecords();
      window.alert("Lead converted into a deal.");
    } catch (error) {
      console.error("Failed to convert lead", error);
      window.alert("Unable to convert the lead right now.");
    }
  };

  const quickDealStatus = async (record, nextStatus) => {
    try {
      await API.put(`${config.resource}${record.id}/`, {
        data: {
          ...(record.data || {}),
          status: nextStatus,
          stage: nextStatus === "Won" ? "Won" : nextStatus === "Lost" ? "Lost" : record.data?.stage,
        },
      });
      loadRecords();
    } catch (error) {
      console.error("Failed to update deal status", error);
      window.alert("Unable to update the deal status.");
    }
  };

  const ownerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.data?.[config.ownerField])
            .filter(Boolean)
        )
      ).sort((left, right) => String(left).localeCompare(String(right))),
    [config.ownerField, records]
  );

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        const matchesSearch = smartSearchMatch(record.data || {}, search, [
          record.created_at,
          record.updated_at,
        ]);
        const matchesStatus = !statusFilter || record.data?.status === statusFilter;
        const matchesSecondary = !secondaryFilter || record.data?.[config.filterField.name] === secondaryFilter;
        const matchesOwner = !ownerFilter || record.data?.[config.ownerField] === ownerFilter;
        const dateCandidates = (config.dateFields || []).map((field) =>
          field === "created_at" || field === "updated_at" ? record[field] : record.data?.[field]
        );
        const matchesDate = matchesAnyDateRange(dateCandidates, dateFrom, dateTo);
        const matchesQuick =
          !quickFilter ||
          config.quickFilters?.find((item) => item.key === quickFilter)?.predicate(record);
        return (
          matchesSearch &&
          matchesStatus &&
          matchesSecondary &&
          matchesOwner &&
          matchesDate &&
          matchesQuick
        );
      })
      .sort((left, right) =>
        String(right.updated_at || right.created_at || "").localeCompare(
          String(left.updated_at || left.created_at || "")
        )
      );
  }, [
    config.dateFields,
    config.filterField.name,
    config.ownerField,
    config.quickFilters,
    dateFrom,
    dateTo,
    ownerFilter,
    quickFilter,
    records,
    search,
    secondaryFilter,
    statusFilter,
  ]);

  const appliedFilters = activeFilterCount({
    search,
    statusFilter,
    secondaryFilter,
    ownerFilter,
    dateFrom,
    dateTo,
    quickFilter,
  });

  const stats = useMemo(() => config.stats(filteredRecords), [config, filteredRecords]);
  const highlights = useMemo(
    () =>
      filteredRecords.slice(0, 5).map((record) => ({
        label: record.data?.[config.summaryFields[0]] || config.singular,
        meta: record.data?.[config.summaryFields[1]] || "Details pending",
        value: record.data?.status || "Draft",
        tone: statusTone(record.data?.status),
      })),
    [config, filteredRecords]
  );

  const summaryContent = (
    <div className="payroll-summary-list">
      {config.summaryFields.map((field) => (
        <div key={field} className="payroll-summary-row">
          <span>{field.replace(/_/g, " ")}</span>
          <strong>{form[field] || "-"}</strong>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell crm-shell">
        <HrmHero
          kicker={config.kicker}
          title={`${config.plural} ${variant === "grid" ? "Grid" : "List"}`}
          subtitle={config.subtitle}
          action={
            <>
              <div className="d-flex gap-2 flex-wrap">
                <Link
                  to={config.listRoute}
                  className={`btn ${variant === "list" ? "btn-primary" : "btn-white"}`}
                >
                  <i className="ti ti-list-details me-2" />
                  List
                </Link>
                <Link
                  to={config.gridRoute}
                  className={`btn ${variant === "grid" ? "btn-primary" : "btn-white"}`}
                >
                  <i className="ti ti-layout-grid me-2" />
                  Grid
                </Link>
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <i className="ti ti-circle-plus me-2" />
                  {config.buttonLabel}
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
            <i className="ti ti-filter-search" />
            Search, stage, and source filters built in
          </span>
          <span className="employee-chip">
            <i className="ti ti-route-square-2" />
            Detail views keep related activity context close
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>{config.plural} Workspace</h5>
                  <div className="payroll-table-subtitle">
                    Built to support quicker navigation from high-level lists into relationship details.
                  </div>
                </div>
                <div className="payroll-table-controls">
                  <input
                    className="form-control"
                    style={{ minWidth: 220 }}
                    placeholder={config.searchPlaceholder || `Search ${config.plural.toLowerCase()}`}
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
                    value={secondaryFilter}
                    onChange={(event) => setSecondaryFilter(event.target.value)}
                  >
                    <option value="">{config.filterField.label}</option>
                    {config.filterField.options.map((option) => (
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
                    {config.statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
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
                        setStatusFilter("");
                        setSecondaryFilter("");
                        setOwnerFilter("");
                        setDateFrom("");
                        setDateTo("");
                        setQuickFilter("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {config.quickFilters?.length ? (
                  <div className="payroll-filter-actions mt-3">
                    {config.quickFilters.map((item) => (
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
                ) : null}
              </div>
              {variant === "list" ? (
                <div className="payroll-table-shell">
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          {config.columns.map((column) => (
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
                            <td colSpan={config.columns.length + 1} className="text-center py-5">
                              Loading {config.plural.toLowerCase()}...
                            </td>
                          </tr>
                        ) : filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan={config.columns.length + 1}>
                              <HrmEmptyState
                                icon={config.emptyIcon}
                                title={config.emptyTitle}
                                description={config.emptyDescription}
                              />
                            </td>
                          </tr>
                        ) : (
                          filteredRecords.map((record) => (
                            <tr key={record.id}>
                              {config.columns.map((column) => (
                                <td key={`${record.id}-${column.key}`} className={column.align === "end" ? "text-end" : ""}>
                                  {column.render(record)}
                                </td>
                              ))}
                              <td className="text-end">
                                <Link
                                  to={`${config.detailsRoute}?id=${record.id}`}
                                  className="btn btn-sm btn-white me-2"
                                >
                                  <i className="ti ti-eye" />
                                </Link>
                                <button type="button" className="btn btn-sm btn-light me-2" onClick={() => openEdit(record)}>
                                  <i className="ti ti-edit" />
                                </button>
                                {entityKey === "lead" ? (
                                  <button type="button" className="btn btn-sm btn-primary me-2" onClick={() => extraAction(record)}>
                                    <i className="ti ti-arrows-transfer-up" />
                                  </button>
                                ) : null}
                                {entityKey === "deal" && record.data?.status === "Open" ? (
                                  <>
                                    <button type="button" className="btn btn-sm btn-success me-2" onClick={() => quickDealStatus(record, "Won")}>
                                      <i className="ti ti-check" />
                                    </button>
                                    <button type="button" className="btn btn-sm btn-warning me-2" onClick={() => quickDealStatus(record, "Lost")}>
                                      <i className="ti ti-x" />
                                    </button>
                                  </>
                                ) : null}
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
              ) : (
                <div className="card-body">
                  {loading ? (
                    <div className="py-5 text-center">Loading {config.plural.toLowerCase()}...</div>
                  ) : filteredRecords.length === 0 ? (
                    <HrmEmptyState
                      icon={config.emptyIcon}
                      title={config.emptyTitle}
                      description={config.emptyDescription}
                    />
                  ) : (
                    <div className="employee-card-grid">
                      {filteredRecords.map((record) => (
                        <div key={record.id} className="card employee-directory-card crm-entity-card">
                          <div className="card-body">
                            <div className="d-flex justify-content-between gap-3 mb-3">
                              <div className="flex-grow-1">
                                <div className="payroll-primary-text fs-5">
                                  {record.data?.[config.summaryFields[0]] || config.singular}
                                </div>
                                <div className="payroll-secondary-text">
                                  {record.data?.[config.summaryFields[1]] || "Details pending"}
                                </div>
                              </div>
                              <span className={`payroll-badge ${toneClass(statusTone(record.data?.status))}`}>
                                {record.data?.status || "Draft"}
                              </span>
                            </div>
                            <div className="crm-meta-grid mb-3">
                              {config.cardMeta(record).map((item) => (
                                <div key={item.label} className="crm-meta-card">
                                  <span>{item.label}</span>
                                  <strong>{item.value}</strong>
                                </div>
                              ))}
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                              <Link to={`${config.detailsRoute}?id=${record.id}`} className="btn btn-white">
                                <i className="ti ti-eye me-2" />
                                View
                              </Link>
                              <button type="button" className="btn btn-light" onClick={() => openEdit(record)}>
                                <i className="ti ti-edit me-2" />
                                Edit
                              </button>
                              {entityKey === "lead" ? (
                                <button type="button" className="btn btn-primary" onClick={() => extraAction(record)}>
                                  Convert
                                </button>
                              ) : null}
                              {entityKey === "deal" && record.data?.status === "Open" ? (
                                <button type="button" className="btn btn-success" onClick={() => quickDealStatus(record, "Won")}>
                                  Mark Won
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="col-xl-4">
            <HrmSideList
              title="Highlights"
              items={highlights}
              emptyLabel={`Once ${config.plural.toLowerCase()} are added, highlights will appear here.`}
            />
          </div>
        </div>
      </div>

      <HrmModal
        open={showModal}
        title={editing ? `Update ${config.singular}` : config.buttonLabel}
        subtitle={`Capture ${config.singular.toLowerCase()} details with a stronger CRM workflow and cleaner context.`}
        onClose={closeModal}
        onSubmit={saveRecord}
        submitLabel={saving ? "Saving..." : editing ? "Save Changes" : config.buttonLabel}
        summary={summaryContent}
      >
        <div className="card payroll-section-card">
          <div className="card-body">
            <div className="payroll-section-header">
              <h5 className="payroll-section-title">{config.singular} Details</h5>
            </div>
            <div className="row g-3">
              {config.fields.map((field) => (
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
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
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

export default CrmEntityWorkspace;
