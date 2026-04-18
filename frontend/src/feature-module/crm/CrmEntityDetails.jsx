import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import {
  HrmEmptyState,
  HrmHero,
  HrmSideList,
  formatDisplayDate,
  normalizeResourceRecords,
} from "../hrm/hrmShared";
import { CRM_ACTIVITY_CONFIG, CRM_ENTITY_CONFIGS, formatDetailValue } from "./crmConfigs";

const RELATED_RESOURCES = {
  contact: {
    primary: null,
    secondary: "/data/crm-deals/",
    tertiary: CRM_ACTIVITY_CONFIG.resource,
  },
  company: {
    primary: "/data/crm-contacts/",
    secondary: "/data/crm-deals/",
    tertiary: CRM_ACTIVITY_CONFIG.resource,
  },
  deal: {
    primary: null,
    secondary: CRM_ACTIVITY_CONFIG.resource,
    tertiary: "/data/crm-leads/",
  },
  lead: {
    primary: "/data/crm-deals/",
    secondary: CRM_ACTIVITY_CONFIG.resource,
    tertiary: "/data/crm-companies/",
  },
};

const CrmEntityDetails = ({ entityKey }) => {
  const config = CRM_ENTITY_CONFIGS[entityKey];
  const navigate = useNavigate();
  const { search } = useLocation();
  const id = new URLSearchParams(search).get("id") || "";
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [related, setRelated] = useState({ primary: [], secondary: [], tertiary: [] });

  const loadList = useCallback(async () => {
    const response = await API.get(config.resource);
    return normalizeResourceRecords(response.data);
  }, [config.resource]);

  const loadRecord = useCallback(
    async (targetId) => {
      if (!targetId) return;
      setLoading(true);
      try {
        const [entityResponse, list] = await Promise.all([API.get(`${config.resource}${targetId}/`), loadList()]);
        setRecord(entityResponse.data);
        setRecords(list);
      } catch (error) {
        console.error(`Failed to load ${config.singular.toLowerCase()} details`, error);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    },
    [config.resource, config.singular, loadList]
  );

  const loadSelectionList = useCallback(async () => {
    try {
      const list = await loadList();
      setRecords(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (error) {
      console.error(`Failed to load ${config.plural.toLowerCase()}`, error);
      setRecords([]);
    }
  }, [config.plural, loadList, selectedId]);

  useEffect(() => {
    if (id) {
      loadRecord(id);
    } else {
      loadSelectionList();
    }
  }, [id, loadRecord, loadSelectionList]);

  useEffect(() => {
    const loadRelated = async () => {
      if (!record) return;
      const resources = RELATED_RESOURCES[entityKey];
      const requests = [resources.primary, resources.secondary, resources.tertiary].map((resource) =>
        resource ? API.get(resource).then((response) => normalizeResourceRecords(response.data)) : Promise.resolve([])
      );
      const [primary, secondary, tertiary] = await Promise.all(requests);
      setRelated({ primary, secondary, tertiary });
    };
    loadRelated().catch((error) => console.error("Failed to load related CRM records", error));
  }, [entityKey, record]);

  const highlights = !record
    ? []
    : config.summaryFields.map((field) => ({
        label: field.replace(/_/g, " "),
        meta: "",
        value: String(record.data?.[field] || "-"),
        tone: field === "status" ? "success" : "accent",
      }));

  const relatedPanels = useMemo(() => {
    if (!record) return [];
    const name =
      record.data?.full_name ||
      record.data?.company_name ||
      record.data?.deal_name ||
      record.data?.lead_name ||
      "";
    return [
      {
        title: entityKey === "company" ? "Related Contacts" : entityKey === "lead" ? "Related Deals" : "Related Opportunities",
        items: related.primary.filter((item) =>
          JSON.stringify(item.data || "").toLowerCase().includes(String(name).toLowerCase())
        ),
      },
      {
        title: entityKey === "company" ? "Related Deals" : "Activities / Pipeline",
        items: related.secondary.filter((item) =>
          JSON.stringify(item.data || "").toLowerCase().includes(String(name).toLowerCase())
        ),
      },
      {
        title: entityKey === "deal" ? "Related Leads" : entityKey === "lead" ? "Company Matches" : "Related Activities",
        items: related.tertiary.filter((item) =>
          JSON.stringify(item.data || "").toLowerCase().includes(String(name).toLowerCase())
        ),
      },
    ];
  }, [entityKey, record, related]);

  if (!id) {
    return (
      <div className="page-wrapper">
        <div className="content container-fluid payroll-shell employee-shell crm-shell">
          <HrmHero
            kicker={`${config.singular} Lookup`}
            title={`${config.singular} Details`}
            subtitle={`Pick a ${config.singular.toLowerCase()} from the CRM to open its richer detail view.`}
            action={<Link to={config.gridRoute} className="btn btn-primary">Back to {config.plural}</Link>}
            stats={[
              { label: `${config.plural}`, value: records.length, meta: "Available to inspect" },
              { label: "Detail View", value: "Ready", meta: "Choose a record to continue" },
              { label: "Query Routing", value: "Enabled", meta: "Works with ?id=..." },
              { label: "Cross-links", value: "Visible", meta: "Related records appear in details" },
            ]}
          />
          <div className="card payroll-section-card">
            <div className="card-body">
              {records.length === 0 ? (
                <HrmEmptyState
                  icon={config.emptyIcon}
                  title={`No ${config.plural.toLowerCase()} to inspect`}
                  description={`Create a ${config.singular.toLowerCase()} first, then open its detail page from here.`}
                />
              ) : (
                <div className="row g-3 align-items-end">
                  <div className="col-md-8">
                    <label className="form-label">{config.singular}</label>
                    <select className="form-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                      {records.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.data?.[config.summaryFields[0]] || config.singular}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <button
                      type="button"
                      className="btn btn-primary w-100"
                      disabled={!selectedId}
                      onClick={() => navigate(`${config.detailsRoute}?id=${selectedId}`)}
                    >
                      Open Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell crm-shell">
        {loading || !record ? (
          <div className="card payroll-section-card">
            <div className="card-body py-5 text-center">
              {loading ? "Loading details..." : `No ${config.singular.toLowerCase()} selected.`}
            </div>
          </div>
        ) : (
          <>
            <HrmHero
              kicker={`${config.singular} Detail`}
              title={record.data?.[config.summaryFields[0]] || `${config.singular} Record`}
              subtitle={config.subtitle}
              action={
                <>
                  <Link to={config.gridRoute} className="btn btn-white">
                    <i className="ti ti-layout-grid me-2" />
                    Back to Grid
                  </Link>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </>
              }
              stats={[
                { label: "Status", value: record.data?.status || "Draft", meta: config.singular },
                { label: "Updated", value: formatDisplayDate(record.updated_at || record.created_at), meta: "Latest change" },
                { label: "Primary Route", value: config.gridRoute, meta: "Grid and list stay in sync" },
                { label: "Related Panels", value: relatedPanels.reduce((sum, panel) => sum + panel.items.length, 0), meta: "Cross-record visibility" },
              ]}
            />

            <div className="row g-4">
              <div className="col-xl-8">
                <div className="card payroll-section-card mb-4">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">Core Details</h5>
                    </div>
                    <div className="crm-detail-grid">
                      {config.detailsSections.map((section) => (
                        <div key={section.key} className="crm-detail-card">
                          <span>{section.label}</span>
                          <strong>{formatDetailValue(record.data?.[section.key], section.format)}</strong>
                        </div>
                      ))}
                    </div>
                    {record.data?.notes ? (
                      <div className="finance-note-card mt-4">
                        <i className="ti ti-notes" />
                        {record.data.notes}
                      </div>
                    ) : null}
                  </div>
                </div>

                {relatedPanels.map((panel) => (
                  <div key={panel.title} className="card payroll-section-card mb-4">
                    <div className="card-body">
                      <div className="payroll-section-header">
                        <h5 className="payroll-section-title">{panel.title}</h5>
                      </div>
                      {panel.items.length === 0 ? (
                        <p className="text-muted mb-0">No linked records found yet.</p>
                      ) : (
                        <div className="payroll-summary-list">
                          {panel.items.slice(0, 6).map((item) => (
                            <div key={item.id} className="payroll-summary-row">
                              <div>
                                <div className="payroll-primary-text">
                                  {item.data?.deal_name ||
                                    item.data?.lead_name ||
                                    item.data?.full_name ||
                                    item.data?.company_name ||
                                    item.data?.subject ||
                                    "Record"}
                                </div>
                                <div className="payroll-secondary-text">
                                  {item.data?.owner ||
                                    item.data?.activity_type ||
                                    item.data?.status ||
                                    item.data?.source ||
                                    "Linked CRM item"}
                                </div>
                              </div>
                              <span className="payroll-badge accent">
                                {item.data?.status || item.data?.stage || item.data?.activity_type || "Open"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="col-xl-4">
                <HrmSideList title="Quick Snapshot" items={highlights} emptyLabel="Summary data will appear here." />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CrmEntityDetails;
