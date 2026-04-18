import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import API, { API_BASE_URL } from "../../api/axios";
import { getToken } from "../../core/auth/auth";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";

type ChatUser = {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  role?: string;
  effective_role?: string;
  employee_profile_id?: number | null;
  last_seen_at?: string | null;
};

type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
  sender: ChatUser;
};

type ChatThread = {
  id: string;
  title?: string;
  display_title?: string;
  thread_type?: string;
  participants: ChatUser[];
  latest_message?: ChatMessage | null;
  unread_count?: number;
  typing_users?: ChatUser[];
  read_receipts?: ChatReadReceipt[];
  last_message_at?: string;
  created_at?: string;
  updated_at?: string;
};

type ChatReadReceipt = {
  user_id: number;
  display_name: string;
  last_read_at?: string | null;
};

type ChatContact = ChatUser & {
  active_thread_id?: string | null;
};

type ChatSocketEvent = {
  type: string;
  threadId?: string;
  actorId?: number;
  thread?: ChatThread;
  message?: ChatMessage;
  presence?: ChatUser;
  status?: string;
  detail?: string;
};

const roleTone: Record<string, string> = {
  super_admin: "primary",
  hr: "success",
  employee: "info",
  stakeholder: "warning",
};

const normalizeList = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatThreadTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

const formatMessageTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPresence = (value?: string | null) => {
  if (!value) return "Offline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Offline";
  const diff = Date.now() - date.getTime();
  if (diff < 2 * 60 * 1000) return "Online";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  return `Last seen ${date.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`;
};

const initials = (value?: string | null) => {
  const text = String(value || "User").trim();
  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U"
  );
};

const mergeThread = (threads: ChatThread[], nextThread?: ChatThread | null) => {
  if (!nextThread?.id) return threads;
  return [nextThread, ...threads.filter((thread) => thread.id !== nextThread.id)];
};

const appendMessage = (messages: ChatMessage[], nextMessage?: ChatMessage | null) => {
  if (!nextMessage?.id) return messages;
  if (messages.some((message) => message.id === nextMessage.id)) {
    return messages.map((message) => (message.id === nextMessage.id ? nextMessage : message));
  }
  return [...messages, nextMessage];
};

const applyPresence = <T extends ChatUser>(user: T, presence?: ChatUser | null): T => {
  if (!presence || user.id !== presence.id) return user;
  return { ...user, last_seen_at: presence.last_seen_at };
};

const buildChatSocketUrl = () => {
  const token = getToken();
  if (!token) return null;
  const apiUrl = new URL(API_BASE_URL);
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${apiUrl.host}/ws/chat/?token=${encodeURIComponent(token)}`;
};

const Chat: React.FC = () => {
  const routes = all_routes;
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const typingTimeoutRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const manualSocketCloseRef = useRef(false);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<"websocket" | "polling">("polling");
  const [socketNotice, setSocketNotice] = useState("Connecting live chat...");

  const [threadSearch, setThreadSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);

  const selectedThreadId = searchParams.get("thread") || "";

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const response = await API.get("/chat/threads/", {
        params: threadSearch ? { search: threadSearch } : {},
      });
      const nextThreads = normalizeList<ChatThread>(response.data);
      setThreads(nextThreads);
      if (!selectedThreadId && nextThreads.length) {
        setSearchParams({ thread: nextThreads[0].id });
      }
    } catch (error) {
      console.error("Failed to load chat threads", error);
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId, setSearchParams, threadSearch]);

  const loadContacts = useCallback(async () => {
    try {
      const response = await API.get("/chat/threads/contacts/");
      setContacts(normalizeList<ChatContact>(response.data));
    } catch (error) {
      console.error("Failed to load chat contacts", error);
      setContacts([]);
    }
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    if (!threadId) return;
    setLoadingMessages(true);
    try {
      const response = await API.get(`/chat/threads/${threadId}/messages/`);
      setMessages(normalizeList<ChatMessage>(response.data));
    } catch (error) {
      console.error("Failed to load chat messages", error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const sendSocketEvent = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const syncPresenceState = useCallback((presence?: ChatUser | null) => {
    if (!presence?.id) return;
    setContacts((current) => current.map((contact) => applyPresence(contact, presence)));
    setThreads((current) =>
      current.map((thread) => ({
        ...thread,
        participants: thread.participants.map((participant) => applyPresence(participant, presence)),
        typing_users: (thread.typing_users || []).map((participant) => applyPresence(participant, presence)),
      }))
    );
    setMessages((current) =>
      current.map((message) => ({
        ...message,
        sender: applyPresence(message.sender, presence),
      }))
    );
  }, []);

  const handleSocketEvent = useCallback(
    (event: ChatSocketEvent) => {
      switch (event.type) {
        case "connected":
          setSocketConnected(true);
          setTransportMode("websocket");
          setSocketNotice("Live WebSocket connected");
          return;
        case "message.created":
          if (event.thread) {
            setThreads((current) => mergeThread(current, event.thread));
          }
          if (event.threadId === selectedThreadId && event.message) {
            setMessages((current) => appendMessage(current, event.message));
          }
          return;
        case "thread.updated":
        case "typing.updated":
        case "read.updated":
          if (event.thread) {
            setThreads((current) => mergeThread(current, event.thread));
          }
          return;
        case "presence.updated":
          syncPresenceState(event.presence);
          return;
        case "error":
          if (event.detail) {
            window.alert(event.detail);
          }
          return;
        default:
          return;
      }
    },
    [selectedThreadId, syncPresenceState]
  );

  const sendTyping = useCallback(
    async (typing: boolean, threadId?: string) => {
      const targetThreadId = threadId || selectedThreadId;
      if (!targetThreadId) return;
      if (socketConnected && sendSocketEvent({ type: "typing", threadId: targetThreadId, typing })) {
        return;
      }
      try {
        await API.post(`/chat/threads/${targetThreadId}/typing/`, { typing });
      } catch (error) {
        console.error("Failed to update typing status", error);
      }
    },
    [selectedThreadId, sendSocketEvent, socketConnected]
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
    }
  }, [selectedThreadId, loadMessages]);

  useEffect(() => {
    const fallbackTimer = window.setInterval(() => {
      if (!socketConnected) {
        loadThreads();
        loadContacts();
        if (selectedThreadId) {
          loadMessages(selectedThreadId);
        }
      }
    }, 8000);
    return () => window.clearInterval(fallbackTimer);
  }, [socketConnected, loadContacts, loadMessages, loadThreads, selectedThreadId]);

  useEffect(() => {
    const sanityTimer = window.setInterval(() => {
      if (socketConnected) {
        loadThreads();
        if (selectedThreadId) {
          loadMessages(selectedThreadId);
        }
      }
    }, 45000);
    return () => window.clearInterval(sanityTimer);
  }, [socketConnected, loadMessages, loadThreads, selectedThreadId]);

  useEffect(() => {
    if (!user?.can_use_chat) return undefined;
    const socketUrl = buildChatSocketUrl();
    if (!socketUrl) return undefined;

    manualSocketCloseRef.current = false;

    const connect = () => {
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setSocketConnected(true);
        setTransportMode("websocket");
        setSocketNotice("Live WebSocket connected");
      };

      socket.onmessage = (message) => {
        try {
          handleSocketEvent(JSON.parse(message.data));
        } catch (error) {
          console.error("Failed to parse socket event", error);
        }
      };

      socket.onerror = () => {
        setTransportMode("polling");
        setSocketNotice("WebSocket retrying - using fallback sync");
      };

      socket.onclose = () => {
        setSocketConnected(false);
        setTransportMode("polling");
        if (!manualSocketCloseRef.current) {
          setSocketNotice("Realtime link lost - reconnecting");
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      manualSocketCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [handleSocketEvent, user?.can_use_chat, user?.id]);

  useEffect(() => {
    if (!socketConnected) return undefined;
    const pingTimer = window.setInterval(() => {
      sendSocketEvent({ type: "ping" });
    }, 15000);
    return () => window.clearInterval(pingTimer);
  }, [sendSocketEvent, socketConnected]);

  useEffect(() => {
    if (!selectedThreadId || !socketConnected) return undefined;
    sendSocketEvent({ type: "mark_read", threadId: selectedThreadId });
    return undefined;
  }, [selectedThreadId, sendSocketEvent, socketConnected]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      manualSocketCloseRef.current = true;
      socketRef.current?.close();
    };
  }, []);

  const filteredThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => {
      const haystack = [thread.display_title, thread.latest_message?.body]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [threadSearch, threads]);

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const haystack = [contact.display_name, contact.email, contact.username, contact.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, contactSearch]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const typingLabel = useMemo(() => {
    const typingUsers = selectedThread?.typing_users || [];
    if (typingUsers.length === 0) return "";
    if (typingUsers.length === 1) {
      return `${typingUsers[0].display_name || typingUsers[0].username} is typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  }, [selectedThread]);

  const insights = useMemo(() => {
    const unread = threads.reduce((sum, thread) => sum + Number(thread.unread_count || 0), 0);
    const direct = threads.filter((thread) => thread.thread_type === "direct").length;
    const groups = threads.filter((thread) => thread.thread_type === "group").length;
    const onlineContacts = contacts.filter((contact) => formatPresence(contact.last_seen_at) === "Online").length;
    return [
      { label: "Conversations", value: threads.length, meta: `${direct} direct / ${groups} groups` },
      { label: "Unread", value: unread, meta: "Waiting for your response" },
      { label: "Online Now", value: onlineContacts, meta: `${contacts.length} chat-enabled contacts` },
    ];
  }, [contacts, threads]);

  const selectThread = async (threadId: string) => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (selectedThreadId) {
      await sendTyping(false, selectedThreadId);
    }
    setComposer("");
    setSearchParams({ thread: threadId });
  };

  const toggleParticipant = (contactId: number) => {
    setSelectedParticipants((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const startDirectChat = async (contact: ChatContact) => {
    if (contact.active_thread_id) {
      await selectThread(contact.active_thread_id);
      return;
    }
    try {
      setCreatingThread(true);
      const response = await API.post("/chat/threads/", {
        participant_ids: [contact.id],
        initial_message: newThreadMessage || "Hello!",
      });
      const thread = response.data as ChatThread;
      setShowNewThread(false);
      setSelectedParticipants([]);
      setNewThreadMessage("");
      setNewThreadTitle("");
      await loadThreads();
      await selectThread(thread.id);
    } catch (error) {
      const errorMessage = (error as any)?.response?.data?.detail || "Unable to start chat.";
      window.alert(errorMessage);
    } finally {
      setCreatingThread(false);
    }
  };

  const createThread = async () => {
    if (!selectedParticipants.length) {
      window.alert("Select at least one participant.");
      return;
    }
    if (selectedParticipants.length === 1) {
      const contact = contacts.find((item) => item.id === selectedParticipants[0]);
      if (contact) {
        await startDirectChat(contact);
      }
      return;
    }

    try {
      setCreatingThread(true);
      const response = await API.post("/chat/threads/", {
        participant_ids: selectedParticipants,
        thread_type: "group",
        title: newThreadTitle || "Project Collaboration",
        initial_message: newThreadMessage,
      });
      const thread = response.data as ChatThread;
      setShowNewThread(false);
      setSelectedParticipants([]);
      setNewThreadTitle("");
      setNewThreadMessage("");
      await loadThreads();
      await selectThread(thread.id);
    } catch (error) {
      const errorMessage = (error as any)?.response?.data?.detail || "Unable to create group chat.";
      window.alert(errorMessage);
    } finally {
      setCreatingThread(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedThreadId || !composer.trim()) return;
    const nextBody = composer.trim();
    setComposer("");
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    await sendTyping(false, selectedThreadId);

    if (socketConnected && sendSocketEvent({ type: "message.send", threadId: selectedThreadId, body: nextBody })) {
      return;
    }

    try {
      setSending(true);
      const response = await API.post(`/chat/threads/${selectedThreadId}/messages/`, { body: nextBody });
      setMessages((current) => appendMessage(current, response.data as ChatMessage));
      await Promise.all([loadMessages(selectedThreadId), loadThreads(), loadContacts()]);
    } catch (error) {
      setComposer(nextBody);
      const errorMessage = (error as any)?.response?.data?.detail || "Unable to send message.";
      window.alert(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleComposerChange = (value: string) => {
    setComposer(value);
    if (!selectedThreadId) return;
    void sendTyping(Boolean(value.trim()), selectedThreadId);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    if (value.trim()) {
      typingTimeoutRef.current = window.setTimeout(() => {
        void sendTyping(false, selectedThreadId);
      }, 2200);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row g-4 align-items-start">
              <div className="col-xl-8">
                <span className="payroll-kicker">
                  <i className="ti ti-brand-hipchat"></i>
                  Conversation Hub
                </span>
                <h1 className="payroll-title">Internal HR and employee chat</h1>
                <p className="payroll-subtitle">
                  HR, employees, stakeholders, and super admins can collaborate from one secure in-app channel with direct chats, group threads, unread tracking, typing signals, presence awareness, and WebSocket delivery.
                </p>
              </div>
              <div className="col-xl-4">
                <div className="payroll-hero-actions justify-content-xl-end">
                  <button type="button" className="btn btn-primary" onClick={() => setShowNewThread(true)}>
                    <i className="ti ti-message-plus me-2"></i>
                    New Conversation
                  </button>
                  <CollapseHeader />
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              <span className={`employee-chip ${socketConnected ? "is-active" : ""}`}>
                <i className="ti ti-plug-connected"></i>
                {transportMode === "websocket" ? "WebSocket Live" : "Fallback Sync"}
              </span>
              <span className="employee-chip">
                <i className="ti ti-radio"></i>
                {socketNotice}
              </span>
            </div>
            <div className="payroll-stat-grid mt-4" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {insights.map((card) => (
                <div key={card.label} className="card payroll-stat-card">
                  <div className="card-body">
                    <span className="payroll-stat-label">{card.label}</span>
                    <h3 className="payroll-stat-value">{card.value}</h3>
                    <div className="payroll-stat-meta">{card.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-xxl-3 col-xl-4">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1">Chats</h5>
                    <div className="text-muted small">Pick up active conversations quickly.</div>
                  </div>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setShowNewThread(true)}>
                    <i className="ti ti-plus"></i>
                  </button>
                </div>
                <input
                  className="form-control mb-3"
                  placeholder="Search chats"
                  value={threadSearch}
                  onChange={(event) => setThreadSearch(event.target.value)}
                />
                <div className="d-flex flex-column gap-2" style={{ maxHeight: 620, overflowY: "auto" }}>
                  {loadingThreads ? (
                    <div className="text-muted py-5 text-center">Loading conversations...</div>
                  ) : filteredThreads.length === 0 ? (
                    <div className="text-muted py-5 text-center">No threads yet.</div>
                  ) : (
                    filteredThreads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        className={`btn text-start border rounded-4 p-3 ${selectedThreadId === thread.id ? "border-primary bg-primary-subtle" : "bg-white"}`}
                        onClick={() => {
                          void selectThread(thread.id);
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div className="d-flex gap-3 min-w-0">
                            <span className="avatar avatar-md">
                              <span className="avatar-title rounded-circle bg-dark-subtle text-dark fw-bold">
                                {initials(thread.display_title || thread.title || "Chat")}
                              </span>
                            </span>
                            <div className="min-w-0">
                              <div className="fw-semibold text-truncate">{thread.display_title || thread.title || "Conversation"}</div>
                              <div className="small text-muted text-truncate">
                                {thread.typing_users?.length
                                  ? `${thread.typing_users[0].display_name || thread.typing_users[0].username} is typing...`
                                  : thread.latest_message?.body || "No messages yet"}
                              </div>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="small text-muted">{formatThreadTime(thread.last_message_at)}</div>
                            {thread.unread_count ? <span className="badge bg-primary mt-2">{thread.unread_count}</span> : null}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xxl-6 col-xl-8">
            <div className="card payroll-panel h-100">
              <div className="card-body d-flex flex-column" style={{ minHeight: 720 }}>
                {selectedThread ? (
                  <>
                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 border-bottom pb-3 mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <span className="avatar avatar-lg">
                          <span className="avatar-title rounded-circle bg-primary-subtle text-primary fw-bold">
                            {initials(selectedThread.display_title || selectedThread.title || "Chat")}
                          </span>
                        </span>
                        <div>
                          <h5 className="mb-1">{selectedThread.display_title || selectedThread.title || "Conversation"}</h5>
                          <div className="text-muted small">
                            {selectedThread.participants.length} participant(s) - last active {formatMessageTime(selectedThread.last_message_at)}
                          </div>
                          {typingLabel ? <div className="small text-primary mt-1">{typingLabel}</div> : null}
                        </div>
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        {user?.can_manage_accounts ? (
                          <Link to={routes.manageusers} className="btn btn-light btn-sm">
                            <i className="ti ti-user-cog me-1"></i>
                            Manage Access
                          </Link>
                        ) : null}
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => loadMessages(selectedThread.id)}>
                          <i className="ti ti-refresh me-1"></i>
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="flex-grow-1 d-flex flex-column gap-3 pe-2" style={{ overflowY: "auto" }}>
                      {loadingMessages ? (
                        <div className="text-muted py-5 text-center">Loading messages...</div>
                      ) : messages.length === 0 ? (
                        <div className="text-muted py-5 text-center">No messages in this conversation yet.</div>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} className={`d-flex ${message.is_mine ? "justify-content-end" : "justify-content-start"}`}>
                            <div className={`p-3 rounded-4 ${message.is_mine ? "bg-primary text-white" : "bg-light"}`} style={{ maxWidth: 460 }}>
                              <div className={`small fw-semibold mb-1 ${message.is_mine ? "text-white" : "text-dark"}`}>
                                {message.sender.display_name || message.sender.username}
                              </div>
                              <div>{message.body}</div>
                              <div className={`small mt-2 ${message.is_mine ? "text-white-50" : "text-muted"}`}>
                                {formatMessageTime(message.created_at)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-top pt-3 mt-3">
                      <div className="input-group">
                        <input
                          className="form-control"
                          placeholder="Write a message"
                          value={composer}
                          onChange={(event) => handleComposerChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void sendMessage();
                            }
                          }}
                        />
                        <button type="button" className="btn btn-primary" disabled={sending || !composer.trim()} onClick={() => void sendMessage()}>
                          <i className="ti ti-send me-2"></i>
                          {sending ? "Sending..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-100 d-flex flex-column justify-content-center align-items-center text-center text-muted">
                    <span className="avatar avatar-xl mb-3">
                      <span className="avatar-title rounded-circle bg-light text-dark"><i className="ti ti-message-2 fs-1"></i></span>
                    </span>
                    <h5 className="mb-2 text-dark">Choose a conversation</h5>
                    <p className="mb-0">Select an existing thread or start a new conversation with an employee, HR partner, or stakeholder.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xxl-3">
            <div className="card payroll-panel h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1">Participants</h5>
                    <div className="text-muted small">Who you can reach from this account.</div>
                  </div>
                </div>
                <input
                  className="form-control mb-3"
                  placeholder="Search people"
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                />
                <div className="d-flex flex-column gap-2" style={{ maxHeight: 620, overflowY: "auto" }}>
                  {filteredContacts.map((contact) => {
                    const presence = formatPresence(contact.last_seen_at);
                    const isOnline = presence === "Online";
                    return (
                      <button key={contact.id} type="button" className="btn border rounded-4 text-start p-3 bg-white" onClick={() => void startDirectChat(contact)}>
                        <div className="d-flex justify-content-between gap-3">
                          <div className="d-flex gap-3 min-w-0">
                            <span className="avatar avatar-md position-relative">
                              <span className="avatar-title rounded-circle bg-warning-subtle text-warning-emphasis fw-bold">
                                {initials(contact.display_name || contact.username)}
                              </span>
                              <span className={`position-absolute bottom-0 end-0 rounded-circle border border-white ${isOnline ? "bg-success" : "bg-secondary"}`} style={{ width: 10, height: 10 }}></span>
                            </span>
                            <div className="min-w-0">
                              <div className="fw-semibold text-truncate">{contact.display_name || contact.username}</div>
                              <div className="small text-muted text-truncate">{contact.email || contact.username}</div>
                              <div className="small text-muted text-truncate">{presence}</div>
                            </div>
                          </div>
                          <span className={`badge badge-soft-${roleTone[contact.effective_role || contact.role || "employee"] || "secondary"}`}>
                            {contact.effective_role || contact.role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedThread ? (
                  <div className="mt-4 border-top pt-3">
                    <h6 className="mb-3">Current Thread Snapshot</h6>
                    <div className="d-flex flex-column gap-2 mb-3">
                      {selectedThread.participants.map((participant) => (
                        <div key={participant.id} className="d-flex align-items-center justify-content-between border rounded-4 px-3 py-2">
                          <div>
                            <div className="fw-semibold small">{participant.display_name || participant.username}</div>
                            <div className="text-muted small">{formatPresence(participant.last_seen_at)}</div>
                          </div>
                          <span className={`badge badge-soft-${roleTone[participant.effective_role || participant.role || "employee"] || "secondary"}`}>
                            {participant.effective_role || participant.role}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border rounded-4 p-3 bg-light-subtle mb-3">
                      <div className="fw-semibold mb-2">Read receipts</div>
                      {(selectedThread.read_receipts || []).length ? (
                        <div className="d-flex flex-column gap-2">
                          {(selectedThread.read_receipts || []).map((receipt) => (
                            <div key={receipt.user_id} className="d-flex justify-content-between small">
                              <span>{receipt.display_name}</span>
                              <span className="text-muted">{formatMessageTime(receipt.last_read_at)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="small text-muted">
                          Read receipts will appear here once other participants open the thread.
                        </div>
                      )}
                    </div>
                    <div className="small text-muted">Signed in as {user?.display_name || user?.username}. Messages stay scoped to authorized participants only.</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNewThread ? (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <div>
                  <h4 className="modal-title">Start a new conversation</h4>
                  <p className="text-muted mb-0">Pick one participant for a direct chat or multiple for a group thread.</p>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowNewThread(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Group title</label>
                  <input className="form-control" placeholder="Optional for direct chats" value={newThreadTitle} onChange={(event) => setNewThreadTitle(event.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Initial message</label>
                  <textarea className="form-control" rows={3} placeholder="Say hello, share context, or set the agenda" value={newThreadMessage} onChange={(event) => setNewThreadMessage(event.target.value)} />
                </div>
                <div className="border rounded-4 p-3" style={{ maxHeight: 360, overflowY: "auto" }}>
                  {contacts.map((contact) => (
                    <label key={contact.id} className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2">
                      <div className="d-flex align-items-center gap-3">
                        <input type="checkbox" className="form-check-input mt-0" checked={selectedParticipants.includes(contact.id)} onChange={() => toggleParticipant(contact.id)} />
                        <div>
                          <div className="fw-semibold">{contact.display_name || contact.username}</div>
                          <div className="small text-muted">{contact.email || contact.username}</div>
                        </div>
                      </div>
                      <span className={`badge badge-soft-${roleTone[contact.effective_role || contact.role || "employee"] || "secondary"}`}>
                        {contact.effective_role || contact.role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-light" onClick={() => setShowNewThread(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={creatingThread || selectedParticipants.length === 0} onClick={() => void createThread()}>
                  {creatingThread ? "Creating..." : "Start Conversation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showNewThread ? <div className="modal-backdrop fade show"></div> : null}
    </div>
  );
};

export default Chat;
