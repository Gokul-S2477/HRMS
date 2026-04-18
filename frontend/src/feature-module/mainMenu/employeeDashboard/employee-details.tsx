// frontend/src/feature-module/mainMenu/employeeDashboard/employee-details.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../../../api/axios";
import { useAuth } from "../../../core/auth/AuthContext";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import all_routes from "../../router/all_routes";
import {
  calculateAge,
  calculateTenureLabel,
  employeeFullName,
  employeeSummary,
  formatDisplayDate,
  formatMoney,
  normalizeList,
  profileCompletion,
} from "./employeeShared";

// Types
type Dept = { id: number; name: string };
type Desig = { id: number; title: string };

type BankInfo = {
  bank_name?: string;
  account_number?: string;
  ifsc?: string;
  branch?: string;
  pan?: string;
  pf_number?: string;
};

type PersonalInfo = {
  passport_expiry?: string;
  nationality?: string;
  religion?: string;
  children_count?: number | string;
};

type FamilyInfo = {
  spouse_name?: string;
  spouse_employment?: string;
  children_count?: number | string;
  emergency_name?: string;
  emergency_phone?: string;
};

type EducationItem = { degree?: string; institute?: string; year?: string };
type ExperienceItem = { company?: string; role?: string; from?: string; to?: string };
type ProjectItem = {
  name?: string;
  tasks?: number | string;
  completed?: number | string;
  deadline?: string;
  lead?: string;
};
type AssetItem = { name?: string; status?: string; assigned_on?: string };

type BasicForm = {
  phone?: string;
  email?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
};

type PersonalForm = {
  passport_no?: string;
  passport_expiry?: string;
  nationality?: string;
  religion?: string;
  marital_status?: string;
  children_count?: number | string;
};

type EmergencyForm = {
  primary_name?: string;
  primary_phone?: string;
  secondary_name?: string;
  secondary_phone?: string;
};

type Employee = {
  id: number;
  emp_code: string;
  first_name: string;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  alternate_phone?: string | null;
  address?: string | null;
  gender?: string | null;
  department?: Dept | null;
  designation?: Desig | null;
  joining_date?: string | null;
  date_of_birth?: string | null;
  employment_type?: string | null;
  role?: string | null;
  reporting_to?: number | null;
  salary?: number | null;
  photo?: string | null;
  is_active?: boolean;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  national_id?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  work_shift?: string | null;
  work_location?: string | null;
  about?: string | null;
  personal_info?: PersonalInfo | null;
  bank_info?: BankInfo | null;
  family_info?: FamilyInfo | null;
  education?: EducationItem[] | null;
  experience?: ExperienceItem[] | null;
  projects?: ProjectItem[] | null;
  assets?: AssetItem[] | null;
};

const EmployeeDetails: React.FC = () => {
  const { id: idParam } = useParams();
  const queryId = new URLSearchParams(useLocation().search).get("id");
  const { user, role } = useAuth();
  const employeeId =
    idParam || queryId || (user?.employee_profile?.id ? String(user.employee_profile.id) : "");
  const navigate = useNavigate();
  const canEditEmployee = role !== "employee";

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [editSection, setEditSection] = useState<
    | "basic"
    | "personal"
    | "emergency"
    | "about"
    | "bank"
    | "family"
    | "education"
    | "experience"
    | "projects"
    | "assets"
    | null
  >(null);
  const [savingSection, setSavingSection] = useState(false);

  const [basicForm, setBasicForm] = useState<BasicForm>({});
  const [personalForm, setPersonalForm] = useState<PersonalForm>({});
  const [emergencyForm, setEmergencyForm] = useState<EmergencyForm>({});
  const [aboutForm, setAboutForm] = useState<string>("");
  const [bankForm, setBankForm] = useState<BankInfo>({});
  const [familyForm, setFamilyForm] = useState<FamilyInfo>({});
  const [educationForm, setEducationForm] = useState<EducationItem[]>([]);
  const [experienceForm, setExperienceForm] = useState<ExperienceItem[]>([]);
  const [projectsForm, setProjectsForm] = useState<ProjectItem[]>([]);
  const [assetsForm, setAssetsForm] = useState<AssetItem[]>([]);

  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const apiHost = useMemo(
    () => (API.defaults.baseURL || "").replace(/\/api\/?$/, ""),
    []
  );

  const loadEmployee = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`employees/${employeeId}/`);
      setEmployee(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setError("Employee not found.");
      } else if (status === 401) {
        setError("Unauthorized. Please login again.");
      } else {
        setError("Failed to load employee details.");
      }
      setEmployee(null);
      console.error("Error loading employee details:", err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadEmployeeList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await API.get("employees/");
      const data = normalizeList<Employee>(res.data);
      setEmployeeList(data);
      setSelectedId((prev) => prev || (data.length > 0 ? String(data[0].id) : ""));
    } catch (err) {
      console.error("Error loading employees:", err);
      setEmployeeList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEmployeeList();
  }, [loadEmployeeList]);

  useEffect(() => {
    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId, loadEmployee]);

  useEffect(() => {
    if (!employee) return;
    setBasicForm({
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      gender: employee.gender ?? "",
      date_of_birth: employee.date_of_birth ?? "",
      address: employee.address ?? "",
    });
    setPersonalForm({
      passport_no: employee.national_id ?? "",
      passport_expiry: employee.personal_info?.passport_expiry ?? "",
      nationality: employee.personal_info?.nationality ?? "",
      religion: employee.personal_info?.religion ?? "",
      marital_status: employee.marital_status ?? "",
      children_count:
        employee.personal_info?.children_count ?? employee.family_info?.children_count ?? "",
    });
    setEmergencyForm({
      primary_name: employee.emergency_contact_name ?? "",
      primary_phone: employee.emergency_contact_number ?? "",
      secondary_name: employee.family_info?.emergency_name ?? "",
      secondary_phone: employee.family_info?.emergency_phone ?? "",
    });
    setAboutForm(employee.about ?? "");
    setBankForm(employee.bank_info ?? {});
    setFamilyForm(employee.family_info ?? {});
    setEducationForm(Array.isArray(employee.education) ? employee.education : []);
    setExperienceForm(Array.isArray(employee.experience) ? employee.experience : []);
    setProjectsForm(Array.isArray(employee.projects) ? employee.projects : []);
    setAssetsForm(Array.isArray(employee.assets) ? employee.assets : []);
  }, [employee]);

  const handleDelete = async () => {
    if (!canEditEmployee) return;
    if (!employeeId) return;
    if (!window.confirm("Delete this employee?")) return;
    try {
      await API.delete(`employees/${employeeId}/`);
      navigate(all_routes.employeeList, { replace: true });
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed.");
    }
  };

  const goToEdit = () => {
    if (!canEditEmployee) return;
    if (!employeeId) return;
    navigate(`${all_routes.employeeAdd}?id=${employeeId}&returnTo=details`);
  };

  const sendMessage = () => {
    if (!employee?.email) return;
    window.location.href = `mailto:${employee.email}`;
  };

  const saveSection = async () => {
    if (!canEditEmployee) return;
    if (!employeeId || !editSection) return;
    setSavingSection(true);
    const payload: any = {};
    const normalize = (value?: string) => {
      if (value === undefined || value === null) return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    if (editSection === "basic") {
      if (basicForm.email && basicForm.email.trim()) {
        payload.email = basicForm.email.trim();
      }
      payload.phone = normalize(basicForm.phone);
      payload.gender = normalize(basicForm.gender);
      payload.date_of_birth =
        basicForm.date_of_birth && basicForm.date_of_birth.trim()
          ? basicForm.date_of_birth.trim()
          : null;
      payload.address = normalize(basicForm.address);
    }
    if (editSection === "personal") {
      payload.national_id = normalize(personalForm.passport_no);
      if (personalForm.marital_status && personalForm.marital_status.trim()) {
        payload.marital_status = personalForm.marital_status.trim();
      }
      payload.personal_info = {
        ...(employee?.personal_info ?? {}),
        passport_expiry: personalForm.passport_expiry ?? "",
        nationality: personalForm.nationality ?? "",
        religion: personalForm.religion ?? "",
        children_count: personalForm.children_count ?? "",
      };
      payload.family_info = {
        ...(employee?.family_info ?? {}),
        children_count:
          personalForm.children_count ??
          employee?.family_info?.children_count ??
          "",
      };
    }
    if (editSection === "emergency") {
      payload.emergency_contact_name = normalize(emergencyForm.primary_name);
      payload.emergency_contact_number = normalize(emergencyForm.primary_phone);
      payload.family_info = {
        ...(employee?.family_info ?? {}),
        emergency_name: emergencyForm.secondary_name ?? "",
        emergency_phone: emergencyForm.secondary_phone ?? "",
      };
    }
    if (editSection === "about") payload.about = aboutForm;
    if (editSection === "bank") payload.bank_info = bankForm;
    if (editSection === "family") {
      payload.family_info = {
        ...(employee?.family_info ?? {}),
        ...familyForm,
      };
      if (familyForm.children_count !== undefined) {
        payload.personal_info = {
          ...(employee?.personal_info ?? {}),
          children_count: familyForm.children_count ?? "",
        };
      }
    }
    if (editSection === "education") payload.education = educationForm;
    if (editSection === "experience") payload.experience = experienceForm;
    if (editSection === "projects") payload.projects = projectsForm;
    if (editSection === "assets") payload.assets = assetsForm;

    try {
      const res = await API.patch(`employees/${employeeId}/`, payload);
      setEmployee(res.data);
      setEditSection(null);
    } catch (err) {
      console.error("Failed to save section:", err);
      alert("Failed to save details.");
    } finally {
      setSavingSection(false);
    }
  };

  const sectionTitle = {
    basic: "Basic Information",
    personal: "Personal Information",
    emergency: "Emergency Contact",
    about: "About Employee",
    bank: "Bank Information",
    family: "Family Information",
    education: "Education Details",
    experience: "Experience",
    projects: "Projects",
    assets: "Assets",
  } as const;

  const closeModal = () => setEditSection(null);
  const sectionTitleText = editSection ? sectionTitle[editSection] : "";

  const photoUrl =
    employee?.photo
      ? employee.photo.startsWith("http")
        ? employee.photo
        : `${apiHost}${employee.photo}`
      : "/assets/images/avatar.png";

  const arrayOrEmpty = <T,>(value: T[] | null | undefined): T[] =>
    Array.isArray(value) ? value : [];

  const aboutText =
    employee?.about && employee.about.trim()
      ? employee.about
      : `${employee?.first_name ?? "Employee"} works as ${
          employee?.designation?.title ?? "an employee"
        } in the ${employee?.department?.name ?? "company"} department.`;

  const hasValues = (obj?: Record<string, any> | null) =>
    !!obj && Object.values(obj).some((v) => v !== null && v !== undefined && String(v).trim() !== "");

  const educationList = arrayOrEmpty(employee?.education);
  const experienceList = arrayOrEmpty(employee?.experience);
  const projectsList = arrayOrEmpty(employee?.projects);
  const assetsList = arrayOrEmpty(employee?.assets);
  const personalInfo: PersonalInfo = employee?.personal_info ?? {};
  const personalChildren =
    personalInfo.children_count ?? employee?.family_info?.children_count ?? "-";
  const secondaryEmergencyName = employee?.family_info?.emergency_name ?? "-";
  const secondaryEmergencyPhone = employee?.family_info?.emergency_phone ?? "-";
  const profileScore = employee ? profileCompletion(employee) : 0;
  const age = calculateAge(employee?.date_of_birth);
  const tenureLabel = calculateTenureLabel(employee?.joining_date);
  const reportingManager = employeeList.find(
    (item) => String(item.id) === String(employee?.reporting_to ?? "")
  );
  const projectTasks = projectsList.reduce(
    (sum, project) => sum + Number(project.tasks ?? 0),
    0
  );
  const projectCompleted = projectsList.reduce(
    (sum, project) => sum + Number(project.completed ?? 0),
    0
  );
  const projectCompletionRate =
    projectTasks > 0 ? Math.min(100, Math.round((projectCompleted / projectTasks) * 100)) : 0;
  const employeeTotals = employeeSummary(employeeList);
  const missingBlocks = [
    !employee?.phone && "Phone number",
    !employee?.address && "Address",
    !hasValues(employee?.bank_info) && "Bank details",
    educationList.length === 0 && "Education history",
    experienceList.length === 0 && "Experience history",
    !employee?.emergency_contact_number && "Primary emergency contact",
  ].filter(Boolean) as string[];

  const renderSummaryRows = (rows: Array<{ label: string; value: React.ReactNode }>) => (
    <div className="employee-summary-list">
      {rows.map((row) => (
        <div key={row.label} className="employee-summary-row">
          <span>{row.label}</span>
          <strong className="text-end">{row.value}</strong>
        </div>
      ))}
    </div>
  );

  if (!employeeId) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell employee-shell">
          <div className="card payroll-hero mb-4">
            <div className="card-body">
              <div className="row align-items-center g-4">
                <div className="col-lg-8 employee-hero-copy">
                  <span className="payroll-kicker">
                    <i className="ti ti-user-search" /> Employee Details Workspace
                  </span>
                  <h1 className="payroll-title">
                    {canEditEmployee ? "Employee Details" : "Your employee profile is not linked yet"}
                  </h1>
                  <p className="payroll-subtitle">
                    {canEditEmployee
                      ? "Pick any employee from the directory to review their profile, statutory details, projects, assets, and profile completion from one place."
                      : "This login needs to be linked to an employee record before your self-service profile can open here. HR or your super admin can do that in User Access."}
                  </p>
                  <div className="employee-chip-row">
                    {canEditEmployee ? (
                      <>
                        <span className="employee-chip">
                          <i className="ti ti-users" /> {employeeTotals.total} employees in directory
                        </span>
                        <span className="employee-chip">
                          <i className="ti ti-user-check" /> {employeeTotals.active} active profiles
                        </span>
                        <span className="employee-chip">
                          <i className="ti ti-sparkles" /> {employeeTotals.averageCompletion}% average completeness
                        </span>
                      </>
                    ) : (
                      <span className="employee-chip">
                        <i className="ti ti-shield-lock" /> Ask HR to link this login to your employee record
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="payroll-hero-actions">
                    {canEditEmployee ? (
                      <>
                        <Link to={all_routes.employeeList} className="btn btn-white">
                          <i className="ti ti-layout-list me-1" /> Browse Directory
                        </Link>
                        <Link to={all_routes.employeeAdd} className="btn btn-primary">
                          <i className="ti ti-user-plus me-1" /> Add Employee
                        </Link>
                      </>
                    ) : (
                      <Link to={all_routes.employeeDashboard} className="btn btn-primary">
                        <i className="ti ti-layout-dashboard me-1" /> Back to My Workspace
                      </Link>
                    )}
                    <div className="head-icons">
                      <CollapseHeader />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {canEditEmployee ? (
          <div className="card employee-section-card">
            <div className="card-body">
              <div className="row g-4 align-items-end">
                <div className="col-lg-8">
                  <h5 className="mb-1">Open an employee profile</h5>
                  <p className="payroll-table-subtitle mb-0">
                    Choose an employee to view and update profile sections without leaving
                    the workspace.
                  </p>
                </div>
                <div className="col-lg-4 text-lg-end">
                  <small className="text-muted">
                    Useful shortcut: details edits save per section, so you do not lose
                    progress across the page.
                  </small>
                </div>
                {loadingList ? (
                  <div className="col-12">
                    <div className="alert alert-light border mb-0">Loading employees...</div>
                  </div>
                ) : employeeList.length === 0 ? (
                  <div className="col-12">
                    <div className="alert alert-light border mb-0 d-flex flex-wrap justify-content-between align-items-center gap-3">
                      <span>
                        No employees found yet. Add a couple of profiles to start using the
                        details workspace.
                      </span>
                      <Link to={all_routes.employeeAdd} className="btn btn-primary">
                        Add Employee
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="col-md-8">
                      <label className="form-label">Employee</label>
                      <select
                        className="form-select"
                        value={selectedId}
                        onChange={(event) => setSelectedId(event.target.value)}
                      >
                        {employeeList.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {employeeFullName(item)} ({item.emp_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4 d-grid">
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          navigate(all_routes.employeeDetailsView.replace(":id", selectedId))
                        }
                        disabled={!selectedId}
                      >
                        View Details
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          ) : null}
        </div>
      </div>
    );
  }

  const quickOverviewRows = [
    { label: "Employee ID", value: employee?.emp_code ?? "-" },
    { label: "Department", value: employee?.department?.name ?? "-" },
    { label: "Designation", value: employee?.designation?.title ?? "-" },
    { label: "Employment", value: employee?.employment_type ?? "-" },
    {
      label: "Reporting To",
      value: reportingManager ? employeeFullName(reportingManager) : "-",
    },
    { label: "Work Shift", value: employee?.work_shift ?? "-" },
    { label: "Work Location", value: employee?.work_location ?? "-" },
    { label: "Status", value: employee?.is_active ? "Active" : "Inactive" },
  ];

  const basicInfoRows = [
    { label: "Phone", value: employee?.phone ?? "-" },
    { label: "Email", value: employee?.email ?? "-" },
    { label: "Gender", value: employee?.gender ?? "-" },
    { label: "Birthday", value: formatDisplayDate(employee?.date_of_birth) },
    { label: "Address", value: employee?.address ?? "-" },
  ];

  const personalRows = [
    { label: "Passport No", value: employee?.national_id ?? "-" },
    { label: "Passport Expiry", value: formatDisplayDate(personalInfo.passport_expiry) },
    { label: "Nationality", value: personalInfo.nationality ?? "-" },
    { label: "Religion", value: personalInfo.religion ?? "-" },
    { label: "Marital Status", value: employee?.marital_status ?? "-" },
    { label: "No. of children", value: personalChildren },
  ];

  const emergencyRows = [
    { label: "Primary Contact", value: employee?.emergency_contact_name ?? "-" },
    { label: "Primary Phone", value: employee?.emergency_contact_number ?? "-" },
    { label: "Secondary Contact", value: secondaryEmergencyName },
    { label: "Secondary Phone", value: secondaryEmergencyPhone },
  ];

  const bankRows = [
    { label: "Bank", value: employee?.bank_info?.bank_name ?? "-" },
    { label: "Account", value: employee?.bank_info?.account_number ?? "-" },
    { label: "IFSC", value: employee?.bank_info?.ifsc ?? "-" },
    { label: "Branch", value: employee?.bank_info?.branch ?? "-" },
    { label: "PAN", value: employee?.bank_info?.pan ?? "-" },
    { label: "PF Number", value: employee?.bank_info?.pf_number ?? "-" },
  ];

  const familyRows = [
    { label: "Spouse", value: employee?.family_info?.spouse_name ?? "-" },
    {
      label: "Spouse Employment",
      value: employee?.family_info?.spouse_employment ?? "-",
    },
    {
      label: "Children",
      value: employee?.family_info?.children_count ?? personalChildren,
    },
    { label: "Emergency Name", value: employee?.family_info?.emergency_name ?? "-" },
    { label: "Emergency Phone", value: employee?.family_info?.emergency_phone ?? "-" },
  ];

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker">
                  <i className="ti ti-user-circle" /> Employee Workspace
                </span>
                <h1 className="payroll-title">Employee Details</h1>
                <p className="payroll-subtitle">
                  Review profile completeness, statutory data, projects, assets, and direct
                  section edits from one advanced employee workspace.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip">
                    <i className="ti ti-id" /> {employee?.emp_code ?? "Employee"}
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-building-community" />{" "}
                    {employee?.department?.name ?? "No department"}
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-briefcase" />{" "}
                    {employee?.designation?.title ?? "No designation"}
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-chart-donut" /> {profileScore}% profile complete
                  </span>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="payroll-hero-actions">
                  {canEditEmployee ? (
                    <button
                      className="btn btn-white"
                      type="button"
                      onClick={() => navigate(all_routes.employeeList)}
                    >
                      <i className="ti ti-arrow-left me-1" /> Back to Directory
                    </button>
                  ) : null}
                  {canEditEmployee ? (
                    <button className="btn btn-primary" type="button" onClick={goToEdit}>
                      <i className="ti ti-edit me-1" /> Edit Employee
                    </button>
                  ) : null}
                  {canEditEmployee ? (
                    <button className="btn btn-outline-danger" type="button" onClick={handleDelete}>
                      <i className="ti ti-trash me-1" /> Delete
                    </button>
                  ) : null}
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card employee-section-card">
            <div className="card-body text-center py-5">
              <h5 className="mb-1">Loading employee profile...</h5>
              <p className="payroll-table-subtitle mb-0">
                We are pulling the latest details now.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="card employee-section-card">
            <div className="card-body text-center py-5">
              <h5 className="mb-2">{error}</h5>
              <Link to={all_routes.employeeList} className="btn btn-primary">
                Go Back
              </Link>
            </div>
          </div>
        ) : !employee ? (
          <div className="card employee-section-card">
            <div className="card-body text-center py-5">
              <h5 className="mb-1">No employee data</h5>
              <p className="payroll-table-subtitle mb-0">
                The selected employee could not be loaded.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="card employee-detail-banner mb-4">
              <div className="card-body">
                <div className="row g-4 align-items-center">
                  <div className="col-lg-8">
                    <div className="d-flex flex-wrap align-items-center gap-4">
                      <img
                        src={photoUrl}
                        alt={employee.first_name}
                        className="employee-detail-avatar"
                      />
                      <div>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                          <h2 className="mb-0">{employeeFullName(employee)}</h2>
                          <span className="employee-badge-soft">
                            <i className="ti ti-circle-filled" />
                            {employee.is_active ? "Active profile" : "Inactive profile"}
                          </span>
                        </div>
                        <p className="payroll-subtitle mb-0">{aboutText}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4 text-lg-end">
                    <div className="d-flex flex-wrap justify-content-lg-end gap-2">
                      {canEditEmployee ? (
                        <button
                          className="btn btn-outline-primary"
                          type="button"
                          onClick={() => setEditSection("bank")}
                        >
                          <i className="ti ti-building-bank me-1" /> Bank & Statutory
                        </button>
                      ) : null}
                      {canEditEmployee ? (
                        <Link className="btn btn-outline-secondary" to={`${all_routes.recruitmentInterviews}?employee=${employee.id}`}>
                          <i className="ti ti-messages me-1" /> Interview Trail
                        </Link>
                      ) : null}
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={sendMessage}
                      >
                        <i className="ti ti-mail me-1" /> Message
                      </button>
                    </div>
                  </div>
                </div>

                <div className="employee-detail-stats">
                  <div className="employee-detail-stat">
                    <small>Profile Completion</small>
                    <strong>{profileScore}%</strong>
                  </div>
                  <div className="employee-detail-stat">
                    <small>Current Salary</small>
                    <strong>{formatMoney(employee.salary)}</strong>
                  </div>
                  <div className="employee-detail-stat">
                    <small>Time With Company</small>
                    <strong>{tenureLabel}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="payroll-stat-grid mb-4">
              <div className="payroll-stat-card">
                <div className="card-body">
                  <span className="payroll-stat-label">Projects</span>
                  <h3 className="payroll-stat-value">{projectsList.length}</h3>
                  <div className="payroll-stat-meta">
                    {projectCompleted} of {projectTasks} tasks completed
                  </div>
                </div>
              </div>
              <div className="payroll-stat-card">
                <div className="card-body">
                  <span className="payroll-stat-label">Assigned Assets</span>
                  <h3 className="payroll-stat-value">{assetsList.length}</h3>
                  <div className="payroll-stat-meta">
                    Track hardware and access ownership here
                  </div>
                </div>
              </div>
              <div className="payroll-stat-card">
                <div className="card-body">
                  <span className="payroll-stat-label">Age</span>
                  <h3 className="payroll-stat-value">{age ? `${age} yrs` : "-"}</h3>
                  <div className="payroll-stat-meta">
                    Joined {formatDisplayDate(employee.joining_date)}
                  </div>
                </div>
              </div>
              <div className="payroll-stat-card">
                <div className="card-body">
                  <span className="payroll-stat-label">Profile Gaps</span>
                  <h3 className="payroll-stat-value">{missingBlocks.length}</h3>
                  <div className="payroll-stat-meta">
                    Fill gaps to improve operational readiness
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-4">
            {/* Left Column */}
            <div className="col-xl-4 d-grid gap-4">
              <div className="card employee-summary-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <h5 className="mb-1">Directory Snapshot</h5>
                      <p className="payroll-table-subtitle mb-0">
                        Quick view of this profile inside the wider employee directory.
                      </p>
                    </div>
                    {canEditEmployee ? (
                      <button className="btn btn-sm btn-light" type="button" onClick={goToEdit}>
                        <i className="ti ti-edit" />
                      </button>
                    ) : null}
                  </div>
                  {renderSummaryRows(quickOverviewRows)}
                  <div className="finance-metric-stack mt-4">
                    <div className="d-flex justify-content-between align-items-center gap-3">
                      <span className="payroll-secondary-text">Project completion</span>
                      <strong>{projectCompletionRate}%</strong>
                    </div>
                    <div className="finance-progress-track">
                      <div
                        className={`finance-progress-bar ${
                          projectCompletionRate >= 80
                            ? "success"
                            : projectCompletionRate >= 45
                            ? "warning"
                            : "danger"
                        }`}
                        style={{ width: `${Math.max(projectCompletionRate, 6)}%` }}
                      />
                    </div>
                  </div>
                  {missingBlocks.length > 0 ? (
                    <div className="finance-note-card mt-4">
                      <i className="ti ti-alert-triangle" />
                      <span>Still missing: {missingBlocks.join(", ")}.</span>
                    </div>
                  ) : (
                    <div className="finance-note-card mt-4">
                      <i className="ti ti-rosette-discount-check" />
                      <span>
                        This employee profile is nicely filled out and ready for operations.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card employee-section-card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">Basic Information</h6>
                    <p className="payroll-table-subtitle mb-0">
                      Primary contact and address information
                    </p>
                  </div>
                  {canEditEmployee ? (
                    <button className="btn btn-sm btn-light" type="button" onClick={() => setEditSection("basic")}>
                      <i className="ti ti-edit" />
                    </button>
                  ) : null}
                </div>
                <div className="card-body">{renderSummaryRows(basicInfoRows)}</div>
              </div>

              <div className="card employee-section-card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">Personal Information</h6>
                    <p className="payroll-table-subtitle mb-0">Identity and household context</p>
                  </div>
                  {canEditEmployee ? (
                    <button className="btn btn-sm btn-light" type="button" onClick={() => setEditSection("personal")}>
                      <i className="ti ti-edit" />
                    </button>
                  ) : null}
                </div>
                <div className="card-body">{renderSummaryRows(personalRows)}</div>
              </div>

              <div className="card employee-section-card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">Emergency Contacts</h6>
                    <p className="payroll-table-subtitle mb-0">
                      Escalation contacts for urgent situations
                    </p>
                  </div>
                  {canEditEmployee ? (
                    <button className="btn btn-sm btn-light" type="button" onClick={() => setEditSection("emergency")}>
                      <i className="ti ti-edit" />
                    </button>
                  ) : null}
                </div>
                <div className="card-body">{renderSummaryRows(emergencyRows)}</div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col-xl-8 d-grid gap-4">
              <div className="card employee-section-card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">About Employee</h6>
                    <p className="payroll-table-subtitle mb-0">
                      Narrative summary and current focus area
                    </p>
                  </div>
                  {canEditEmployee ? (
                    <button className="btn btn-sm btn-light" onClick={() => setEditSection("about")}>
                      <i className="ti ti-edit" />
                    </button>
                  ) : null}
                </div>
                <div className="card-body">
                  <p className="mb-3">{aboutText}</p>
                  <div className="employee-chip-row">
                    <span className="employee-chip">
                      <i className="ti ti-user-star" />{" "}
                      {reportingManager ? employeeFullName(reportingManager) : "No manager assigned"}
                    </span>
                    <span className="employee-chip">
                      <i className="ti ti-map-pin" />{" "}
                      {employee.work_location || "Location not set"}
                    </span>
                    <span className="employee-chip">
                      <i className="ti ti-briefcase" /> {employee.role || "Role not set"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="card employee-section-card h-100">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">Bank Information</h6>
                        <p className="payroll-table-subtitle mb-0">
                          Payroll and statutory details
                        </p>
                      </div>
                      {canEditEmployee ? (
                        <button className="btn btn-sm btn-light" onClick={() => setEditSection("bank")}>
                          <i className="ti ti-edit" />
                        </button>
                      ) : null}
                    </div>
                    <div className="card-body">
                      {!hasValues(employee?.bank_info) ? (
                        <p className="text-muted mb-0">No bank information added.</p>
                      ) : (
                        renderSummaryRows(bankRows)
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card employee-section-card h-100">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">Family Information</h6>
                        <p className="payroll-table-subtitle mb-0">
                          Household context and backup emergency data
                        </p>
                      </div>
                      {canEditEmployee ? (
                        <button className="btn btn-sm btn-light" onClick={() => setEditSection("family")}>
                          <i className="ti ti-edit" />
                        </button>
                      ) : null}
                    </div>
                    <div className="card-body">
                      {!hasValues(employee?.family_info) ? (
                        <p className="text-muted mb-0">No family information added.</p>
                      ) : (
                        renderSummaryRows(familyRows)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="card employee-section-card h-100">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">Education Details</h6>
                        <p className="payroll-table-subtitle mb-0">
                          Academic background and qualifications
                        </p>
                      </div>
                      {canEditEmployee ? (
                        <button className="btn btn-sm btn-light" onClick={() => setEditSection("education")}>
                          <i className="ti ti-edit" />
                        </button>
                      ) : null}
                    </div>
                    <div className="card-body">

{educationList.length === 0 ? (
  <p className="text-muted mb-0">No education details added.</p>
) : (
  <div className="d-grid gap-3">
    {educationList.map((item, index) => (
      <div
        key={`${item.degree || "education"}-${index}`}
        className="border rounded-4 p-3"
      >
        <div className="fw-semibold mb-1">{item.degree ?? "-"}</div>
        <div className="text-muted">{item.institute ?? "-"}</div>
        <small className="text-muted">Graduated {item.year ?? "-"}</small>
      </div>
    ))}
  </div>
)}                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card employee-section-card h-100">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">Experience</h6>
                        <p className="payroll-table-subtitle mb-0">
                          Previous companies and roles
                        </p>
                      </div>
                      {canEditEmployee ? (
                        <button className="btn btn-sm btn-light" onClick={() => setEditSection("experience")}>
                          <i className="ti ti-edit" />
                        </button>
                      ) : null}
                    </div>
                    <div className="card-body">

{experienceList.length === 0 ? (
  <p className="text-muted mb-0">No experience details added.</p>
) : (
  <div className="d-grid gap-3">
    {experienceList.map((item, index) => (
      <div
        key={`${item.company || "experience"}-${index}`}
        className="border rounded-4 p-3"
      >
        <div className="fw-semibold mb-1">{item.role ?? "-"}</div>
        <div className="text-muted">{item.company ?? "-"}</div>
        <small className="text-muted">
          {item.from ?? "-"} to {item.to ?? "-"}
        </small>
      </div>
    ))}
  </div>
)}                    </div>
                  </div>
                </div>
              </div>

              <div className="card employee-section-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <ul className="nav nav-tabs" role="tablist">
                      <li className="nav-item" role="presentation">
                        <button className="nav-link active" data-bs-toggle="tab" data-bs-target="#projects" type="button" role="tab">
                          Projects ({projectsList.length})
                        </button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button className="nav-link" data-bs-toggle="tab" data-bs-target="#assets" type="button" role="tab">
                          Assets ({assetsList.length})
                        </button>
                      </li>
                    </ul>
                    <div className="d-flex gap-2">
                      {canEditEmployee ? (
                        <button className="btn btn-sm btn-light" onClick={() => setEditSection("projects")}>
                          <i className="ti ti-edit" /> Projects
                        </button>
                      ) : null}
                      {canEditEmployee ? (
                        <button className="btn btn-sm btn-light" onClick={() => setEditSection("assets")}>
                          <i className="ti ti-edit" /> Assets
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="tab-content">
                    <div className="tab-pane fade show active" id="projects" role="tabpanel">

{projectsList.length === 0 ? (
  <p className="text-muted mb-0">No projects assigned.</p>
) : (
  <div className="row g-3">
    {projectsList.map((item, index) => {
      const tasks = Number(item.tasks ?? 0);
      const completed = Number(item.completed ?? 0);
      const progress =
        tasks > 0 ? Math.min(100, Math.round((completed / tasks) * 100)) : 0;

      return (
        <div key={`${item.name || "project"}-${index}`} className="col-md-6">
          <div className="border rounded-4 p-3 h-100">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h6 className="mb-1">{item.name ?? "-"}</h6>
                <small className="text-muted">
                  {completed} completed of {tasks} tasks
                </small>
              </div>
              <span className="employee-badge-soft">{progress}%</span>
            </div>
            <div className="finance-progress-track mb-3">
              <div
                className={`finance-progress-bar ${
                  progress >= 80 ? "success" : progress >= 45 ? "warning" : "danger"
                }`}
                style={{ width: `${Math.max(progress, 6)}%` }}
              />
            </div>
            <div className="employee-summary-list">
              <div className="employee-summary-row">
                <span>Deadline</span>
                <strong>{formatDisplayDate(item.deadline)}</strong>
              </div>
              <div className="employee-summary-row">
                <span>Project Lead</span>
                <strong>{item.lead ?? "-"}</strong>
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </div>
)}                    </div>
                    <div className="tab-pane fade" id="assets" role="tabpanel">

{assetsList.length === 0 ? (
  <p className="text-muted mb-0">No assets assigned.</p>
) : (
  <div className="d-grid gap-3">
    {assetsList.map((item, index) => (
      <div
        key={`${item.name || "asset"}-${index}`}
        className="border rounded-4 p-3 d-flex flex-wrap justify-content-between align-items-center gap-3"
      >
        <div>
          <div className="fw-semibold">{item.name ?? "-"}</div>
          <small className="text-muted">
            Assigned {formatDisplayDate(item.assigned_on)}
          </small>
        </div>
        <span className="employee-badge-soft">
          {item.status ?? "Status not set"}
        </span>
      </div>
    ))}
  </div>
)}                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {editSection && (
          <>
            <div className="modal show d-block payroll-modal" tabIndex={-1}>
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Edit {sectionTitleText}</h5>
                    <button type="button" className="btn-close" onClick={closeModal} />
                  </div>

                  <div className="modal-body">
                    {editSection === "basic" && (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Phone</label>
                          <input
                            className="form-control"
                            value={basicForm.phone ?? ""}
                            onChange={(e) =>
                              setBasicForm({ ...basicForm, phone: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={basicForm.email ?? ""}
                            onChange={(e) =>
                              setBasicForm({ ...basicForm, email: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Gender</label>
                          <input
                            className="form-control"
                            value={basicForm.gender ?? ""}
                            onChange={(e) =>
                              setBasicForm({ ...basicForm, gender: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Birthday</label>
                          <input
                            type="date"
                            className="form-control"
                            value={basicForm.date_of_birth ?? ""}
                            onChange={(e) =>
                              setBasicForm({
                                ...basicForm,
                                date_of_birth: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-12">
                          <label className="form-label">Address</label>
                          <textarea
                            className="form-control"
                            rows={3}
                            value={basicForm.address ?? ""}
                            onChange={(e) =>
                              setBasicForm({ ...basicForm, address: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {editSection === "personal" && (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Passport No</label>
                          <input
                            className="form-control"
                            value={personalForm.passport_no ?? ""}
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                passport_no: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Passport Exp Date</label>
                          <input
                            type="date"
                            className="form-control"
                            value={personalForm.passport_expiry ?? ""}
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                passport_expiry: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Nationality</label>
                          <input
                            className="form-control"
                            value={personalForm.nationality ?? ""}
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                nationality: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Religion</label>
                          <input
                            className="form-control"
                            value={personalForm.religion ?? ""}
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                religion: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Marital Status</label>
                          <select
                            className="form-select"
                            value={personalForm.marital_status ?? ""}
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                marital_status: e.target.value,
                              })
                            }
                          >
                            <option value="">Select</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">No. of children</label>
                          <input
                            type="number"
                            className="form-control"
                            value={personalForm.children_count ?? ""}
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                children_count: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {editSection === "emergency" && (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Primary Name</label>
                          <input
                            className="form-control"
                            value={emergencyForm.primary_name ?? ""}
                            onChange={(e) =>
                              setEmergencyForm({
                                ...emergencyForm,
                                primary_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Primary Phone</label>
                          <input
                            className="form-control"
                            value={emergencyForm.primary_phone ?? ""}
                            onChange={(e) =>
                              setEmergencyForm({
                                ...emergencyForm,
                                primary_phone: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Secondary Name</label>
                          <input
                            className="form-control"
                            value={emergencyForm.secondary_name ?? ""}
                            onChange={(e) =>
                              setEmergencyForm({
                                ...emergencyForm,
                                secondary_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Secondary Phone</label>
                          <input
                            className="form-control"
                            value={emergencyForm.secondary_phone ?? ""}
                            onChange={(e) =>
                              setEmergencyForm({
                                ...emergencyForm,
                                secondary_phone: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {editSection === "about" && (
                      <div>
                        <label className="form-label">About</label>
                        <textarea
                          className="form-control"
                          rows={5}
                          value={aboutForm}
                          onChange={(e) => setAboutForm(e.target.value)}
                        />
                      </div>
                    )}

                    {editSection === "bank" && (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Bank Name</label>
                          <input
                            className="form-control"
                            value={bankForm.bank_name ?? ""}
                            onChange={(e) =>
                              setBankForm({ ...bankForm, bank_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Account Number</label>
                          <input
                            className="form-control"
                            value={bankForm.account_number ?? ""}
                            onChange={(e) =>
                              setBankForm({ ...bankForm, account_number: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">IFSC</label>
                          <input
                            className="form-control"
                            value={bankForm.ifsc ?? ""}
                            onChange={(e) =>
                              setBankForm({ ...bankForm, ifsc: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Branch</label>
                          <input
                            className="form-control"
                            value={bankForm.branch ?? ""}
                            onChange={(e) =>
                              setBankForm({ ...bankForm, branch: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">PAN</label>
                          <input
                            className="form-control"
                            value={bankForm.pan ?? ""}
                            onChange={(e) =>
                              setBankForm({ ...bankForm, pan: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">PF Number</label>
                          <input
                            className="form-control"
                            value={bankForm.pf_number ?? ""}
                            onChange={(e) =>
                              setBankForm({ ...bankForm, pf_number: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {editSection === "family" && (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Spouse Name</label>
                          <input
                            className="form-control"
                            value={familyForm.spouse_name ?? ""}
                            onChange={(e) =>
                              setFamilyForm({ ...familyForm, spouse_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Spouse Employment</label>
                          <input
                            className="form-control"
                            value={familyForm.spouse_employment ?? ""}
                            onChange={(e) =>
                              setFamilyForm({ ...familyForm, spouse_employment: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Children Count</label>
                          <input
                            className="form-control"
                            value={familyForm.children_count ?? ""}
                            onChange={(e) =>
                              setFamilyForm({ ...familyForm, children_count: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Emergency Name</label>
                          <input
                            className="form-control"
                            value={familyForm.emergency_name ?? ""}
                            onChange={(e) =>
                              setFamilyForm({ ...familyForm, emergency_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Emergency Phone</label>
                          <input
                            className="form-control"
                            value={familyForm.emergency_phone ?? ""}
                            onChange={(e) =>
                              setFamilyForm({ ...familyForm, emergency_phone: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {editSection === "education" && (
                      <div>
                        {educationForm.map((ed, idx) => (
                          <div className="row g-2 mb-2" key={idx}>
                            <div className="col-md-4">
                              <input
                                className="form-control"
                                placeholder="Degree"
                                value={ed.degree ?? ""}
                                onChange={(e) => {
                                  const next = [...educationForm];
                                  next[idx] = { ...next[idx], degree: e.target.value };
                                  setEducationForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-4">
                              <input
                                className="form-control"
                                placeholder="Institute"
                                value={ed.institute ?? ""}
                                onChange={(e) => {
                                  const next = [...educationForm];
                                  next[idx] = { ...next[idx], institute: e.target.value };
                                  setEducationForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="Year"
                                value={ed.year ?? ""}
                                onChange={(e) => {
                                  const next = [...educationForm];
                                  next[idx] = { ...next[idx], year: e.target.value };
                                  setEducationForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2 d-grid">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() =>
                                  setEducationForm(educationForm.filter((_, i) => i !== idx))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setEducationForm([...educationForm, {}])}
                        >
                          Add Education
                        </button>
                      </div>
                    )}

                    {editSection === "experience" && (
                      <div>
                        {experienceForm.map((ex, idx) => (
                          <div className="row g-2 mb-2" key={idx}>
                            <div className="col-md-4">
                              <input
                                className="form-control"
                                placeholder="Company"
                                value={ex.company ?? ""}
                                onChange={(e) => {
                                  const next = [...experienceForm];
                                  next[idx] = { ...next[idx], company: e.target.value };
                                  setExperienceForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="Role"
                                value={ex.role ?? ""}
                                onChange={(e) => {
                                  const next = [...experienceForm];
                                  next[idx] = { ...next[idx], role: e.target.value };
                                  setExperienceForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="From"
                                value={ex.from ?? ""}
                                onChange={(e) => {
                                  const next = [...experienceForm];
                                  next[idx] = { ...next[idx], from: e.target.value };
                                  setExperienceForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="To"
                                value={ex.to ?? ""}
                                onChange={(e) => {
                                  const next = [...experienceForm];
                                  next[idx] = { ...next[idx], to: e.target.value };
                                  setExperienceForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-1 d-grid">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() =>
                                  setExperienceForm(experienceForm.filter((_, i) => i !== idx))
                                }
                              >
                                x
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setExperienceForm([...experienceForm, {}])}
                        >
                          Add Experience
                        </button>
                      </div>
                    )}

                    {editSection === "projects" && (
                      <div>
                        {projectsForm.map((p, idx) => (
                          <div className="row g-2 mb-2" key={idx}>
                            <div className="col-md-4">
                              <input
                                className="form-control"
                                placeholder="Project Name"
                                value={p.name ?? ""}
                                onChange={(e) => {
                                  const next = [...projectsForm];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setProjectsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="Tasks"
                                value={p.tasks ?? ""}
                                onChange={(e) => {
                                  const next = [...projectsForm];
                                  next[idx] = { ...next[idx], tasks: e.target.value };
                                  setProjectsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="Completed"
                                value={p.completed ?? ""}
                                onChange={(e) => {
                                  const next = [...projectsForm];
                                  next[idx] = { ...next[idx], completed: e.target.value };
                                  setProjectsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="Deadline"
                                value={p.deadline ?? ""}
                                onChange={(e) => {
                                  const next = [...projectsForm];
                                  next[idx] = { ...next[idx], deadline: e.target.value };
                                  setProjectsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2">
                              <input
                                className="form-control"
                                placeholder="Lead"
                                value={p.lead ?? ""}
                                onChange={(e) => {
                                  const next = [...projectsForm];
                                  next[idx] = { ...next[idx], lead: e.target.value };
                                  setProjectsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-12 d-flex justify-content-end">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() =>
                                  setProjectsForm(projectsForm.filter((_, i) => i !== idx))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setProjectsForm([...projectsForm, {}])}
                        >
                          Add Project
                        </button>
                      </div>
                    )}

                    {editSection === "assets" && (
                      <div>
                        {assetsForm.map((a, idx) => (
                          <div className="row g-2 mb-2" key={idx}>
                            <div className="col-md-4">
                              <input
                                className="form-control"
                                placeholder="Asset Name"
                                value={a.name ?? ""}
                                onChange={(e) => {
                                  const next = [...assetsForm];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setAssetsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="Status"
                                value={a.status ?? ""}
                                onChange={(e) => {
                                  const next = [...assetsForm];
                                  next[idx] = { ...next[idx], status: e.target.value };
                                  setAssetsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                className="form-control"
                                placeholder="Assigned On"
                                value={a.assigned_on ?? ""}
                                onChange={(e) => {
                                  const next = [...assetsForm];
                                  next[idx] = { ...next[idx], assigned_on: e.target.value };
                                  setAssetsForm(next);
                                }}
                              />
                            </div>
                            <div className="col-md-2 d-grid">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() =>
                                  setAssetsForm(assetsForm.filter((_, i) => i !== idx))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setAssetsForm([...assetsForm, {}])}
                        >
                          Add Asset
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={closeModal}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={saveSection}
                      disabled={savingSection}
                    >
                      {savingSection ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-backdrop show"></div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetails;

