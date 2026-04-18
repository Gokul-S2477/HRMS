import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import PublicRecruitmentShell from "./PublicRecruitmentShell";
import { fetchPublicJobDetails, getApplicantToken } from "./applicantAuth";
import { all_routes } from "../../router/all_routes";
import { formatCurrency, formatDisplayDate } from "../../hrm/hrmShared";

const applyRoute = (jobId, jobSlug) => all_routes.careersApply.replace(":jobId", String(jobId)).replace(":jobSlug", jobSlug || "opening");
const detailRoute = (job) => all_routes.careersJobDetails.replace(":jobId", String(job.id)).replace(":jobSlug", job.public_slug || "opening");

const CareersJobDetailPage = () => {
  const { jobId, jobSlug } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchPublicJobDetails(jobId, jobSlug);
        setPayload(data);
      } catch (error) {
        console.error("Failed to load public job", error);
        setPayload(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId, jobSlug]);

  const job = payload?.job;
  const suggested = payload?.suggested_jobs || [];
  const alreadyApplied = Boolean(payload?.already_applied);

  return (
    <PublicRecruitmentShell
      title={job?.title || "Role details"}
      subtitle="See the role context, the suggested follow-on openings, and move straight into the guided application flow." 
      action={job ? (
        <div className="d-flex flex-wrap gap-2 justify-content-lg-end justify-content-start">
          <Link to={applyRoute(job.id, job.public_slug)} className="btn btn-primary">
            {alreadyApplied ? "Update my application" : "Apply for this role"}
          </Link>
          <a href={job.share_links?.linkedin} className="btn btn-light" target="_blank" rel="noreferrer">Share</a>
        </div>
      ) : null}
      chips={[
        alreadyApplied ? "You already have an application for this role" : "No duplicate public application needed once your email is linked",
        getApplicantToken() ? "Applicant session detected" : "Use applicant access before applying",
      ]}
    >
      {loading ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">Loading job details...</div></div>
      ) : !job ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">This public role is not available right now.</div></div>
      ) : (
        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel mb-4">
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="payroll-badge accent">{job.employment_type || "Full-Time"}</span>
                  <span className="payroll-badge info">{job.work_mode || "Hybrid"}</span>
                  <span className="payroll-badge success">{job.department_name || "General"}</span>
                </div>
                <div className="row g-3 mb-4">
                  <div className="col-md-4"><div className="careers-data-pill"><span>Openings</span><strong>{job.openings || 1}</strong></div></div>
                  <div className="col-md-4"><div className="careers-data-pill"><span>Experience</span><strong>{job.experience_band || `${job.experience_min_years || 0}-${job.experience_max_years || 0} years`}</strong></div></div>
                  <div className="col-md-4"><div className="careers-data-pill"><span>Salary band</span><strong>{Number(job.salary_max || 0) > 0 ? `${formatCurrency(job.salary_min)} - ${formatCurrency(job.salary_max)}` : "Shared during screening"}</strong></div></div>
                </div>
                <div className="mb-4">
                  <h5 className="payroll-section-title mb-3">Role overview</h5>
                  <p className="text-muted mb-0">{job.description || "The hiring team will use this role page to describe scope, responsibilities, and the workflow after you apply."}</p>
                </div>
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="card payroll-section-card h-100">
                      <div className="card-body">
                        <h6 className="payroll-section-title mb-3">Skills they are looking for</h6>
                        <div className="employee-chip-row">
                          {(job.skills || []).length ? job.skills.map((item) => <span key={item} className="employee-chip">{item}</span>) : <span className="text-muted">Skills will be discussed with shortlisted applicants.</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card payroll-section-card h-100">
                      <div className="card-body">
                        <h6 className="payroll-section-title mb-3">Why this role stands out</h6>
                        <ul className="careers-list mb-0">
                          {(job.benefits || []).length ? job.benefits.map((item) => <li key={item}>{item}</li>) : <li>Benefits and growth details are shared as you move through the hiring flow.</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card payroll-section-card mb-4">
              <div className="card-body">
                <h5 className="payroll-section-title mb-3">Role snapshot</h5>
                <div className="payroll-summary-list">
                  <div className="payroll-summary-row"><span>Location</span><strong>{job.location || [job.city, job.state, job.country].filter(Boolean).join(", ") || "Flexible"}</strong></div>
                  <div className="payroll-summary-row"><span>Posted</span><strong>{formatDisplayDate(job.posted_on)}</strong></div>
                  <div className="payroll-summary-row"><span>Closing</span><strong>{formatDisplayDate(job.closing_on)}</strong></div>
                  <div className="payroll-summary-row"><span>Hiring manager</span><strong>{job.hiring_manager || "Talent team"}</strong></div>
                </div>
              </div>
            </div>

            <div className="card payroll-section-card">
              <div className="card-body">
                <h5 className="payroll-section-title mb-3">Suggested next jobs</h5>
                {suggested.length ? (
                  <div className="d-flex flex-column gap-3">
                    {suggested.map((item) => (
                      <div key={item.id} className="careers-suggestion">
                        <div>
                          <div className="payroll-primary-text">{item.title}</div>
                          <div className="payroll-secondary-text">{item.department_name || "General"} · {item.work_mode || "Hybrid"}</div>
                        </div>
                        <Link to={detailRoute(item)} className="btn btn-sm btn-light">View</Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0">No related openings were found yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PublicRecruitmentShell>
  );
};

export default CareersJobDetailPage;
