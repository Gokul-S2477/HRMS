import API from "../../../api/axios";

type EmployeeShape = {
  first_name?: string | null;
  last_name?: string | null;
  emp_code?: string | null;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  address?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  joining_date?: string | null;
  employment_type?: string | null;
  role?: string | null;
  department?: { id?: number; name?: string | null } | null;
  designation?: { id?: number; title?: string | null } | null;
  reporting_to?: number | null;
  salary?: number | string | null;
  is_active?: boolean;
  photo?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  national_id?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  work_shift?: string | null;
  work_location?: string | null;
  about?: string | null;
  personal_info?: Record<string, unknown> | null;
  bank_info?: Record<string, unknown> | null;
  family_info?: Record<string, unknown> | null;
  education?: unknown[] | null;
  experience?: unknown[] | null;
  projects?: unknown[] | null;
  assets?: unknown[] | null;
};

export const normalizeList = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown[] }).results)) {
    return ((data as { results: unknown[] }).results || []) as T[];
  }
  return [];
};

export const formatDisplayDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatMoney = (value?: number | string | null) => {
  const amount = Number(String(value ?? "0").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const employeeFullName = (employee: EmployeeShape) =>
  `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.emp_code || "Employee";

export const apiHost = () => (API.defaults.baseURL || "").replace(/\/api\/?$/, "");

export const employeeAvatarSrc = (employee: EmployeeShape) => {
  if (employee.photo) {
    return employee.photo.startsWith("http") ? employee.photo : `${apiHost()}${employee.photo}`;
  }
  return "/assets/images/avatar.png";
};

export const calculateAge = (value?: string | null) => {
  if (!value) return null;
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return null;
  return Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
};

export const calculateTenureLabel = (value?: string | null) => {
  if (!value) return "Tenure unavailable";
  const joined = new Date(value);
  if (Number.isNaN(joined.getTime())) return "Tenure unavailable";
  const days = Math.max(0, Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24)));
  if (days < 30) return `${days} days in company`;
  if (days < 365) return `${Math.floor(days / 30)} months in company`;
  return `${(days / 365).toFixed(1)} years in company`;
};

export const profileCompletion = (employee: EmployeeShape) => {
  const checks = [
    employee.first_name,
    employee.last_name,
    employee.email,
    employee.phone,
    employee.address,
    employee.gender,
    employee.date_of_birth,
    employee.department?.name,
    employee.designation?.title,
    employee.joining_date,
    employee.employment_type,
    employee.role,
    employee.salary,
    employee.emergency_contact_name,
    employee.emergency_contact_number,
    employee.national_id,
    employee.work_shift,
    employee.work_location,
    employee.about,
    employee.personal_info && Object.keys(employee.personal_info).length > 0,
    employee.bank_info && Object.keys(employee.bank_info).length > 0,
    employee.family_info && Object.keys(employee.family_info).length > 0,
    employee.education && employee.education.length > 0,
    employee.experience && employee.experience.length > 0,
    employee.projects && employee.projects.length > 0,
    employee.assets && employee.assets.length > 0,
  ];

  const total = checks.length;
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / total) * 100);
};

export const employeeSummary = <T extends EmployeeShape>(employees: T[]) => {
  const total = employees.length;
  const active = employees.filter((employee) => employee.is_active).length;
  const inactive = total - active;
  const newJoiners = employees.filter((employee) => {
    if (!employee.joining_date) return false;
    const joined = new Date(employee.joining_date);
    if (Number.isNaN(joined.getTime())) return false;
    return (Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24) <= 30;
  }).length;
  const averageCompletion =
    total === 0 ? 0 : Math.round(employees.reduce((sum, employee) => sum + profileCompletion(employee), 0) / total);

  return { total, active, inactive, newJoiners, averageCompletion };
};
