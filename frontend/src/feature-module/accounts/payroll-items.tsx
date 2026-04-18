import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";

const RESOURCE = "/data/payroll-items/";

type PayrollTab = "addition" | "overtime" | "deduction";

type PayrollItemRecord = {
  id: string;
  data: {
    name?: string;
    category?: string;
    amount?: number | string;
    type?: PayrollTab;
  };
  created_at?: string;
  updated_at?: string;
};

const tabLabels: Record<PayrollTab, string> = {
  addition: "Additions",
  overtime: "Overtime",
  deduction: "Deductions",
};

const tabActionLabels: Record<PayrollTab, string> = {
  addition: "Addition",
  overtime: "Overtime",
  deduction: "Deduction",
};

const tabRoutes: Record<PayrollTab, string> = {
  addition: all_routes.payrollAddition,
  overtime: all_routes.payrollOvertime,
  deduction: all_routes.payrollDeduction,
};

const PayrollItems: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = useState<PayrollItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PayrollTab>("addition");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<PayrollItemRecord | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "",
    amount: "",
  });

  const normalize = (data: any): PayrollItemRecord[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const toNumber = (value: any) => {
    const num = parseFloat(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(num) ? num : 0;
  };

  const formatAmount = (value: any) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(toNumber(value));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(RESOURCE);
      setItems(normalize(res.data));
    } catch (err) {
      console.error("Failed to load payroll items", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const path = location.pathname || "";
    if (path.includes("payroll-overtime")) setActiveTab("overtime");
    else if (path.includes("payroll-deduction")) setActiveTab("deduction");
    else setActiveTab("addition");
  }, [location.pathname]);

  const filtered = useMemo(() => {
    let list = [...items].filter((item) => (item.data?.type || "addition") === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((item) => {
        const name = (item.data?.name || "").toLowerCase();
        const category = (item.data?.category || "").toLowerCase();
        return name.includes(q) || category.includes(q);
      });
    }
    return list;
  }, [activeTab, items, search]);

  const counts = useMemo(() => {
    const totals = {
      addition: 0,
      overtime: 0,
      deduction: 0,
    };
    items.forEach((item) => {
      const type = item.data?.type || "addition";
      totals[type] += 1;
    });
    return totals;
  }, [items]);

  const totals = useMemo(() => {
    return {
      addition: items
        .filter((item) => (item.data?.type || "addition") === "addition")
        .reduce((sum, item) => sum + toNumber(item.data?.amount), 0),
      overtime: items
        .filter((item) => (item.data?.type || "addition") === "overtime")
        .reduce((sum, item) => sum + toNumber(item.data?.amount), 0),
      deduction: items
        .filter((item) => (item.data?.type || "addition") === "deduction")
        .reduce((sum, item) => sum + toNumber(item.data?.amount), 0),
    };
  }, [items]);

  const changeTab = (tab: PayrollTab) => {
    setActiveTab(tab);
    navigate(tabRoutes[tab]);
  };

  const openAdd = () => {
    setForm({ name: "", category: "", amount: "" });
    setEditing(null);
    setShowEdit(false);
    setShowAdd(true);
  };

  const openEdit = (item: PayrollItemRecord) => {
    setEditing(item);
    setForm({
      name: item.data?.name || "",
      category: item.data?.category || "",
      amount: item.data?.amount?.toString?.() || "",
    });
    setShowAdd(false);
    setShowEdit(true);
  };

  const closeModals = () => {
    setShowAdd(false);
    setShowEdit(false);
    setEditing(null);
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) return alert("Name is required");
    try {
      await API.post(RESOURCE, {
        data: {
          name: form.name.trim(),
          category: form.category.trim() || "",
          amount: toNumber(form.amount),
          type: activeTab,
        },
      });
      closeModals();
      load();
    } catch (err) {
      console.error("Add payroll item failed", err);
      alert("Failed to add payroll item");
    }
  };

  const handleEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editing) return;
    if (!form.name.trim()) return alert("Name is required");
    try {
      await API.put(`${RESOURCE}${editing.id}/`, {
        data: {
          name: form.name.trim(),
          category: form.category.trim() || "",
          amount: toNumber(form.amount),
          type: editing.data?.type || activeTab,
        },
      });
      closeModals();
      load();
    } catch (err) {
      console.error("Edit payroll item failed", err);
      alert("Failed to update payroll item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this payroll item?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      load();
    } catch (err) {
      console.error("Delete payroll item failed", err);
      alert("Failed to delete payroll item");
    }
  };

  const summaryCards = [
    {
      key: "addition",
      label: "Additions",
      count: counts.addition,
      total: formatAmount(totals.addition),
      icon: "ti ti-circle-plus",
    },
    {
      key: "overtime",
      label: "Overtime",
      count: counts.overtime,
      total: formatAmount(totals.overtime),
      icon: "ti ti-clock-hour-4",
    },
    {
      key: "deduction",
      label: "Deductions",
      count: counts.deduction,
      total: formatAmount(totals.deduction),
      icon: "ti ti-circle-minus",
    },
  ] as const;

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">Finance & Accounts</li>
                <li className="breadcrumb-item">Payroll</li>
                <li className="breadcrumb-item active">Payroll Items</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className="ti ti-stack-2" /> Payroll Components
                </span>
                <h1 className="payroll-title">Payroll Items</h1>
                <p className="payroll-subtitle">
                  Manage additions, overtime, and deductions with a cleaner structure so payroll
                  inputs stay consistent before every payout cycle.
                </p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button">
                    <i className="ti ti-file-export me-1" /> Export
                  </button>
                  <button className="btn btn-primary" type="button" onClick={openAdd}>
                    <i className="ti ti-plus me-1" /> Add {tabActionLabels[activeTab]}
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>

            <div className="payroll-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {summaryCards.map((card) => (
                <div className="card payroll-stat-card" key={card.key}>
                  <div className="card-body">
                    <span className="payroll-stat-label">
                      <i className={`${card.icon} me-2`} />
                      {card.label}
                    </span>
                    <h3 className="payroll-stat-value">{card.count}</h3>
                    <div className="payroll-stat-meta">{card.total} configured</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Component Library</h5>
              <div className="payroll-table-subtitle">
                Switch between additions, overtime, and deductions without leaving the workspace.
              </div>
            </div>
            <div className="payroll-table-controls">
              <div className="payroll-segmented">
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "addition" ? "btn-primary" : "btn-white"}`}
                  onClick={() => changeTab("addition")}
                >
                  Additions
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "overtime" ? "btn-primary" : "btn-white"}`}
                  onClick={() => changeTab("overtime")}
                >
                  Overtime
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === "deduction" ? "btn-primary" : "btn-white"}`}
                  onClick={() => changeTab("deduction")}
                >
                  Deductions
                </button>
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or category"
                style={{ minWidth: 240 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                    <th>Name</th>
                    <th>Category</th>
                    <th>Configured Amount</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-5">
                        Loading payroll items...
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="payroll-empty">
                          <i className="ti ti-stack-pop" />
                          <h6 className="mb-2">No {tabLabels[activeTab].toLowerCase()} found</h6>
                          <p className="mb-0">
                            Add a new item or refine the search to see more component entries.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filtered.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input type="checkbox" className="form-check-input" />
                        </td>
                        <td>
                          <div className="payroll-avatar-block">
                            <span className="payroll-avatar-icon">
                              <i className="ti ti-adjustments-dollar" />
                            </span>
                            <div>
                              <div className="payroll-primary-text">{item.data?.name || "-"}</div>
                              <div className="payroll-secondary-text">
                                {tabLabels[item.data?.type || activeTab]}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="payroll-badge accent">{item.data?.category || "-"}</span>
                        </td>
                        <td>
                          <span className="payroll-badge success">
                            {formatAmount(item.data?.amount)}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-white me-2"
                            onClick={() => openEdit(item)}
                          >
                            <i className="ti ti-edit" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-white text-danger"
                            onClick={() => handleDelete(item.id)}
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {(showAdd || showEdit) && (
        <div className="modal show d-block payroll-modal" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={showEdit ? handleEdit : handleAdd}>
                <div className="modal-header">
                  <div>
                    <span className="payroll-kicker">
                      <i className="ti ti-category-plus" /> {showEdit ? "Edit Item" : "New Item"}
                    </span>
                    <h5 className="modal-title mb-0">
                      {showEdit ? "Update Payroll Item" : `Add ${tabActionLabels[activeTab]}`}
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={closeModals} />
                </div>
                <div className="modal-body">
                  <div className="payroll-modal-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr" }}>
                    <div className="card payroll-section-card">
                      <div className="card-body">
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label">Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={form.name}
                              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Category</label>
                            <input
                              type="text"
                              className="form-control"
                              value={form.category}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, category: e.target.value }))
                              }
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Default / Unit Amount</label>
                            <input
                              type="number"
                              className="form-control"
                              value={form.amount}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, amount: e.target.value }))
                              }
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card payroll-section-card payroll-summary-card">
                      <div className="card-body">
                        <div className="payroll-section-header">
                          <h6 className="payroll-section-title">Preview</h6>
                        </div>
                        <div className="payroll-summary-highlight mb-3">
                          <small>Configured amount</small>
                          <h3>{formatAmount(form.amount)}</h3>
                        </div>
                        <div className="payroll-summary-list">
                          <div className="payroll-summary-row">
                            <span>Type</span>
                            <strong>{tabLabels[editing?.data?.type || activeTab]}</strong>
                          </div>
                          <div className="payroll-summary-row">
                            <span>Name</span>
                            <strong>{form.name || "-"}</strong>
                          </div>
                          <div className="payroll-summary-row">
                            <span>Category</span>
                            <strong>{form.category || "-"}</strong>
                          </div>
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
                    {showEdit ? "Update Payroll Item" : "Add Payroll Item"}
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

export default PayrollItems;
