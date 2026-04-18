import React, { useCallback, useEffect, useMemo, useState } from "react";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import {
  HrmEmptyState,
  HrmHero,
  HrmModal,
  HrmSideList,
  activeFilterCount,
  formatDateTimeLabel,
} from "../hrm/hrmShared";
import {
  checklistProgress,
  eventCountdown,
  formatDisplayDate,
  normalizeListResponse,
  noteMatches,
  noteToneClass,
  parseTableRowsText,
  splitCommaValues,
  splitParagraphs,
  stringifyTableRows,
  tablePreviewCount,
} from "./productivityShared";
import UpcomingReminderBanner from "./UpcomingReminderBanner";

const TONE_OPTIONS = [
  { value: "amber", label: "Amber" },
  { value: "coral", label: "Coral" },
  { value: "ocean", label: "Ocean" },
  { value: "mint", label: "Mint" },
  { value: "violet", label: "Violet" },
];

const defaultChecklistItem = () => ({ text: "", done: false });

const defaultForm = {
  title: "",
  category: "",
  tone: "amber",
  tags_text: "",
  blocks_text: "",
  checklist: [defaultChecklistItem()],
  table_columns_text: "",
  table_rows_text: "",
  reminder_at: "",
  is_pinned: false,
  is_archived: false,
};

const ProductivityNotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [toneFilter, setToneFilter] = useState("");
  const [archiveMode, setArchiveMode] = useState("active");
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/productivity/notes/");
      setNotes(normalizeListResponse(response.data));
    } catch (error) {
      console.error("Failed to load notes", error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(notes.map((note) => note.category).filter(Boolean))).sort((left, right) => String(left).localeCompare(String(right))),
    [notes]
  );

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) => {
        const matchesSearch = noteMatches(note, search);
        const matchesCategory = !categoryFilter || String(note.category || "") === categoryFilter;
        const matchesTone = !toneFilter || String(note.tone || "") === toneFilter;
        const matchesArchive = archiveMode === "all" || (archiveMode === "active" ? !note.is_archived : note.is_archived);
        return matchesSearch && matchesCategory && matchesTone && matchesArchive;
      }),
    [archiveMode, categoryFilter, notes, search, toneFilter]
  );

  const stats = useMemo(() => {
    const pinned = filteredNotes.filter((item) => item.is_pinned).length;
    const withReminder = filteredNotes.filter((item) => item.reminder_at).length;
    const withTables = filteredNotes.filter((item) => tablePreviewCount(item.table_data).rows > 0).length;
    return [
      { label: "Notes", value: filteredNotes.length, meta: "Private workspace for HR and stakeholders" },
      { label: "Pinned", value: pinned, meta: "Fast-access reference notes" },
      { label: "Reminder-backed", value: withReminder, meta: "Notes that surface with a date" },
      { label: "Structured", value: withTables, meta: "Table-backed notes ready" },
    ];
  }, [filteredNotes]);

  const highlights = useMemo(
    () =>
      filteredNotes
        .filter((item) => item.is_pinned)
        .slice(0, 6)
        .map((item) => ({
          label: item.title,
          meta: `${item.category || "Uncategorised"} · ${checklistProgress(item.checklist).completed}/${checklistProgress(item.checklist).total} checklist`,
          value: item.reminder_at ? eventCountdown(item.reminder_at) : item.tone,
          tone: item.reminder_at ? "warning" : "accent",
        })),
    [filteredNotes]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (record) => {
    const paragraphs = Array.isArray(record.blocks) ? record.blocks.map((item) => item?.text || "").filter(Boolean).join("\n\n") : "";
    setEditing(record);
    setForm({
      title: record.title || "",
      category: record.category || "",
      tone: record.tone || "amber",
      tags_text: Array.isArray(record.tags) ? record.tags.join(", ") : "",
      blocks_text: paragraphs,
      checklist: Array.isArray(record.checklist) && record.checklist.length ? record.checklist.map((item) => ({ text: item.text || "", done: Boolean(item.done) })) : [defaultChecklistItem()],
      table_columns_text: Array.isArray(record.table_data?.columns) ? record.table_data.columns.join(", ") : "",
      table_rows_text: stringifyTableRows(record.table_data?.rows),
      reminder_at: record.reminder_at ? String(record.reminder_at).slice(0, 16) : "",
      is_pinned: Boolean(record.is_pinned),
      is_archived: Boolean(record.is_archived),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const saveNote = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        category: form.category,
        tone: form.tone,
        tags: splitCommaValues(form.tags_text),
        blocks: splitParagraphs(form.blocks_text).map((text) => ({ type: "paragraph", text })),
        checklist: form.checklist.filter((item) => String(item.text || "").trim()).map((item) => ({ text: item.text.trim(), done: Boolean(item.done) })),
        table_data: {
          columns: splitCommaValues(form.table_columns_text),
          rows: parseTableRowsText(form.table_rows_text),
        },
        reminder_at: form.reminder_at || null,
        is_pinned: Boolean(form.is_pinned),
        is_archived: Boolean(form.is_archived),
      };
      if (editing) {
        await API.put(`/productivity/notes/${editing.id}/`, payload);
      } else {
        await API.post("/productivity/notes/", payload);
      }
      closeModal();
      load();
    } catch (error) {
      console.error("Failed to save note", error);
      window.alert(error?.response?.data?.detail || "Unable to save note.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (record) => {
    if (!window.confirm(`Delete the note "${record.title}"?`)) return;
    try {
      await API.delete(`/productivity/notes/${record.id}/`);
      load();
    } catch (error) {
      console.error("Failed to delete note", error);
      window.alert("Unable to delete this note.");
    }
  };

  const toggleAction = async (record, action) => {
    try {
      await API.post(`/productivity/notes/${record.id}/${action}/`);
      load();
    } catch (error) {
      console.error(`Failed to ${action} note`, error);
    }
  };

  const filterCount = activeFilterCount({ search, categoryFilter, toneFilter, archiveMode: archiveMode !== "active" ? archiveMode : "" });

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell">
        <UpcomingReminderBanner compact />
        <HrmHero
          kicker="Notes Studio"
          title="Team Notes"
          subtitle="An iOS-notes style workspace for HR and stakeholders with paragraphs, checklist items, table sections, tags, reminder timestamps, and quick pinning for operational memory."
          stats={stats}
          action={
            <>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <i className="ti ti-notes me-2" />
                New Note
              </button>
              <div className="head-icons"><CollapseHeader /></div>
            </>
          }
        >
          <span className="employee-chip"><i className="ti ti-table" />Add checklist blocks and mini tables inside the same note</span>
          <span className="employee-chip"><i className="ti ti-bell-ringing" />Pin reminders to notes so they surface before the event</span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-9">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Private note library</h5>
                  <div className="payroll-table-subtitle">Search across tags, block text, checklist items, and table content without losing alignment.</div>
                </div>
                <div className="payroll-table-controls">
                  <input className="form-control" style={{ minWidth: 240 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search note title, tag, content, checklist" />
                  <select className="form-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="">All categories</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select className="form-select" value={toneFilter} onChange={(event) => setToneFilter(event.target.value)}>
                    <option value="">All tones</option>
                    {TONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="form-select" value={archiveMode} onChange={(event) => setArchiveMode(event.target.value)}>
                    <option value="active">Active only</option>
                    <option value="archived">Archived only</option>
                    <option value="all">All notes</option>
                  </select>
                  <div className="payroll-filter-actions">
                    <span className="payroll-filter-meta">Filters <strong>{filterCount}</strong></span>
                    <button type="button" className="btn btn-light" onClick={() => { setSearch(""); setCategoryFilter(""); setToneFilter(""); setArchiveMode("active"); }}>
                      Reset
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-5 text-muted">Loading note workspace...</div>
                ) : filteredNotes.length === 0 ? (
                  <HrmEmptyState icon="ti ti-notes-off" title="No notes here yet" description="Create handover notes, policy prep, interview prep, or stakeholder discussions in one place." />
                ) : (
                  <div className="row g-3">
                    {filteredNotes.map((note) => {
                      const checklist = checklistProgress(note.checklist);
                      const tablePreview = tablePreviewCount(note.table_data);
                      const firstBlock = Array.isArray(note.blocks) ? note.blocks.find((item) => item?.text)?.text : "";
                      return (
                        <div className="col-md-6 col-xxl-4" key={note.id}>
                          <div className={`productivity-note-card ${noteToneClass(note.tone)}`}>
                            <div className="productivity-note-top">
                              <div>
                                <div className="productivity-note-meta">{note.category || "General note"}</div>
                                <h5>{note.title}</h5>
                              </div>
                              <div className="d-flex gap-2 flex-wrap justify-content-end">
                                {note.is_pinned ? <span className="payroll-badge warning">Pinned</span> : null}
                                {note.is_archived ? <span className="payroll-badge">Archived</span> : null}
                              </div>
                            </div>
                            <p className="productivity-note-copy">{firstBlock || "No paragraph content yet."}</p>
                            <div className="productivity-note-grid">
                              <div>
                                <span>Checklist</span>
                                <strong>{checklist.completed}/{checklist.total}</strong>
                              </div>
                              <div>
                                <span>Table</span>
                                <strong>{tablePreview.columns} × {tablePreview.rows}</strong>
                              </div>
                              <div>
                                <span>Updated</span>
                                <strong>{formatDisplayDate(note.updated_at)}</strong>
                              </div>
                              <div>
                                <span>Reminder</span>
                                <strong>{note.reminder_at ? eventCountdown(note.reminder_at) : "None"}</strong>
                              </div>
                            </div>
                            {Array.isArray(note.tags) && note.tags.length ? (
                              <div className="d-flex gap-2 flex-wrap mt-3">
                                {note.tags.slice(0, 4).map((tag) => <span className="productivity-tag" key={tag}>#{tag}</span>)}
                              </div>
                            ) : null}
                            <div className="d-flex gap-2 flex-wrap mt-3">
                              <button type="button" className="btn btn-light btn-sm" onClick={() => openEdit(note)}>Edit</button>
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => toggleAction(note, "pin")}>{note.is_pinned ? "Unpin" : "Pin"}</button>
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => toggleAction(note, "archive")}>{note.is_archived ? "Restore" : "Archive"}</button>
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deleteNote(note)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-xl-3">
            <HrmSideList title="Pinned and ready" items={highlights} emptyLabel="Pin important notes to surface them here." />
          </div>
        </div>

        <HrmModal
          open={showModal}
          title={editing ? "Update Note" : "Create Note"}
          subtitle="Combine free-form writing, a checklist, and a mini table so the note behaves more like a real operations notebook."
          onClose={closeModal}
          onSubmit={saveNote}
          submitLabel={saving ? "Saving..." : editing ? "Save Note" : "Create Note"}
          summary={
            <div className="payroll-summary-list">
              <div className="payroll-summary-row"><span>Title</span><strong>{form.title || "Untitled note"}</strong></div>
              <div className="payroll-summary-row"><span>Category</span><strong>{form.category || "General"}</strong></div>
              <div className="payroll-summary-row"><span>Tone</span><strong>{TONE_OPTIONS.find((item) => item.value === form.tone)?.label || "Amber"}</strong></div>
              <div className="payroll-summary-row"><span>Checklist items</span><strong>{form.checklist.filter((item) => String(item.text || "").trim()).length}</strong></div>
              <div className="payroll-summary-row"><span>Reminder</span><strong>{form.reminder_at ? formatDateTimeLabel(form.reminder_at) : "None"}</strong></div>
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
                  <label className="form-label">Category</label>
                  <input className="form-control" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Recruitment, Payroll, People" />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Color tone</label>
                  <select className="form-select" value={form.tone} onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value }))}>
                    {TONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="col-md-8">
                  <label className="form-label">Tags</label>
                  <input className="form-control" value={form.tags_text} onChange={(event) => setForm((current) => ({ ...current, tags_text: event.target.value }))} placeholder="offer prep, stakeholder sync, payroll close" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Reminder</label>
                  <input type="datetime-local" className="form-control" value={form.reminder_at} onChange={(event) => setForm((current) => ({ ...current, reminder_at: event.target.value }))} />
                </div>
                <div className="col-12">
                  <label className="form-label">Paragraph blocks</label>
                  <textarea className="form-control" rows={6} value={form.blocks_text} onChange={(event) => setForm((current) => ({ ...current, blocks_text: event.target.value }))} placeholder="Separate paragraphs with a blank line. This becomes the main note body." />
                </div>
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label mb-0">Checklist</label>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setForm((current) => ({ ...current, checklist: [...current.checklist, defaultChecklistItem()] }))}>
                      <i className="ti ti-checklist me-1" />Add item
                    </button>
                  </div>
                  <div className="productivity-checklist-editor">
                    {form.checklist.map((item, index) => (
                      <div className="productivity-checklist-row" key={`check-${index}`}>
                        <input type="checkbox" checked={Boolean(item.done)} onChange={(event) => setForm((current) => ({ ...current, checklist: current.checklist.map((entry, entryIndex) => entryIndex === index ? { ...entry, done: event.target.checked } : entry) }))} />
                        <input className="form-control" value={item.text} onChange={(event) => setForm((current) => ({ ...current, checklist: current.checklist.map((entry, entryIndex) => entryIndex === index ? { ...entry, text: event.target.value } : entry) }))} placeholder="Checklist item" />
                        <button type="button" className="btn btn-light btn-sm" onClick={() => setForm((current) => ({ ...current, checklist: current.checklist.filter((_, entryIndex) => entryIndex !== index).length ? current.checklist.filter((_, entryIndex) => entryIndex !== index) : [defaultChecklistItem()] }))}>
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Table columns</label>
                  <input className="form-control" value={form.table_columns_text} onChange={(event) => setForm((current) => ({ ...current, table_columns_text: event.target.value }))} placeholder="Topic, Owner, Status" />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Table rows</label>
                  <textarea className="form-control" rows={4} value={form.table_rows_text} onChange={(event) => setForm((current) => ({ ...current, table_rows_text: event.target.value }))} placeholder={"One row per line. Use | between cells.\nExample: Offer draft | Asha | In progress"} />
                </div>
                <div className="col-md-6">
                  <div className="form-check mt-2">
                    <input className="form-check-input" type="checkbox" checked={form.is_pinned} id="notePinned" onChange={(event) => setForm((current) => ({ ...current, is_pinned: event.target.checked }))} />
                    <label className="form-check-label" htmlFor="notePinned">Pin this note</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-check mt-2">
                    <input className="form-check-input" type="checkbox" checked={form.is_archived} id="noteArchived" onChange={(event) => setForm((current) => ({ ...current, is_archived: event.target.checked }))} />
                    <label className="form-check-label" htmlFor="noteArchived">Archive after save</label>
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

export default ProductivityNotesPage;
