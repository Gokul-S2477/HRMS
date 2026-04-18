import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { all_routes } from "../../router/all_routes";
import { clearApplicantSession, getStoredApplicant } from "./applicantAuth";

const PublicRecruitmentShell = ({ title, subtitle, children, action = null, chips = [] }) => {
  const applicant = getStoredApplicant();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await clearApplicantSession();
    navigate(all_routes.careersJobs);
  };

  return (
    <div className="careers-shell payroll-shell min-vh-100">
      <div className="careers-topbar">
        <div className="container-fluid">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <Link to={all_routes.careersJobs} className="careers-brand text-decoration-none">
              <span className="careers-brand-mark">HR</span>
              <div>
                <strong>SmartHR Careers</strong>
                <small>Find roles, apply once, track every step.</small>
              </div>
            </Link>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <Link to={all_routes.login} className="btn btn-light">
                HR Sign In
              </Link>
              {applicant ? (
                <>
                  <Link to={all_routes.applicantDashboard} className="btn btn-primary">
                    My Applications
                  </Link>
                  <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>
                    Sign Out
                  </button>
                </>
              ) : (
                <Link to={all_routes.applicantAccess} className="btn btn-primary">
                  Applicant Access
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid py-4 py-lg-5">
        <div className="card payroll-hero careers-hero mb-4">
          <div className="card-body">
            <div className="row g-4 align-items-start">
              <div className="col-lg-8">
                <div className="payroll-kicker">Public Recruitment Portal</div>
                <h1 className="payroll-title">{title}</h1>
                <p className="payroll-subtitle">{subtitle}</p>
                {chips.length ? (
                  <div className="employee-chip-row mt-3">
                    {chips.map((chip) => (
                      <span key={chip} className="employee-chip">
                        <i className="ti ti-sparkles" />
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions justify-content-lg-end justify-content-start">{action}</div>
              </div>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};

export default PublicRecruitmentShell;
