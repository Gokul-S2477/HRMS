import React from "react";
import API from "../../api/axios";
import {
  employeeAvatarSrc,
  employeeFullName,
  normalizeList,
} from "../mainMenu/employeeDashboard/employeeShared";

export const normalizeResourceRecords = (data) => normalizeList(data);

export const toNumber = (value) => {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

export const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTimeLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const calculateHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = String(checkIn).split(":").map((part) => Number(part));
  const [outHour, outMinute] = String(checkOut).split(":").map((part) => Number(part));
  if (![inHour, inMinute, outHour, outMinute].every(Number.isFinite)) return 0;
  const start = inHour * 60 + inMinute;
  const end = outHour * 60 + outMinute;
  if (end <= start) return 0;
  return Math.round(((end - start) / 60) * 10) / 10;
};

export const daysUntil = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export const dayDifference = (fromValue, toValue) => {
  if (!fromValue || !toValue) return null;
  const from = new Date(fromValue);
  const to = new Date(toValue);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

const flattenSearchValues = (input) => {
  if (input === null || input === undefined) return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenSearchValues(item));
  }
  if (typeof input === "object") {
    return Object.values(input).flatMap((value) => flattenSearchValues(value));
  }
  return [String(input)];
};

export const smartSearchMatch = (input, query, extras = []) => {
  const normalizedQuery = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (normalizedQuery.length === 0) return true;
  const haystack = [...flattenSearchValues(input), ...flattenSearchValues(extras)]
    .join(" ")
    .toLowerCase();
  return normalizedQuery.every((token) => haystack.includes(token));
};

export const isDateInRange = (value, start, end) => {
  if (!start && !end) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (start) {
    const startDate = new Date(start);
    if (!Number.isNaN(startDate.getTime()) && date < startDate) return false;
  }
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      if (date > endDate) return false;
    }
  }
  return true;
};

export const matchesAnyDateRange = (values, start, end) => {
  if (!start && !end) return true;
  return flattenSearchValues(values).some((value) => isDateInRange(value, start, end));
};

export const activeFilterCount = (filters) =>
  Object.values(filters || {}).filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).length;

export const toneClass = (tone) => {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "info":
      return "info";
    case "accent":
    default:
      return "accent";
  }
};

export const statusTone = (status) => {
  const key = String(status ?? "").toLowerCase();
  if (["active", "present", "approved", "completed", "closed", "filed"].includes(key)) {
    return "success";
  }
  if (["pending", "on hold", "draft", "scheduled"].includes(key)) {
    return "warning";
  }
  if (["inactive", "absent", "late", "rejected", "terminated", "overdue"].includes(key)) {
    return "danger";
  }
  if (["review", "reopened", "in progress"].includes(key)) {
    return "info";
  }
  return "accent";
};

export const initialEmployeePayload = (employee) => ({
  employee_id: employee?.id ? String(employee.id) : "",
  employee_name: employee?.name || "",
  department: employee?.department || "",
  designation: employee?.designation || "",
  email: employee?.email || "",
  phone: employee?.phone || "",
});

export const fetchEmployeeDirectory = async () => {
  const response = await API.get("/employees/");
  return normalizeList(response.data).map((employee) => ({
    id: employee.id,
    name: employeeFullName(employee),
    email: employee.email || "",
    phone: employee.phone || "",
    empCode: employee.emp_code || `EMP-${employee.id}`,
    department: employee.department?.name || "",
    designation: employee.designation?.title || "",
    joiningDate: employee.joining_date || "",
    avatar: employeeAvatarSrc(employee),
  }));
};

export const selectEmployee = (employees, id) =>
  employees.find((employee) => String(employee.id) === String(id)) || null;

export const HrmHero = (props) => {
  const { kicker, title, subtitle, action, stats, children } = props;
  return (
    <div className="card payroll-hero mb-4">
      <div className="card-body">
        <div className="row g-4 align-items-start">
          <div className="col-lg-8">
            {kicker ? <div className="payroll-kicker">{kicker}</div> : null}
            <h1 className="payroll-title">{title}</h1>
            <p className="payroll-subtitle">{subtitle}</p>
            {children ? <div className="employee-chip-row">{children}</div> : null}
          </div>
          <div className="col-lg-4">
            <div className="payroll-hero-actions justify-content-lg-end justify-content-start">
              {action}
            </div>
          </div>
        </div>
        {stats?.length ? (
          <div className="payroll-stat-grid">
            {stats.map((stat) => (
              <div className="card payroll-stat-card" key={stat.label}>
                <div className="card-body">
                  <span className="payroll-stat-label">{stat.label}</span>
                  <h3 className="payroll-stat-value">{stat.value}</h3>
                  {stat.meta ? <div className="payroll-stat-meta">{stat.meta}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const HrmEmptyState = ({ icon = "ti ti-folder-open", title, description }) => (
  <div className="payroll-empty">
    <i className={icon} />
    <h5 className="mb-2">{title}</h5>
    <p className="mb-0">{description}</p>
  </div>
);

export const HrmSideList = ({ title, items, emptyLabel = "No highlights yet." }) => (
  <div className="card payroll-section-card h-100">
    <div className="card-body">
      <div className="payroll-section-header">
        <h5 className="payroll-section-title">{title}</h5>
      </div>
      {items?.length ? (
        <div className="payroll-summary-list">
          {items.map((item) => (
            <div className="payroll-summary-row" key={item.label}>
              <div>
                <div className="payroll-primary-text">{item.label}</div>
                {item.meta ? <div className="payroll-secondary-text">{item.meta}</div> : null}
              </div>
              {item.value ? (
                <span className={`payroll-badge ${toneClass(item.tone)}`}>{item.value}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted mb-0">{emptyLabel}</p>
      )}
    </div>
  </div>
);

export const HrmModal = ({
  open,
  title,
  subtitle,
  summary,
  onClose,
  onSubmit,
  submitLabel,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="modal show d-block payroll-modal" tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <form onSubmit={onSubmit}>
            <div className="modal-header">
              <div>
                <h4 className="modal-title mb-1">{title}</h4>
                {subtitle ? <p className="text-muted mb-0">{subtitle}</p> : null}
              </div>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="payroll-modal-grid">
                <div>{children}</div>
                <div>
                  <div className="card payroll-section-card payroll-summary-card">
                    <div className="card-body">
                      <div className="payroll-section-header">
                        <h5 className="payroll-section-title">Quick Summary</h5>
                      </div>
                      {summary}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
