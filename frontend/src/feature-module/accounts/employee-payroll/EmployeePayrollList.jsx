import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import API from "../../../api/axios";
import { all_routes } from "../../router/all_routes";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";

const RESOURCE = "/employee-payroll/";
const EMPLOYEE_API = "/employees/";

const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const defaultForm = {
  employee_id: "",
  month: "",
  year: new Date().getFullYear(),
  earnings: {
    basic: "",
    da: "",
    hra: "",
    conveyance: "",
    allowance: "",
    medical: "",
    others: "",
  },
  deductions: {
    tds: "",
    esi: "",
    pf: "",
    leave: "",
    prof_tax: "",
    labour_welfare: "",
    others: "",
  },
  extraEarnings: [],
  extraDeductions: [],
};

const EmployeePayrollList = () => {
  const routes = all_routes;
  const { search } = useLocation();

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...defaultForm });

  const [searchText, setSearchText] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

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

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [salaryRes, employeeRes] = await Promise.all([
        API.get(RESOURCE),
        API.get(EMPLOYEE_API),
      ]);
      setRecords(normalize(salaryRes.data));
      setEmployees(normalize(employeeRes.data));
    } catch (err) {
      console.error("Failed to load employee salaries", err);
      setRecords([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("add") === "1") {
      setEditing(null);
      setShowEdit(false);
      setShowAdd(true);
      setForm({ ...defaultForm });
    }
    const editId = params.get("edit");
    if (editId) {
      const record = records.find((entry) => String(entry.id) === String(editId));
      if (record) openEdit(record);
    }
  }, [search, records]);

  const employeeMap = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => {
      map.set(String(emp.id), emp);
    });
    return map;
  }, [employees]);

  const selectedEmployee = employeeMap.get(String(form.employee_id));

  const designations = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      if (emp?.designation?.title) set.add(emp.designation.title);
    });
    records.forEach((record) => {
      if (record?.data?.designation) set.add(record.data.designation);
    });
    return Array.from(set).sort();
  }, [employees, records]);

  const totals = useMemo(() => {
    const earnings = form.earnings || {};
    const deductions = form.deductions || {};
    const earningKeys = ["basic", "da", "hra", "conveyance", "allowance", "medical", "others"];
    const deductionKeys = ["tds", "esi", "pf", "leave", "prof_tax", "labour_welfare", "others"];

    const grossFixed = earningKeys.reduce((sum, key) => sum + toNumber(earnings[key]), 0);
    const totalDeductionFixed = deductionKeys.reduce((sum, key) => sum + toNumber(deductions[key]), 0);

    const extraEarnings = (form.extraEarnings || []).reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );
    const extraDeductions = (form.extraDeductions || []).reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );

    const gross = grossFixed + extraEarnings;
    const totalDeduction = totalDeductionFixed + extraDeductions;
    const net = gross - totalDeduction;

    return {
      gross,
      totalDeduction,
      net,
      additions: extraEarnings,
      deductionsExtra: extraDeductions,
    };
  }, [form]);

  const filtered = useMemo(() => {
    let list = [...records];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((record) => {
        const data = record.data || {};
        const employee = employeeMap.get(String(data.employee_id));
        const employeeName = employee
          ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
          : "";
        return [
          data.employee_name,
          employeeName,
          data.emp_code,
          data.email,
          data.designation,
          employee?.designation?.title,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
    }

    if (designationFilter) {
      list = list.filter((record) => {
        const data = record.data || {};
        const employee = employeeMap.get(String(data.employee_id));
        const designation = data.designation || employee?.designation?.title || "";
        return designation === designationFilter;
      });
    }

    if (statusFilter) {
      list = list.filter((record) => String(record?.data?.status || "draft") === statusFilter);
    }

    if (sortBy === "asc") {
      list.sort((a, b) =>
        String(a?.data?.employee_name || "").localeCompare(String(b?.data?.employee_name || ""))
      );
    } else if (sortBy === "desc") {
      list.sort((a, b) =>
        String(b?.data?.employee_name || "").localeCompare(String(a?.data?.employee_name || ""))
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
      );
    }

    return list;
  }, [designationFilter, employeeMap, records, searchText, sortBy, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const statCards = (() => {
    const totalPayroll = records.length;
    const totalPayout = records.reduce(
      (sum, record) => sum + toNumber(record?.data?.net_salary),
      0
    );
    const averagePayout = totalPayroll ? totalPayout / totalPayroll : 0;
    const topPayroll = records.reduce((highest, record) => {
      const current = toNumber(record?.data?.net_salary);
      if (!highest || current > toNumber(highest?.data?.net_salary)) return record;
      return highest;
    }, null);

    const now = new Date();
    const monthName = monthOptions[now.getMonth()];
    const currentCycle = records.filter(
      (record) =>
        record?.data?.month === monthName && Number(record?.data?.year) === now.getFullYear()
    ).length;

    return [
      {
        label: "Payroll Records",
        value: totalPayroll,
        meta: `${filtered.length} visible after filters`,
      },
      {
        label: "Net Payout",
        value: formatAmount(totalPayout),
        meta: `${formatAmount(averagePayout)} average payout`,
      },
      {
        label: "Top Salary",
        value: topPayroll ? formatAmount(topPayroll?.data?.net_salary) : formatAmount(0),
        meta: topPayroll?.data?.employee_name || "No records yet",
      },
      {
        label: "Current Cycle",
        value: currentCycle,
        meta: `${monthName} ${now.getFullYear()} payroll entries`,
      },
    ];
  })();

  const resetForm = () => {
    setForm({ ...defaultForm });
  };

  const openAdd = () => {
    resetForm();
    setEditing(null);
    setShowEdit(false);
    setShowAdd(true);
  };

  const closeModals = () => {
    setShowAdd(false);
    setShowEdit(false);
    setEditing(null);
  };

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openEdit = (record) => {
    const data = record.data || {};
    setEditing(record);
    setForm({
      employee_id: data.employee_id?.toString?.() || "",
      month: data.month || "",
      year: data.year || new Date().getFullYear(),
      earnings: {
        basic: data.earnings?.basic ?? "",
        da: data.earnings?.da ?? "",
        hra: data.earnings?.hra ?? "",
        conveyance: data.earnings?.conveyance ?? "",
        allowance: data.earnings?.allowance ?? "",
        medical: data.earnings?.medical ?? "",
        others: data.earnings?.others ?? "",
      },
      deductions: {
        tds: data.deductions?.tds ?? "",
        esi: data.deductions?.esi ?? "",
        pf: data.deductions?.pf ?? "",
        leave: data.deductions?.leave ?? "",
        prof_tax: data.deductions?.prof_tax ?? "",
        labour_welfare: data.deductions?.labour_welfare ?? "",
        others: data.deductions?.others ?? "",
      },
      extraEarnings: Array.isArray(data.extra_earnings) ? data.extra_earnings : [],
      extraDeductions: Array.isArray(data.extra_deductions) ? data.extra_deductions : [],
    });
    setShowAdd(false);
    setShowEdit(true);
  };

  const buildPayload = () => {
    const employeeName = selectedEmployee
      ? `${selectedEmployee.first_name || ""} ${selectedEmployee.last_name || ""}`.trim()
      : "";

    return {
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      emp_code: selectedEmployee?.emp_code || "",
      employee_name: employeeName,
      email: selectedEmployee?.email || "",
      phone: selectedEmployee?.phone || "",
      designation: selectedEmployee?.designation?.title || "",
      joining_date: selectedEmployee?.joining_date || "",
      month: form.month,
      year: Number(form.year) || new Date().getFullYear(),
      earnings: {
        basic: toNumber(form.earnings.basic),
        da: toNumber(form.earnings.da),
        hra: toNumber(form.earnings.hra),
        conveyance: toNumber(form.earnings.conveyance),
        allowance: toNumber(form.earnings.allowance),
        medical: toNumber(form.earnings.medical),
        others: toNumber(form.earnings.others),
      },
      deductions: {
        tds: toNumber(form.deductions.tds),
        esi: toNumber(form.deductions.esi),
        pf: toNumber(form.deductions.pf),
        leave: toNumber(form.deductions.leave),
        prof_tax: toNumber(form.deductions.prof_tax),
        labour_welfare: toNumber(form.deductions.labour_welfare),
        others: toNumber(form.deductions.others),
      },
      extra_earnings: (form.extraEarnings || []).filter((item) => item.label || item.amount),
      extra_deductions: (form.extraDeductions || []).filter((item) => item.label || item.amount),
      gross_salary: totals.gross,
      total_deductions: totals.totalDeduction,
      net_salary: totals.net,
    };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return alert("Employee is required");
    if (!form.month) return alert("Month is required");
    try {
      await API.post(RESOURCE, { data: buildPayload() });
      closeModals();
      resetForm();
      loadAll();
    } catch (err) {
      console.error("Add salary failed", err);
      alert("Failed to add salary");
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await API.put(`${RESOURCE}${editing.id}/`, { data: buildPayload() });
      closeModals();
      resetForm();
      loadAll();
    } catch (err) {
      console.error("Edit salary failed", err);
      alert("Failed to update salary");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this salary record?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      loadAll();
    } catch (err) {
      console.error("Delete salary failed", err);
      alert("Failed to delete salary");
    }
  };

  const updateEarning = (field, value) => {
    setForm((prev) => ({
      ...prev,
      earnings: { ...prev.earnings, [field]: value },
    }));
  };

  const updateDeduction = (field, value) => {
    setForm((prev) => ({
      ...prev,
      deductions: { ...prev.deductions, [field]: value },
    }));
  };

  const updateExtra = (type, index, key, value) => {
    setForm((prev) => {
      const list =
        type === "earning" ? [...prev.extraEarnings] : [...prev.extraDeductions];
      list[index] = { ...list[index], [key]: value };
      return {
        ...prev,
        extraEarnings: type === "earning" ? list : prev.extraEarnings,
        extraDeductions: type === "deduction" ? list : prev.extraDeductions,
      };
    });
  };

  const addExtra = (type) => {
    setForm((prev) => ({
      ...prev,
      extraEarnings:
        type === "earning"
          ? [...prev.extraEarnings, { label: "", amount: "" }]
          : prev.extraEarnings,
      extraDeductions:
        type === "deduction"
          ? [...prev.extraDeductions, { label: "", amount: "" }]
          : prev.extraDeductions,
    }));
  };

  const removeExtra = (type, index) => {
    setForm((prev) => {
      const list =
        type === "earning" ? [...prev.extraEarnings] : [...prev.extraDeductions];
      list.splice(index, 1);
      return {
        ...prev,
        extraEarnings: type === "earning" ? list : prev.extraEarnings,
        extraDeductions: type === "deduction" ? list : prev.extraDeductions,
      };
    });
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">Finance & Accounts</li>
                <li className="breadcrumb-item active">Payroll</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className="ti ti-wallet" /> Payroll Workspace
                </span>
                <h1 className="payroll-title">Employee Salary</h1>
                <p className="payroll-subtitle">
                  Review payroll runs, track payout health, and open detailed salary breakdowns
                  from one aligned workspace that keeps HR and finance data in sync.
                </p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button">
                    <i className="ti ti-file-export me-1" /> Export
                  </button>
                  <button className="btn btn-primary" type="button" onClick={openAdd}>
                    <i className="ti ti-plus me-1" /> Add Salary
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>

            <div className="payroll-stat-grid">
              {statCards.map((card) => (
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
                <label className="form-label">Search Payroll</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by employee, code, email, or designation"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <label className="form-label">Designation</label>
                <select
                  className="form-select"
                  value={designationFilter}
                  onChange={(e) => {
                    setDesignationFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All designations</option>
                  {designations.map((designation) => (
                    <option key={designation} value={designation}>
                      {designation}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Payroll Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                  <option value="published">Published</option>
                  <option value="locked">Locked</option>
                </select>
              </div>
              <div>
                <label className="form-label">Sort Order</label>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="recent">Most Recent</option>
                  <option value="asc">Employee Name A-Z</option>
                  <option value="desc">Employee Name Z-A</option>
                </select>
              </div>
              <div>
                <label className="form-label">Rows Per Page</label>
                <select
                  className="form-select"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
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
              <h5>Salary Register</h5>
              <div className="payroll-table-subtitle">
                {filtered.length} payroll records with salary, designation, and payslip access.
              </div>
            </div>
            <div className="payroll-table-controls">
              <span className="payroll-kpi-pill">
                <i className="ti ti-calendar-month" />
                Page {page} of {totalPages}
              </span>
              <span className="payroll-kpi-pill">
                <i className="ti ti-badge-dollar-sign" />
                {formatAmount(
                  filtered.reduce((sum, record) => sum + toNumber(record?.data?.net_salary), 0)
                )} visible payout
              </span>
            </div>
          </div>
          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover table-center mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>
                      <input type="checkbox" className="form-check-input" />
                    </th>
                    <th>Employee</th>
                    <th>Contact</th>
                    <th>Cycle</th>
                    <th>Salary Snapshot</th>
                    <th>Payslip</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-5">
                        Loading payroll records...
                      </td>
                    </tr>
                  )}
                  {!loading && paged.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="payroll-empty">
                          <i className="ti ti-wallet-off" />
                          <h6 className="mb-2">No salary records match the current filters</h6>
                          <p className="mb-0">
                            Try changing the designation or search terms, or add a new payroll run.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    paged.map((record) => {
                      const data = record.data || {};
                      const employee = employeeMap.get(String(data.employee_id));
                      const employeeName =
                        data.employee_name ||
                        (employee
                          ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
                          : "-");
                      const designation =
                        data.designation || employee?.designation?.title || "Not assigned";
                      const gross = toNumber(data.gross_salary);
                      const deductions = toNumber(data.total_deductions);
                      const net = toNumber(data.net_salary);
                      const deductionShare = gross > 0 ? Math.round((deductions / gross) * 100) : 0;

                      return (
                        <tr key={record.id}>
                          <td>
                            <input type="checkbox" className="form-check-input" />
                          </td>
                          <td>
                            <div className="payroll-avatar-block">
                              <span className="payroll-avatar-icon">
                                <i className="ti ti-user-dollar" />
                              </span>
                              <div>
                                <div className="payroll-primary-text">{employeeName}</div>
                                <div className="payroll-secondary-text">
                                  {data.emp_code || employee?.emp_code || "-"} | {designation}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="payroll-primary-text">{data.email || employee?.email || "-"}</div>
                            <div className="payroll-secondary-text">{data.phone || employee?.phone || "-"}</div>
                          </td>
                          <td>
                            <div className="payroll-badge accent mb-2">
                              <i className="ti ti-calendar-event" />
                              {data.month || "-"} {data.year || ""}
                            </div>
                            <div className="payroll-secondary-text mb-1">
                              Joined {formatDate(data.joining_date || employee?.joining_date)}
                            </div>
                            <span className={`payroll-badge ${String(data.status || "draft") === "published" ? "success" : String(data.status || "draft") === "locked" ? "accent" : ""}`}>
                              <i className="ti ti-shield-check" />
                              {String(data.status || "draft").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            <div className="payroll-primary-text">{formatAmount(net)}</div>
                            <div className="payroll-secondary-text mb-1">
                              Gross {formatAmount(gross)} | Deductions {formatAmount(deductions)}
                            </div>
                            <span className="payroll-badge">
                              <i className="ti ti-chart-donut-2" />
                              {deductionShare}% deduction share
                            </span>
                          </td>
                          <td>
                            <Link
                              to={routes.payslipsView.replace(":id", record.id)}
                              className="btn btn-dark btn-sm"
                            >
                              Generate Slip
                            </Link>
                          </td>
                          <td className="text-end">
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
                              onClick={() => handleDelete(record.id)}
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
                Showing {paged.length === 0 ? 0 : (page - 1) * rowsPerPage + 1} to{" "}
                {(page - 1) * rowsPerPage + paged.length} of {filtered.length} records
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
                      <i className="ti ti-edit-circle" /> {showEdit ? "Edit Run" : "New Run"}
                    </span>
                    <h5 className="modal-title mb-0">
                      {showEdit ? "Update Employee Salary" : "Create Employee Salary"}
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={closeModals} />
                </div>
                <div className="modal-body">
                  <div className="payroll-modal-grid">
                    <div className="d-grid gap-3">
                      <div className="card payroll-section-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">Payroll Identity</h6>
                            <span className="payroll-badge accent">
                              <i className="ti ti-shield-check" />
                              Live calculation
                            </span>
                          </div>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Employee</label>
                              <select
                                className="form-select"
                                value={form.employee_id}
                                onChange={(e) =>
                                  setForm((prev) => ({ ...prev, employee_id: e.target.value }))
                                }
                                required
                              >
                                <option value="">Select employee</option>
                                {employees.map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {`${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
                                      employee.email}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Month</label>
                              <select
                                className="form-select"
                                value={form.month}
                                onChange={(e) =>
                                  setForm((prev) => ({ ...prev, month: e.target.value }))
                                }
                                required
                              >
                                <option value="">Select month</option>
                                {monthOptions.map((month) => (
                                  <option key={month} value={month}>
                                    {month}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Year</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.year}
                                onChange={(e) =>
                                  setForm((prev) => ({ ...prev, year: e.target.value }))
                                }
                                min="2000"
                                max="2100"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card payroll-section-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">Earnings</h6>
                            <button
                              type="button"
                              className="btn btn-link text-decoration-none p-0"
                              onClick={() => addExtra("earning")}
                            >
                              <i className="ti ti-plus me-1" />
                              Add custom earning
                            </button>
                          </div>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <label className="form-label">Basic</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.basic}
                                onChange={(e) => updateEarning("basic", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">DA</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.da}
                                onChange={(e) => updateEarning("da", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">HRA</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.hra}
                                onChange={(e) => updateEarning("hra", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Conveyance</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.conveyance}
                                onChange={(e) => updateEarning("conveyance", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Allowance</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.allowance}
                                onChange={(e) => updateEarning("allowance", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Medical</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.medical}
                                onChange={(e) => updateEarning("medical", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Others</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.earnings.others}
                                onChange={(e) => updateEarning("others", e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="d-grid gap-3 mt-3">
                            {form.extraEarnings.map((item, index) => (
                              <div className="payroll-extra-row" key={`extra-earning-${index}`}>
                                <div className="row g-3 align-items-end">
                                  <div className="col-md-5">
                                    <label className="form-label">Label</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={item.label}
                                      onChange={(e) =>
                                        updateExtra("earning", index, "label", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="col-md-5">
                                    <label className="form-label">Amount</label>
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={item.amount}
                                      onChange={(e) =>
                                        updateExtra("earning", index, "amount", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="col-md-2">
                                    <button
                                      type="button"
                                      className="btn btn-light w-100"
                                      onClick={() => removeExtra("earning", index)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="card payroll-section-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">Deductions</h6>
                            <button
                              type="button"
                              className="btn btn-link text-decoration-none p-0"
                              onClick={() => addExtra("deduction")}
                            >
                              <i className="ti ti-plus me-1" />
                              Add custom deduction
                            </button>
                          </div>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <label className="form-label">TDS</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.tds}
                                onChange={(e) => updateDeduction("tds", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">ESI</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.esi}
                                onChange={(e) => updateDeduction("esi", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">PF</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.pf}
                                onChange={(e) => updateDeduction("pf", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Leave</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.leave}
                                onChange={(e) => updateDeduction("leave", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Professional Tax</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.prof_tax}
                                onChange={(e) => updateDeduction("prof_tax", e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Labour Welfare</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.labour_welfare}
                                onChange={(e) =>
                                  updateDeduction("labour_welfare", e.target.value)
                                }
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Others</label>
                              <input
                                type="number"
                                className="form-control"
                                value={form.deductions.others}
                                onChange={(e) => updateDeduction("others", e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="d-grid gap-3 mt-3">
                            {form.extraDeductions.map((item, index) => (
                              <div className="payroll-extra-row" key={`extra-deduction-${index}`}>
                                <div className="row g-3 align-items-end">
                                  <div className="col-md-5">
                                    <label className="form-label">Label</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={item.label}
                                      onChange={(e) =>
                                        updateExtra("deduction", index, "label", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="col-md-5">
                                    <label className="form-label">Amount</label>
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={item.amount}
                                      onChange={(e) =>
                                        updateExtra("deduction", index, "amount", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="col-md-2">
                                    <button
                                      type="button"
                                      className="btn btn-light w-100"
                                      onClick={() => removeExtra("deduction", index)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="d-grid gap-3">
                      <div className="card payroll-section-card payroll-summary-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">Run Summary</h6>
                            <span className="payroll-badge success">
                              <i className="ti ti-scan" />
                              Ready to publish
                            </span>
                          </div>

                          <div className="payroll-summary-highlight mb-3">
                            <small>Net salary</small>
                            <h3>{formatAmount(totals.net)}</h3>
                          </div>

                          <div className="payroll-summary-list">
                            <div className="payroll-summary-row">
                              <span>Gross salary</span>
                              <strong>{formatAmount(totals.gross)}</strong>
                            </div>
                            <div className="payroll-summary-row">
                              <span>Total deductions</span>
                              <strong>{formatAmount(totals.totalDeduction)}</strong>
                            </div>
                            <div className="payroll-summary-row">
                              <span>Custom earnings</span>
                              <strong>{formatAmount(totals.additions)}</strong>
                            </div>
                            <div className="payroll-summary-row">
                              <span>Custom deductions</span>
                              <strong>{formatAmount(totals.deductionsExtra)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card payroll-section-card">
                        <div className="card-body">
                          <div className="payroll-section-header">
                            <h6 className="payroll-section-title">Employee Snapshot</h6>
                          </div>
                          {selectedEmployee ? (
                            <div className="payroll-summary-list">
                              <div className="payroll-summary-row">
                                <span>Name</span>
                                <strong>
                                  {`${selectedEmployee.first_name || ""} ${
                                    selectedEmployee.last_name || ""
                                  }`.trim()}
                                </strong>
                              </div>
                              <div className="payroll-summary-row">
                                <span>Employee code</span>
                                <strong>{selectedEmployee.emp_code || "-"}</strong>
                              </div>
                              <div className="payroll-summary-row">
                                <span>Designation</span>
                                <strong>{selectedEmployee?.designation?.title || "-"}</strong>
                              </div>
                              <div className="payroll-summary-row">
                                <span>Joining date</span>
                                <strong>{formatDate(selectedEmployee.joining_date)}</strong>
                              </div>
                              <div className="payroll-summary-row">
                                <span>Contact</span>
                                <strong>{selectedEmployee.phone || selectedEmployee.email || "-"}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="payroll-empty py-4">
                              <i className="ti ti-user-search" />
                              <p className="mb-0">
                                Select an employee to see role, joining date, and contact details.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={closeModals}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {showEdit ? "Update Employee Salary" : "Add Employee Salary"}
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

export default EmployeePayrollList;
