import API from "../../api/axios";
import {
  formatCurrency,
  formatDisplayDate,
  normalizeResourceRecords,
  toNumber,
} from "../hrm/hrmShared";

export const CRM_RESOURCE_MAP = {
  contact: "/data/crm-contacts/",
  company: "/data/crm-companies/",
  deal: "/data/crm-deals/",
  lead: "/data/crm-leads/",
  activity: "/data/crm-activities/",
};

export const CRM_STAGE_ORDER = ["Discovery", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

export const CRM_STAGE_PROBABILITY = {
  Discovery: 20,
  Qualified: 40,
  Proposal: 65,
  Negotiation: 82,
  Won: 100,
  Lost: 0,
};

export const fetchCrmResource = async (resource) => {
  const response = await API.get(resource);
  return normalizeResourceRecords(response.data);
};

export const fetchCrmCollections = async (keys) => {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await fetchCrmResource(CRM_RESOURCE_MAP[key])])
  );
  return Object.fromEntries(entries);
};

export const getRecordLabel = (record) => {
  const data = record?.data || {};
  return (
    data.full_name ||
    data.company_name ||
    data.deal_name ||
    data.lead_name ||
    data.subject ||
    data.title ||
    "Record"
  );
};

export const getRecordOwner = (record) => {
  const data = record?.data || {};
  return data.owner || data.account_owner || data.assigned_to || "Unassigned";
};

export const getDealValue = (deal) => toNumber(deal?.data?.value);

export const getWeightedValue = (deal) =>
  getDealValue(deal) * (toNumber(deal?.data?.probability) || 0) / 100;

export const isOpenDeal = (deal) => String(deal?.data?.status || "").toLowerCase() === "open";

export const activityIsClosed = (activity) => {
  const status = String(activity?.data?.status || "").toLowerCase();
  return ["completed", "cancelled"].includes(status);
};

export const isOverdueActivity = (activity) => {
  if (activityIsClosed(activity)) return false;
  const dueDate = activity?.data?.due_date;
  if (!dueDate) return false;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

export const isDueSoon = (value, days = 7) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= days;
};

export const buildRelationOptions = (collections) => {
  const descriptors = [
    { type: "contact", records: collections.contact || [] },
    { type: "company", records: collections.company || [] },
    { type: "deal", records: collections.deal || [] },
    { type: "lead", records: collections.lead || [] },
  ];

  return descriptors
    .flatMap(({ type, records }) =>
      records.map((record) => {
        const label = getRecordLabel(record);
        return {
          value: `${type}:${record.id}`,
          relation_type: type,
          relation_id: String(record.id),
          relation_name: label,
          label: `${label} - ${type}`,
        };
      })
    )
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const relationPath = (relationType, relationId, routes) => {
  if (!relationType || !relationId) return "";
  const map = {
    contact: routes.contactDetails,
    company: routes.companiesDetails,
    deal: routes.dealsDetails,
    lead: routes.leadsDetails,
  };
  const path = map[relationType];
  return path ? `${path}?id=${relationId}` : "";
};

export const summarizeSources = (records, field = "source") => {
  const counts = new Map();
  records.forEach((record) => {
    const key = record?.data?.[field] || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
};

export const ownerLeaderboard = (deals, leads, contacts) => {
  const board = new Map();

  deals.forEach((deal) => {
    const owner = getRecordOwner(deal);
    const current = board.get(owner) || {
      owner,
      dealValue: 0,
      dealCount: 0,
      leadCount: 0,
      contactCount: 0,
      weightedValue: 0,
    };
    board.set(owner, {
      ...current,
      dealValue: current.dealValue + getDealValue(deal),
      weightedValue: current.weightedValue + getWeightedValue(deal),
      dealCount: current.dealCount + 1,
    });
  });

  leads.forEach((lead) => {
    const owner = getRecordOwner(lead);
    const current = board.get(owner) || {
      owner,
      dealValue: 0,
      dealCount: 0,
      leadCount: 0,
      contactCount: 0,
      weightedValue: 0,
    };
    board.set(owner, {
      ...current,
      leadCount: current.leadCount + 1,
    });
  });

  contacts.forEach((contact) => {
    const owner = getRecordOwner(contact);
    const current = board.get(owner) || {
      owner,
      dealValue: 0,
      dealCount: 0,
      leadCount: 0,
      contactCount: 0,
      weightedValue: 0,
    };
    board.set(owner, {
      ...current,
      contactCount: current.contactCount + 1,
    });
  });

  return Array.from(board.values()).sort((left, right) => right.weightedValue - left.weightedValue);
};

export const stageSummary = (deals) =>
  CRM_STAGE_ORDER.map((stage) => {
    const stageDeals = deals.filter((deal) => String(deal?.data?.stage || "") === stage);
    const totalValue = stageDeals.reduce((sum, deal) => sum + getDealValue(deal), 0);
    return {
      stage,
      deals: stageDeals,
      count: stageDeals.length,
      totalValue,
      totalValueLabel: formatCurrency(totalValue),
      weightedValueLabel: formatCurrency(stageDeals.reduce((sum, deal) => sum + getWeightedValue(deal), 0)),
    };
  });

export const stageTone = (stage) => {
  const key = String(stage || "").toLowerCase();
  if (["won"].includes(key)) return "success";
  if (["lost"].includes(key)) return "danger";
  if (["negotiation", "proposal"].includes(key)) return "warning";
  return "accent";
};

export const buildActivityPreview = (activity) => {
  const dueDate = formatDisplayDate(activity?.data?.due_date);
  return `${activity?.data?.activity_type || "Activity"} on ${dueDate}`;
};
