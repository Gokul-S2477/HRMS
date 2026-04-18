import API from "../../../api/axios";

const APPLICANT_TOKEN_KEY = "applicant_access_token";
const APPLICANT_PROFILE_KEY = "applicant_profile";

export const getApplicantToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(APPLICANT_TOKEN_KEY) || "";
};

export const getStoredApplicant = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(APPLICANT_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export const saveApplicantSession = (token, applicant) => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(APPLICANT_TOKEN_KEY, token);
  }
  if (applicant) {
    localStorage.setItem(APPLICANT_PROFILE_KEY, JSON.stringify(applicant));
  }
};

export const clearApplicantSession = async () => {
  const token = getApplicantToken();
  if (typeof window !== "undefined") {
    localStorage.removeItem(APPLICANT_TOKEN_KEY);
    localStorage.removeItem(APPLICANT_PROFILE_KEY);
  }
  if (token) {
    try {
      await API.post("/public/auth/sign-out/", {}, { headers: { "X-Applicant-Token": token } });
    } catch (error) {
      // ignore local sign-out cleanup failures
    }
  }
};

export const applicantHeaders = () => {
  const token = getApplicantToken();
  return token ? { "X-Applicant-Token": token } : {};
};

export const requestApplicantCode = async (payload) => {
  const response = await API.post("/public/auth/request-code/", payload);
  return response.data;
};

export const verifyApplicantCode = async (payload) => {
  const response = await API.post("/public/auth/verify-code/", payload);
  if (response.data?.token) {
    saveApplicantSession(response.data.token, response.data.applicant);
  }
  return response.data;
};

export const fetchApplicantProfile = async () => {
  const response = await API.get("/public/applicant/me/", { headers: applicantHeaders() });
  if (response.data) {
    saveApplicantSession(getApplicantToken(), response.data);
  }
  return response.data;
};

export const updateApplicantProfile = async (payload) => {
  const response = await API.patch("/public/applicant/me/", payload, { headers: applicantHeaders() });
  if (response.data) {
    saveApplicantSession(getApplicantToken(), response.data);
  }
  return response.data;
};

export const fetchApplicantApplications = async () => {
  const response = await API.get("/public/applicant/applications/", { headers: applicantHeaders() });
  return response.data;
};

export const fetchPublicJobs = async (params = {}) => {
  const response = await API.get("/public/jobs/", { params, headers: applicantHeaders() });
  return response.data;
};

export const fetchPublicJobDetails = async (jobId, jobSlug = "") => {
  const path = jobSlug ? `/public/jobs/${jobId}/${jobSlug}/` : `/public/jobs/${jobId}/`;
  const response = await API.get(path, { headers: applicantHeaders() });
  return response.data;
};

export const submitPublicApplication = async (jobId, jobSlug, payload) => {
  const path = jobSlug ? `/public/jobs/${jobId}/${jobSlug}/apply/` : `/public/jobs/${jobId}/apply/`;
  const response = await API.post(path, payload, { headers: applicantHeaders() });
  return response.data;
};
