import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import PublicRecruitmentShell from "./PublicRecruitmentShell";
import { fetchPublicJobs, getStoredApplicant } from "./applicantAuth";
import { all_routes } from "../../router/all_routes";
import { formatCurrency, formatDisplayDate, smartSearchMatch } from "../../hrm/hrmShared";

const routeForJob = (job) => all_routes.careersJobDetails.replace(":jobId", String(job.id)).replace(":jobSlug", job.public_slug || "opening");
const applyRouteForJob = (job) => all_routes.careersApply.replace(":jobId", String(job.id)).replace(":jobSlug", job.public_slug || "opening");

const CareersJobsPage = () => {
  const applicant = getStoredApplicant();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ search: "", location: "", employment_type: "", work_mode: "" });
  const [meta, setMeta] = useState({ employment_types: [], work_modes: [] });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchPublicJobs(filters);
        setJobs(data?.results || []);
        setMeta(data?.filters || { employment_types: [], work_modes: [] });
      } catch (error) {
        console.error("Failed to load public jobs", error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters]);

  const statCards = useMemo(() => {
    const remote = jobs.filter((job) => String(job.work_mode || "").toLowerCase().includes("remote")).length;
    const departments = new Set(jobs.map((job) => job.department_name).filter(Boolean)).size;
    return [
      { label: "Open Roles", value: jobs.length, meta: "Public jobs live now" },
      { label: "Departments", value: departments, meta: "Cross-functional hiring" },
      { label: "Remote Friendly", value: remote, meta: "Roles with distributed setup" },
      { label: "Applicant Access", value: applicant ? "On" : "Ready", meta: applicant ? applicant.email : "Email-based access" },
    ];
  }, [applicant, jobs]);

  return (
    <PublicRecruitmentShell
      title="Explore open roles"
      subtitle="Search active openings, share them across LinkedIn or Indeed, and move into a single applicant flow that remembers who you are." 
      action={
        <div className="d-flex flex-wrap gap-2 justify-content-lg-end justify-content-start">
          <Link to={applicant ? all_routes.applicantDashboard : all_routes.applicantAccess} className="btn btn-primary">
            {applicant ? "Go to applicant dashboard" : "Access with email"}
          </Link>
        </div>
      }
      chips={[
        "Search by role, location, type, or work mode",
        "Apply once with email-based applicant access",
        "Share directly to LinkedIn, WhatsApp, email, or Indeed",
      ]}
    >
      <div className="row g-4 mb-4">
        {statCards.map((card) => (
          <div className="col-md-6 col-xl-3" key={card.label}>
            <div className="card payroll-stat-card h-100">
              <div className="card-body">
                <span className="payroll-stat-label">{card.label}</span>
                <h3 className="payroll-stat-value">{card.value}</h3>
                <div className="payroll-stat-meta">{card.meta}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card payroll-panel mb-4">
        <div className="card-body">
          <div className="payroll-toolbar careers-toolbar">
            <div>
              <label className="form-label">Smart Search</label>
              <input
                className="form-control"
                placeholder="Frontend, HR Ops, recruiter, Bangalore"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Location</label>
              <input
                className="form-control"
                placeholder="Bengaluru, Chennai, Remote"
                value={filters.location}
                onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Employment Type</label>
              <select className="form-select" value={filters.employment_type} onChange={(event) => setFilters((current) => ({ ...current, employment_type: event.target.value }))}>
                <option value="">All types</option>
                {meta.employment_types.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Work Mode</label>
              <select className="form-select" value={filters.work_mode} onChange={(event) => setFilters((current) => ({ ...current, work_mode: event.target.value }))}>
                <option value="">All modes</option>
                {meta.work_modes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">Loading open jobs...</div></div>
      ) : jobs.length === 0 ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">No public jobs matched those filters yet.</div></div>
      ) : (
        <div className="row g-4">
          {jobs.filter((job) => smartSearchMatch(job, filters.search)).map((job) => (
            <div className="col-xl-6" key={job.id}>
              <div className="card payroll-section-card careers-job-card h-100">
                <div className="card-body d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between gap-3 align-items-start">
                    <div>
                      <div className="payroll-primary-text fs-5">{job.title}</div>
                      <div className="payroll-secondary-text mt-1">{job.department_name || "General"} · {job.location || [job.city, job.state].filter(Boolean).join(", ") || "Location shared after screening"}</div>
                    </div>
                    <span className="payroll-badge accent">{job.work_mode || "Hybrid"}</span>
                  </div>

                  <div className="careers-meta-row">
                    <span><i className="ti ti-briefcase" /> {job.employment_type || "Full-Time"}</span>
                    <span><i className="ti ti-users-group" /> {job.openings || 1} opening(s)</span>
                    <span><i className="ti ti-calendar-event" /> Posted {formatDisplayDate(job.posted_on)}</span>
                  </div>

                  <p className="text-muted mb-0">{job.description || "This role is live on the public recruitment portal. Open the role to review requirements, suggested jobs, and the guided application flow."}</p>

                  <div className="row g-3 mt-1">
                    <div className="col-sm-6">
                      <div className="careers-data-pill">
                        <span>Experience</span>
                        <strong>{job.experience_band || `${job.experience_min_years || 0}-${job.experience_max_years || 0} years`}</strong>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="careers-data-pill">
                        <span>Salary</span>
                        <strong>{Number(job.salary_max || 0) > 0 ? `${formatCurrency(job.salary_min)} - ${formatCurrency(job.salary_max)}` : "Discuss during screening"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-auto">
                    <Link to={routeForJob(job)} className="btn btn-light">View role</Link>
                    <Link to={applyRouteForJob(job)} className="btn btn-primary">Apply now</Link>
                    <a href={job.share_links?.linkedin} target="_blank" rel="noreferrer" className="btn btn-outline-secondary">LinkedIn</a>
                    <a href={job.share_links?.indeed} target="_blank" rel="noreferrer" className="btn btn-outline-secondary">Indeed</a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PublicRecruitmentShell>
  );
};

export default CareersJobsPage;
