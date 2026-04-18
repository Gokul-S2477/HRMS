import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../../api/axios";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";

const RESOURCE = "/data/tickets/";
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const STATUS_OPTIONS = ["Open", "On Hold", "Reopened", "Closed"];

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

const TicketDetails: React.FC = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const { search } = useLocation();
  const ticketId = new URLSearchParams(search).get("id") || "";

  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ticketList, setTicketList] = useState<TicketRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);

  const normalize = (data: any): TicketRecord[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const loadTicket = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`${RESOURCE}${id}/`);
      setTicket(res.data);
    } catch (err) {
      console.error("Failed to load ticket", err);
      setError("Unable to load ticket.");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = useCallback(async () => {
    try {
      const res = await API.get(RESOURCE);
      const list = normalize(res.data);
      setTicketList(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load tickets", err);
      setTicketList([]);
    }
  }, [selectedId]);

  useEffect(() => {
    if (ticketId) {
      loadTicket(ticketId);
    } else {
      loadTickets();
    }
  }, [ticketId, loadTickets]);

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

  const comments = ticket?.data?.comments || [];

  const updateTicket = async (nextData: Partial<TicketData>) => {
    if (!ticket) return;
    setSaving(true);
    try {
      const res = await API.put(`${RESOURCE}${ticket.id}/`, {
        data: {
          ...ticket.data,
          ...nextData,
        },
      });
      setTicket(res.data);
    } catch (err) {
      console.error("Failed to update ticket", err);
      alert("Failed to update ticket.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddReply = async () => {
    if (!replyText.trim() || !ticket) return;
    const nextComments = [
      ...comments,
      {
        author: "Admin",
        message: replyText.trim(),
        created_at: new Date().toISOString(),
      },
    ];
    await updateTicket({ comments: nextComments });
    setReplyText("");
    setReplyOpen(false);
  };

  const handleTogglePrivacy = () => {
    updateTicket({ is_private: !ticket?.data?.is_private });
  };

  const handleSelectChange = (field: keyof TicketData, value: string) => {
    updateTicket({ [field]: value } as Partial<TicketData>);
  };

  if (!ticketId) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell employee-shell">
          <div className="page-header d-flex align-items-center justify-content-between mb-4">
            <h3 className="page-title">Ticket Details</h3>
            <Link to={routes.tickets} className="btn btn-outline-secondary">
              Back to List
            </Link>
          </div>

          <div className="card">
            <div className="card-body">
              <h5 className="mb-2">Select a ticket to view details</h5>
              <p className="text-muted mb-4">
                Pick a ticket below or return to the ticket list.
              </p>

              {ticketList.length === 0 ? (
                <p>No tickets found.</p>
              ) : (
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Ticket</label>
                    <select
                      className="form-select"
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                    >
                      {ticketList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.data?.title || "Untitled"} ({t.data?.code || t.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-3 d-grid">
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        navigate(`${routes.ticketDetails}?id=${selectedId}`)
                      }
                      disabled={!selectedId}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="page-header d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => navigate(routes.tickets)}
            >
              <i className="ti ti-arrow-left" />
            </button>
            <h3 className="page-title mb-0">Ticket Details</h3>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Link to={`${routes.tickets}?add=1`} className="btn btn-primary">
              <i className="ti ti-circle-plus me-2" /> Add Ticket
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="card p-4">
            <h5>Loading...</h5>
          </div>
        ) : error ? (
          <div className="card p-4 text-center">
            <h5 className="mb-2">{error}</h5>
            <Link to={routes.tickets} className="btn btn-primary">
              Go Back
            </Link>
          </div>
        ) : !ticket ? (
          <div className="card p-4">
            <h5>No ticket data</h5>
          </div>
        ) : (
          <div className="row g-3">
            <div className="col-xl-9 col-md-8">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="text-info fw-medium">
                    {ticket.data?.category || "Support"}
                  </h5>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-danger">
                      <i className="ti ti-circle-filled fs-5 me-1" />
                      {ticket.data?.priority || "High"}
                    </span>
                    <button
                      className="btn btn-sm btn-outline-light"
                      onClick={handleTogglePrivacy}
                      disabled={saving}
                    >
                      {ticket.data?.is_private ? "Mark as Public" : "Mark as Private"}
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom mb-3">
                    <div className="mb-3">
                      <span className="badge badge-info rounded-pill mb-2">
                        {ticket.data?.code || "TIC"}
                      </span>
                      <div className="d-flex align-items-center mb-2">
                        <h5 className="fw-semibold me-2">
                          {ticket.data?.title || "Untitled"}
                        </h5>
                        <span className="badge bg-outline-pink d-flex align-items-center ms-1">
                          <i className="ti ti-circle-filled fs-5 me-1" />
                          {ticket.data?.status || "Open"}
                        </span>
                      </div>
                      <div className="d-flex align-items-center flex-wrap row-gap-2">
                        <p className="d-flex align-items-center mb-0 me-2">
                          <ImageWithBasePath
                            src="assets/img/profiles/avatar-06.jpg"
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
                          <i className="ti ti-message-circle-share me-1" />
                          {comments.length} Comments
                        </p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <button
                        className="btn btn-primary"
                        onClick={() => setReplyOpen((prev) => !prev)}
                      >
                        <i className="ti ti-arrow-forward-up me-1" />
                        Post a Reply
                      </button>
                    </div>
                  </div>

                  <div className="border-bottom mb-3 pb-3">
                    <p className="mb-0">
                      {ticket.data?.description || "No description provided."}
                    </p>
                  </div>

                  {replyOpen && (
                    <div className="mb-4">
                      <label className="form-label">Reply</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="mt-2 d-flex gap-2">
                        <button
                          className="btn btn-primary"
                          onClick={handleAddReply}
                          disabled={saving}
                        >
                          Submit Reply
                        </button>
                        <button
                          className="btn btn-light"
                          onClick={() => setReplyOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {comments.length === 0 ? (
                    <p className="text-muted">No replies yet.</p>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {comments.map((c, idx) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="fw-medium">
                              {c.author || "Agent"}
                            </div>
                            <small className="text-muted">
                              {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                            </small>
                          </div>
                          <p className="mb-0">{c.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-4">
              <div className="card">
                <div className="card-header">
                  <h4>Ticket Details</h4>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Change Priority</label>
                    <select
                      className="form-select"
                      value={ticket.data?.priority || "High"}
                      onChange={(e) => handleSelectChange("priority", e.target.value)}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Assign To</label>
                    <input
                      className="form-control"
                      value={ticket.data?.assigned_to || ""}
                      onChange={(e) => handleSelectChange("assigned_to", e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Ticket Status</label>
                    <select
                      className="form-select"
                      value={ticket.data?.status || "Open"}
                      onChange={(e) => handleSelectChange("status", e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <div className="small text-muted">User</div>
                    <div className="fw-medium">
                      {ticket.data?.requested_by || "-"}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="small text-muted">Support Agent</div>
                    <div className="fw-medium">
                      {ticket.data?.assigned_to || "-"}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="small text-muted">Category</div>
                    <div className="fw-medium">
                      {ticket.data?.category || "-"}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="small text-muted">Email</div>
                    <div className="fw-medium">
                      {ticket.data?.requester_email || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="small text-muted">Last Updated</div>
                    <div className="fw-medium">{formatUpdated(ticket.updated_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetails;
