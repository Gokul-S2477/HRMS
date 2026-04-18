import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmEmptyState, HrmHero, HrmModal, HrmSideList, activeFilterCount, formatDisplayDate, smartSearchMatch, statusTone, toneClass } from "../hrm/hrmShared";
import { fetchCandidateOptions, fetchEmployeeOptions, fetchOnboardingTemplateOptions, normalizeList } from "./liveHelpers";

const defaultForm = {
  title: "",
  employee_id: "",
  candidate_id: "",
  template_id: "",
  status: "planned",
  target_joining_date: "",
  notes: "",
};

const defaultTaskForm = {
  title: "",
  task_type: "general",
  due_date: "",
  status: "pending",
  notes: "",
};

const OnboardingDeskPage = () => {
  const { role } = useAuth();
  const canManage = role === "hr" || role === "super_admin";
  const [records, setRecords] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState({ employees: [], candidates: [], templates: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [recordForm, setRecordForm] = useState(defaultForm);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recordRes, taskRes, employees, candidates, templates] = await Promise.all([
        API.get("/onboarding/records/"),
        API.get("/onboarding/tasks/"),
        fetchEmployeeOptions(),
        fetchCandidateOptions(),
        fetchOnboardingTemplateOptions(),
      ]);
      const recordsList = normalizeList(recordRes.data);
      setRecords(recordsList);
      setTasks(normalizeList(taskRes.data));
      setDependencies({ employees, candidates, templates });
      if (!selectedRecordId && recordsList[0]?.id) {
        setSelectedRecordId(String(recordsList[0].id));
      }
    } catch (error) {
      console.error("Failed to load onboarding desk", error);
      setRecords([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRecordId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRecords = useMemo(() => records.filter((record) => {
    if (!smartSearchMatch(record, search)) return false;
    if (statusFilter && String(record.status) !== String(statusFilter)) return false;
    return true;
  }), [records, search, statusFilter]);

  const selectedRecord = useMemo(() => filteredRecords.find((item) => String(item.id) === String(selectedRecordId)) || filteredRecords[0] || null, [filteredRecords, selectedRecordId]);

  const selectedTasks = useMemo(() => tasks.filter((item) => String(item.record) === String(selectedRecord?.id)), [tasks, selectedRecord]);

  const stats = useMemo(() => {
    const completed = records.filter((item) => item.status === "completed").length;
    const active = records.filter((item) => item.status !== "completed").length;
    const blocked = records.filter((item) => item.status === "blocked").length;
    const openTasks = tasks.filter((item) => item.status !== "completed").length;
    return [
      { label: "Onboarding Plans", value: records.length, meta: `${active} active right now` },
      { label: "Completed Plans", value: completed, meta: `${blocked} blocked` },
      { label: "Open Tasks", value: openTasks, meta: "Cross-team follow up" },
      { label: "Filters", value: activeFilterCount({ search, statusFilter }), meta: "Current workspace filters" },
    ];
  }, [records, tasks, search, statusFilter]);

  const highlights = useMemo(() => filteredRecords.slice(0, 5).map((item) => ({
    label: item.title,
    meta: item.employee?.full_name || item.candidate?.full_name || "Candidate handoff",
    value: `${item.progress_percentage || 0}%`,
    tone: statusTone(item.status),
  })), [filteredRecords]);

  const resetRecordForm = () => {
    setEditingRecord(null);
    setRecordForm(defaultForm);
  };

  const openRecordModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setRecordForm({
        title: record.title || "",
        employee_id: record.employee?.id ? String(record.employee.id) : "",
        candidate_id: record.candidate?.id ? String(record.candidate.id) : "",
        template_id: record.template?.id ? String(record.template.id) : "",
        status: record.status || "planned",
        target_joining_date: record.target_joining_date || "",
        notes: record.notes || "",
      });
    } else {
      resetRecordForm();
    }
    setRecordModalOpen(true);
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: recordForm.title,
        employee_id: recordForm.employee_id || null,
        candidate_id: recordForm.candidate_id || null,
        template_id: recordForm.template_id || null,
        status: recordForm.status,
        target_joining_date: recordForm.target_joining_date || null,
        notes: recordForm.notes,
      };
      if (editingRecord) {
        await API.put(`/onboarding/records/${editingRecord.id}/`, payload);
      } else {
        await API.post("/onboarding/records/", payload);
      }
      setRecordModalOpen(false);
      resetRecordForm();
      load();
    } catch (error) {
      window.alert(error?.response?.data?.detail || "Unable to save onboarding record.");
    } finally {
      setSaving(false);
    }
  };

  const openTaskModal = (task = null) => {
    if (!selectedRecord) return;
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title || "",
        task_type: task.task_type || "general",
        due_date: task.due_date || "",
        status: task.status || "pending",
        notes: task.notes || "",
      });
    } else {
      setEditingTask(null);
      setTaskForm(defaultTaskForm);
    }
    setTaskModalOpen(true);
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (!selectedRecord) return;
    setSaving(true);
    try {
      const payload = {
        record: selectedRecord.id,
        title: taskForm.title,
        task_type: taskForm.task_type,
        due_date: taskForm.due_date || null,
        status: taskForm.status,
        notes: taskForm.notes,
      };
      if (editingTask) {
        await API.put(`/onboarding/tasks/${editingTask.id}/`, payload);
      } else {
        await API.post("/onboarding/tasks/", payload);
      }
      setTaskModalOpen(false);
      setEditingTask(null);
      setTaskForm(defaultTaskForm);
      load();
    } catch (error) {
      window.alert(error?.response?.data?.detail || "Unable to save onboarding task.");
    } finally {
      setSaving(false);
    }
  };

  const quickAction = async (url, successMessage) => {
    try {
      await API.post(url);
      load();
    } catch (error) {
      window.alert(error?.response?.data?.detail || successMessage || "Action failed.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Onboarding"
          title="Onboarding Desk"
          subtitle="Coordinate pre-join, day-one, and post-join tasks with a dedicated landing plan for each hire or internal mover."
          action={<>
            {canManage ? <button type="button" className="btn btn-primary" onClick={() => openRecordModal()}><i className="ti ti-circle-plus me-2" />Add Plan</button> : null}
            <div className="head-icons"><CollapseHeader /></div>
          </>}
          stats={stats}
        >
          <span className="employee-chip"><i className="ti ti-user-check" /> Employee self-view + HR operating desk</span>
          <span className="employee-chip"><i className="ti ti-list-check" /> Task-driven landing workflow</span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card mb-4">
              <div className="payroll-table-header">
                <div>
                  <h5>Onboarding Records</h5>
                  <div className="payroll-table-subtitle">Track plans, progress, ownership, and join dates in one desk.</div>
                </div>
                <div className="payroll-table-controls">
                  <input className="form-control" style={{ minWidth: 240 }} placeholder="Smart search employee, candidate, title" value={search} onChange={(event) => setSearch(event.target.value)} />
                  <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="card-body">
                {loading ? <div className="text-center py-5 text-muted">Loading onboarding desk...</div> : filteredRecords.length === 0 ? <HrmEmptyState title="No onboarding plans yet" description="Create the first plan to coordinate HR, IT, admin, and manager tasks for a new joiner." /> : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Plan</th>
                          <th>Owner</th>
                          <th>Progress</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => (
                          <tr key={record.id} className={String(selectedRecord?.id) === String(record.id) ? "table-active" : ""}>
                            <td>
                              <button type="button" className="btn btn-link text-start p-0 text-decoration-none" onClick={() => setSelectedRecordId(String(record.id))}>
                                <div className="fw-semibold">{record.title}</div>
                                <div className="text-muted small">{record.employee?.full_name || record.candidate?.full_name || "New hire"} • Join {formatDisplayDate(record.target_joining_date)}</div>
                              </button>
                            </td>
                            <td>{record.owner?.display_name || record.owner?.username || "HR Desk"}</td>
                            <td style={{ minWidth: 160 }}>
                              <div className="progress" style={{ height: 8 }}>
                                <div className="progress-bar bg-primary" role="progressbar" style={{ width: `${record.progress_percentage || 0}%` }} />
                              </div>
                              <div className="text-muted small mt-2">{record.progress_percentage || 0}% complete</div>
                            </td>
                            <td><span className={`payroll-badge ${toneClass(statusTone(record.status))}`}>{String(record.status || "").replace(/_/g, " ")}</span></td>
                            <td>
                              <div className="d-flex justify-content-end gap-2 flex-wrap">
                                {canManage ? <button type="button" className="btn btn-sm btn-light" onClick={() => openRecordModal(record)}>Edit</button> : null}
                                {canManage ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => quickAction(`/onboarding/records/${record.id}/sync_tasks/`, "Unable to sync tasks.")}>Sync Tasks</button> : null}
                                {canManage && record.status !== "completed" ? <button type="button" className="btn btn-sm btn-primary" onClick={() => quickAction(`/onboarding/records/${record.id}/complete/`, "Unable to complete onboarding plan.")}>Complete</button> : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Task Tracker</h5>
                  <div className="payroll-table-subtitle">{selectedRecord ? `Tasks for ${selectedRecord.title}` : "Select a plan to see tasks."}</div>
                </div>
                <div className="payroll-table-controls">
                  {canManage && selectedRecord ? <button type="button" className="btn btn-primary" onClick={() => openTaskModal()}><i className="ti ti-circle-plus me-2" />Add Task</button> : null}
                </div>
              </div>
              <div className="card-body">
                {!selectedRecord ? <HrmEmptyState title="Select an onboarding plan" description="Choose a plan from the table above to manage tasks, blockers, and completion status." /> : selectedTasks.length === 0 ? <HrmEmptyState title="No tasks yet" description="Sync tasks from the template or add a task manually to start the onboarding checklist." /> : (
                  <div className="payroll-summary-list">
                    {selectedTasks.map((task) => (
                      <div className="payroll-summary-row" key={task.id}>
                        <div>
                          <div className="payroll-primary-text">{task.title}</div>
                          <div className="payroll-secondary-text">{task.task_type} • Due {formatDisplayDate(task.due_date)} • {task.assigned_to?.display_name || task.assigned_to?.username || "Unassigned"}</div>
                        </div>
                        <div className="d-flex gap-2 align-items-center flex-wrap justify-content-end">
                          <span className={`payroll-badge ${toneClass(statusTone(task.status))}`}>{String(task.status || "").replace(/_/g, " ")}</span>
                          {canManage ? <button type="button" className="btn btn-sm btn-light" onClick={() => openTaskModal(task)}>Edit</button> : null}
                          {canManage && task.status !== "completed" ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => quickAction(`/onboarding/tasks/${task.id}/complete/`, "Unable to complete task.")}>Mark Done</button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-xl-4">
            <HrmSideList title="Live Highlights" items={highlights} emptyLabel="No onboarding highlights yet." />
          </div>
        </div>

        <HrmModal
          open={recordModalOpen}
          title={editingRecord ? "Edit Onboarding Plan" : "Add Onboarding Plan"}
          subtitle="Create a landing workflow for a new hire, internal transfer, or candidate moving to joined status."
          onClose={() => { setRecordModalOpen(false); resetRecordForm(); }}
          onSubmit={saveRecord}
          submitLabel={saving ? "Saving..." : editingRecord ? "Save Changes" : "Create Plan"}
          summary={<div className="payroll-summary-list">
            <div className="payroll-summary-row"><span>Plan</span><strong>{recordForm.title || "-"}</strong></div>
            <div className="payroll-summary-row"><span>Employee</span><strong>{dependencies.employees.find((item) => String(item.value) === String(recordForm.employee_id))?.label || "-"}</strong></div>
            <div className="payroll-summary-row"><span>Candidate</span><strong>{dependencies.candidates.find((item) => String(item.value) === String(recordForm.candidate_id))?.label || "-"}</strong></div>
            <div className="payroll-summary-row"><span>Template</span><strong>{dependencies.templates.find((item) => String(item.value) === String(recordForm.template_id))?.label || "-"}</strong></div>
          </div>}
        >
          <div className="card payroll-section-card"><div className="card-body"><div className="row g-3">
            <div className="col-md-6"><label className="form-label">Title</label><input className="form-control" value={recordForm.title} onChange={(event) => setRecordForm((current) => ({ ...current, title: event.target.value }))} required /></div>
            <div className="col-md-6"><label className="form-label">Status</label><select className="form-select" value={recordForm.status} onChange={(event) => setRecordForm((current) => ({ ...current, status: event.target.value }))}><option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option></select></div>
            <div className="col-md-6"><label className="form-label">Employee</label><select className="form-select" value={recordForm.employee_id} onChange={(event) => setRecordForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Select employee</option>{dependencies.employees.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="col-md-6"><label className="form-label">Candidate</label><select className="form-select" value={recordForm.candidate_id} onChange={(event) => setRecordForm((current) => ({ ...current, candidate_id: event.target.value }))}><option value="">Select candidate</option>{dependencies.candidates.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="col-md-6"><label className="form-label">Template</label><select className="form-select" value={recordForm.template_id} onChange={(event) => setRecordForm((current) => ({ ...current, template_id: event.target.value }))}><option value="">Select template</option>{dependencies.templates.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="col-md-6"><label className="form-label">Target Joining Date</label><input type="date" className="form-control" value={recordForm.target_joining_date} onChange={(event) => setRecordForm((current) => ({ ...current, target_joining_date: event.target.value }))} /></div>
            <div className="col-12"><label className="form-label">Notes</label><textarea className="form-control" rows={5} value={recordForm.notes} onChange={(event) => setRecordForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div></div></div>
        </HrmModal>

        <HrmModal
          open={taskModalOpen}
          title={editingTask ? "Edit Onboarding Task" : "Add Onboarding Task"}
          subtitle="Track the cross-functional tasks needed to land the employee cleanly."
          onClose={() => { setTaskModalOpen(false); setEditingTask(null); setTaskForm(defaultTaskForm); }}
          onSubmit={saveTask}
          submitLabel={saving ? "Saving..." : editingTask ? "Save Task" : "Create Task"}
          summary={<div className="payroll-summary-list">
            <div className="payroll-summary-row"><span>Plan</span><strong>{selectedRecord?.title || "-"}</strong></div>
            <div className="payroll-summary-row"><span>Task</span><strong>{taskForm.title || "-"}</strong></div>
            <div className="payroll-summary-row"><span>Status</span><strong>{taskForm.status}</strong></div>
            <div className="payroll-summary-row"><span>Due</span><strong>{taskForm.due_date || "-"}</strong></div>
          </div>}
        >
          <div className="card payroll-section-card"><div className="card-body"><div className="row g-3">
            <div className="col-md-6"><label className="form-label">Task Title</label><input className="form-control" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} required /></div>
            <div className="col-md-6"><label className="form-label">Task Type</label><input className="form-control" value={taskForm.task_type} onChange={(event) => setTaskForm((current) => ({ ...current, task_type: event.target.value }))} /></div>
            <div className="col-md-6"><label className="form-label">Due Date</label><input type="date" className="form-control" value={taskForm.due_date} onChange={(event) => setTaskForm((current) => ({ ...current, due_date: event.target.value }))} /></div>
            <div className="col-md-6"><label className="form-label">Status</label><select className="form-select" value={taskForm.status} onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option></select></div>
            <div className="col-12"><label className="form-label">Notes</label><textarea className="form-control" rows={4} value={taskForm.notes} onChange={(event) => setTaskForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div></div></div>
        </HrmModal>
      </div>
    </div>
  );
};

export default OnboardingDeskPage;
