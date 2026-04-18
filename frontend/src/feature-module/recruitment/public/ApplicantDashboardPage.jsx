import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PublicRecruitmentShell from "./PublicRecruitmentShell";
import {
  clearApplicantSession,
  fetchApplicantApplications,
  fetchApplicantProfile,
  fetchPublicJobs,
  getApplicantToken,
  updateApplicantProfile,
} from "./applicantAuth";
import { all_routes } from "../../router/all_routes";
import { formatDisplayDate } from "../../hrm/hrmShared";

const detailRoute = (job) => all_routes.careersJobDetails.replace(":jobId", String(job.id)).replace(":jobSlug", job.public_slug || "opening");
const applyRoute = (job) => all_routes.careersApply.replace(":jobId", String(job.id)).replace(":jobSlug", job.public_slug || "opening");

const ApplicantDashboardPage = () => {
  const token = getApplicantToken();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [suggestedJobs, setSuggestedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate(all_routes.applicantAccess, { replace: true });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [profileData, applicationData] = await Promise.all([fetchApplicantProfile(), fetchApplicantApplications()]);
        setProfile(profileData);
        setApplications(applicationData || []);
        const jobData = await fetchPublicJobs({ search: profileData?.preferred_role || "" });
        setSuggestedJobs(jobData?.results || []);
      } catch (loadError) {
        console.error("Failed to load applicant dashboard", loadError);
        setError("We could not load your applicant dashboard right now.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, token]);

  const stats = useMemo(() => {
    const active = applications.filter((item) => !["rejected", "withdrawn", "joined"].includes(item.stage)).length;
    return [
      { label: "Applications", value: applications.length, meta: "Roles attached to this email" },
      { label: "Active flow", value: active, meta: `${applications.filter((item) => item.stage === "offer").length} in offer stage` },
      { label: "Shortlisted", value: applications.filter((item) => ["screening", "interview", "offer"].includes(item.stage)).length, meta: "Still moving" },
      { label: "Profile", value: profile?.preferred_role || "Candidate", meta: profile?.email || "Applicant identity" },
    ];
  }, [applications, profile]);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const next = await updateApplicantProfile(profile);
      setProfile(next);
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || "Unable to update your applicant profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await clearApplicantSession();
    navigate(all_routes.careersJobs, { replace: true });
  };

  return (
    <PublicRecruitmentShell
      title="Applicant dashboard"
      subtitle="Track every application tied to your email, keep your profile current, and jump into new roles without re-entering everything from scratch."
      action={
        <div className="d-flex flex-wrap gap-2 justify-content-lg-end justify-content-start">
          <Link to={all_routes.careersJobs} className="btn btn-light">Browse jobs</Link>
          <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>Sign out</button>
        </div>
      }
      chips={[
        "This profile powers duplicate-safe public applications",
        "HR, stakeholder, and admin teams can review your profile from the internal pipeline",
      ]}
    >
      {loading ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">Loading your applicant dashboard...</div></div>
      ) : (
        <>
          {error ? <div className="alert alert-danger">{error}</div> : null}
          <div className="row g-4 mb-4">
            {stats.map((card) => (
              <div className="col-md-6 col-xl-3" key={card.label}>
                <div className="card payroll-stat-card h-100"><div className="card-body"><span className="payroll-stat-label">{card.label}</span><h3 className="payroll-stat-value">{card.value}</h3><div className="payroll-stat-meta">{card.meta}</div></div></div>
              </div>
            ))}
          </div>
          <div className="row g-4">
            <div className="col-xl-5">
              <div className="card payroll-panel h-100">
                <div className="card-body">
                  <div className="payroll-section-header"><h5 className="payroll-section-title">Your profile</h5></div>
                  <form onSubmit={handleProfileSave} className="row g-3 mt-1">
                    {profile ? [
                      ["first_name", "First name"],
                      ["last_name", "Last name"],
                      ["phone", "Phone"],
                      ["whatsapp", "WhatsApp"],
                      ["preferred_role", "Preferred role"],
                      ["current_company", "Current company"],
                      ["current_title", "Current title"],
                      ["linkedin_url", "LinkedIn URL"],
                      ["portfolio_url", "Portfolio URL"],
                      ["resume_url", "Resume URL"],
                    ].map(([name, label]) => (
                      <div className="col-md-6" key={name}>
                        <label className="form-label">{label}</label>
                        <input className="form-control" value={profile[name] || ""} onChange={(event) => setProfile((current) => ({ ...current, [name]: event.target.value }))} />
                      </div>
                    )) : null}
                    <div className="col-12">
                      <label className="form-label">Summary</label>
                      <textarea className="form-control" rows={4} value={profile?.summary || ""} onChange={(event) => setProfile((current) => ({ ...current, summary: event.target.value }))} />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving profile..." : "Save profile"}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-xl-7">
              <div className="card payroll-panel mb-4">
                <div className="card-body">
                  <div className="payroll-section-header"><h5 className="payroll-section-title">Application tracker</h5></div>
                  {applications.length ? (
                    <div className="table-responsive mt-3">
                      <table className="table align-middle mb-0">
                        <thead><tr><th>Role</th><th>Stage</th><th>Submitted</th><th className="text-end">Action</th></tr></thead>
                        <tbody>
                          {applications.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div className="fw-semibold">{item.job?.title}</div>
                                <div className="text-muted small">{item.job?.department_name || "General"}</div>
                              </td>
                              <td><span className="payroll-badge accent">{item.stage}</span></td>
                              <td>{formatDisplayDate(item.submitted_at)}</td>
                              <td className="text-end"><Link to={applyRoute(item.job)} className="btn btn-sm btn-light">Open</Link></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted mt-3 mb-0">No applications tied to this email yet.</p>
                  )}
                </div>
              </div>
              <div className="card payroll-panel">
                <div className="card-body">
                  <div className="payroll-section-header"><h5 className="payroll-section-title">Suggested roles</h5></div>
                  {suggestedJobs.length ? (
                    <div className="row g-3 mt-1">
                      {suggestedJobs.slice(0, 4).map((job) => (
                        <div className="col-md-6" key={job.id}>
                          <div className="careers-suggestion-card h-100">
                            <div className="payroll-primary-text">{job.title}</div>
                            <div className="payroll-secondary-text mb-3">{job.department_name || "General"} · {job.work_mode || "Hybrid"}</div>
                            <div className="d-flex gap-2 mt-auto">
                              <Link to={detailRoute(job)} className="btn btn-sm btn-light">View</Link>
                              <Link to={applyRoute(job)} className="btn btn-sm btn-primary">Apply</Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mt-3 mb-0">We’ll start suggesting jobs once your profile has a preferred role or application history.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PublicRecruitmentShell>
  );
};

export default ApplicantDashboardPage;
