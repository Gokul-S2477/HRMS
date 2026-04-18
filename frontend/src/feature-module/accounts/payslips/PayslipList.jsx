import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../../api/axios";
import { all_routes } from "../../router/all_routes";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";

const RESOURCE = "/employee-payroll/";

const PayslipList = () => {
  const routes = all_routes;
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

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

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(RESOURCE);
      setRecords(normalize(res.data));
    } catch (error) {
      console.error("Error loading payslips:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayslips();
  }, [loadPayslips]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((record) => {
      const data = record.data || {};
      return [data.employee_name, data.emp_code, data.email, data.designation, data.month]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [records, search]);

  const statCards = (() => {
    const totalPayslips = records.length;
    const totalPayout = records.reduce(
      (sum, record) => sum + toNumber(record?.data?.net_salary),
      0
    );
    const totalDeductions = records.reduce(
      (sum, record) => sum + toNumber(record?.data?.total_deductions),
      0
    );
    const averageNet = totalPayslips ? totalPayout / totalPayslips : 0;

    return [
      {
        label: "Payslip Records",
        value: totalPayslips,
        meta: `${filtered.length} currently visible`,
      },
      {
        label: "Total Net Payout",
        value: formatAmount(totalPayout),
        meta: `${formatAmount(averageNet)} average take-home`,
      },
      {
        label: "Total Deductions",
        value: formatAmount(totalDeductions),
        meta: "Across all salary slips",
      },
    ];
  })();

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this payslip?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      loadPayslips();
    } catch (error) {
      console.error("Delete failed", error);
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
                <li className="breadcrumb-item active">Payslip</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className="ti ti-receipt-2" /> Salary Documents
                </span>
                <h1 className="payroll-title">Payslip Register</h1>
                <p className="payroll-subtitle">
                  Explore finalized salary slips, compare payout totals, and jump straight into the
                  printable document view for each employee.
                </p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <button className="btn btn-white" type="button">
                    <i className="ti ti-file-export me-1" /> Export
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>

            <div className="payroll-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
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

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Payslip Library</h5>
              <div className="payroll-table-subtitle">
                Search by employee, code, month, or designation.
              </div>
            </div>
            <div className="payroll-table-controls">
              <input
                type="text"
                className="form-control"
                placeholder="Search payslips"
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
                    <th>Employee</th>
                    <th>Cycle</th>
                    <th>Compensation</th>
                    <th>Net Salary</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-5">
                        Loading payslips...
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="payroll-empty">
                          <i className="ti ti-file-search" />
                          <h6 className="mb-2">No payslips found</h6>
                          <p className="mb-0">Try a different search term or create salary records first.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filtered.map((record) => {
                      const data = record.data || {};
                      return (
                        <tr key={record.id}>
                          <td>
                            <div className="payroll-avatar-block">
                              <span className="payroll-avatar-icon">
                                <i className="ti ti-file-certificate" />
                              </span>
                              <div>
                                <div className="payroll-primary-text">{data.employee_name || "N/A"}</div>
                                <div className="payroll-secondary-text">
                                  {data.emp_code || "-"} | {data.designation || "No designation"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="payroll-badge accent">
                              <i className="ti ti-calendar-time" />
                              {data.month || "-"} {data.year || ""}
                            </span>
                          </td>
                          <td>
                            <div className="payroll-primary-text">
                              Gross {formatAmount(data.gross_salary)}
                            </div>
                            <div className="payroll-secondary-text">
                              Deductions {formatAmount(data.total_deductions)}
                            </div>
                          </td>
                          <td>
                            <span className="payroll-badge success">
                              <i className="ti ti-cash-banknote" />
                              {formatAmount(data.net_salary)}
                            </span>
                          </td>
                          <td className="text-end">
                            <Link
                              to={routes.payslipsView.replace(":id", record.id)}
                              className="btn btn-sm btn-primary me-2"
                            >
                              View Slip
                            </Link>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="btn btn-sm btn-white text-danger"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipList;
