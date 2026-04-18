import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";

type EmployeeOption = {
  id: number;
  emp_code?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  user_account?: { id?: number } | null;
};

type Account = {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  role: string;
  account_status: string;
  is_active: boolean;
  can_use_chat: boolean;
  must_change_password: boolean;
  employee_profile?: {
    id: number;
    emp_code?: string;
    full_name?: string;
    designation_title?: string;
  } | null;
  managed_by?: { id: number; display_name?: string } | null;
  last_login?: string | null;
  last_seen_at?: string | null;
  date_joined?: string | null;
};

type AccountForm = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: string;
  account_status: string;
  is_active: boolean;
  can_use_chat: boolean;
  must_change_password: boolean;
  employee_profile_id: string;
  password: string;
};

const normalizeList = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const randomPassword = () =>
  `HRMS@${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}`;

const createInitialForm = (): AccountForm => ({
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  display_name: "",
  role: "employee",
  account_status: "active",
  is_active: true,
  can_use_chat: true,
  must_change_password: true,
  employee_profile_id: "",
  password: randomPassword(),
});

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffHours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDateTime(value);
};

const Manageusers: React.FC = () => {
  const routes = all_routes;
  const { user } = useAuth();
  const canManageStakeholders = Boolean(user?.can_manage_stakeholders);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [credentialNotice, setCredentialNotice] = useState<{ username: string; password: string } | null>(null);

  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [linkedFilter, setLinkedFilter] = useState("");
  const [quickView, setQuickView] = useState("all");
  const [form, setForm] = useState<AccountForm>(createInitialForm());

  const roleOptions = useMemo(
    () => (canManageStakeholders ? ["employee", "stakeholder", "hr"] : ["employee"]),
    [canManageStakeholders]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, employeesRes] = await Promise.all([
        API.get("/users/accounts/"),
        API.get("/employees/"),
      ]);
      setAccounts(normalizeList<Account>(accountsRes.data));
      setEmployees(normalizeList<EmployeeOption>(employeesRes.data));
    } catch (error) {
      console.error("Failed to load access data", error);
      setAccounts([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableEmployees = useMemo(
    () => employees.filter((item) => !item.user_account?.id || String(item.id) === form.employee_profile_id),
    [employees, form.employee_profile_id]
  );

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const haystack = [
        account.username,
        account.email,
        account.display_name,
        account.employee_profile?.emp_code,
        account.employee_profile?.full_name,
        account.employee_profile?.designation_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchText.trim() && !haystack.includes(searchText.trim().toLowerCase())) return false;
      if (roleFilter && account.role !== roleFilter) return false;
      if (statusFilter && account.account_status !== statusFilter) return false;
      if (linkedFilter === "linked" && !account.employee_profile) return false;
      if (linkedFilter === "unlinked" && account.employee_profile) return false;
      if (quickView === "blocked" && account.account_status !== "blocked") return false;
      if (quickView === "reset" && !account.must_change_password) return false;
      if (quickView === "employee" && account.role !== "employee") return false;
      if (quickView === "stakeholder" && account.role !== "stakeholder") return false;
      return true;
    });
  }, [accounts, searchText, roleFilter, statusFilter, linkedFilter, quickView]);

  const stats = useMemo(() => {
    const blocked = accounts.filter((item) => item.account_status === "blocked").length;
    const employeesCount = accounts.filter((item) => item.role === "employee").length;
    const stakeholdersCount = accounts.filter((item) => item.role === "stakeholder").length;
    const noLoginEmployees = employees.filter((item) => !item.user_account?.id).length;
    return [
      { label: "Managed Accounts", value: accounts.length, meta: `${filteredAccounts.length} visible with current filters` },
      { label: "Employee Logins", value: employeesCount, meta: `${noLoginEmployees} employees still need login access` },
      { label: "Stakeholders", value: stakeholdersCount, meta: canManageStakeholders ? "External members you can onboard" : "Reserved for super admin" },
      { label: "Blocked Accounts", value: blocked, meta: "Review and reopen access when needed" },
    ];
  }, [accounts, employees, filteredAccounts.length, canManageStakeholders]);

  const openCreate = () => {
    setEditing(null);
    setForm(createInitialForm());
    setCredentialNotice(null);
    setShowModal(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setCredentialNotice(null);
    setForm({
      username: account.username || "",
      email: account.email || "",
      first_name: account.first_name || "",
      last_name: account.last_name || "",
      display_name: account.display_name || "",
      role: account.role || "employee",
      account_status: account.account_status || "active",
      is_active: Boolean(account.is_active),
      can_use_chat: Boolean(account.can_use_chat),
      must_change_password: Boolean(account.must_change_password),
      employee_profile_id: account.employee_profile?.id ? String(account.employee_profile.id) : "",
      password: "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setCredentialNotice(null);
    setForm(createInitialForm());
  };

  const updateForm = (field: keyof AccountForm, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value } as AccountForm;
      if (field === "role" && value !== "employee") {
        next.employee_profile_id = "";
      }
      return next;
    });
  };

  const handleEmployeeLink = (value: string) => {
    const selected = employees.find((item) => String(item.id) === value);
    setForm((prev) => ({
      ...prev,
      employee_profile_id: value,
      email: selected?.email || prev.email,
      first_name: selected?.first_name || prev.first_name,
      last_name: selected?.last_name || prev.last_name,
      display_name: `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim() || prev.display_name,
      username: prev.username || (selected?.email ? selected.email.split("@")[0] : prev.username),
    }));
  };

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setCredentialNotice(null);
    const payload: Record<string, any> = {
      username: form.username,
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      display_name: form.display_name,
      role: form.role,
      account_status: form.account_status,
      is_active: form.is_active,
      can_use_chat: form.can_use_chat,
      must_change_password: form.must_change_password,
      employee_profile_id: form.role === "employee" && form.employee_profile_id ? Number(form.employee_profile_id) : null,
    };
    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (editing) {
        await API.patch(`/users/accounts/${editing.id}/`, payload);
      } else {
        await API.post("/users/accounts/", payload);
        setCredentialNotice({ username: form.username, password: form.password });
      }
      await loadData();
      if (editing) {
        closeModal();
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || JSON.stringify(error?.response?.data || {}) || "Unable to save account.";
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (account: Account) => {
    const password = randomPassword();
    try {
      const response = await API.post(`/users/accounts/${account.id}/reset_password/`, { password });
      setCredentialNotice({ username: account.username, password: response.data?.temporary_password || password });
      await loadData();
    } catch (error: any) {
      window.alert(error?.response?.data?.detail || "Unable to reset password.");
    }
  };

  const handleAccountAction = async (account: Account, action: "block" | "unblock" | "delete") => {
    const confirmed = window.confirm(
      action === "delete"
        ? `Delete ${account.display_name || account.username}?`
        : `${action === "block" ? "Block" : "Unblock"} ${account.display_name || account.username}?`
    );
    if (!confirmed) return;

    try {
      if (action === "delete") {
        await API.delete(`/users/accounts/${account.id}/`);
      } else {
        await API.post(`/users/accounts/${account.id}/${action}/`);
      }
      await loadData();
    } catch (error: any) {
      window.alert(error?.response?.data?.detail || `Unable to ${action} account.`);
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
                  <i className="ti ti-shield-lock"></i>
                  Access Control Center
                </span>
                <h1 className="payroll-title">Employee and stakeholder login management</h1>
                <p className="payroll-subtitle">
                  Create employee logins, onboard stakeholder accounts, block risky access, and keep chat availability under one advanced control panel.
                </p>
              </div>
              <div className="col-xl-4">
                <div className="payroll-hero-actions justify-content-xl-end">
                  <Link to={routes.chat} className="btn btn-white">
                    <i className="ti ti-brand-hipchat me-2"></i>
                    Open Chat Hub
                  </Link>
                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    <i className="ti ti-user-plus me-2"></i>
                    Add Login Account
                  </button>
                  <CollapseHeader />
                </div>
              </div>
            </div>
            <div className="payroll-stat-grid mt-4">
              {stats.map((card) => (
                <div className="card payroll-stat-card" key={card.label}>
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

        <div className="card payroll-panel mb-4">
          <div className="card-body">
            <div className="payroll-toolbar">
              <div>
                <label className="form-label">Smart Search</label>
                <input
                  className="form-control"
                  placeholder="Search username, email, employee code, or profile name"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="form-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="">All roles</option>
                  {roleOptions.map((item) => (
                    <option key={item} value={item}>{item.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="invited">Invited</option>
                </select>
              </div>
              <div>
                <label className="form-label">Link State</label>
                <select className="form-select" value={linkedFilter} onChange={(event) => setLinkedFilter(event.target.value)}>
                  <option value="">All accounts</option>
                  <option value="linked">Linked employee</option>
                  <option value="unlinked">Standalone account</option>
                </select>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              {[
                { key: "all", label: "All" },
                { key: "employee", label: "Employees" },
                { key: "stakeholder", label: "Stakeholders" },
                { key: "blocked", label: "Blocked" },
                { key: "reset", label: "Must reset password" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`payroll-chip-toggle ${quickView === item.key ? "active" : ""}`}
                  onClick={() => setQuickView(item.key)}
                >
                  {item.label}
                </button>
              ))}
              <button type="button" className="btn btn-light ms-auto" onClick={() => {
                setSearchText("");
                setRoleFilter("");
                setStatusFilter("");
                setLinkedFilter("");
                setQuickView("all");
              }}>
                Reset
              </button>
            </div>
            <div className="payroll-filter-note">
              {filteredAccounts.length} account(s) match the current view. HR manages employee logins; super admin can also manage stakeholder access.
            </div>
          </div>
        </div>

        {credentialNotice ? (
          <div className="card payroll-panel mb-4 border-success-subtle">
            <div className="card-body d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
              <div>
                <div className="payroll-kicker bg-success-subtle text-success-emphasis mb-2">Credential Ready</div>
                <h5 className="mb-1">Share these credentials securely with the user</h5>
                <div className="text-muted">Username: <strong>{credentialNotice.username}</strong> | Temporary Password: <strong>{credentialNotice.password}</strong></div>
              </div>
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => navigator.clipboard?.writeText(`Username: ${credentialNotice.username}\nPassword: ${credentialNotice.password}`)}
              >
                <i className="ti ti-copy me-2"></i>
                Copy Credentials
              </button>
            </div>
          </div>
        ) : null}

        <div className="card payroll-panel payroll-table-card">
          <div className="payroll-table-header">
            <div>
              <h5>Managed Login Accounts</h5>
              <div className="payroll-table-subtitle">Track ownership, linkage, and access actions from one advanced table.</div>
            </div>
            <span className="payroll-filter-meta"><strong>{filteredAccounts.length}</strong> visible</span>
          </div>
          <div className="payroll-table-shell table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Linked Employee</th>
                  <th>Managed By</th>
                  <th>Last Activity</th>
                  <th>Access</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">Loading accounts...</td></tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">No accounts match the current filters.</td></tr>
                ) : (
                  filteredAccounts.map((account) => {
                    const isBlocked = account.account_status === "blocked";
                    return (
                      <tr key={account.id}>
                        <td>
                          <div className="payroll-avatar-block">
                            <span className="payroll-avatar-icon"><i className="ti ti-user-shield"></i></span>
                            <div>
                              <div className="fw-semibold text-gray-900">{account.display_name || account.username}</div>
                              <div className="small text-muted">{account.username} • {account.email || "No email"}</div>
                              {account.must_change_password ? <span className="badge badge-soft-warning mt-1">Must change password</span> : null}
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-soft-primary text-capitalize">{account.role.replace("_", " ")}</span></td>
                        <td>
                          {account.employee_profile ? (
                            <div>
                              <div className="fw-semibold">{account.employee_profile.full_name}</div>
                              <div className="small text-muted">{account.employee_profile.emp_code} • {account.employee_profile.designation_title || "-"}</div>
                            </div>
                          ) : (
                            <span className="text-muted">Standalone account</span>
                          )}
                        </td>
                        <td>
                          <div className="fw-semibold">{account.managed_by?.display_name || "System"}</div>
                          <div className="small text-muted">Joined {formatDateTime(account.date_joined)}</div>
                        </td>
                        <td>
                          <div className="fw-semibold">{formatRelativeTime(account.last_seen_at || account.last_login)}</div>
                          <div className="small text-muted">Last login: {formatDateTime(account.last_login)}</div>
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            <span className={`badge ${isBlocked ? "badge-soft-danger" : "badge-soft-success"}`}>{account.account_status}</span>
                            <span className={`badge ${account.can_use_chat ? "badge-soft-info" : "badge-soft-secondary"}`}>{account.can_use_chat ? "Chat enabled" : "Chat disabled"}</span>
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                            <button type="button" className="btn btn-light btn-sm" onClick={() => openEdit(account)}>
                              <i className="ti ti-edit me-1"></i>Edit
                            </button>
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleResetPassword(account)}>
                              <i className="ti ti-key me-1"></i>Reset
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${isBlocked ? "btn-outline-success" : "btn-outline-warning"}`}
                              onClick={() => handleAccountAction(account, isBlocked ? "unblock" : "block")}
                            >
                              <i className={`ti ${isBlocked ? "ti-lock-open" : "ti-ban"} me-1`}></i>
                              {isBlocked ? "Unblock" : "Block"}
                            </button>
                            {account.id !== user?.id ? (
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleAccountAction(account, "delete")}>
                                <i className="ti ti-trash me-1"></i>Delete
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal ? (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <div>
                  <h4 className="modal-title">{editing ? "Update login account" : "Create login account"}</h4>
                  <p className="text-muted mb-0">Link employee identities, issue credentials, and control chat access.</p>
                </div>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <form onSubmit={saveAccount}>
                <div className="modal-body">
                  <div className="row g-3 payroll-modal-grid">
                    <div className="col-md-4">
                      <label className="form-label">Role</label>
                      <select className="form-select" value={form.role} onChange={(event) => updateForm("role", event.target.value)}>
                        {roleOptions.map((item) => (
                          <option key={item} value={item}>{item.replace("_", " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Status</label>
                      <select className="form-select" value={form.account_status} onChange={(event) => updateForm("account_status", event.target.value)}>
                        <option value="active">Active</option>
                        <option value="invited">Invited</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Employee Link</label>
                      <select className="form-select" value={form.employee_profile_id} onChange={(event) => handleEmployeeLink(event.target.value)} disabled={form.role !== "employee"}>
                        <option value="">{form.role === "employee" ? "Select employee" : "Not required for this role"}</option>
                        {availableEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>{employee.emp_code} - {employee.first_name} {employee.last_name || ""}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Username</label>
                      <input className="form-control" value={form.username} onChange={(event) => updateForm("username", event.target.value)} required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Display Name</label>
                      <input className="form-control" value={form.display_name} onChange={(event) => updateForm("display_name", event.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">First Name</label>
                      <input className="form-control" value={form.first_name} onChange={(event) => updateForm("first_name", event.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Last Name</label>
                      <input className="form-control" value={form.last_name} onChange={(event) => updateForm("last_name", event.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Password</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={form.password}
                          placeholder={editing ? "Leave blank to keep current password" : "Temporary password"}
                          onChange={(event) => updateForm("password", event.target.value)}
                        />
                        <button type="button" className="btn btn-outline-primary" onClick={() => updateForm("password", randomPassword())}>Generate</button>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label d-block">Chat Access</label>
                      <div className="form-check form-switch mt-2">
                        <input className="form-check-input" type="checkbox" checked={form.can_use_chat} onChange={(event) => updateForm("can_use_chat", event.target.checked)} />
                        <label className="form-check-label">Enable in-app chat</label>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label d-block">Sign-in State</label>
                      <div className="form-check form-switch mt-2">
                        <input className="form-check-input" type="checkbox" checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} />
                        <label className="form-check-label">Allow login</label>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="card border-0 bg-light">
                        <div className="card-body d-flex justify-content-between gap-3 flex-column flex-lg-row">
                          <div>
                            <h6 className="mb-1">Provisioning summary</h6>
                            <p className="mb-0 text-muted">
                              {form.role === "employee"
                                ? "This login will be linked to one employee profile and automatically scoped to that employee's data, payroll, tickets, and self-service pages."
                                : "This standalone account will receive dashboard and chat access based on its assigned role."}
                            </p>
                          </div>
                          <div className="text-lg-end">
                            <div className="fw-semibold text-capitalize">Role: {form.role.replace("_", " ")}</div>
                            <div className="small text-muted">Status: {form.account_status}</div>
                            <div className="small text-muted">Chat: {form.can_use_chat ? "Enabled" : "Disabled"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Account"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      {showModal ? <div className="modal-backdrop fade show"></div> : null}
    </div>
  );
};

export default Manageusers;

