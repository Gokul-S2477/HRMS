import React from "react";
import { Link } from "react-router-dom";

import { all_routes } from "../../router/all_routes";

const accessTracks = [
  {
    title: "Internal Workforce Access",
    icon: "users-group",
    copy: "HR, employees, stakeholders, and admins do not self-register here. Their accounts are created and managed inside HRMS.",
    actionLabel: "Go to Login",
    actionHref: all_routes.login,
  },
  {
    title: "Applicant Access",
    icon: "briefcase-2",
    copy: "Candidates should use the public careers flow, verify their email, and track applications from the applicant portal.",
    actionLabel: "Applicant Access",
    actionHref: all_routes.applicantAccess,
  },
  {
    title: "Explore Open Roles",
    icon: "sparkles",
    copy: "Want to apply for jobs? Browse the public careers board, see related openings, and submit once with your email-based applicant account.",
    actionLabel: "View Careers",
    actionHref: all_routes.careersJobs,
  },
];

const managedSteps = [
  "HR or super admin creates the login account.",
  "The user signs in with username or work email plus password.",
  "Applicant registrations happen separately in the careers portal.",
];

const Register = () => {
  return (
    <div className="auth-premium-page">
      <div className="auth-premium-shell">
        <section className="auth-premium-hero">
          <div className="auth-premium-brand">
            <span className="auth-premium-brand-mark">HR</span>
            <div>
              <strong>SmartHR</strong>
              <small>Managed access workspace</small>
            </div>
          </div>

          <div className="auth-premium-copy">
            <span className="auth-premium-kicker">Account creation flow</span>
            <h1>This HRMS uses managed access, not open internal sign-up.</h1>
            <p>
              I traced the live project flow: workforce logins are created by HR or the super admin,
              while candidates use the separate public recruitment portal. The old template sign-up form
              was still present, which is why registration felt broken.
            </p>
          </div>

          <div className="auth-premium-panel">
            <div className="auth-premium-panel-head">
              <h4>How access works now</h4>
              <span>Aligned to the backend</span>
            </div>
            <div className="auth-premium-panel-list">
              {managedSteps.map((step) => (
                <div key={step}>
                  <i className="ti ti-checks"></i>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-premium-form-wrap">
          <div className="auth-premium-form-card">
            <div className="auth-premium-form-head">
              <span className="auth-premium-kicker">Choose the right entry</span>
              <h2>Access options</h2>
              <p>
                We cleaned up the auth mapping so the frontend now follows the real system rules instead of the template placeholders.
              </p>
            </div>

            <div className="auth-demo-list">
              {accessTracks.map((item) => (
                <Link key={item.title} to={item.actionHref} className="auth-demo-card text-decoration-none">
                  <span className="auth-demo-icon">
                    <i className={`ti ti-${item.icon}`}></i>
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.copy}</small>
                  </div>
                  <span className="auth-demo-action">{item.actionLabel}</span>
                </Link>
              ))}
            </div>

            <div className="alert alert-info auth-login-alert" role="alert">
              <i className="ti ti-info-circle"></i>
              <span>
                Need a new employee, HR, or stakeholder login? Create it from <strong>User Access</strong> after signing in as HR or super admin.
              </span>
            </div>

            <div className="auth-form-footer mt-4">
              <div>
                <strong>Already have a managed account?</strong>
                <p>Sign in with your username or work email. The backend now accepts both.</p>
              </div>
              <Link to={all_routes.login} className="btn btn-primary">
                Back to Login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Register;
