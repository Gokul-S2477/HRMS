import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import PublicRecruitmentShell from "./PublicRecruitmentShell";
import { fetchApplicantProfile, fetchPublicJobDetails, getApplicantToken, submitPublicApplication } from "./applicantAuth";
import { all_routes } from "../../router/all_routes";

const splitList = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

const CareersApplyPage = () => {
  const navigate = useNavigate();
  const { jobId, jobSlug } = useParams();
  const token = getApplicantToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobPayload, setJobPayload] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    whatsapp: "",
    city: "",
    state: "",
    country: "India",
    headline: "",
    preferred_role: "",
    current_company: "",
    current_title: "",
    years_experience: "0",
    notice_period_days: "0",
    expected_ctc: "0",
    current_ctc: "0",
    linkedin_url: "",
    portfolio_url: "",
    resume_url: "",
    skills: "",
    summary: "",
    cover_letter: "",
    consent_to_contact: true,
  });

  useEffect(() => {
    if (!token) {
      const redirect = all_routes.careersApply.replace(":jobId", String(jobId)).replace(":jobSlug", jobSlug || "opening");
      navigate(`${all_routes.applicantAccess}?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [jobData, applicant] = await Promise.all([fetchPublicJobDetails(jobId, jobSlug), fetchApplicantProfile()]);
        setJobPayload(jobData);
        setForm((current) => ({
          ...current,
          first_name: applicant?.first_name || "",
          last_name: applicant?.last_name || "",
          phone: applicant?.phone || "",
          whatsapp: applicant?.whatsapp || "",
          city: applicant?.city || "",
          state: applicant?.state || "",
          country: applicant?.country || "India",
          headline: applicant?.headline || "",
          preferred_role: applicant?.preferred_role || jobData?.job?.title || "",
          current_company: applicant?.current_company || "",
          current_title: applicant?.current_title || "",
          years_experience: applicant?.years_experience || "0",
          linkedin_url: applicant?.linkedin_url || "",
          portfolio_url: applicant?.portfolio_url || "",
          resume_url: applicant?.resume_url || "",
          summary: applicant?.summary || "",
        }));
      } catch (loadError) {
        console.error("Failed to load application page", loadError);
        setError("We could not prepare this application form right now.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId, jobSlug, navigate, token]);

  const job = jobPayload?.job;
  const suggested = jobPayload?.suggested_jobs || [];

  const summary = useMemo(
    () => [
      { label: "Applying for", value: job?.title || "-" },
      { label: "Department", value: job?.department_name || "General" },
      { label: "Work mode", value: job?.work_mode || "Hybrid" },
      { label: "Experience", value: `${form.years_experience || 0} years` },
    ],
    [form.years_experience, job]
  );

  const handleChange = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await submitPublicApplication(jobId, jobSlug, {
        ...form,
        years_experience: Number(form.years_experience || 0),
        notice_period_days: Number(form.notice_period_days || 0),
        expected_ctc: Number(form.expected_ctc || 0),
        current_ctc: Number(form.current_ctc || 0),
        skills: splitList(form.skills),
      });
      navigate(all_routes.applicantDashboard, { replace: true });
    } catch (submitError) {
      setError(submitError?.response?.data?.detail || "Unable to save this application right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PublicRecruitmentShell
      title={job ? `Apply for ${job.title}` : "Apply for this role"}
      subtitle="This keeps the job you are applying for front and center, while also showing suggested openings if you want to branch out." 
      chips={[
        "Applicant profile fields prefill once you sign in with email",
        "Existing applications update instead of duplicating records",
      ]}
    >
      {loading ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">Preparing your application form...</div></div>
      ) : !job ? (
        <div className="card payroll-panel"><div className="card-body text-center text-muted py-5">This role is unavailable for application.</div></div>
      ) : (
        <div className="row g-4">
          <div className="col-xl-8">
            <div className="card payroll-panel">
              <div className="card-body">
                {error ? <div className="alert alert-danger">{error}</div> : null}
                <form onSubmit={handleSubmit} className="row g-3">
                  {[
                    ["first_name", "First name"],
                    ["last_name", "Last name"],
                    ["phone", "Phone"],
                    ["whatsapp", "WhatsApp"],
                    ["city", "City"],
                    ["state", "State"],
                    ["country", "Country"],
                    ["headline", "Professional headline"],
                    ["preferred_role", "Preferred role"],
                    ["current_company", "Current company"],
                    ["current_title", "Current title"],
                    ["years_experience", "Years of experience"],
                    ["notice_period_days", "Notice period (days)"],
                    ["expected_ctc", "Expected CTC"],
                    ["current_ctc", "Current CTC"],
                    ["linkedin_url", "LinkedIn URL"],
                    ["portfolio_url", "Portfolio URL"],
                    ["resume_url", "Resume URL"],
                  ].map(([name, label]) => (
                    <div className="col-md-6" key={name}>
                      <label className="form-label">{label}</label>
                      <input className="form-control" value={form[name]} onChange={(event) => handleChange(name, event.target.value)} required={name === "first_name" || name === "phone"} />
                    </div>
                  ))}
                  <div className="col-12">
                    <label className="form-label">Primary skills</label>
                    <input className="form-control" value={form.skills} onChange={(event) => handleChange("skills", event.target.value)} placeholder="React, Django, stakeholder management" />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Profile summary</label>
                    <textarea className="form-control" rows={4} value={form.summary} onChange={(event) => handleChange("summary", event.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Cover letter</label>
                    <textarea className="form-control" rows={5} value={form.cover_letter} onChange={(event) => handleChange("cover_letter", event.target.value)} placeholder={`Why are you a fit for ${job.title}?`} />
                  </div>
                  <div className="col-12">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={form.consent_to_contact} onChange={(event) => handleChange("consent_to_contact", event.target.checked)} id="consent_to_contact" />
                      <label className="form-check-label" htmlFor="consent_to_contact">I’m okay with the HR team contacting me through email or WhatsApp for this role.</label>
                    </div>
                  </div>
                  <div className="col-12 d-flex flex-wrap gap-2">
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving application..." : jobPayload?.already_applied ? "Update application" : "Submit application"}</button>
                    <Link to={all_routes.applicantDashboard} className="btn btn-light">Back to dashboard</Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="col-xl-4">
            <div className="card payroll-section-card mb-4">
              <div className="card-body">
                <h5 className="payroll-section-title mb-3">Application summary</h5>
                <div className="payroll-summary-list">
                  {summary.map((item) => (
                    <div className="payroll-summary-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card payroll-section-card">
              <div className="card-body">
                <h5 className="payroll-section-title mb-3">Suggested jobs</h5>
                {suggested.length ? suggested.map((item) => (
                  <div className="careers-suggestion" key={item.id}>
                    <div>
                      <div className="payroll-primary-text">{item.title}</div>
                      <div className="payroll-secondary-text">{item.work_mode || "Hybrid"} · {item.department_name || "General"}</div>
                    </div>
                    <Link to={all_routes.careersJobDetails.replace(":jobId", String(item.id)).replace(":jobSlug", item.public_slug || "opening")} className="btn btn-sm btn-light">View</Link>
                  </div>
                )) : <p className="text-muted mb-0">No suggested roles just yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </PublicRecruitmentShell>
  );
};

export default CareersApplyPage;
