import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import API from "../../../api/axios";

const normalizeList = (data: any) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/notifications/");
      setItems(normalizeList(response.data).slice(0, 8));
    } catch (error) {
      console.error("Failed to load notifications", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const markRead = async (id: string) => {
    try {
      await API.post(`/notifications/${id}/read/`);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllRead = async () => {
    try {
      await API.post("/notifications/read_all/");
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    }
  };

  return (
    <div className="dropdown">
      <button type="button" className="nh-icon-btn position-relative" data-bs-toggle="dropdown" aria-expanded="false">
        <i className="ti ti-bell"></i>
        {unreadCount ? <span className="badge bg-danger rounded-pill position-absolute top-0 start-100 translate-middle">{unreadCount}</span> : null}
      </button>
      <div className="dropdown-menu dropdown-menu-end shadow-sm p-0" style={{ width: 360 }}>
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
          <div>
            <h6 className="mb-1">Notifications</h6>
            <div className="text-muted small">Leave, payroll, tickets, training, and chat activity</div>
          </div>
          <button type="button" className="btn btn-sm btn-light" onClick={markAllRead}>
            Mark all read
          </button>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {loading ? (
            <div className="p-4 text-center text-muted">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-muted">No notifications yet.</div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                to={item.target_url || "#"}
                className={`dropdown-item border-bottom px-3 py-3 ${item.is_read ? "" : "bg-primary-subtle"}`}
                onClick={() => markRead(item.id)}
              >
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div className="min-w-0">
                    <div className="fw-semibold text-wrap">{item.title}</div>
                    <div className="small text-muted text-wrap">{item.body || item.notification_type}</div>
                  </div>
                  <div className="small text-muted text-nowrap">{formatTime(item.created_at)}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationBell;
