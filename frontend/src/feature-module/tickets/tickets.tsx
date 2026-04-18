import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import API from "../../api/axios";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";

type TicketComment = {
  author?: string;
  message?: string;
  created_at?: string;
};

type TicketData = {
  code?: string;
  category?: string;
  title?: string;
  subject?: string;
  description?: string;
  priority?: string;
  status?: string;
  assigned_to?: string;
  requested_by?: string;
  requester_email?: string;
  comments?: TicketComment[];
  is_private?: boolean;
};

type TicketRecord = {
  id: string;
  data: TicketData;
  created_at?: string;
  updated_at?: string;
};

const RESOURCE = "/data/tickets/";
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const STATUS_OPTIONS = ["Open", "On Hold", "Reopened", "Closed"];

const Tickets: React.FC = () => {
  const routes = all_routes;
  const { search } = useLocation();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<TicketRecord | null>(null);

  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const [form, setForm] = useState({
    code: "",
    category: "",
    title: "",
    subject: "",
    description: "",
    priority: "High",
    status: "Open",
    assigned_to: "",
    requested_by: "",
    requester_email: "",
    is_private: false,
  });

  const normalize = (data: any): TicketRecord[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(RESOURCE);
      setTickets(normalize(res.data));
    } catch (err) {
      console.error("Failed to load tickets", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("add") === "1") {
      setShowAdd(true);
    }
  }, [search]);

  const resetForm = () => {
    setForm({
      code: "",
      category: "",
      title: "",
      subject: "",
      description: "",
      priority: "High",
      status: "Open",
      assigned_to: "",
      requested_by: "",
      requester_email: "",
      is_private: false,
    });
  };

  const nextCode = () => {
    const nums = tickets
      .map((t) => t.data?.code || "")
      .map((code) => parseInt(code.replace(/\D/g, "") || "0", 10));
    const next = Math.max(0, ...nums) + 1;
    return `TIC-${String(next).padStart(3, "0")}`;
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title.trim() || !form.category.trim()) {
      alert("Title and Category are required");
      return;
    }
    try {
      await API.post(RESOURCE, {
        data: {
          ...form,
          code: form.code.trim() || nextCode(),
          title: form.title.trim(),
          category: form.category.trim(),
          subject: form.subject.trim() || form.title.trim(),
          description: form.description.trim(),
          assigned_to: form.assigned_to.trim(),
          requested_by: form.requested_by.trim(),
          requester_email: form.requester_email.trim(),
          comments: [],
        },
      });
      setShowAdd(false);
      resetForm();
      load();
    } catch (err) {
      console.error("Add ticket failed", err);
      alert("Failed to add ticket");
    }
  };
  const openEdit = (item: TicketRecord) => {
    setEditing(item);
    setForm({
      code: item.data?.code || "",
      category: item.data?.category || "",
      title: item.data?.title || "",
      subject: item.data?.subject || "",
      description: item.data?.description || "",
      priority: item.data?.priority || "High",
      status: item.data?.status || "Open",
      assigned_to: item.data?.assigned_to || "",
      requested_by: item.data?.requested_by || "",
      requester_email: item.data?.requester_email || "",
      is_private: !!item.data?.is_private,
    });
    setShowEdit(true);
  };

  const handleEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editing) return;
    try {
      await API.put(`${RESOURCE}${editing.id}/`, {
        data: {
          ...editing.data,
          ...form,
          code: form.code.trim() || editing.data?.code || nextCode(),
          title: form.title.trim(),
          category: form.category.trim(),
          subject: form.subject.trim() || form.title.trim(),
          description: form.description.trim(),
          assigned_to: form.assigned_to.trim(),
          requested_by: form.requested_by.trim(),
          requester_email: form.requester_email.trim(),
        },
      });
      setShowEdit(false);
      setEditing(null);
      resetForm();
      load();
    } catch (err) {
      console.error("Edit ticket failed", err);
      alert("Failed to update ticket");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this ticket?")) return;
    try {
      await API.delete(`${RESOURCE}${id}/`);
      load();
    } catch (err) {
      console.error("Delete ticket failed", err);
      alert("Failed to delete ticket");
    }
  };

  const priorityBadge = (priority?: string) => {
    switch (priority) {
      case "High":
        return "badge-danger";
      case "Medium":
        return "badge-warning";
      case "Low":
        return "badge-success";
      default:
        return "badge-secondary";
    }
  };

  const statusBadge = (status?: string) => {
    switch (status) {
      case "Open":
        return "bg-outline-pink";
      case "On Hold":
        return "bg-outline-warning";
      case "Reopened":
        return "bg-outline-purple";
      case "Closed":
        return "bg-outline-success";
      default:
        return "bg-outline-secondary";
    }
  };

  const formatUpdated = (value?: string) => {
    if (!value) return "Updated just now";
    const diff = Date.now() - new Date(value).getTime();
    if (Number.isNaN(diff)) return "Updated recently";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Updated ${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Updated ${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `Updated ${days} days ago`;
  };

  const filteredTickets = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let items = tickets.filter((t) => {
      const title = t.data?.title || "";
      const subject = t.data?.subject || "";
      const category = t.data?.category || "";
      const assignee = t.data?.assigned_to || "";
      const matchesSearch =
        !q ||
        title.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        assignee.toLowerCase().includes(q);
      const matchesPriority = !priorityFilter || t.data?.priority === priorityFilter;
      const matchesStatus = !statusFilter || t.data?.status === statusFilter;
      return matchesSearch && matchesPriority && matchesStatus;
    });

    if (sortBy === "asc") {
      items = [...items].sort((a, b) =>
        String(a.updated_at || a.created_at || "").localeCompare(
          String(b.updated_at || b.created_at || "")
        )
      );
    } else if (sortBy === "desc") {
      items = [...items].sort((a, b) =>
        String(b.updated_at || b.created_at || "").localeCompare(
          String(a.updated_at || a.created_at || "")
        )
      );
    }
    return items;
  }, [tickets, searchText, priorityFilter, statusFilter, sortBy]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {
      Open: 0,
      "On Hold": 0,
      Reopened: 0,
      Closed: 0,
    };
    tickets.forEach((t) => {
      const st = t.data?.status || "";
      if (byStatus[st] !== undefined) {
        byStatus[st] += 1;
      }
    });
    return {
      newTickets: byStatus.Open,
      openTickets: byStatus.Reopened,
      solvedTickets: byStatus.Closed,
      pendingTickets: byStatus["On Hold"],
    };
  }, [tickets]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const cat = t.data?.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [tickets]);

  const agentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const agent = t.data?.assigned_to || "Unassigned";
      map[agent] = (map[agent] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [tickets]);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="page-header d-flex align-items-center justify-content-between mb-4">
          <div>
            <h3 className="page-title">Tickets</h3>
            <ul className="breadcrumb">
              <li className="breadcrumb-item">Employee</li>
              <li className="breadcrumb-item active">Tickets</li>
            </ul>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-primary"
              onClick={() => setShowAdd(true)}
            >
              <i className="ti ti-circle-plus me-2" /> Add Ticket
            </button>
            <div className="head-icons ms-1">
              <CollapseHeader />
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-xl-3 col-md-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">New Tickets</p>
                <h4 className="mb-0">{counts.newTickets}</h4>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">Open Tickets</p>
                <h4 className="mb-0">{counts.openTickets}</h4>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">Solved Tickets</p>
                <h4 className="mb-0">{counts.solvedTickets}</h4>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6">
            <div className="card">
              <div className="card-body">
                <p className="text-muted mb-1">Pending Tickets</p>
                <h4 className="mb-0">{counts.pendingTickets}</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <h5 className="mb-0">Ticket List</h5>
            <div className="d-flex flex-wrap gap-2">
              <select
                className="form-select form-select-sm"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">Priority</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Select Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">Sort By: Recent</option>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-xl-9 col-md-8">
            {loading ? (
              <div className="card">
                <div className="card-body">Loading tickets...</div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="card">
                <div className="card-body">No tickets found.</div>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div className="card" key={ticket.id}>
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                    <h5 className="text-info fw-medium">
                      {ticket.data?.category || "Support"}
                    </h5>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${priorityBadge(ticket.data?.priority)}`}>
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        {ticket.data?.priority || "Low"}
                      </span>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => openEdit(ticket)}
                      >
                        <i className="ti ti-edit" />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(ticket.id)}
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <span className="badge badge-info rounded-pill mb-2">
                      {ticket.data?.code || "TIC"}
                    </span>
                    <div className="d-flex align-items-center mb-2">
                      <h5 className="fw-semibold me-2">
                        <Link to={`${routes.ticketDetails}?id=${ticket.id}`}>
                          {ticket.data?.title || "Untitled"}
                        </Link>
                      </h5>
                      <span className={`badge ${statusBadge(ticket.data?.status)} d-flex align-items-center ms-1`}>
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        {ticket.data?.status || "Open"}
                      </span>
                    </div>
                    <div className="d-flex align-items-center flex-wrap row-gap-2">
                      <p className="d-flex align-items-center mb-0 me-2">
                        <ImageWithBasePath
                          src="assets/img/profiles/avatar-01.jpg"
                          className="avatar avatar-xs rounded-circle me-2"
                          alt="img"
                        />
                        Assigned to
                        <span className="text-dark ms-1">
                          {ticket.data?.assigned_to || "Unassigned"}
                        </span>
                      </p>
                      <p className="d-flex align-items-center mb-0 me-2">
                        <i className="ti ti-calendar-bolt me-1" />
                        {formatUpdated(ticket.updated_at)}
                      </p>
                      <p className="d-flex align-items-center mb-0">
                        <i className="ti ti-message-share me-1" />
                        {ticket.data?.comments?.length || 0} Comments
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="col-xl-3 col-md-4">
            <div className="card">
              <div className="card-header">
                <h4>Ticket Categories</h4>
              </div>
              <div className="card-body p-0">
                <div className="d-flex flex-column">
                  {categoryCounts.length === 0 ? (
                    <div className="p-3 text-muted">No categories</div>
                  ) : (
                    categoryCounts.map((cat) => (
                      <div
                        key={cat.name}
                        className="d-flex align-items-center justify-content-between border-bottom p-3"
                      >
                        <span>{cat.name}</span>
                        <span className="badge badge-xs bg-dark rounded-circle">
                          {cat.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4>Support Agents</h4>
              </div>
              <div className="card-body p-0">
                <div className="d-flex flex-column">
                  {agentCounts.length === 0 ? (
                    <div className="p-3 text-muted">No agents</div>
                  ) : (
                    agentCounts.map((agent) => (
                      <div
                        key={agent.name}
                        className="d-flex align-items-center justify-content-between border-bottom p-3"
                      >
                        <span className="d-flex align-items-center">
                          <ImageWithBasePath
                            src="assets/img/profiles/avatar-02.jpg"
                            className="avatar avatar-xs rounded-circle me-2"
                            alt="img"
                          />
                          {agent.name}
                        </span>
                        <span className="badge badge-xs bg-dark rounded-circle">
                          {agent.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={handleAdd}>
                <div className="modal-header">
                  <h5 className="modal-title">Add Ticket</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAdd(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Ticket Code</label>
                      <input
                        className="form-control"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        placeholder="TIC-001"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Category</label>
                      <input
                        className="form-control"
                        list="ticket-categories"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="IT Support"
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Title</label>
                      <input
                        className="form-control"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Laptop Issue"
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Subject</label>
                      <input
                        className="form-control"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        placeholder="Short summary"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Assign To</label>
                      <input
                        className="form-control"
                        list="ticket-agents"
                        value={form.assigned_to}
                        onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                        placeholder="Agent name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Requested By</label>
                      <input
                        className="form-control"
                        value={form.requested_by}
                        onChange={(e) => setForm({ ...form, requested_by: e.target.value })}
                        placeholder="Employee name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Requester Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={form.requester_email}
                        onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 d-flex align-items-center">
                      <div className="form-check mt-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={form.is_private}
                          onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                          id="ticketPrivate"
                        />
                        <label className="form-check-label" htmlFor="ticketPrivate">
                          Mark as Private
                        </label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Ticket details"
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowAdd(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEdit && editing && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={handleEdit}>
                <div className="modal-header">
                  <h5 className="modal-title">Edit Ticket</h5>
                  <button type="button" className="btn-close" onClick={() => setShowEdit(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Ticket Code</label>
                      <input
                        className="form-control"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Category</label>
                      <input
                        className="form-control"
                        list="ticket-categories"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Title</label>
                      <input
                        className="form-control"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Subject</label>
                      <input
                        className="form-control"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Assign To</label>
                      <input
                        className="form-control"
                        list="ticket-agents"
                        value={form.assigned_to}
                        onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Requested By</label>
                      <input
                        className="form-control"
                        value={form.requested_by}
                        onChange={(e) => setForm({ ...form, requested_by: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Requester Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={form.requester_email}
                        onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 d-flex align-items-center">
                      <div className="form-check mt-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={form.is_private}
                          onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                          id="ticketPrivateEdit"
                        />
                        <label className="form-check-label" htmlFor="ticketPrivateEdit">
                          Mark as Private
                        </label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowEdit(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <datalist id="ticket-categories">
        {categoryCounts.map((cat) => (
          <option key={cat.name} value={cat.name} />
        ))}
      </datalist>
      <datalist id="ticket-agents">
        {agentCounts.map((agent) => (
          <option key={agent.name} value={agent.name} />
        ))}
      </datalist>
    </div>
  );
};

export default Tickets;
