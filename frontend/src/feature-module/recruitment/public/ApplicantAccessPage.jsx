import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import PublicRecruitmentShell from "./PublicRecruitmentShell";
import { requestApplicantCode, verifyApplicantCode, getStoredApplicant } from "./applicantAuth";
import { all_routes } from "../../router/all_routes";

const ApplicantAccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const applicant = getStoredApplicant();
  const redirectTo = new URLSearchParams(location.search).get("redirect") || all_routes.applicantDashboard;

  const [email, setEmail] = useState(applicant?.email || "");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [debugCode, setDebugCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRequest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const data = await requestApplicantCode({ email });
      setRequested(true);
      setMessage(data?.message || "A sign-in code was sent.");
      setDebugCode(data?.debug_code || "");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Unable to request a sign-in code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await verifyApplicantCode({ email, code });
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "The sign-in code is invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicRecruitmentShell
      title="Applicant access"
      subtitle="Use your email to open a single candidate access path. That keeps applications tied to the same profile instead of reapplying from scratch each time."
      chips={[
        "One email = one reusable applicant identity",
        "Local debug mode shows the code without email delivery",
      ]}
    >
      <div className="row justify-content-center">
        <div className="col-xl-7">
          <div className="card payroll-panel careers-auth-card">
            <div className="card-body p-4 p-lg-5">
              <div className="text-center mb-4">
                <div className="payroll-kicker">Secure applicant sign-in</div>
                <h3 className="payroll-section-title mb-2">Continue with your email</h3>
                <p className="text-muted mb-0">We’ll issue a short code so you can view your applications, update your profile, and apply without creating duplicates.</p>
              </div>

              {error ? <div className="alert alert-danger">{error}</div> : null}
              {message ? <div className="alert alert-info">{message}</div> : null}
              {debugCode ? <div className="alert alert-warning">Local debug code: <strong>{debugCode}</strong></div> : null}

              <form onSubmit={requested ? handleVerify : handleRequest} className="d-flex flex-column gap-3">
                <div>
                  <label className="form-label">Applicant email</label>
                  <input type="email" className="form-control" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                {requested ? (
                  <div>
                    <label className="form-label">Verification code</label>
                    <input type="text" className="form-control" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter the 6-digit code" required />
                  </div>
                ) : null}
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Working..." : requested ? "Verify and continue" : "Send sign-in code"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </PublicRecruitmentShell>
  );
};

export default ApplicantAccessPage;
