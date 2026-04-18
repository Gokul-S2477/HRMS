import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmHero } from "./hrmShared";

type SettingsRecord = {
  id: string;
  data: {
    max_leave_days?: number;
    carry_forward_days?: number;
    min_notice_days?: number;
    approval_required?: boolean;
  };
};

const RESOURCE = "/data/leave-settings/";

const LeaveSettings: React.FC = () => {
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulationDays, setSimulationDays] = useState(3);

  const [form, setForm] = useState({
    max_leave_days: 24,
    carry_forward_days: 6,
    min_notice_days: 2,
    approval_required: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get(RESOURCE);
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      if (list.length > 0) {
        const item: SettingsRecord = list[0];
        setRecordId(item.id);
        setForm({
          max_leave_days: item.data?.max_leave_days ?? 24,
          carry_forward_days: item.data?.carry_forward_days ?? 6,
          min_notice_days: item.data?.min_notice_days ?? 2,
          approval_required: item.data?.approval_required ?? true,
        });
      }
    } catch (err) {
      console.error("Failed to load leave settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { data: { ...form } };
      if (recordId) {
        await API.put(`${RESOURCE}${recordId}/`, payload);
      } else {
        const res = await API.post(RESOURCE, payload);
        setRecordId(res.data?.id || null);
      }
      alert("Settings saved");
    } catch (err) {
      console.error("Save settings failed", err);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: "Annual Cap", value: form.max_leave_days, meta: "Maximum leave days per year" },
      { label: "Carry Forward", value: form.carry_forward_days, meta: "Unused days that can move forward" },
      { label: "Notice Window", value: `${form.min_notice_days} days`, meta: "Minimum lead time before leave" },
      { label: "Approval Flow", value: form.approval_required ? "On" : "Off", meta: "Controls manager/HR approval requirement" },
    ],
    [form]
  );

  const projectedBalance = Math.max(form.max_leave_days + form.carry_forward_days - simulationDays, 0);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Policy Control"
          title="Leave Settings"
          subtitle="Set the annual leave cap, carry-forward rules, notice window, and approval flow from one cleaner policy workspace."
          action={
            <>
              <button className="btn btn-primary" type="submit" form="leave-settings-form" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
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
            <div className="card payroll-section-card">
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-5">Loading leave settings...</div>
                ) : (
                  <form id="leave-settings-form" onSubmit={handleSave}>
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">Policy Configuration</h5>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label">Max Leave Days / Year</label>
                        <input type="number" className="form-control" value={form.max_leave_days} min={0} onChange={(e) => setForm({ ...form, max_leave_days: Number(e.target.value) })} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Carry Forward Days</label>
                        <input type="number" className="form-control" value={form.carry_forward_days} min={0} onChange={(e) => setForm({ ...form, carry_forward_days: Number(e.target.value) })} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Minimum Notice Days</label>
                        <input type="number" className="form-control" value={form.min_notice_days} min={0} onChange={(e) => setForm({ ...form, min_notice_days: Number(e.target.value) })} />
                      </div>
                      <div className="col-12">
                        <div className="form-check form-switch mt-2">
                          <input className="form-check-input" type="checkbox" id="approval_required" checked={form.approval_required} onChange={(e) => setForm({ ...form, approval_required: e.target.checked })} />
                          <label className="form-check-label" htmlFor="approval_required">
                            Approval required for leave requests
                          </label>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card payroll-section-card">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h5 className="payroll-section-title">Policy Simulator</h5>
                </div>
                <p className="text-muted mb-3">
                  Try a sample leave request to preview how this policy behaves before you save it.
                </p>
                <label className="form-label">Sample Request Days</label>
                <input type="number" className="form-control mb-3" min={1} value={simulationDays} onChange={(e) => setSimulationDays(Number(e.target.value) || 1)} />
                <div className="payroll-summary-list">
                  <div className="payroll-summary-row">
                    <span>Annual entitlement</span>
                    <strong>{form.max_leave_days}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Carry forward</span>
                    <strong>{form.carry_forward_days}</strong>
                  </div>
                  <div className="payroll-summary-row">
                    <span>Simulated request</span>
                    <strong>{simulationDays} days</strong>
                  </div>
                  <div className="payroll-summary-highlight">
                    <small>Projected balance</small>
                    <h3>{projectedBalance}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveSettings;
