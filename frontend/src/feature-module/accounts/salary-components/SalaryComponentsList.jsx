import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { all_routes } from "../../router/all_routes";

const SalaryComponentsList = () => {
  const routes = all_routes;
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/salary-components/");
      setComponents(normalize(res.data));
    } catch (err) {
      console.error("Failed to load salary components", err);
      toast.error("Failed to load salary components");
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    let list = [...components];

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((item) =>
        [item?.name, item?.component_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
    }

    if (typeFilter) {
      list = list.filter((item) => (item?.component_type || "") === typeFilter);
    }

    return list;
  }, [components, search, typeFilter]);

  const stats = (() => {
    const earnings = components.filter((item) => item?.component_type === "earning");
    const deductions = components.filter((item) => item?.component_type === "deduction");

    return [
      {
        label: "Total Components",
        value: components.length,
        meta: `${filtered.length} visible after filters`,
      },
      {
        label: "Earning Components",
        value: earnings.length,
        meta: formatAmount(earnings.reduce((sum, item) => sum + toNumber(item?.amount), 0)),
      },
      {
        label: "Deduction Components",
        value: deductions.length,
        meta: formatAmount(deductions.reduce((sum, item) => sum + toNumber(item?.amount), 0)),
      },
    ];
  })();

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this salary component?")) return;
    try {
      await API.delete(`/salary-components/${id}/`);
      toast.success("Salary component deleted");
      loadData();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Delete failed");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">Finance & Accounts</li>
                <li className="breadcrumb-item">Payroll</li>
                <li className="breadcrumb-item active">Salary Components</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className="ti ti-adjustments-dollar" /> Payroll Structure
                </span>
                <h1 className="payroll-title">Salary Components</h1>
                <p className="payroll-subtitle">
                  Configure earning and deduction components in a cleaner workspace so payroll
                  calculations stay consistent across every employee salary run.
                </p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button">
                    <i className="ti ti-file-export me-1" /> Export
                  </button>
                  <Link to={routes.salaryComponentsCreate} className="btn btn-primary">
                    <i className="ti ti-plus me-1" /> Add Component
                  </Link>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="payroll-stat-grid"
              style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
              {stats.map((card) => (
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

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Component Register</h5>
              <div className="payroll-table-subtitle">
                Review earning and deduction items before assigning them to salary structures.
              </div>
            </div>
            <div className="payroll-table-controls">
              <input
                type="text"
                className="form-control"
                placeholder="Search components"
                style={{ minWidth: 220 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-select"
                style={{ minWidth: 180 }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                <option value="earning">Earning</option>
                <option value="deduction">Deduction</option>
              </select>
            </div>
          </div>

          <div className="payroll-table-shell">
            <div className="table-responsive">
              <table className="table table-hover table-center mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4} className="text-center py-5">
                        Loading salary components...
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="payroll-empty">
                          <i className="ti ti-adjustments-off" />
                          <h6 className="mb-2">No salary components found</h6>
                          <p className="mb-0">
                            Add a new component or change the search/filter to see more results.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((component) => (
                      <tr key={component.id}>
                        <td>
                          <div className="payroll-avatar-block">
                            <span className="payroll-avatar-icon">
                              <i className="ti ti-cash" />
                            </span>
                            <div>
                              <div className="payroll-primary-text">{component.name || "-"}</div>
                              <div className="payroll-secondary-text">
                                Payroll component ready for salary mapping
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`payroll-badge ${
                              component.component_type === "earning" ? "success" : "accent"
                            }`}
                          >
                            <i
                              className={`ti ${
                                component.component_type === "earning"
                                  ? "ti-arrow-up-right"
                                  : "ti-arrow-down-right"
                              }`}
                            />
                            {component.component_type || "-"}
                          </span>
                        </td>
                        <td>
                          <div className="payroll-primary-text">
                            {formatAmount(component.amount)}
                          </div>
                        </td>
                        <td className="text-end">
                          <Link
                            to={`/accounts/salary-components/edit/${component.id}`}
                            className="btn btn-sm btn-white me-2"
                          >
                            <i className="ti ti-edit" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(component.id)}
                            className="btn btn-sm btn-white text-danger"
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
    </div>
  );
};

export default SalaryComponentsList;
