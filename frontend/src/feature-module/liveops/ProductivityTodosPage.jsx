import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmEmptyState, HrmHero, HrmModal, HrmSideList, activeFilterCount, formatDateTimeLabel, toneClass } from "../hrm/hrmShared";
import { checklistProgress, normalizeListResponse, splitCommaValues, todoMatches, eventCountdown } from "./productivityShared";
import UpcomingReminderBanner from "./UpcomingReminderBanner";

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const priorityTone = (value) => {
  const key = String(value || "medium").toLowerCase();
  if (key === "urgent") return "danger";
  if (key === "high") return "warning";
  if (key === "low") return "success";
  return "accent";
};

const emptyChecklistItem = () => ({ text: "", done: false });

const defaultForm = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  due_at: "",
  labels_text: "",
  linked_url: "",
  checklist: [emptyChecklistItem()],
};

const ProductivityTodosPage = () => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/productivity/todos/");
      setTodos(normalizeListResponse(response.data));
    } catch (error) {
      console.error("Failed to load todos", error);
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTodos = useMemo(
    () =>
      todos.filter((todo) => {
        const matchesSearch = todoMatches(todo, search);
        const matchesPriority = !priorityFilter || String(todo.priority || "") === priorityFilter;
        return matchesSearch && matchesPriority;
      }),
    [priorityFilter, search, todos]
  );

  const stats = useMemo(() => {
    const todoCount = filteredTodos.filter((item) => item.status === "todo").length;
    const inProgress = filteredTodos.filter((item) => item.status === "in_progress").length;
    const waiting = filteredTodos.filter((item) => item.status === "waiting").length;
    const completed = filteredTodos.filter((item) => item.status === "completed").length;
    return [
      { label: "Open tasks", value: todoCount, meta: "Fresh work to start" },
      { label: "In progress", value: inProgress, meta: "Currently moving" },
      { label: "Waiting", value: waiting, meta: "Blocked or awaiting input" },
      { label: "Completed", value: completed, meta: "Closed from this board" },
    ];
  }, [filteredTodos]);

  const highlights = useMemo(
    () =>
      filteredTodos
        .filter((item) => item.due_at && item.status !== "completed")
        .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime())
        .slice(0, 6)
        .map((item) => ({
          label: item.title,
          meta: `${item.status.replace(/_/g, " ")} · ${checklistProgress(item.checklist).completed}/${checklistProgress(item.checklist).total} checklist`,
          value: eventCountdown(item.due_at),
          tone: priorityTone(item.priority),
        })),
    [filteredTodos]
  );

  const grouped = useMemo(
    () => STATUS_OPTIONS.map((statusOption) => ({
      ...statusOption,
      items: filteredTodos.filter((todo) => todo.status === statusOption.value),
    })),
    [filteredTodos]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      title: record.title || "",
      description: record.description || "",
      status: record.status || "todo",
      priority: record.priority || "medium",
      due_at: record.due_at ? String(record.due_at).slice(0, 16) : "",
      labels_text: Array.isArray(record.labels) ? record.labels.join(", ") : "",
      linked_url: record.linked_url || "",
      checklist: Array.isArray(record.checklist) && record.checklist.length ? record.checklist.map((item) => ({ text: item.text || "", done: Boolean(item.done) })) : [emptyChecklistItem()],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const saveTodo = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_at: form.due_at || null,
        labels: splitCommaValues(form.labels_text),
        linked_url: form.linked_url,
        checklist: form.checklist.filter((item) => String(item.text || "").trim()).map((item) => ({ text: item.text.trim(), done: Boolean(item.done) })),
      };
      if (editing) {
        await API.put(`/productivity/todos/${editing.id}/`, payload);
      } else {
        await API.post("/productivity/todos/", payload);
      }
      closeModal();
      load();
    } catch (error) {
      console.error("Failed to save todo", error);
      window.alert(error?.response?.data?.detail || "Unable to save task.");
    } finally {
      setSaving(false);
    }
  };

  const completeTodo = async (record) => {
    try {
      await API.post(`/productivity/todos/${record.id}/complete/`);
      load();
    } catch (error) {
      console.error("Failed to complete todo", error);
    }
  };

  const deleteTodo = async (record) => {
    if (!window.confirm(`Delete task "${record.title}"?`)) return;
    try {
      await API.delete(`/productivity/todos/${record.id}/`);
      load();
    } catch (error) {
      console.error("Failed to delete todo", error);
      window.alert("Unable to delete this task.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <UpcomingReminderBanner compact />
        <HrmHero
          kicker="Task Board"
          title="To-do Planner"
          subtitle="Track HR and stakeholder follow-up with status lanes, checklist detail, due-time countdowns, labels, and links back to the right workspace."
          stats={stats}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-checklist me-2" />
                New Task
              </button>
              <div className="head-icons"><CollapseHeader /></div>
            </>
          }
        >
          <span className="employee-chip"><i className="ti ti-timeline-event" />Due dates turn into visible countdowns right on the board</span>
          <span className="employee-chip"><i className="ti ti-link" />Keep links back to candidate, payroll, or approval pages inside the task</span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-9">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Operational task board</h5>
                  <div className="payroll-table-subtitle">A structured follow-up board for recruitment, payroll close, approvals, and stakeholder reviews.</div>
                </div>
                <div className="payroll-table-controls">
                  <input className="form-control" style={{ minWidth: 240 }} placeholder="Search tasks, labels, due date, notes" value={search} onChange={(event) => setSearch(event.target.value)} />
                  <select className="form-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="">All priorities</option>
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <div className="payroll-filter-actions">
                    <span className="payroll-filter-meta">Filters <strong>{activeFilterCount({ search, priorityFilter })}</strong></span>
                    <button type="button" className="btn btn-light" onClick={() => { setSearch(""); setPriorityFilter(""); }}>Reset</button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-5 text-muted">Loading task board...</div>
                ) : filteredTodos.length === 0 ? (
                  <HrmEmptyState icon="ti ti-checkup-list" title="No tasks yet" description="Add tasks for hiring follow-up, document collection, approvals, or anything that should stay visible at login." />
                ) : (
                  <div className="productivity-board-grid">
                    {grouped.map((column) => (
                      <div className="productivity-board-column" key={column.value}>
                        <div className="productivity-board-head">
                          <h6>{column.label}</h6>
                          <span>{column.items.length}</span>
                        </div>
                        <div className="d-flex flex-column gap-3">
                          {column.items.map((todo) => {
                            const checklist = checklistProgress(todo.checklist);
                            return (
                              <div className="productivity-task-card" key={todo.id}>
                                <div className="d-flex justify-content-between gap-2 align-items-start">
                                  <div>
                                    <h6>{todo.title}</h6>
                                    <div className="text-muted small">{todo.description || "No extra note yet."}</div>
                                  </div>
                                  <span className={`payroll-badge ${toneClass(priorityTone(todo.priority))}`}>{todo.priority}</span>
                                </div>
                                <div className="productivity-note-grid mt-3">
                                  <div><span>Due</span><strong>{todo.due_at ? eventCountdown(todo.due_at) : "None"}</strong></div>
                                  <div><span>Checklist</span><strong>{checklist.completed}/{checklist.total}</strong></div>
                                </div>
                                {Array.isArray(todo.labels) && todo.labels.length ? (
                                  <div className="d-flex gap-2 flex-wrap mt-3">
                                    {todo.labels.slice(0, 4).map((label) => <span className="productivity-tag" key={label}>{label}</span>)}
                                  </div>
                                ) : null}
                                <div className="d-flex gap-2 flex-wrap mt-3">
                                  <button type="button" className="btn btn-light btn-sm" onClick={() => openEdit(todo)}>Edit</button>
                                  {todo.status !== "completed" ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => completeTodo(todo)}>Complete</button> : null}
                                  {todo.linked_url ? <a className="btn btn-outline-secondary btn-sm" href={todo.linked_url}>Open</a> : null}
                                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deleteTodo(todo)}>Delete</button>
                                </div>
                                {todo.due_at ? <div className="text-muted small mt-2">Due {formatDateTimeLabel(todo.due_at)}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-xl-3">
            <HrmSideList title="Due next" items={highlights} emptyLabel="Add due dates to surface the next tasks here." />
          </div>
        </div>

        <HrmModal
          open={showModal}
          title={editing ? "Update Task" : "Create Task"}
          subtitle="Use checklist items, labels, and due dates so the board can remind you what matters next."
          onClose={closeModal}
          onSubmit={saveTodo}
          submitLabel={saving ? "Saving..." : editing ? "Save Task" : "Create Task"}
          summary={
            <div className="payroll-summary-list">
              <div className="payroll-summary-row"><span>Title</span><strong>{form.title || "Untitled task"}</strong></div>
              <div className="payroll-summary-row"><span>Status</span><strong>{STATUS_OPTIONS.find((item) => item.value === form.status)?.label || "To Do"}</strong></div>
              <div className="payroll-summary-row"><span>Priority</span><strong>{PRIORITY_OPTIONS.find((item) => item.value === form.priority)?.label || "Medium"}</strong></div>
              <div className="payroll-summary-row"><span>Checklist items</span><strong>{form.checklist.filter((item) => String(item.text || "").trim()).length}</strong></div>
              <div className="payroll-summary-row"><span>Due</span><strong>{form.due_at ? formatDateTimeLabel(form.due_at) : "None"}</strong></div>
            </div>
          }
        >
          <div className="card payroll-section-card">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-8">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Capture context, blockers, or what done looks like." />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Due at</label>
                  <input type="datetime-local" className="form-control" value={form.due_at} onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Labels</label>
                  <input className="form-control" value={form.labels_text} onChange={(event) => setForm((current) => ({ ...current, labels_text: event.target.value }))} placeholder="recruitment, docs, payroll" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Linked URL</label>
                  <input className="form-control" value={form.linked_url} onChange={(event) => setForm((current) => ({ ...current, linked_url: event.target.value }))} placeholder="/candidates or /approvals/inbox" />
                </div>
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label mb-0">Checklist</label>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setForm((current) => ({ ...current, checklist: [...current.checklist, emptyChecklistItem()] }))}>
                      <i className="ti ti-circle-plus me-1" />Add item
                    </button>
                  </div>
                  <div className="productivity-checklist-editor">
                    {form.checklist.map((item, index) => (
                      <div className="productivity-checklist-row" key={`todo-check-${index}`}>
                        <input type="checkbox" checked={Boolean(item.done)} onChange={(event) => setForm((current) => ({ ...current, checklist: current.checklist.map((entry, entryIndex) => entryIndex === index ? { ...entry, done: event.target.checked } : entry) }))} />
                        <input className="form-control" value={item.text} onChange={(event) => setForm((current) => ({ ...current, checklist: current.checklist.map((entry, entryIndex) => entryIndex === index ? { ...entry, text: event.target.value } : entry) }))} placeholder="Checklist item" />
                        <button type="button" className="btn btn-light btn-sm" onClick={() => setForm((current) => ({ ...current, checklist: current.checklist.filter((_, entryIndex) => entryIndex !== index).length ? current.checklist.filter((_, entryIndex) => entryIndex !== index) : [emptyChecklistItem()] }))}>
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </HrmModal>
      </div>
    </div>
  );
};

export default ProductivityTodosPage;
