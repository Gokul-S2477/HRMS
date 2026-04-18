import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { all_routes } from "../../router/all_routes";

const defaultForm = {
  name: "",
  component_type: "earning",
  amount: "",
};

const SalaryComponentsForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const routes = all_routes;
  const isEdit = Boolean(id);

  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (!id) return;
    setLoading(true);
    try {
      const res = await API.get(`/salary-components/${id}/`);
      setForm({
        name: res.data?.name || "",
        component_type: res.data?.component_type || "earning",
        amount: res.data?.amount || "",
      });
    } catch (err) {
      console.error("Failed to load component", err);
      toast.error("Failed to load component");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const preview = {
    amount: formatAmount(form.amount),
    typeLabel: form.component_type === "earning" ? "Earning" : "Deduction",
    toneClass: form.component_type === "earning" ? "success" : "accent",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        component_type: form.component_type,
        amount: toNumber(form.amount),
      };

      if (isEdit) {
        await API.put(`/salary-components/${id}/`, payload);
        toast.success("Salary component updated");
      } else {
        await API.post("/salary-components/", payload);
        toast.success("Salary component created");
      }
      navigate(routes.salaryComponents);
    } catch (err) {
      console.error("Save failed", err);
      toast.error("Save failed");
    } finally {
      setSaving(false);
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
                <li className="breadcrumb-item">
                  <Link to={routes.salaryComponents}>Salary Components</Link>
                </li>
                <li className="breadcrumb-item active">
                  {isEdit ? "Edit Component" : "Add Component"}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <span className="payroll-kicker">
                  <i className="ti ti-pencil-cog" /> Component Builder
                </span>
                <h1 className="payroll-title">
                  {isEdit ? "Edit Salary Component" : "Add Salary Component"}
                </h1>
                <p className="payroll-subtitle">
                  Define the payroll component name, its type, and default amount so the salary
                  structure stays aligned across all payroll workflows.
                </p>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  <Link to={routes.salaryComponents} className="btn btn-white">
                    <i className="ti ti-arrow-left me-1" /> Back to List
                  </Link>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="payroll-modal-grid">
            <div className="card payroll-section-card">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h6 className="payroll-section-title">Component Details</h6>
                  <span className={`payroll-badge ${preview.toneClass}`}>
                    <i className="ti ti-checkup-list" />
                    {isEdit ? "Editing existing component" : "Creating new component"}
                  </span>
                </div>

                {loading ? (
                  <div className="payroll-empty py-5">
                    <i className="ti ti-loader" />
                    <p className="mb-0">Loading salary component...</p>
                  </div>
                ) : (
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Component Name</label>
                      <input
                        className="form-control"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: House Rent Allowance"
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Component Type</label>
                      <select
                        className="form-select"
                        value={form.component_type}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, component_type: e.target.value }))
                        }
                      >
                        <option value="earning">Earning</option>
                        <option value="deduction">Deduction</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Default Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={form.amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card payroll-section-card payroll-summary-card">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h6 className="payroll-section-title">Live Preview</h6>
                </div>

                <div className="payroll-summary-highlight mb-3">
                  <small>Configured amount</small>
                  <h3>{preview.amount}</h3>
                </div>

                <div className="payroll-summary-list">
                  <div className="payroll-summary-row">
                    <span>Name</span>
                    <strong>{form.name || "-"}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Type</span>
                    <strong>{preview.typeLabel}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Usage</span>
                    <strong>Available in payroll setup</strong>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-4">
                  <Link to={routes.salaryComponents} className="btn btn-light w-100">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary w-100" disabled={saving || loading}>
                    {saving ? "Saving..." : isEdit ? "Update Component" : "Create Component"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalaryComponentsForm;
