import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";

const normalize = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const toNumber = (value) => {
  const num = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const formatAmount = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_TONE_MAP = {
  draft: "",
  sent: "accent",
  accepted: "success",
  converted: "info",
  expired: "danger",
  paid: "success",
  "partially paid": "warning",
  overdue: "danger",
  completed: "success",
  pending: "warning",
  failed: "danger",
  refunded: "accent",
  approved: "success",
  review: "info",
  planned: "accent",
  "at risk": "warning",
  received: "success",
  forecast: "info",
  cancelled: "danger",
  rejected: "danger",
  filed: "info",
  hold: "warning",
  active: "success",
  archived: "",
};

const getStatusTone = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return STATUS_TONE_MAP[key] || "";
};

const SalesWorkspace = ({ config }) => {
  const navigate = useNavigate();
  const routes = all_routes;
  const endpoint = `/data/${config.resourceType}/`;

  const fields = useMemo(() => config.fields || [], [config.fields]);
  const searchFields = useMemo(() => config.searchFields || [], [config.searchFields]);
  const amountField = config.amountField;
  const statusField = config.statusField || "status";
  const statusOptions = config.statusOptions || [];
  const codeField = config.codeField;
  const codePrefix = config.codePrefix || config.resourceType.slice(0, 3).toUpperCase();

  const [records, setRecords] = useState([]);
  const [dependencies, setDependencies] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const createCode = useCallback(
    (prefixOverride) => {
      const prefix = prefixOverride || codePrefix;
      const base = String(records.length + 1).padStart(3, "0");
      const suffix = String(Date.now()).slice(-4);
      return `${prefix}-${base}${suffix}`;
    },
    [codePrefix, records.length]
  );

  const buildFormState = useCallback(
    (seed = {}) => {
      const nextState = {};
      fields.forEach((field) => {
        let value = seed[field.name];
        if (value === undefined || value === null) value = field.defaultValue ?? "";
        if (field.type === "number" && value !== "" && value !== null && value !== undefined) {
          value = String(value);
        }
        nextState[field.name] = value;
      });
      if (codeField && !nextState[codeField]) {
        nextState[codeField] = createCode();
      }
      return nextState;
    },
    [codeField, createCode, fields]
  );

  const [form, setForm] = useState(() =>
    buildFormState(typeof config.initialData === "function" ? config.initialData({ createCode }) : {})
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(endpoint);
      setRecords(normalize(res.data));

      if (typeof config.loadDependencies === "function") {
        try {
          const loadedDependencies = await config.loadDependencies({
            api: API,
            routes,
            navigate,
            endpoint,
            normalize,
            toNumber,
            formatAmount,
            formatDate,
            getStatusTone,
            createCode,
            resourceType: config.resourceType,
            title: config.title,
          });
          setDependencies(loadedDependencies || {});
        } catch (dependencyError) {
          console.error(`Failed to load ${config.resourceType} dependencies`, dependencyError);
          setDependencies({});
        }
      } else {
        setDependencies({});
      }
    } catch (error) {
      console.error(`Failed to load ${config.resourceType}`, error);
      setRecords([]);
      setDependencies({});
      toast.error(`Failed to load ${config.title}`);
    } finally {
      setLoading(false);
    }
  }, [config, createCode, endpoint, navigate, routes]);

  const helpers = useMemo(
    () => ({
      api: API,
      routes,
      navigate,
      endpoint,
      normalize,
      toNumber,
      formatAmount,
      formatDate,
      getStatusTone,
      createCode,
      reload: loadRecords,
      resourceType: config.resourceType,
      title: config.title,
      dependencies,
    }),
    [config.resourceType, config.title, createCode, dependencies, endpoint, loadRecords, navigate, routes]
  );

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    let list = [...records];

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((record) => {
        const data = record.data || {};
        return searchFields
          .map((field) => data[field])
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
    }

    if (statusFilter) {
      list = list.filter(
        (record) => String(record.data?.[statusField] || "") === statusFilter
      );
    }

    const defaultNameField = searchFields[0] || codeField || "created_at";

    if (sortBy === "amount-high" && amountField) {
      list.sort((a, b) => toNumber(b.data?.[amountField]) - toNumber(a.data?.[amountField]));
    } else if (sortBy === "amount-low" && amountField) {
      list.sort((a, b) => toNumber(a.data?.[amountField]) - toNumber(b.data?.[amountField]));
    } else if (sortBy === "name-asc") {
      list.sort((a, b) =>
        String(a.data?.[defaultNameField] || "").localeCompare(String(b.data?.[defaultNameField] || ""))
      );
    } else if (sortBy === "name-desc") {
      list.sort((a, b) =>
        String(b.data?.[defaultNameField] || "").localeCompare(String(a.data?.[defaultNameField] || ""))
      );
    } else if (sortBy === "oldest") {
      list.sort(
        (a, b) =>
          new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0)
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
      );
    }

    return list;
  }, [amountField, codeField, records, search, searchFields, sortBy, statusField, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summaryCards = useMemo(() => {
    if (typeof config.getSummaryCards === "function") {
      return config.getSummaryCards(records, filtered, helpers);
    }
    return [
      {
        label: "Total Records",
        value: records.length,
        meta: `${filtered.length} visible after filters`,
      },
    ];
  }, [config, filtered, helpers, records]);

  const modalPreview = useMemo(() => {
    if (typeof config.getPreview === "function") {
      return config.getPreview(form, helpers);
    }

    const rows = fields.slice(0, 4).map((field) => ({
      label: field.label,
      value: form[field.name] || "-",
    }));

    return {
      highlightLabel: amountField ? "Amount" : "Reference",
      highlightValue: amountField ? formatAmount(form[amountField]) : form[codeField] || "-",
      rows,
      note: config.previewNote || "Review the record before saving changes.",
    };
  }, [amountField, codeField, config, fields, form, helpers]);

  const resetForm = useCallback(() => {
    const initialSeed = typeof config.initialData === "function" ? config.initialData({ createCode }) : {};
    setForm(buildFormState(initialSeed));
  }, [buildFormState, config, createCode]);

  const openAdd = () => {
    resetForm();
    setEditing(null);
    setShowEdit(false);
    setShowAdd(true);
  };

  const openEdit = (record) => {
    setForm(buildFormState(record.data || {}));
    setEditing(record);
    setShowAdd(false);
    setShowEdit(true);
  };

  const closeModal = () => {
    setShowAdd(false);
    setShowEdit(false);
    setEditing(null);
  };

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildPayload = useCallback(
    (mode) => {
      let payload = {};
      fields.forEach((field) => {
        const rawValue = form[field.name];
        if (field.type === "number") {
          payload[field.name] = rawValue === "" ? (field.allowBlank ? "" : 0) : toNumber(rawValue);
        } else {
          payload[field.name] = rawValue;
        }
      });

      if (codeField && !payload[codeField]) {
        payload[codeField] = createCode();
      }

      if (typeof config.preparePayload === "function") {
        payload = config.preparePayload({ payload, form, mode, editing, helpers });
      }

      return payload;
    },
    [codeField, config, createCode, editing, fields, form, helpers]
  );

  const handleAdd = async (event) => {
    event.preventDefault();
    try {
      const payload = buildPayload("create");
      await API.post(endpoint, { data: payload });
      if (typeof config.afterSave === "function") {
        await config.afterSave({ mode: "create", payload, record: null, helpers });
      }
      toast.success(`${config.title} created successfully`);
      closeModal();
      resetForm();
      loadRecords();
    } catch (error) {
      console.error(`Failed to create ${config.resourceType}`, error);
      toast.error(`Failed to create ${config.title}`);
    }
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    try {
      const payload = buildPayload("edit");
      await API.put(`${endpoint}${editing.id}/`, { data: payload });
      if (typeof config.afterSave === "function") {
        await config.afterSave({ mode: "edit", payload, record: editing, helpers });
      }
      toast.success(`${config.title} updated successfully`);
      closeModal();
      resetForm();
      loadRecords();
    } catch (error) {
      console.error(`Failed to update ${config.resourceType}`, error);
      toast.error(`Failed to update ${config.title}`);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete this ${config.title.toLowerCase()} record?`)) return;
    try {
      await API.delete(`${endpoint}${record.id}/`);
      if (typeof config.afterDelete === "function") {
        await config.afterDelete({ record, helpers });
      }
      toast.success(`${config.title} deleted successfully`);
      loadRecords();
    } catch (error) {
      console.error(`Failed to delete ${config.resourceType}`, error);
      toast.error(`Failed to delete ${config.title}`);
    }
  };

  const handleDuplicate = async (record) => {
    try {
      let payload = JSON.parse(JSON.stringify(record.data || {}));
      if (codeField) {
        payload[codeField] = createCode();
      }
      if (statusField && config.duplicateStatus) {
        payload[statusField] = config.duplicateStatus;
      }
      if (typeof config.transformDuplicate === "function") {
        payload = config.transformDuplicate({ payload, record, helpers });
      }
      await API.post(endpoint, { data: payload });
      toast.success(`${config.title} duplicated successfully`);
      loadRecords();
    } catch (error) {
      console.error(`Failed to duplicate ${config.resourceType}`, error);
      toast.error(`Failed to duplicate ${config.title}`);
    }
  };

  const runCustomAction = async (action, record) => {
    if (action.confirmation && !window.confirm(action.confirmation)) return;
    try {
      await action.onClick(record, helpers);
      if (action.successMessage) {
        toast.success(action.successMessage);
      }
      loadRecords();
    } catch (error) {
      console.error(`Failed to execute ${action.label}`, error);
      toast.error(action.errorMessage || `Failed to ${action.label.toLowerCase()}`);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">{config.rootLabel || "Finance & Accounts"}</li>
                <li className="breadcrumb-item">{config.moduleLabel || "Sales"}</li>
                <li className="breadcrumb-item active">{config.title}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className={config.kickerIcon || "ti ti-chart-arcs"} /> {config.kicker || "Sales Workspace"}
                </span>
                <h1 className="payroll-title">{config.title}</h1>
                <p className="payroll-subtitle">{config.subtitle}</p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button">
                    <i className="ti ti-file-export me-1" /> Export
                  </button>
                  <button className="btn btn-primary" type="button" onClick={openAdd}>
                    <i className="ti ti-plus me-1" /> {config.primaryActionLabel || `Add ${config.title}`}
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="payroll-stat-grid"
              style={{ gridTemplateColumns: `repeat(${Math.max(summaryCards.length, 1)}, minmax(0, 1fr))` }}
            >
              {summaryCards.map((card) => (
                <div className="card payroll-stat-card" key={card.label}>
                  <div className="card-body">
                    <span className="payroll-stat-label">{card.label}</span>
                    <h3 className="payroll-stat-value">{card.value}</h3>
                    <div className="payroll-stat-meta">{card.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card payroll-panel mb-4">
          <div className="card-body">
            <div className="payroll-toolbar">
              <div>
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Search ${config.title.toLowerCase()}`}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All status</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Sort Order</label>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="recent">Most Recent</option>
                  <option value="oldest">Oldest</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  {amountField ? <option value="amount-high">Amount High-Low</option> : null}
                  {amountField ? <option value="amount-low">Amount Low-High</option> : null}
                </select>
              </div>
              <div>
                <label className="form-label">Rows Per Page</label>
                <select
                  className="form-select"
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[5, 10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} rows
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>{config.tableTitle || `${config.title} Register`}</h5>
              <div className="payroll-table-subtitle">
                {config.tableSubtitle || `${filtered.length} records available for review.`}
              </div>
            </div>
            <div className="payroll-table-controls">
              <span className="payroll-kpi-pill">
                <i className="ti ti-list-details" /> {filtered.length} filtered records
              </span>
              {amountField ? (
                <span className="payroll-kpi-pill">
                  <i className="ti ti-cash" />
                  {formatAmount(filtered.reduce((sum, record) => sum + toNumber(record.data?.[amountField]), 0))}
                </span>
              ) : null}
            </div>
          </div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover table-center mb-0">
                <thead>
                  <tr>
                    {config.columns.map((column) => (
                      <th key={column.label} className={column.headerClassName || ""}>
                        {column.label}
                      </th>
                    ))}
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={config.columns.length + 1} className="text-center py-5">
                        Loading {config.title.toLowerCase()}...
                      </td>
                    </tr>
                  )}
                  {!loading && paged.length === 0 && (
                    <tr>
                      <td colSpan={config.columns.length + 1}>
                        <div className="payroll-empty">
                          <i className={config.emptyIcon || "ti ti-folder-search"} />
                          <h6 className="mb-2">{config.emptyTitle || `No ${config.title.toLowerCase()} found`}</h6>
                          <p className="mb-0">
                            {config.emptyDescription || "Try a different filter or create a new record."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    paged.map((record) => {
                      const customActions =
                        typeof config.getRowActions === "function"
                          ? config.getRowActions(record, helpers) || []
                          : [];

                      return (
                        <tr key={record.id}>
                          {config.columns.map((column) => (
                            <td key={`${record.id}-${column.label}`} className={column.className || ""}>
                              {typeof column.render === "function"
                                ? column.render(record.data || {}, record, helpers)
                                : record.data?.[column.key] || "-"}
                            </td>
                          ))}
                          <td className="text-end">
                            {customActions.map((action) =>
                              action.to ? (
                                <Link
                                  key={`${record.id}-${action.label}`}
                                  to={action.to}
                                  className={`btn btn-sm ${action.variant || "btn-white"} me-2 ${action.className || ""}`.trim()}
                                >
                                  {action.icon ? <i className={`${action.icon} me-1`} /> : null}
                                  {action.label}
                                </Link>
                              ) : (
                                <button
                                  key={`${record.id}-${action.label}`}
                                  type="button"
                                  className={`btn btn-sm ${action.variant || "btn-white"} me-2 ${action.className || ""}`.trim()}
                                  onClick={() => runCustomAction(action, record)}
                                >
                                  {action.icon ? <i className={`${action.icon} me-1`} /> : null}
                                  {action.label}
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-white me-2"
                              onClick={() => handleDuplicate(record)}
                            >
                              <i className="ti ti-copy" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-white me-2"
                              onClick={() => openEdit(record)}
                            >
                              <i className="ti ti-edit" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-white text-danger"
                              onClick={() => handleDelete(record)}
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pt-4">
              <p className="mb-0 payroll-secondary-text">
                Showing {paged.length === 0 ? 0 : (page - 1) * rowsPerPage + 1} to {(page - 1) * rowsPerPage + paged.length} of {filtered.length} records
              </p>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-light"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-light"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(showAdd || showEdit) && (
        <div className="modal show d-block payroll-modal" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content">
              <form onSubmit={showEdit ? handleEdit : handleAdd}>
                <div className="modal-header">
                  <div>
                    <span className="payroll-kicker">
                      <i className={config.kickerIcon || "ti ti-pencil-plus"} /> {showEdit ? "Edit Record" : "New Record"}
                    </span>
                    <h5 className="modal-title mb-0">
                      {showEdit ? `Update ${config.title}` : config.primaryActionLabel || `Add ${config.title}`}
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={closeModal} />
                </div>
                <div className="modal-body">
                  <div className="payroll-modal-grid">
                    <div className="d-grid gap-3">
                      <div className="card payroll-section-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">{config.title} Details</h6>
                            <span className={`payroll-badge ${getStatusTone(form[statusField])}`}>
                              <i className="ti ti-circle-dashed" /> {form[statusField] || "Draft"}
                            </span>
                          </div>
                          <div className="row g-3">
                            {fields.map((field) => {
                              const colClass = field.colClass || (field.type === "textarea" ? "col-12" : "col-md-6");
                              const readOnly = field.readOnly || (field.readOnlyOnEdit && showEdit);
                              const rawOptions =
                                typeof field.options === "function"
                                  ? field.options({ form, helpers, editing, showAdd, showEdit, records, dependencies })
                                  : field.options || [];
                              const options = Array.isArray(rawOptions) ? rawOptions : [];
                              return (
                                <div className={colClass} key={field.name}>
                                  <label className="form-label">{field.label}</label>
                                  {field.type === "select" ? (
                                    <select
                                      className="form-select"
                                      value={form[field.name] ?? ""}
                                      onChange={(event) => updateField(field.name, event.target.value)}
                                      required={field.required}
                                      disabled={readOnly}
                                    >
                                      <option value="">{field.placeholder || `Select ${field.label}`}</option>
                                      {options.map((option) => {
                                        const value = typeof option === "string" ? option : option.value;
                                        const label = typeof option === "string" ? option : option.label;
                                        return (
                                          <option key={value} value={value}>
                                            {label}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : field.type === "textarea" ? (
                                    <textarea
                                      className="form-control"
                                      rows={4}
                                      value={form[field.name] ?? ""}
                                      onChange={(event) => updateField(field.name, event.target.value)}
                                      placeholder={field.placeholder || ""}
                                      required={field.required}
                                      disabled={readOnly}
                                    />
                                  ) : (
                                    <input
                                      type={field.type || "text"}
                                      className="form-control"
                                      value={form[field.name] ?? ""}
                                      onChange={(event) => updateField(field.name, event.target.value)}
                                      placeholder={field.placeholder || ""}
                                      required={field.required}
                                      min={field.min}
                                      step={field.step}
                                      disabled={readOnly}
                                    />
                                  )}
                                  {field.hint ? <small className="finance-form-hint">{field.hint}</small> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="d-grid gap-3">
                      <div className="card payroll-section-card payroll-summary-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">Live Preview</h6>
                          </div>
                          <div className="payroll-summary-highlight mb-3">
                            <small>{modalPreview.highlightLabel || "Summary"}</small>
                            <h3>{modalPreview.highlightValue || "-"}</h3>
                          </div>
                          <div className="payroll-summary-list">
                            {(modalPreview.rows || []).map((row) => (
                              <div className="payroll-summary-row" key={row.label}>
                                <span>{row.label}</span>
                                <strong>{row.value || "-"}</strong>
                              </div>
                            ))}
                          </div>
                          {modalPreview.note ? (
                            <div className="finance-note-card mt-3">
                              <i className="ti ti-sparkles" />
                              <span>{modalPreview.note}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {showEdit ? `Update ${config.title}` : config.primaryActionLabel || `Add ${config.title}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesWorkspace;
