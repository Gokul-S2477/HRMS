import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmHero } from "../hrm/hrmShared";

const LEAVE_TYPES_RESOURCE = "/data/leave-types/";
const APPROVALS_RESOURCE = "/data/settings-approvals/";
const NOTIFICATIONS_RESOURCE = "/data/settings-notifications/";
const DOCUMENTS_RESOURCE = "/data/settings-documents/";
const ONBOARDING_RESOURCE = "/data/settings-onboarding/";

const emptyLeaveType = { name: "", days: 0, status: "Active" };

const SettingsControlCenter: React.FC = () => {
  const location = useLocation();
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [approvalRecordId, setApprovalRecordId] = useState<string | null>(null);
  const [notificationRecordId, setNotificationRecordId] = useState<string | null>(null);
  const [documentRecordId, setDocumentRecordId] = useState<string | null>(null);
  const [onboardingRecordId, setOnboardingRecordId] = useState<string | null>(null);
  const [approvalForm, setApprovalForm] = useState({
    leave_requires_stakeholder: true,
    ticket_sla_hours: 24,
    payroll_cutoff_day: 25,
    offboarding_dual_check: true,
  });
  const [notificationForm, setNotificationForm] = useState({
    chat_push: true,
    leave_updates: true,
    ticket_updates: true,
    payroll_updates: true,
    training_reminders: true,
  });
  const [documentForm, setDocumentForm] = useState({
    expiry_reminder_days: 30,
    employee_uploads: true,
    mandatory_review: true,
    auto_expire: true,
  });
  const [onboardingForm, setOnboardingForm] = useState({
    welcome_pack_days: 3,
    auto_create_from_joined: true,
    stakeholder_visibility: true,
    default_owner_role: "hr",
  });
  const [leaveTypeForm, setLeaveTypeForm] = useState(emptyLeaveType);
  const [editingLeaveType, setEditingLeaveType] = useState<any | null>(null);

  const load = async () => {
    try {
      const [leaveRes, approvalRes, notificationRes, documentRes, onboardingRes] = await Promise.all([
        API.get(LEAVE_TYPES_RESOURCE),
        API.get(APPROVALS_RESOURCE),
        API.get(NOTIFICATIONS_RESOURCE),
        API.get(DOCUMENTS_RESOURCE),
        API.get(ONBOARDING_RESOURCE),
      ]);
      const leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : leaveRes.data?.results || [];
      setLeaveTypes(leaveList);

      const approvalList = Array.isArray(approvalRes.data) ? approvalRes.data : approvalRes.data?.results || [];
      const approvalItem = approvalList[0];
      if (approvalItem) {
        setApprovalRecordId(approvalItem.id);
        setApprovalForm((current) => ({ ...current, ...(approvalItem.data || {}) }));
      }

      const notificationList = Array.isArray(notificationRes.data) ? notificationRes.data : notificationRes.data?.results || [];
      const notificationItem = notificationList[0];
      if (notificationItem) {
        setNotificationRecordId(notificationItem.id);
        setNotificationForm((current) => ({ ...current, ...(notificationItem.data || {}) }));
      }

      const documentList = Array.isArray(documentRes.data) ? documentRes.data : documentRes.data?.results || [];
      const documentItem = documentList[0];
      if (documentItem) {
        setDocumentRecordId(documentItem.id);
        setDocumentForm((current) => ({ ...current, ...(documentItem.data || {}) }));
      }

      const onboardingList = Array.isArray(onboardingRes.data) ? onboardingRes.data : onboardingRes.data?.results || [];
      const onboardingItem = onboardingList[0];
      if (onboardingItem) {
        setOnboardingRecordId(onboardingItem.id);
        setOnboardingForm((current) => ({ ...current, ...(onboardingItem.data || {}) }));
      }
    } catch (error) {
      console.error("Failed to load settings control center", error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pageTitle = useMemo(() => {
    if (location.pathname.includes("approval-settings")) return "Approval Settings";
    if (location.pathname.includes("notifications-settings")) return "Notification Settings";
    if (location.pathname.includes("leave-type")) return "Leave Types";
    return "Settings Control Center";
  }, [location.pathname]);

  const saveApprovalSettings = async () => {
    const payload = { data: approvalForm };
    if (approvalRecordId) {
      await API.put(`${APPROVALS_RESOURCE}${approvalRecordId}/`, payload);
    } else {
      const response = await API.post(APPROVALS_RESOURCE, payload);
      setApprovalRecordId(response.data?.id || null);
    }
    window.alert("Approval settings saved.");
  };

  const saveNotificationSettings = async () => {
    const payload = { data: notificationForm };
    if (notificationRecordId) {
      await API.put(`${NOTIFICATIONS_RESOURCE}${notificationRecordId}/`, payload);
    } else {
      const response = await API.post(NOTIFICATIONS_RESOURCE, payload);
      setNotificationRecordId(response.data?.id || null);
    }
    window.alert("Notification settings saved.");
  };

  const saveDocumentSettings = async () => {
    const payload = { data: documentForm };
    if (documentRecordId) {
      await API.put(`${DOCUMENTS_RESOURCE}${documentRecordId}/`, payload);
    } else {
      const response = await API.post(DOCUMENTS_RESOURCE, payload);
      setDocumentRecordId(response.data?.id || null);
    }
    window.alert("Document settings saved.");
  };

  const saveOnboardingSettings = async () => {
    const payload = { data: onboardingForm };
    if (onboardingRecordId) {
      await API.put(`${ONBOARDING_RESOURCE}${onboardingRecordId}/`, payload);
    } else {
      const response = await API.post(ONBOARDING_RESOURCE, payload);
      setOnboardingRecordId(response.data?.id || null);
    }
    window.alert("Onboarding settings saved.");
  };

  const saveLeaveType = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { data: leaveTypeForm };
    if (editingLeaveType) {
      await API.put(`${LEAVE_TYPES_RESOURCE}${editingLeaveType.id}/`, payload);
    } else {
      await API.post(LEAVE_TYPES_RESOURCE, payload);
    }
    setLeaveTypeForm(emptyLeaveType);
    setEditingLeaveType(null);
    load();
  };

  const removeLeaveType = async (id: string) => {
    if (!window.confirm("Delete this leave type?")) return;
    await API.delete(`${LEAVE_TYPES_RESOURCE}${id}/`);
    load();
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Admin Settings"
          title={pageTitle}
          subtitle="Keep approvals, notifications, document controls, onboarding defaults, and leave catalogs live inside the role-aware HRMS instead of static template pages."
          action={<div className="head-icons"><CollapseHeader /></div>}
          stats={[
            { label: "Leave Types", value: leaveTypes.length, meta: "Policy catalog" },
            { label: "Stakeholder Check", value: approvalForm.leave_requires_stakeholder ? "On" : "Off", meta: "Approval routing" },
            { label: "Ticket SLA", value: `${approvalForm.ticket_sla_hours}h`, meta: "Response expectation" },
            { label: "Notification Packs", value: Object.values(notificationForm).filter(Boolean).length, meta: "Enabled channels" },
            { label: "Doc Reminder", value: `${documentForm.expiry_reminder_days}d`, meta: "Expiry follow-up" },
            { label: "Onboarding Auto", value: onboardingForm.auto_create_from_joined ? "On" : "Off", meta: "Joined-stage automation" },
          ]}
        />

        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card payroll-section-card h-100">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h5 className="payroll-section-title">Approval Settings</h5>
                </div>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Ticket SLA Hours</label>
                    <input type="number" className="form-control" value={approvalForm.ticket_sla_hours} onChange={(event) => setApprovalForm((current) => ({ ...current, ticket_sla_hours: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Payroll Cutoff Day</label>
                    <input type="number" className="form-control" value={approvalForm.payroll_cutoff_day} onChange={(event) => setApprovalForm((current) => ({ ...current, payroll_cutoff_day: Number(event.target.value) || 1 }))} />
                  </div>
                  <div className="col-12">
                    <div className="form-check form-switch mb-2">
                      <input className="form-check-input" type="checkbox" checked={approvalForm.leave_requires_stakeholder} onChange={(event) => setApprovalForm((current) => ({ ...current, leave_requires_stakeholder: event.target.checked }))} />
                      <label className="form-check-label">Leave needs stakeholder visibility</label>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={approvalForm.offboarding_dual_check} onChange={(event) => setApprovalForm((current) => ({ ...current, offboarding_dual_check: event.target.checked }))} />
                      <label className="form-check-label">Offboarding requires dual check</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <button type="button" className="btn btn-primary w-100" onClick={saveApprovalSettings}>Save Approval Settings</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card payroll-section-card h-100">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h5 className="payroll-section-title">Notification Defaults</h5>
                </div>
                <div className="d-flex flex-column gap-3">
                  {Object.entries(notificationForm).map(([key, value]) => (
                    <div className="form-check form-switch" key={key}>
                      <input className="form-check-input" type="checkbox" checked={Boolean(value)} onChange={(event) => setNotificationForm((current) => ({ ...current, [key]: event.target.checked }))} />
                      <label className="form-check-label text-capitalize">{key.replace(/_/g, " ")}</label>
                    </div>
                  ))}
                  <button type="button" className="btn btn-primary mt-2" onClick={saveNotificationSettings}>Save Notification Settings</button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card payroll-section-card h-100">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h5 className="payroll-section-title">Leave Types</h5>
                </div>
                <form className="row g-3 mb-3" onSubmit={saveLeaveType}>
                  <div className="col-12">
                    <label className="form-label">Name</label>
                    <input className="form-control" value={leaveTypeForm.name} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, name: event.target.value }))} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Days</label>
                    <input type="number" className="form-control" value={leaveTypeForm.days} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, days: Number(event.target.value) || 0 }))} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={leaveTypeForm.status} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, status: event.target.value }))}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button type="submit" className="btn btn-primary flex-fill">{editingLeaveType ? "Save Changes" : "Add Leave Type"}</button>
                    {editingLeaveType ? <button type="button" className="btn btn-light flex-fill" onClick={() => { setEditingLeaveType(null); setLeaveTypeForm(emptyLeaveType); }}>Cancel</button> : null}
                  </div>
                </form>
                <div className="payroll-summary-list">
                  {leaveTypes.map((item) => (
                    <div className="payroll-summary-row" key={item.id}>
                      <div>
                        <div className="payroll-primary-text">{item.data?.name}</div>
                        <div className="payroll-secondary-text">{item.data?.days} day(s) • {item.data?.status}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <button type="button" className="btn btn-sm btn-light" onClick={() => { setEditingLeaveType(item); setLeaveTypeForm({ name: item.data?.name || "", days: item.data?.days || 0, status: item.data?.status || "Active" }); }}>Edit</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeLeaveType(item.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-6">
            <div className="card payroll-section-card h-100">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h5 className="payroll-section-title">Document Controls</h5>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Expiry Reminder Days</label>
                    <input type="number" className="form-control" value={documentForm.expiry_reminder_days} onChange={(event) => setDocumentForm((current) => ({ ...current, expiry_reminder_days: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="col-md-6 d-flex flex-column justify-content-end gap-2">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={documentForm.employee_uploads} onChange={(event) => setDocumentForm((current) => ({ ...current, employee_uploads: event.target.checked }))} />
                      <label className="form-check-label">Allow employee uploads</label>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={documentForm.mandatory_review} onChange={(event) => setDocumentForm((current) => ({ ...current, mandatory_review: event.target.checked }))} />
                      <label className="form-check-label">Mandatory HR review</label>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={documentForm.auto_expire} onChange={(event) => setDocumentForm((current) => ({ ...current, auto_expire: event.target.checked }))} />
                      <label className="form-check-label">Auto mark expired</label>
                    </div>
                  </div>
                  <div className="col-12"><button type="button" className="btn btn-primary w-100" onClick={saveDocumentSettings}>Save Document Settings</button></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-6">
            <div className="card payroll-section-card h-100">
              <div className="card-body">
                <div className="payroll-section-header">
                  <h5 className="payroll-section-title">Onboarding Defaults</h5>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Welcome Pack Days</label>
                    <input type="number" className="form-control" value={onboardingForm.welcome_pack_days} onChange={(event) => setOnboardingForm((current) => ({ ...current, welcome_pack_days: Number(event.target.value) || 0 }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Default Owner Role</label>
                    <select className="form-select" value={onboardingForm.default_owner_role} onChange={(event) => setOnboardingForm((current) => ({ ...current, default_owner_role: event.target.value }))}>
                      <option value="hr">HR</option>
                      <option value="stakeholder">Stakeholder</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <div className="form-check form-switch mb-2">
                      <input className="form-check-input" type="checkbox" checked={onboardingForm.auto_create_from_joined} onChange={(event) => setOnboardingForm((current) => ({ ...current, auto_create_from_joined: event.target.checked }))} />
                      <label className="form-check-label">Auto create onboarding when candidate joins</label>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={onboardingForm.stakeholder_visibility} onChange={(event) => setOnboardingForm((current) => ({ ...current, stakeholder_visibility: event.target.checked }))} />
                      <label className="form-check-label">Stakeholder visibility on onboarding desk</label>
                    </div>
                  </div>
                  <div className="col-12"><button type="button" className="btn btn-primary w-100" onClick={saveOnboardingSettings}>Save Onboarding Defaults</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsControlCenter;
