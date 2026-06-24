import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { formatDisplayDate, normalizeList } from "../mainMenu/employeeDashboard/employeeShared";

type Announcement = {
  id: number;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  author?: {
    username: string;
    email: string;
  };
  published_at: string;
  expires_at?: string;
  target_audience: string;
  is_pinned: boolean;
  views_count: number;
  read_by: number[];
};

const PRIORITY_TONES: Record<string, string> = {
  low: "success",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

const Announcements: React.FC = () => {
  const { user, role } = useAuth();
  const isHR = role === "super_admin" || role === "hr";

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // HR Post Form Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("announcements/");
      setAnnouncements(normalizeList<Announcement>(res.data));
    } catch (error) {
      console.error("Failed to load announcements", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const total = announcements.length;
    const active = announcements.filter((a) => {
      if (!a.expires_at) return true;
      return new Date(a.expires_at) > new Date();
    }).length;
    const pinned = announcements.filter((a) => a.is_pinned).length;
    const unread = announcements.filter((a) => !a.read_by.includes(user?.id || 0)).length;

    return {
      total,
      active,
      pinned,
      unread,
    };
  }, [announcements, user]);

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert("Please fill in title and body.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        body,
        priority,
        is_pinned: isPinned,
        expires_at: expiresAt || null,
        target_audience: "all",
      };

      await API.post("announcements/", payload);
      alert("Announcement posted successfully!");
      setShowPostModal(false);
      // Reset form
      setTitle("");
      setBody("");
      setPriority("normal");
      setIsPinned(false);
      setExpiresAt("");
      loadData();
    } catch (err) {
      console.error("Failed to post notice", err);
      alert("Unable to post announcement.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRead = async (annId: number) => {
    try {
      await API.post(`announcements/${annId}/mark-read/`);
      loadData();
      if (selectedAnn?.id === annId) {
        setSelectedAnn((prev) =>
          prev
            ? {
                ...prev,
                read_by: [...prev.read_by, user?.id || 0],
              }
            : null
        );
      }
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  };

  const handleDeleteNotice = async (annId: number) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
    try {
      await API.delete(`announcements/${annId}/`);
      alert("Notice deleted successfully.");
      setSelectedAnn(null);
      loadData();
    } catch (err) {
      console.error("Failed to delete notice", err);
      alert("Failed to delete notice.");
    }
  };

  const filteredNotices = useMemo(() => {
    return announcements.filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.body.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = !priorityFilter || a.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [announcements, searchTerm, priorityFilter]);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        {/* Hero Header */}
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker">
                  <i className="ti ti-bell-ringing" /> Company News & Updates
                </span>
                <h1 className="payroll-title">Notice Board</h1>
                <p className="payroll-subtitle">
                  Stay updated with corporate bulletins, policy adjustments, training program registrations, and general organization-wide announcements.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip">
                    <i className="ti ti-folders" /> {stats.total} Bulletins Posted
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-pin" /> {stats.pinned} Pinned Notices
                  </span>
                  {stats.unread > 0 && (
                    <span className="employee-chip bg-warning-light text-warning">
                      <i className="ti ti-bell" /> {stats.unread} Unread Updates
                    </span>
                  )}
                </div>
              </div>
              <div className="col-lg-4 text-lg-end">
                <div className="payroll-hero-actions">
                  {isHR && (
                    <button className="btn btn-primary" onClick={() => setShowPostModal(true)}>
                      <i className="ti ti-plus me-1" /> Post Announcement
                    </button>
                  )}
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Left Column: Notices Archive */}
          <div className="col-xl-7 col-lg-6">
            <div className="card payroll-panel">
              <div className="card-header border-bottom d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <h5 className="mb-0">Bulletin Board Feed</h5>
                  <p className="payroll-table-subtitle mb-0">Search and filter active company notices.</p>
                </div>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search news..."
                    style={{ maxWidth: 180 }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: 140 }}
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="card-body p-0">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : filteredNotices.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="ti ti-news display-4 mb-3" />
                    <h6>No notices found</h6>
                    <p className="small">Bulletin board is empty or matching filters did not return logs.</p>
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {filteredNotices.map((ann) => {
                      const isUnread = !ann.read_by.includes(user?.id || 0);

                      return (
                        <div
                          key={ann.id}
                          className={`list-group-item list-group-item-action p-4 cursor-pointer border-bottom ${
                            selectedAnn?.id === ann.id ? "bg-light-gradient" : ""
                          }`}
                          onClick={() => {
                            setSelectedAnn(ann);
                            if (isUnread) {
                              handleMarkRead(ann.id);
                            }
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                            <div className="d-flex align-items-center gap-2">
                              {ann.is_pinned && (
                                <span className="text-primary" title="Pinned Announcement">
                                  <i className="ti ti-pin" />
                                </span>
                              )}
                              <h6 className={`mb-0 ${isUnread ? "fw-bold text-dark" : "text-secondary"}`}>
                                {ann.title}
                              </h6>
                              {isUnread && (
                                <span className="badge bg-warning-light text-warning px-2 py-0.5 rounded-pill small">
                                  New
                                </span>
                              )}
                            </div>
                            <span className={`badge bg-${PRIORITY_TONES[ann.priority]}-light text-${PRIORITY_TONES[ann.priority]} px-2 py-1 text-capitalize`}>
                              {ann.priority}
                            </span>
                          </div>
                          <p className="text-secondary small mb-2 text-truncate" style={{ maxWidth: 450 }}>
                            {ann.body}
                          </p>
                          <div className="d-flex justify-content-between align-items-center text-muted small mt-2">
                            <span>
                              Posted by {ann.author ? ann.author.username : "Admin"} • {formatDisplayDate(ann.published_at)}
                            </span>
                            <span>
                              <i className="ti ti-eye me-1" /> {ann.views_count} views
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Notice Viewer */}
          <div className="col-xl-5 col-lg-6">
            {selectedAnn ? (
              <div className="card employee-section-card">
                <div className="card-header border-bottom d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-0">Bulletin Details</h5>
                    <p className="payroll-table-subtitle mb-0">Posted on: {formatDisplayDate(selectedAnn.published_at)}</p>
                  </div>
                  {isHR && (
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDeleteNotice(selectedAnn.id)}
                    >
                      <i className="ti ti-trash me-1" /> Delete
                    </button>
                  )}
                </div>
                <div className="card-body">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                    <span className={`badge bg-${PRIORITY_TONES[selectedAnn.priority]}-light text-${PRIORITY_TONES[selectedAnn.priority]} px-3 py-2 text-capitalize`}>
                      {selectedAnn.priority} Priority
                    </span>
                    {selectedAnn.is_pinned && (
                      <span className="badge bg-primary-light text-primary px-3 py-2">
                        Pinned notice
                      </span>
                    )}
                  </div>

                  <h3 className="mb-3">{selectedAnn.title}</h3>
                  <div className="p-4 border rounded-4 bg-light mb-4" style={{ whiteSpace: "pre-line", minHeight: 180 }}>
                    {selectedAnn.body}
                  </div>

                  <div className="employee-summary-list mb-3 small">
                    <div className="employee-summary-row py-1">
                      <span>Author</span>
                      <strong>{selectedAnn.author ? selectedAnn.author.username : "Management"}</strong>
                    </div>
                    {selectedAnn.expires_at && (
                      <div className="employee-summary-row py-1">
                        <span>Notice Expires On</span>
                        <strong>{formatDisplayDate(selectedAnn.expires_at)}</strong>
                      </div>
                    )}
                    <div className="employee-summary-row py-1">
                      <span>Reader views</span>
                      <strong>{selectedAnn.views_count} Views</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card employee-section-card h-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
                <i className="ti ti-bell display-4 text-muted mb-3" />
                <h5>Bulletin Board Detail View</h5>
                <p className="text-muted">Select any notice from the bulletin feed to view full announcement details and priority notes.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Announcement Modal (HR Only) */}
      {showPostModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Post New Announcement</h5>
                  <button type="button" className="btn-close" onClick={() => setShowPostModal(false)} />
                </div>
                <form onSubmit={handlePostNotice}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label">Bulletin Title</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Q3 Strategic Planning Offsite"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Priority Level</label>
                        <select
                          className="form-select"
                          value={priority}
                          onChange={(e: any) => setPriority(e.target.value)}
                        >
                          <option value="low">Low Priority</option>
                          <option value="normal">Normal Priority</option>
                          <option value="high">High Priority</option>
                          <option value="urgent">Urgent Priority</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Expiration Date (Optional)</label>
                        <input
                          type="date"
                          className="form-control"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                        />
                      </div>

                      <div className="col-12 form-check ms-3 my-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="isPinnedCheck"
                          checked={isPinned}
                          onChange={(e) => setIsPinned(e.target.checked)}
                        />
                        <label className="form-check-label cursor-pointer" htmlFor="isPinnedCheck">
                          Pin this announcement to top of the bulletin feed
                        </label>
                      </div>

                      <div className="col-12">
                        <label className="form-label">Announcement Content</label>
                        <textarea
                          className="form-control"
                          rows={8}
                          placeholder="Type your announcement content here. Explain who this announcement affects, date limits, and action requirements..."
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowPostModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Posting..." : "Publish Announcement"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
};

export default Announcements;
