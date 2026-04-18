import React from "react";
import { all_routes as routes } from "../router/all_routes";
import {
  formatCurrency,
  formatDisplayDate,
  statusTone,
  toneClass,
  toNumber,
} from "../hrm/hrmShared";

const badge = (value) => (
  <span className={`payroll-badge ${toneClass(statusTone(value))}`}>{value || "Draft"}</span>
);

const primaryWithMeta = (title, meta) => (
  <div>
    <div className="payroll-primary-text">{title || "-"}</div>
    {meta ? <div className="payroll-secondary-text">{meta}</div> : null}
  </div>
);

const dateCell = (value, meta) => (
  <div>
    <div className="payroll-primary-text">{formatDisplayDate(value)}</div>
    {meta ? <div className="payroll-secondary-text">{meta}</div> : null}
  </div>
);

export const CRM_ENTITY_CONFIGS = {
  contact: {
    singular: "Contact",
    plural: "Contacts",
    kicker: "Relationship Hub",
    subtitle:
      "A cleaner contact workspace with ownership, follow-up visibility, lead scores, and company context.",
    resource: "/data/crm-contacts/",
    listRoute: routes.contactList,
    gridRoute: routes.contactGrid,
    detailsRoute: routes.contactDetails,
    buttonLabel: "Add Contact",
    emptyIcon: "ti ti-users",
    emptyTitle: "No contacts added",
    emptyDescription: "Create contacts to centralize follow-ups, ownership, and relationship history.",
    statusOptions: ["New", "Active", "Nurturing", "Dormant"],
    ownerField: "owner",
    dateFields: ["next_follow_up", "last_contact_date"],
    searchPlaceholder: "Search contact, company, owner, tags",
    filterField: {
      name: "source",
      label: "All sources",
      options: ["Referral", "Website", "Campaign", "Partner", "Outbound"],
    },
    quickFilters: [
      {
        key: "high-score",
        label: "High score",
        predicate: (record) => toNumber(record.data?.lead_score) >= 75,
      },
      {
        key: "follow-up-due",
        label: "Follow-up due",
        predicate: (record) => !!record.data?.next_follow_up,
      },
      {
        key: "active-only",
        label: "Active",
        predicate: (record) => record.data?.status === "Active",
      },
    ],
    initialForm: {
      full_name: "",
      role: "",
      company_name: "",
      email: "",
      phone: "",
      owner: "",
      source: "Website",
      status: "New",
      lead_score: "60",
      last_contact_date: "",
      next_follow_up: "",
      city: "",
      tags: "",
      notes: "",
    },
    fields: [
      { name: "full_name", label: "Full Name", placeholder: "Asha Kumar", required: true },
      { name: "role", label: "Role", placeholder: "HR Manager" },
      { name: "company_name", label: "Company", placeholder: "Nexa Health" },
      { name: "email", label: "Email", type: "email", placeholder: "asha@nexa.example" },
      { name: "phone", label: "Phone", placeholder: "+1 555 100 0101" },
      { name: "owner", label: "Owner", placeholder: "Leona Hart" },
      {
        name: "source",
        label: "Source",
        type: "select",
        options: ["Referral", "Website", "Campaign", "Partner", "Outbound"],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["New", "Active", "Nurturing", "Dormant"],
      },
      { name: "lead_score", label: "Lead Score", type: "number", placeholder: "75" },
      { name: "last_contact_date", label: "Last Contact", type: "date" },
      { name: "next_follow_up", label: "Next Follow-up", type: "date" },
      { name: "city", label: "City", placeholder: "Boston" },
      { name: "tags", label: "Tags", placeholder: "Enterprise, HR, Priority" },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Relationship notes, preferences, and next action context.",
        colClass: "col-12",
      },
    ],
    summaryFields: ["full_name", "company_name", "status", "next_follow_up"],
    columns: [
      {
        key: "identity",
        label: "Contact",
        render: (record) =>
          primaryWithMeta(
            record.data?.full_name,
            `${record.data?.role || "Role pending"} - ${record.data?.company_name || "Independent"}`
          ),
      },
      { key: "owner", label: "Owner", render: (record) => record.data?.owner || "-" },
      { key: "source", label: "Source", render: (record) => record.data?.source || "-" },
      {
        key: "followup",
        label: "Follow-up",
        render: (record) => dateCell(record.data?.next_follow_up, record.data?.email || record.data?.phone),
      },
      {
        key: "score",
        label: "Score",
        render: (record) => `${toNumber(record.data?.lead_score) || 0}`,
        align: "end",
      },
      { key: "status", label: "Status", render: (record) => badge(record.data?.status) },
    ],
    detailsSections: [
      { label: "Company", key: "company_name" },
      { label: "Role", key: "role" },
      { label: "Owner", key: "owner" },
      { label: "Source", key: "source" },
      { label: "Email", key: "email" },
      { label: "Phone", key: "phone" },
      { label: "City", key: "city" },
      { label: "Lead Score", key: "lead_score" },
      { label: "Last Contact", key: "last_contact_date", format: "date" },
      { label: "Next Follow-up", key: "next_follow_up", format: "date" },
      { label: "Tags", key: "tags" },
    ],
    cardMeta: (record) => [
      { label: "Owner", value: record.data?.owner || "-" },
      { label: "Source", value: record.data?.source || "-" },
      { label: "Follow-up", value: formatDisplayDate(record.data?.next_follow_up) },
    ],
    stats: (records) => [
      { label: "Contacts", value: records.length, meta: "Relationship records tracked" },
      {
        label: "Active",
        value: records.filter((record) => record.data?.status === "Active").length,
        meta: "Currently engaged contacts",
      },
      {
        label: "High Score",
        value: records.filter((record) => toNumber(record.data?.lead_score) >= 75).length,
        meta: "Priority follow-up targets",
      },
      {
        label: "Due Soon",
        value: records.filter((record) => record.data?.next_follow_up).length,
        meta: "Contacts with scheduled follow-ups",
      },
    ],
  },
  company: {
    singular: "Company",
    plural: "Companies",
    kicker: "Account Desk",
    subtitle:
      "A more advanced account view with relationship stage, owner visibility, value potential, and linked contact context.",
    resource: "/data/crm-companies/",
    listRoute: routes.companiesList,
    gridRoute: routes.companiesGrid,
    detailsRoute: routes.companiesDetails,
    buttonLabel: "Add Company",
    emptyIcon: "ti ti-building-community",
    emptyTitle: "No companies added",
    emptyDescription: "Create company accounts to map industries, owners, revenue potential, and relationship stage.",
    statusOptions: ["Prospect", "Active", "Strategic", "Dormant"],
    ownerField: "account_owner",
    dateFields: ["updated_at", "created_at"],
    searchPlaceholder: "Search company, owner, industry, location",
    filterField: {
      name: "industry",
      label: "All industries",
      options: ["Healthcare", "Technology", "Finance", "Retail", "Education"],
    },
    quickFilters: [
      {
        key: "strategic",
        label: "Strategic",
        predicate: (record) => record.data?.status === "Strategic",
      },
      {
        key: "customer-stage",
        label: "Customers",
        predicate: (record) => record.data?.relationship_stage === "Customer",
      },
      {
        key: "high-value",
        label: "High value",
        predicate: (record) => toNumber(record.data?.annual_value) >= 100000,
      },
    ],
    initialForm: {
      company_name: "",
      industry: "Technology",
      website: "",
      account_owner: "",
      email: "",
      phone: "",
      location: "",
      status: "Prospect",
      relationship_stage: "Discovery",
      annual_value: "",
      employee_band: "",
      notes: "",
    },
    fields: [
      { name: "company_name", label: "Company Name", placeholder: "Nexa Health", required: true },
      {
        name: "industry",
        label: "Industry",
        type: "select",
        options: ["Healthcare", "Technology", "Finance", "Retail", "Education"],
      },
      { name: "website", label: "Website", placeholder: "https://nexa.example" },
      { name: "account_owner", label: "Account Owner", placeholder: "Leona Hart" },
      { name: "email", label: "Email", type: "email", placeholder: "hello@nexa.example" },
      { name: "phone", label: "Phone", placeholder: "+1 555 100 0201" },
      { name: "location", label: "Location", placeholder: "Chicago, IL" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Prospect", "Active", "Strategic", "Dormant"],
      },
      {
        name: "relationship_stage",
        label: "Relationship Stage",
        type: "select",
        options: ["Discovery", "Qualified", "Proposal", "Customer", "Expansion"],
      },
      { name: "annual_value", label: "Annual Value", type: "number", placeholder: "150000" },
      { name: "employee_band", label: "Employee Band", placeholder: "200-500" },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Account context, buying committee notes, and renewal details.",
        colClass: "col-12",
      },
    ],
    summaryFields: ["company_name", "industry", "status", "annual_value"],
    columns: [
      {
        key: "company_name",
        label: "Company",
        render: (record) =>
          primaryWithMeta(
            record.data?.company_name,
            `${record.data?.industry || "Industry pending"} - ${record.data?.location || "Location pending"}`
          ),
      },
      { key: "account_owner", label: "Owner", render: (record) => record.data?.account_owner || "-" },
      { key: "relationship_stage", label: "Stage", render: (record) => record.data?.relationship_stage || "-" },
      {
        key: "annual_value",
        label: "Annual Value",
        render: (record) => (record.data?.annual_value ? formatCurrency(record.data?.annual_value) : "-"),
      },
      { key: "status", label: "Status", render: (record) => badge(record.data?.status) },
    ],
    detailsSections: [
      { label: "Industry", key: "industry" },
      { label: "Owner", key: "account_owner" },
      { label: "Website", key: "website" },
      { label: "Email", key: "email" },
      { label: "Phone", key: "phone" },
      { label: "Location", key: "location" },
      { label: "Relationship Stage", key: "relationship_stage" },
      { label: "Annual Value", key: "annual_value", format: "currency" },
      { label: "Employee Band", key: "employee_band" },
    ],
    cardMeta: (record) => [
      { label: "Owner", value: record.data?.account_owner || "-" },
      { label: "Stage", value: record.data?.relationship_stage || "-" },
      {
        label: "Value",
        value: record.data?.annual_value ? formatCurrency(record.data?.annual_value) : "-",
      },
    ],
    stats: (records) => [
      { label: "Companies", value: records.length, meta: "Accounts tracked in CRM" },
      {
        label: "Strategic",
        value: records.filter((record) => record.data?.status === "Strategic").length,
        meta: "High-touch account list",
      },
      {
        label: "Pipeline Value",
        value: formatCurrency(records.reduce((sum, record) => sum + toNumber(record.data?.annual_value), 0)),
        meta: "Combined annual account value",
      },
      {
        label: "Customer Stage",
        value: records.filter((record) => record.data?.relationship_stage === "Customer").length,
        meta: "Accounts already landed",
      },
    ],
  },
  deal: {
    singular: "Deal",
    plural: "Deals",
    kicker: "Revenue Pipeline",
    subtitle:
      "A deal workspace with stage visibility, expected close timing, win/loss state, and owner accountability.",
    resource: "/data/crm-deals/",
    listRoute: routes.dealsList,
    gridRoute: routes.dealsGrid,
    detailsRoute: routes.dealsDetails,
    buttonLabel: "Add Deal",
    emptyIcon: "ti ti-briefcase-2",
    emptyTitle: "No deals added",
    emptyDescription: "Create deals to track value, close dates, stage movement, and revenue risk.",
    statusOptions: ["Open", "Won", "Lost", "On Hold"],
    ownerField: "owner",
    dateFields: ["expected_close_date"],
    searchPlaceholder: "Search deal, company, owner, next step",
    filterField: {
      name: "stage",
      label: "All stages",
      options: ["Discovery", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
    },
    quickFilters: [
      {
        key: "open",
        label: "Open",
        predicate: (record) => record.data?.status === "Open",
      },
      {
        key: "late-stage",
        label: "Late stage",
        predicate: (record) => ["Proposal", "Negotiation"].includes(String(record.data?.stage || "")),
      },
      {
        key: "high-value",
        label: "High value",
        predicate: (record) => toNumber(record.data?.value) >= 40000,
      },
    ],
    initialForm: {
      deal_name: "",
      company_name: "",
      contact_name: "",
      value: "",
      stage: "Discovery",
      probability: "25",
      owner: "",
      expected_close_date: "",
      status: "Open",
      source: "Outbound",
      next_step: "",
      notes: "",
    },
    fields: [
      { name: "deal_name", label: "Deal Name", placeholder: "Nexa HR Platform Rollout", required: true },
      { name: "company_name", label: "Company", placeholder: "Nexa Health" },
      { name: "contact_name", label: "Primary Contact", placeholder: "Asha Kumar" },
      { name: "value", label: "Deal Value", type: "number", placeholder: "45000" },
      {
        name: "stage",
        label: "Stage",
        type: "select",
        options: ["Discovery", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
      },
      { name: "probability", label: "Probability %", type: "number", placeholder: "60" },
      { name: "owner", label: "Owner", placeholder: "Marcus Reed" },
      { name: "expected_close_date", label: "Expected Close", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["Open", "Won", "Lost", "On Hold"] },
      {
        name: "source",
        label: "Source",
        type: "select",
        options: ["Outbound", "Inbound", "Partner", "Expansion"],
      },
      { name: "next_step", label: "Next Step", placeholder: "Security review call" },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Commercial notes, blockers, and stakeholder map.",
        colClass: "col-12",
      },
    ],
    summaryFields: ["deal_name", "stage", "status", "expected_close_date"],
    columns: [
      {
        key: "deal_name",
        label: "Deal",
        render: (record) =>
          primaryWithMeta(
            record.data?.deal_name,
            `${record.data?.company_name || "Company pending"} - ${record.data?.contact_name || "Contact pending"}`
          ),
      },
      { key: "owner", label: "Owner", render: (record) => record.data?.owner || "-" },
      { key: "stage", label: "Stage", render: (record) => record.data?.stage || "-" },
      {
        key: "expected_close_date",
        label: "Close Date",
        render: (record) =>
          dateCell(record.data?.expected_close_date, `${toNumber(record.data?.probability)}% probability`),
      },
      {
        key: "value",
        label: "Value",
        render: (record) => (record.data?.value ? formatCurrency(record.data?.value) : "-"),
      },
      { key: "status", label: "Status", render: (record) => badge(record.data?.status) },
    ],
    detailsSections: [
      { label: "Company", key: "company_name" },
      { label: "Primary Contact", key: "contact_name" },
      { label: "Owner", key: "owner" },
      { label: "Stage", key: "stage" },
      { label: "Status", key: "status" },
      { label: "Value", key: "value", format: "currency" },
      { label: "Probability", key: "probability" },
      { label: "Expected Close", key: "expected_close_date", format: "date" },
      { label: "Source", key: "source" },
      { label: "Next Step", key: "next_step" },
    ],
    cardMeta: (record) => [
      { label: "Owner", value: record.data?.owner || "-" },
      { label: "Probability", value: `${toNumber(record.data?.probability)}%` },
      { label: "Close", value: formatDisplayDate(record.data?.expected_close_date) },
    ],
    stats: (records) => [
      { label: "Deals", value: records.length, meta: "Open and closed opportunities" },
      {
        label: "Open Value",
        value: formatCurrency(
          records
            .filter((record) => record.data?.status === "Open")
            .reduce((sum, record) => sum + toNumber(record.data?.value), 0)
        ),
        meta: "Revenue still in play",
      },
      {
        label: "Won",
        value: records.filter((record) => record.data?.status === "Won").length,
        meta: "Closed won opportunities",
      },
      {
        label: "Negotiation",
        value: records.filter((record) => record.data?.stage === "Negotiation").length,
        meta: "Late-stage opportunities",
      },
    ],
  },
  lead: {
    singular: "Lead",
    plural: "Leads",
    kicker: "Lead Engine",
    subtitle:
      "A lead workspace with scoring, source tracking, owner visibility, and conversion readiness across the funnel.",
    resource: "/data/crm-leads/",
    listRoute: routes.leadsList,
    gridRoute: routes.leadsGrid,
    detailsRoute: routes.leadsDetails,
    buttonLabel: "Add Lead",
    emptyIcon: "ti ti-user-search",
    emptyTitle: "No leads added",
    emptyDescription: "Create leads to centralize outreach, score demand, and promote the right ones into deals.",
    statusOptions: ["New", "Qualified", "Working", "Converted", "Lost"],
    ownerField: "owner",
    dateFields: ["next_follow_up"],
    searchPlaceholder: "Search lead, company, owner, notes",
    filterField: {
      name: "source",
      label: "All sources",
      options: ["Website", "Referral", "Campaign", "Partner", "Outbound"],
    },
    quickFilters: [
      {
        key: "qualified",
        label: "Qualified",
        predicate: (record) => ["Qualified", "Working"].includes(String(record.data?.status || "")),
      },
      {
        key: "high-score",
        label: "High score",
        predicate: (record) => toNumber(record.data?.score) >= 70,
      },
      {
        key: "converted",
        label: "Converted",
        predicate: (record) => record.data?.status === "Converted",
      },
    ],
    initialForm: {
      lead_name: "",
      company_name: "",
      email: "",
      phone: "",
      source: "Website",
      score: "55",
      stage: "New",
      owner: "",
      status: "New",
      expected_value: "",
      next_follow_up: "",
      notes: "",
    },
    fields: [
      { name: "lead_name", label: "Lead Name", placeholder: "David Lin", required: true },
      { name: "company_name", label: "Company", placeholder: "Quantum Nexus" },
      { name: "email", label: "Email", type: "email", placeholder: "david@quantum.example" },
      { name: "phone", label: "Phone", placeholder: "+1 555 100 0401" },
      { name: "owner", label: "Owner", placeholder: "Marcus Reed" },
      {
        name: "source",
        label: "Source",
        type: "select",
        options: ["Website", "Referral", "Campaign", "Partner", "Outbound"],
      },
      { name: "score", label: "Score", type: "number", placeholder: "70" },
      { name: "stage", label: "Stage", type: "select", options: ["New", "Qualified", "Working", "Converted", "Lost"] },
      { name: "status", label: "Status", type: "select", options: ["New", "Qualified", "Working", "Converted", "Lost"] },
      { name: "expected_value", label: "Expected Value", type: "number", placeholder: "28000" },
      { name: "next_follow_up", label: "Next Follow-up", type: "date" },
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Discovery notes, pain points, and next actions.",
        colClass: "col-12",
      },
    ],
    summaryFields: ["lead_name", "source", "status", "next_follow_up"],
    columns: [
      {
        key: "lead_name",
        label: "Lead",
        render: (record) =>
          primaryWithMeta(
            record.data?.lead_name,
            `${record.data?.company_name || "Company pending"} - ${record.data?.email || record.data?.phone || "No contact info"}`
          ),
      },
      { key: "owner", label: "Owner", render: (record) => record.data?.owner || "-" },
      { key: "source", label: "Source", render: (record) => record.data?.source || "-" },
      { key: "score", label: "Score", render: (record) => `${toNumber(record.data?.score)}` },
      { key: "status", label: "Status", render: (record) => badge(record.data?.status) },
    ],
    detailsSections: [
      { label: "Company", key: "company_name" },
      { label: "Owner", key: "owner" },
      { label: "Source", key: "source" },
      { label: "Email", key: "email" },
      { label: "Phone", key: "phone" },
      { label: "Stage", key: "stage" },
      { label: "Status", key: "status" },
      { label: "Score", key: "score" },
      { label: "Expected Value", key: "expected_value", format: "currency" },
      { label: "Next Follow-up", key: "next_follow_up", format: "date" },
    ],
    cardMeta: (record) => [
      { label: "Owner", value: record.data?.owner || "-" },
      { label: "Source", value: record.data?.source || "-" },
      { label: "Score", value: `${toNumber(record.data?.score)}` },
    ],
    stats: (records) => [
      { label: "Leads", value: records.length, meta: "Top of funnel demand" },
      {
        label: "Qualified",
        value: records.filter((record) => record.data?.status === "Qualified").length,
        meta: "Ready for deeper discovery",
      },
      {
        label: "Converted",
        value: records.filter((record) => record.data?.status === "Converted").length,
        meta: "Moved into active deal work",
      },
      {
        label: "Potential",
        value: formatCurrency(records.reduce((sum, record) => sum + toNumber(record.data?.expected_value), 0)),
        meta: "Combined expected lead value",
      },
    ],
  },
};

export const CRM_ACTIVITY_CONFIG = {
  resource: "/data/crm-activities/",
  statusOptions: ["Scheduled", "Completed", "Overdue", "Cancelled"],
  typeOptions: ["Call", "Email", "Meeting", "Task", "Demo"],
  channelOptions: ["Phone", "Email", "Zoom", "In Person", "Slack"],
};

export const formatDetailValue = (value, format) => {
  if (format === "date") return formatDisplayDate(value);
  if (format === "currency") return value ? formatCurrency(value) : "-";
  return value || "-";
};
