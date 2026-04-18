import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";

type InvoiceLineItem = {
  label?: string;
  qty?: number | string;
  cost?: number | string;
  discount?: number | string;
};

type InvoiceData = {
  invoice_number?: string;
  project_name?: string;
  issue_date?: string;
  due_date?: string;
  status?: string;
  amount?: number | string;
  paid_amount?: number | string;
  tax_rate?: number | string;
  client_name?: string;
  address?: string;
  email?: string;
  phone?: string;
  description?: string;
  notes?: string;
  terms?: string;
  line_items?: InvoiceLineItem[];
};

type InvoiceResource = {
  id: string;
  data: InvoiceData;
  created_at?: string;
  updated_at?: string;
};

type NormalizedLineItem = {
  label: string;
  qty: number;
  cost: number;
  discount: number;
};

const toNumber = (value: unknown): number => {
  const num = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const formatAmount = (value: unknown): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getTone = (status?: string | null): string => {
  const key = String(status || "").toLowerCase();
  if (["paid"].includes(key)) return "success";
  if (["overdue"].includes(key)) return "danger";
  if (["partially paid"].includes(key)) return "warning";
  if (["sent"].includes(key)) return "accent";
  return "";
};

const InvoiceDetails = () => {
  const { id } = useParams();
  const routes = all_routes;
  const [record, setRecord] = useState<InvoiceResource | null>(null);
  const [loading, setLoading] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await API.get(`/data/invoices/${id}/`);
      setRecord(res.data);
    } catch (error) {
      console.error("Failed to load invoice", error);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const data = useMemo<InvoiceData>(() => record?.data || {}, [record]);

  const lineItems = useMemo<NormalizedLineItem[]>(() => {
    if (Array.isArray(data.line_items) && data.line_items.length) {
      return data.line_items.map((item: InvoiceLineItem) => ({
        label: item.label || "General Service",
        qty: toNumber(item.qty) || 1,
        cost: toNumber(item.cost),
        discount: toNumber(item.discount),
      }));
    }

    return [
      {
        label: data.project_name || data.description || "General Service",
        qty: 1,
        cost: toNumber(data.amount),
        discount: 0,
      },
    ];
  }, [data]);

  const totals = useMemo(() => {
    const subTotal = lineItems.reduce(
      (sum: number, item: NormalizedLineItem) => sum + item.qty * item.cost - item.discount,
      0
    );
    const taxRate = toNumber(data.tax_rate);
    const taxValue = (subTotal * taxRate) / 100;
    const grandTotal = toNumber(data.amount) || subTotal + taxValue;
    const paid = toNumber(data.paid_amount);
    return {
      subTotal,
      taxRate,
      taxValue,
      grandTotal,
      paid,
      balance: Math.max(grandTotal - paid, 0),
    };
  }, [data, lineItems]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell">
          <p>Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell">
          <p>Invoice record not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <div className="page-header">
          <div className="row align-items-center">
            <div className="col">
              <ul className="breadcrumb mb-2">
                <li className="breadcrumb-item">Finance & Accounts</li>
                <li className="breadcrumb-item">Sales</li>
                <li className="breadcrumb-item">
                  <Link to={routes.invoices}>Invoices</Link>
                </li>
                <li className="breadcrumb-item active">Invoice Details</li>
              </ul>
            </div>
            <div className="col-auto">
              <div className="payroll-hero-actions">
                <button className="btn btn-dark" type="button" onClick={() => window.print()}>
                  <i className="ti ti-printer me-1" /> Print Invoice
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
              <div>
                <span className="payroll-kicker">
                  <i className="ti ti-file-invoice" /> Invoice #{data.invoice_number || "-"}
                </span>
                <h3 className="mb-2">{data.project_name || "Invoice"}</h3>
                <p className="mb-0 payroll-secondary-text">
                  Created {formatDate(data.issue_date)} | Due {formatDate(data.due_date)}
                </p>
              </div>
              <div className="text-end">
                <span className={`payroll-badge ${getTone(data.status)}`.trim()}>
                  <i className="ti ti-point-filled" /> {data.status || "Draft"}
                </span>
                <div className="payroll-primary-text mt-3">Total {formatAmount(totals.grandTotal)}</div>
                <div className="payroll-secondary-text">Balance {formatAmount(totals.balance)}</div>
              </div>
            </div>

            <div className="payslip-total-banner">
              <div className="payroll-summary-row">
                <span>Subtotal</span>
                <strong>{formatAmount(totals.subTotal)}</strong>
              </div>
              <div className="payroll-summary-row">
                <span>Collected</span>
                <strong>{formatAmount(totals.paid)}</strong>
              </div>
              <div className="payroll-summary-row">
                <span>Outstanding</span>
                <strong>{formatAmount(totals.balance)}</strong>
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
                    <h5 className="mb-2">SmartHR Finance Desk</h5>
                    <p className="mb-1 payroll-secondary-text">3099 Kennedy Court Framingham, MA 01702</p>
                    <p className="mb-1 payroll-secondary-text">Email: billing@smarthr.example</p>
                    <p className="mb-0 payroll-secondary-text">Phone: +1 987 654 3210</p>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <span className="payroll-kicker">
                      <i className="ti ti-user-circle" /> Bill To
                    </span>
                    <h5 className="mb-2">{data.client_name || "Client"}</h5>
                    <p className="mb-1 payroll-secondary-text">{data.address || "Address not provided"}</p>
                    <p className="mb-1 payroll-secondary-text">Email: {data.email || "-"}</p>
                    <p className="mb-0 payroll-secondary-text">Phone: {data.phone || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-lg-8">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h6 className="payroll-section-title">Line Items</h6>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th className="text-end">Qty</th>
                            <th className="text-end">Cost</th>
                            <th className="text-end">Discount</th>
                            <th className="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item: NormalizedLineItem, index: number) => (
                            <tr key={`${item.label}-${index}`}>
                              <td>
                                <div className="payroll-primary-text">{item.label}</div>
                              </td>
                              <td className="text-end">{item.qty}</td>
                              <td className="text-end">{formatAmount(item.cost)}</td>
                              <td className="text-end">{formatAmount(item.discount)}</td>
                              <td className="text-end">{formatAmount(item.qty * item.cost - item.discount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="payslip-panel h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h6 className="payroll-section-title">Amount Summary</h6>
                    </div>
                    <div className="payroll-summary-list">
                      <div className="payroll-summary-row">
                        <span>Sub Total</span>
                        <strong>{formatAmount(totals.subTotal)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Tax ({totals.taxRate.toFixed(2)}%)</span>
                        <strong>{formatAmount(totals.taxValue)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Total</span>
                        <strong>{formatAmount(totals.grandTotal)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Paid</span>
                        <strong>{formatAmount(totals.paid)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Balance</span>
                        <strong>{formatAmount(totals.balance)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="finance-detail-grid">
              <div className="finance-document-note">
                <h6 className="mb-2">Description</h6>
                <p className="mb-0">{data.description || "No invoice description added."}</p>
              </div>
              <div className="finance-document-note">
                <h6 className="mb-2">Notes</h6>
                <p className="mb-0">{data.notes || "No client note added."}</p>
              </div>
              <div className="finance-document-note">
                <h6 className="mb-2">Terms</h6>
                <p className="mb-0">{data.terms || "No payment terms added."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetails;
