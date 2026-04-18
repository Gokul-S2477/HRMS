import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { all_routes } from "../../router/all_routes";
import { useAuth } from "../../../core/auth/AuthContext";
import { getHomeRouteForRole } from "../../../core/auth/roleAccess";

type PasswordField = "password";

const demoAccounts = [
  {
    role: "HR Manager",
    username: "hr.manager",
    password: "HR@12345",
    icon: "briefcase-2",
    note: "Approvals, employees, payroll, recruitment",
  },
  {
    role: "Employee",
    username: "ravi.patel",
    password: "Emp@12345",
    icon: "user-circle",
    note: "Self service, leave, attendance, payslips",
  },
  {
    role: "Stakeholder",
    username: "stakeholder.one",
    password: "Stake@12345",
    icon: "chart-dots-3",
    note: "Approvals, revenue views, recruitment insights",
  },
];

const experienceHighlights = [
  { value: "12+", label: "Live workspaces", icon: "layout-grid-add" },
  { value: "24/7", label: "Collaboration", icon: "brand-hipchat" },
  { value: "360°", label: "People lifecycle", icon: "sparkles" },
];

const moduleHighlights = [
  { label: "Employee", icon: "users-group" },
  { label: "HRM", icon: "building-estate" },
  { label: "Recruitment", icon: "briefcase-2" },
  { label: "Payroll", icon: "cash-banknote" },
  { label: "CRM", icon: "heart-handshake" },
  { label: "Analytics", icon: "chart-bar" },
];

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState<{ password: boolean }>({
    password: false,
  });

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const fillDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setErrorMessage("");
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const user = await login(username, password);
      navigate(getHomeRouteForRole(user?.effective_role || user?.role), { replace: true });
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.non_field_errors?.[0] ||
        "Invalid username or password.";
      setErrorMessage(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-premium-page">
      <div className="auth-premium-shell">
        <section className="auth-premium-hero">
          <div className="auth-premium-brand">
            <span className="auth-premium-brand-mark">HR</span>
            <div>
              <strong>SmartHR</strong>
              <small>Premium operations workspace</small>
            </div>
          </div>

          <div className="auth-premium-copy">
            <span className="auth-premium-kicker">Unified people operations</span>
            <h1>Run HR, payroll, recruitment, CRM, approvals, and collaboration from one premium HRMS.</h1>
            <p>
              Give HR, employees, and stakeholders a cleaner workspace with role-based access,
              faster approvals, modern dashboards, and a more polished executive UI.
            </p>
          </div>

          <div className="auth-premium-stats">
            {experienceHighlights.map((item) => (
              <div className="auth-stat-card" key={item.label}>
                <span className="auth-stat-icon">
                  <i className={`ti ti-${item.icon}`}></i>
                </span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>

          <div className="auth-module-grid">
            {moduleHighlights.map((item) => (
              <span className="auth-module-pill" key={item.label}>
                <i className={`ti ti-${item.icon}`}></i>
                {item.label}
              </span>
            ))}
          </div>

          <div className="auth-premium-panel">
            <div className="auth-premium-panel-head">
              <h4>What this login unlocks</h4>
              <span>Role-aware workspace</span>
            </div>
            <div className="auth-premium-panel-list">
              <div>
                <i className="ti ti-checks"></i>
                <span>Employee self-service, leave, attendance, and payroll visibility</span>
              </div>
              <div>
                <i className="ti ti-checks"></i>
                <span>HR approvals, recruitment workflow, document verification, and settlement operations</span>
              </div>
              <div>
                <i className="ti ti-checks"></i>
                <span>Stakeholder revenue insights, approvals, collaboration, and executive dashboards</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-premium-form-wrap">
          <div className="auth-premium-form-card">
            <div className="auth-premium-form-head">
              <span className="auth-premium-kicker">Secure sign in</span>
              <h2>Welcome back</h2>
              <p>
                Use your managed HRMS account to enter the workspace.
                Looking for open roles? <Link to={all_routes.careersJobs}>Visit careers</Link>.
              </p>
            </div>

            <div className="auth-demo-list">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="auth-demo-card"
                  onClick={() => fillDemoAccount(account)}
                >
                  <span className="auth-demo-icon">
                    <i className={`ti ti-${account.icon}`}></i>
                  </span>
                  <div>
                    <strong>{account.role}</strong>
                    <small>{account.note}</small>
                  </div>
                  <span className="auth-demo-action">Use</span>
                </button>
              ))}
            </div>

            {errorMessage ? (
              <div className="alert alert-danger auth-login-alert" role="alert">
                <i className="ti ti-alert-circle"></i>
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="auth-premium-form">
              <div className="auth-field">
                <label className="form-label">Username or email</label>
                <div className="auth-field-shell">
                  <span className="auth-field-icon">
                    <i className="ti ti-user"></i>
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="form-control"
                    autoComplete="username"
                    placeholder="Enter your username or work email"
                  />
                </div>
              </div>

              <div className="auth-field">
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <label className="form-label mb-0">Password</label>
                  <Link to={all_routes.forgotPassword} className="auth-inline-link">
                    Forgot password?
                  </Link>
                </div>
                <div className="auth-field-shell auth-password-shell">
                  <span className="auth-field-icon">
                    <i className="ti ti-lock"></i>
                  </span>
                  <input
                    type={passwordVisibility.password ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="form-control"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => togglePasswordVisibility("password")}
                    aria-label={passwordVisibility.password ? "Hide password" : "Show password"}
                  >
                    <i className={`ti ${passwordVisibility.password ? "ti-eye" : "ti-eye-off"}`}></i>
                  </button>
                </div>
              </div>

              <div className="auth-form-meta">
                <label className="auth-remember">
                  <input className="form-check-input" type="checkbox" />
                  <span>Remember this device</span>
                </label>
                <span className="auth-support-copy">
                  New internal account? Ask HR or the system admin to create access.
                </span>
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-100 auth-submit-btn" disabled={submitting}>
                {submitting ? "Signing you in..." : "Enter SmartHR Workspace"}
              </button>
            </form>

            <div className="auth-form-footer">
              <div>
                <strong>Need applicant access?</strong>
                <p>Use the public recruitment portal with your email to track jobs and applications.</p>
              </div>
              <Link to={all_routes.applicantAccess} className="btn btn-outline-primary">
                Applicant login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
