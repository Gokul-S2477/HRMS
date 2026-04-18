import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";

const RESOURCE = "/employee-payroll/";

const PayslipView = () => {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const loadPayslip = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await API.get(`${RESOURCE}${id}/`);
      setRecord(res.data);
    } catch (err) {
      console.error("Failed to load payslip", err);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPayslip();
  }, [loadPayslip]);

  const data = useMemo(() => record?.data || {}, [record]);

  const earnings = useMemo(() => {
    const list = [];
    const base = data.earnings || {};
    if (base.basic) list.push({ label: "Basic Salary", amount: base.basic });
    if (base.hra) list.push({ label: "House Rent Allowance", amount: base.hra });
    if (base.da) list.push({ label: "Dearness Allowance", amount: base.da });
    if (base.conveyance) list.push({ label: "Conveyance", amount: base.conveyance });
    if (base.allowance) list.push({ label: "Other Allowance", amount: base.allowance });
    if (base.medical) list.push({ label: "Medical Allowance", amount: base.medical });
    if (base.others) list.push({ label: "Others", amount: base.others });
    (data.extra_earnings || []).forEach((item) => {
      if (item?.label || item?.amount) {
        list.push({ label: item.label || "Other", amount: item.amount });
      }
    });
    return list;
  }, [data]);

  const deductions = useMemo(() => {
    const list = [];
    const base = data.deductions || {};
    if (base.tds) list.push({ label: "Tax Deducted at Source", amount: base.tds });
    if (base.pf) list.push({ label: "Provident Fund", amount: base.pf });
    if (base.esi) list.push({ label: "ESI", amount: base.esi });
    if (base.leave) list.push({ label: "Leave", amount: base.leave });
    if (base.prof_tax) list.push({ label: "Professional Tax", amount: base.prof_tax });
    if (base.labour_welfare) list.push({ label: "Labour Welfare", amount: base.labour_welfare });
    if (base.others) list.push({ label: "Others", amount: base.others });
    (data.extra_deductions || []).forEach((item) => {
      if (item?.label || item?.amount) {
        list.push({ label: item.label || "Other", amount: item.amount });
      }
    });
    return list;
  }, [data]);

  const totals = useMemo(() => {
    const totalEarnings = earnings.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const totalDeductions = deductions.reduce((sum, item) => sum + toNumber(item.amount), 0);
    return {
      totalEarnings,
      totalDeductions,
      net: totalEarnings - totalDeductions,
    };
  }, [deductions, earnings]);

  const compliance = useMemo(() => data.compliance_snapshot || {}, [data]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell">
          <p>Loading payslip...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell">
          <p>No payslip found.</p>
        </div>
      </div>
    );
  }

  const payslipNo = `PS${String(record.id || "").replace(/-/g, "").slice(-6).toUpperCase()}`;

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">Finance & Accounts</li>
                <li className="breadcrumb-item">Payroll</li>
                <li className="breadcrumb-item active">Payslip</li>
              </ul>
            </div>
            <div className="col-auto">
              <div className="payroll-hero-actions">
                <button className="btn btn-dark" type="button" onClick={() => window.print()}>
                  <i className="ti ti-download me-1" /> Download
                </button>
                <div className="head-icons">
                  <CollapseHeader />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="payslip-document">
          <div className="payslip-document-header">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div className="payslip-brand">
                <span className="payslip-brand-mark">
                  <i className="ti ti-briefcase-2" />
                </span>
                <div>
                  <h3 className="mb-1">SmartHR</h3>
                  <p className="mb-0 payroll-secondary-text">
                    3099 Kennedy Court Framingham, MA 01702
                  </p>
                </div>
              </div>
              <div className="text-end">
                <span className="payroll-kicker">
                  <i className="ti ti-id-badge-2" /> Payslip #{payslipNo}
                </span>
                <div className="payroll-primary-text mt-2">
                  Salary Month: {data.month} {data.year}
                </div>
              </div>
            </div>

            <div className="payslip-total-banner">
              <div className="payroll-summary-row">
                <span>Total Earnings</span>
                <strong>{formatAmount(totals.totalEarnings)}</strong>
              </div>
              <div className="payroll-summary-row">
                <span>Total Deductions</span>
                <strong>{formatAmount(totals.totalDeductions)}</strong>
              </div>
              <div className="payroll-summary-row">
                <span>Net Salary</span>
                <strong>{formatAmount(totals.net)}</strong>
              </div>
            </div>
          </div>

          <div className="card-body p-4 p-md-5">
            <div className="row g-4 mb-4">
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <span className="payroll-kicker">
                      <i className="ti ti-building-community" /> From
                    </span>
                    <h5 className="mb-2">XYZ Technologies</h5>
                    <p className="mb-1 payroll-secondary-text">2077 Chicago Avenue Orosi, CA 93647</p>
                    <p className="mb-1 payroll-secondary-text">Email: xyztech@example.com</p>
                    <p className="mb-0 payroll-secondary-text">Phone: +1 987 654 3210</p>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <span className="payroll-kicker">
                      <i className="ti ti-user-circle" /> To
                    </span>
                    <h5 className="mb-2">{data.employee_name || "Employee"}</h5>
                    <p className="mb-1 payroll-secondary-text">{data.designation || "No designation"}</p>
                    <p className="mb-1 payroll-secondary-text">Email: {data.email || "-"}</p>
                    <p className="mb-0 payroll-secondary-text">Phone: {data.phone || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h6 className="payroll-section-title">Earnings</h6>
                      <span className="payroll-badge accent">
                        <i className="ti ti-trending-up" />
                        Positive flow
                      </span>
                    </div>
                    <div className="payslip-amount-list">
                      {earnings.length === 0 ? (
                        <div className="payslip-amount-row">
                          <span>No earnings configured</span>
                          <strong>{formatAmount(0)}</strong>
                        </div>
                      ) : (
                        earnings.map((item, index) => (
                          <div className="payslip-amount-row" key={`earning-${index}`}>
                            <span>{item.label}</span>
                            <strong>{formatAmount(item.amount)}</strong>
                          </div>
                        ))
                      )}
                      <div className="payslip-amount-row total">
                        <span>Total Earnings</span>
                        <strong>{formatAmount(totals.totalEarnings)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h6 className="payroll-section-title">Deductions</h6>
                      <span className="payroll-badge">
                        <i className="ti ti-shield-minus" />
                        Controlled outflow
                      </span>
                    </div>
                    <div className="payslip-amount-list">
                      {deductions.length === 0 ? (
                        <div className="payslip-amount-row">
                          <span>No deductions configured</span>
                          <strong>{formatAmount(0)}</strong>
                        </div>
                      ) : (
                        deductions.map((item, index) => (
                          <div className="payslip-amount-row" key={`deduction-${index}`}>
                            <span>{item.label}</span>
                            <strong>{formatAmount(item.amount)}</strong>
                          </div>
                        ))
                      )}
                      <div className="payslip-amount-row total">
                        <span>Total Deductions</span>
                        <strong>{formatAmount(totals.totalDeductions)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4 mt-1">
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h6 className="payroll-section-title">Compliance Snapshot</h6>
                      <span className="payroll-badge accent">
                        <i className="ti ti-shield-check" />
                        {compliance.profile || "Default profile"}
                      </span>
                    </div>
                    <div className="payroll-summary-list">
                      <div className="payroll-summary-row">
                        <span>Employee PF</span>
                        <strong>{formatAmount(compliance.applied?.employee_pf)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Employee ESI</span>
                        <strong>{formatAmount(compliance.applied?.employee_esi)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Professional Tax</span>
                        <strong>{formatAmount(compliance.applied?.professional_tax)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Employer Cost</span>
                        <strong>{formatAmount(data.employer_cost)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h6 className="payroll-section-title">Cycle Inputs</h6>
                      <span className="payroll-badge success">
                        <i className="ti ti-calendar-stats" />
                        {data.status || "published"}
                      </span>
                    </div>
                    <div className="payroll-summary-list">
                      <div className="payroll-summary-row">
                        <span>Cycle start</span>
                        <strong>{data.cycle_start || "-"}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Cycle end</span>
                        <strong>{data.cycle_end || "-"}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Approved overtime</span>
                        <strong>{data.approved_overtime_hours || 0} h</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Loss of pay days</span>
                        <strong>{data.loss_of_pay_days || 0}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="payroll-summary-highlight">
                <small>Take-home summary</small>
                <h3>{formatAmount(totals.net)}</h3>
                <p className="mb-0 mt-2" style={{ opacity: 0.85 }}>
                  Final salary released for {data.month} {data.year}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipView;
