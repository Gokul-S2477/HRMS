import API from "../../api/axios";

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const fetchEmployeeOptions = async () => {
  const response = await API.get("/employees/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.emp_code,
  }));
};

export const fetchShiftOptions = async () => {
  const response = await API.get("/shift-definitions/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: item.name,
  }));
};

export const fetchJobOptions = async () => {
  const response = await API.get("/recruitment/jobs/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: item.title,
  }));
};

export const fetchDocumentCategoryOptions = async () => {
  const response = await API.get("/document-categories/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: item.name,
  }));
};

export const fetchCandidateOptions = async () => {
  const response = await API.get("/recruitment/candidates/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: item.full_name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.email,
  }));
};

export const fetchOnboardingTemplateOptions = async () => {
  const response = await API.get("/onboarding/templates/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: item.name,
  }));
};

export const fetchAssetCategoryOptions = async () => {
  const response = await API.get("/asset-categories/");
  return normalizeList(response.data).map((item) => ({
    value: item.id,
    label: item.name,
  }));
};

export { normalizeList };
