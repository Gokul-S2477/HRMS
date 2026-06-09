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

export const fetchProjectOptions = async () => {
  try {
    const [projRes, crmRes] = await Promise.allSettled([
      API.get("/data/projects/"),
      API.get("/data/crm-deals/")
    ]);
    
    const projects = projRes.status === "fulfilled" ? normalizeList(projRes.value.data) : [];
    const deals = crmRes.status === "fulfilled" ? normalizeList(crmRes.value.data) : [];
    
    const projectNames = new Set();
    const options = [];
    
    projects.forEach((item) => {
      const name = item.data?.name || item.name;
      if (name && !projectNames.has(name)) {
        projectNames.add(name);
        options.push({ value: name, label: name });
      }
    });
    
    deals.forEach((item) => {
      const name = item.data?.deal_name || item.deal_name;
      if (name && !projectNames.has(name)) {
        projectNames.add(name);
        options.push({ value: name, label: name });
      }
    });
    
    if (options.length === 0) {
      ["Website Revamp", "HR Portal Setup", "Hospital Dashboard", "People Ops Revamp"].forEach((name) => {
        options.push({ value: name, label: name });
      });
    }
    
    return options;
  } catch (error) {
    console.error("Failed to fetch project options", error);
    return [
      { value: "Website Revamp", label: "Website Revamp" },
      { value: "HR Portal Setup", label: "HR Portal Setup" },
      { value: "Hospital Dashboard", label: "Hospital Dashboard" },
      { value: "People Ops Revamp", label: "People Ops Revamp" }
    ];
  }
};

export { normalizeList };
