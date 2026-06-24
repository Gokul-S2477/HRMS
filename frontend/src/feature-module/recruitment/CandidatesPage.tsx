import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import { all_routes } from "../router/all_routes";
import CrudOpsWorkspace from "../liveops/CrudOpsWorkspace";
import { fetchJobOptions } from "../liveops/liveHelpers";
import { formatDisplayDate } from "../hrm/hrmShared";

const STAGE_OPTIONS = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "joined", label: "Joined" },
  { value: "rejected", label: "Rejected" },
];

const fields = [
  { name: "job_id", label: "Linked Job", type: "select", optionsKey: "jobOptions" },
  { name: "first_name", label: "First Name", required: true },
  { name: "last_name", label: "Last Name" },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "whatsapp", label: "WhatsApp" },
  { name: "location", label: "Location" },
  { name: "source", label: "Source" },
  { name: "application_source", label: "Application Source" },
  { name: "stage", label: "Stage", type: "select", options: STAGE_OPTIONS, required: true },
  { name: "score", label: "Fit Score", type: "number", min: 0, max: 100 },
  { name: "notice_period_days", label: "Notice Period", type: "number", min: 0 },
  { name: "owner_name", label: "Recruiter / Owner" },
  { name: "current_company", label: "Current Company" },
  { name: "current_title", label: "Current Title" },
  { name: "linkedin_url", label: "LinkedIn URL" },
  { name: "portfolio_url", label: "Portfolio URL" },
  { name: "resume_url", label: "Resume URL" },
  { name: "applied_on", label: "Applied On", type: "date" },
  { name: "summary", label: "Summary", type: "textarea", colClass: "col-12", rows: 5 },
];

const columns = [
  {
    label: "Candidate",
    render: (record: any) => (
      <div>
        <div className="fw-semibold">{record.full_name || `${record.first_name} ${record.last_name || ""}`}</div>
        <div className="text-muted small">{record.email}</div>
      </div>
    ),
    text: (record: any) => record.full_name || `${record.first_name} ${record.last_name || ""}`,
  },
  { label: "Role", render: (record: any) => record.job?.title || "Unassigned", text: (record: any) => record.job?.title || "Unassigned" },
  {
    label: "Contact",
    render: (record: any) => (
      <div>
        <div>{record.phone || record.whatsapp || "-"}</div>
        <div className="text-muted small">{record.location || "Location pending"}</div>
      </div>
    ),
    text: (record: any) => record.phone || record.whatsapp || "-",
  },
  {
    label: "Stage",
    render: (record: any) => <span className={`payroll-badge ${record.stage === "joined" ? "success" : record.stage === "rejected" ? "danger" : "warning"}`}>{record.stage}</span>,
    text: (record: any) => record.stage,
  },
  { label: "Score", render: (record: any) => `${record.score || 0}/100`, text: (record: any) => `${record.score || 0}/100` },
  {
    label: "Owner",
    render: (record: any) => (
      <div>
        <div>{record.owner_name || "-"}</div>
        <div className="text-muted small">Updated {formatDisplayDate(record.stage_updated_at || record.updated_at)}</div>
      </div>
    ),
    text: (record: any) => record.owner_name || "-",
  },
  {
    label: "Interview Trail",
    render: (record: any) => (
      <div>
        <div>{record.interview_snapshot?.count || 0} round(s)</div>
        <div className="text-muted small">{record.interview_snapshot?.latest?.decision ? String(record.interview_snapshot.latest.decision).replace(/_/g, " ") : "No interview logged yet"}</div>
      </div>
    ),
    text: (record: any) => String(record.interview_snapshot?.count || 0),
  },
];

const handleContact = async (record: any, channel: string, refresh: () => void) => {
  try {
    await API.post(`/recruitment/candidates/${record.id}/contact/`, {
      channel,
      note: `Candidate contact initiated from ${channel}.`,
    });
    refresh();
  } catch (error) {
    console.error("Failed to log candidate contact", error);
  }
  if (channel === "email" && record.contact_actions?.email) {
    window.open(record.contact_actions.email, "_blank");
  }
  if (channel === "whatsapp" && record.contact_actions?.whatsapp) {
    window.open(record.contact_actions.whatsapp, "_blank");
  }
};

interface KanbanBoardProps {
  filteredRecords: any[];
  dependencies: any;
  refresh: () => void;
  openEdit: (record: any) => void;
  deleteRecord: (id: number) => void;
  stakeholderView: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  filteredRecords,
  dependencies,
  refresh,
  openEdit,
  deleteRecord,
  stakeholderView,
}) => {
  const [localCandidates, setLocalCandidates] = useState<any[]>([]);
  const [positionFilter, setPositionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  React.useEffect(() => {
    setLocalCandidates(filteredRecords);
  }, [filteredRecords]);

  // Unique sources in candidates
  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    filteredRecords.forEach((cand) => {
      if (cand.source) sources.add(cand.source);
    });
    return Array.from(sources).sort();
  }, [filteredRecords]);

  // Filter candidates by Position and Source locally
  const displayCandidates = useMemo(() => {
    return localCandidates.filter((cand) => {
      if (positionFilter && String(cand.job?.id || "") !== String(positionFilter)) {
        return false;
      }
      if (sourceFilter && cand.source !== sourceFilter) {
        return false;
      }
      return true;
    });
  }, [localCandidates, positionFilter, sourceFilter]);

  // Group candidates by stage
  const candidatesByStage = useMemo(() => {
    const groups: Record<string, any[]> = {
      applied: [],
      screening: [],
      interview: [],
      offer: [],
      joined: [],
      rejected: [],
    };
    displayCandidates.forEach((cand) => {
      const stage = cand.stage || "applied";
      if (groups[stage]) {
        groups[stage].push(cand);
      } else {
        groups.applied.push(cand);
      }
    });
    return groups;
  }, [displayCandidates]);

  // Handle Drag End
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const candidateId = Number(draggableId);
    const newStage = destination.droppableId;

    // Optimistic Update: instantly update local state
    const updatedCandidates = localCandidates.map((c) =>
      c.id === candidateId ? { ...c, stage: newStage } : c
    );
    setLocalCandidates(updatedCandidates);

    // Perform background API call
    try {
      await API.patch(`/recruitment/candidates/${candidateId}/`, {
        stage: newStage,
      });
      refresh();
    } catch (error) {
      console.error("Failed to update candidate stage:", error);
      // Revert optimistic update by restoring original state
      setLocalCandidates(filteredRecords);
      window.alert("Failed to update candidate stage. Reverting changes.");
    }
  };

  const jobOptions = dependencies?.jobOptions || [];

  return (
    <div>
      {/* Kanban Filters */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="d-flex align-items-center flex-wrap gap-2">
          {/* Position Filter */}
          <select
            className="form-select form-select-sm"
            style={{ width: "200px" }}
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          >
            <option value="">All Job Positions</option>
            {jobOptions.map((job: any) => (
              <option key={job.value} value={job.value}>
                {job.label}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            className="form-select form-select-sm"
            style={{ width: "180px" }}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">All Sources</option>
            {sourceOptions.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        {/* View Switchers */}
        <div className="btn-group">
          <Link to="/candidates" className="btn btn-sm btn-outline-secondary">
            <i className="ti ti-table me-1" /> Table
          </Link>
          <Link to="/candidates/grid" className="btn btn-sm btn-outline-secondary">
            <i className="ti ti-grid me-1" /> Grid
          </Link>
          <Link to="/candidates/kanban" className="btn btn-sm btn-primary">
            <i className="ti ti-columns me-1" /> Kanban
          </Link>
        </div>
      </div>

      {/* Kanban Board Container */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-wrapper d-flex gap-3 overflow-auto pb-4" style={{ minHeight: "650px" }}>
          {STAGE_OPTIONS.map((stage) => {
            const list = candidatesByStage[stage.value] || [];
            return (
              <Droppable key={stage.value} droppableId={stage.value}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="kanban-column flex-shrink-0 p-3 rounded"
                    style={{
                      width: "300px",
                      backgroundColor: snapshot.isDraggingOver ? "rgba(242, 101, 34, 0.05)" : "#f8fafc",
                      border: snapshot.isDraggingOver ? "2px dashed var(--hrms-accent)" : "1px solid var(--hrms-border)",
                      transition: "background-color 0.2s, border-color 0.2s"
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0 fw-bold d-flex align-items-center text-dark">
                        {stage.label}
                        <span className="badge bg-secondary ms-2 text-white">{list.length}</span>
                      </h6>
                    </div>

                    <div className="kanban-cards-container d-flex flex-column gap-2" style={{ minHeight: "500px" }}>
                      {list.map((cand, index) => (
                        <Draggable key={String(cand.id)} draggableId={String(cand.id)} index={index}>
                          {(providedDrag, snapshotDrag) => (
                            <div
                              ref={providedDrag.innerRef}
                              {...providedDrag.draggableProps}
                              {...providedDrag.dragHandleProps}
                              className="card p-3 mb-2 shadow-sm"
                              style={{
                                ...providedDrag.draggableProps.style,
                                width: "100%",
                                borderTop: `4px solid ${
                                  stage.value === "joined" ? "#03C95A" : stage.value === "rejected" ? "#E70D0D" : "var(--hrms-accent)"
                                }`,
                                opacity: snapshotDrag.isDragging ? 0.9 : 1,
                                transform: snapshotDrag.isDragging ? "rotate(2deg)" : "none"
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <h6 className="mb-0 fw-semibold text-dark text-truncate" style={{ maxWidth: "160px" }}>
                                  {cand.full_name || `${cand.first_name} ${cand.last_name || ""}`}
                                </h6>
                                <span className="badge bg-light text-muted small">{cand.score ?? 0}/100</span>
                              </div>

                              <p className="text-muted small mb-2 text-truncate" style={{ fontSize: "12px" }}>
                                {cand.job?.title || "Unassigned"}
                              </p>

                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <span className="small text-muted" style={{ fontSize: "11px" }}>
                                  {cand.location || "No Location"}
                                </span>
                                {cand.notice_period_days ? (
                                  <span className="badge bg-warning-transparent text-warning" style={{ fontSize: "10px" }}>
                                    NP: {cand.notice_period_days}d
                                  </span>
                                ) : null}
                              </div>

                              <div className="d-flex justify-content-between align-items-center border-top pt-2">
                                <div className="d-flex gap-1">
                                  {cand.contact_actions?.email && (
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline-secondary p-1 d-flex align-items-center justify-content-center"
                                      onClick={() => handleContact(cand, "email", refresh)}
                                      title="Email Candidate"
                                      style={{ width: "24px", height: "24px" }}
                                    >
                                      <i className="ti ti-mail" />
                                    </button>
                                  )}
                                  {cand.contact_actions?.whatsapp && (
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline-secondary p-1 d-flex align-items-center justify-content-center"
                                      onClick={() => handleContact(cand, "whatsapp", refresh)}
                                      title="WhatsApp Candidate"
                                      style={{ width: "24px", height: "24px" }}
                                    >
                                      <i className="ti ti-brand-whatsapp" />
                                    </button>
                                  )}
                                  <Link
                                    to={`${all_routes.recruitmentInterviews}?candidate=${cand.id}`}
                                    className="btn btn-xs btn-light p-1 d-flex align-items-center justify-content-center"
                                    title="Interview Trail"
                                    style={{ width: "24px", height: "24px" }}
                                  >
                                    <i className="ti ti-calendar" />
                                  </Link>
                                </div>

                                {!stakeholderView && (
                                  <div className="d-flex gap-1">
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-light p-1 d-flex align-items-center justify-content-center"
                                      onClick={() => openEdit(cand)}
                                      title="Edit Candidate"
                                      style={{ width: "24px", height: "24px" }}
                                    >
                                      <i className="ti ti-edit" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline-danger p-1 d-flex align-items-center justify-content-center"
                                      onClick={() => deleteRecord(cand.id)}
                                      title="Delete Candidate"
                                      style={{ width: "24px", height: "24px" }}
                                    >
                                      <i className="ti ti-trash" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

interface CandidatesPageProps {
  variant?: "table" | "cards" | "kanban";
}

const CandidatesPage: React.FC<CandidatesPageProps> = ({ variant = "table" }) => {
  const { role } = useAuth();
  const stakeholderView = role === "stakeholder";

  return (
    <CrudOpsWorkspace
      endpoint="/recruitment/candidates/"
      title="Candidates"
      subtitle="Track applicant flow with richer profiles, recruiter ownership, timeline-ready stages, and direct contact handoffs for HR and stakeholders."
      kicker="Talent Pipeline"
      buttonLabel="Add Candidate"
      searchPlaceholder="Smart search candidate, role, source, recruiter"
      emptyTitle="No candidates yet"
      emptyDescription="Start capturing candidate movement from applied through offer and joining."
      fields={fields}
      filters={[
        { name: "stage", label: "Stage", accessor: "stage", options: STAGE_OPTIONS },
        { name: "job", label: "Job", accessor: "job.id", optionsKey: "jobOptions" },
      ]}
      columns={columns}
      variant={variant === "kanban" ? "cards" : variant} // Table/Grid maps to variant. Kanban hides layout.
      hideDefaultLayout={variant === "kanban"}
      allowCreate={!stakeholderView}
      allowEdit={!stakeholderView}
      canDelete={!stakeholderView}
      extraRowActions={(record: any, context: any) => (
        <>
          {record.contact_actions?.email ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleContact(record, "email", context.refresh)}>
              Email
            </button>
          ) : null}
          {record.contact_actions?.whatsapp ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleContact(record, "whatsapp", context.refresh)}>
              WhatsApp
            </button>
          ) : null}
          <Link to={`${all_routes.recruitmentInterviews}?candidate=${record.id}`} className="btn btn-sm btn-light">
            Interviews
          </Link>
          {record.resume_url ? (
            <a href={record.resume_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-light">
              Resume
            </a>
          ) : null}
        </>
      )}
      defaultForm={{
        job_id: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        whatsapp: "",
        location: "",
        source: "",
        application_source: "internal",
        stage: "applied",
        score: 0,
        notice_period_days: 0,
        owner_name: "",
        current_company: "",
        current_title: "",
        linkedin_url: "",
        portfolio_url: "",
        resume_url: "",
        applied_on: "",
        summary: "",
      }}
      loadDependencies={async () => ({ jobOptions: await fetchJobOptions() })}
      statsBuilder={(records: any[]) => {
        const active = records.filter((item) => !["rejected", "joined"].includes(item.stage)).length;
        const offers = records.filter((item) => item.stage === "offer").length;
        const avgScore = records.length ? Math.round(records.reduce((sum, item) => sum + Number(item.score || 0), 0) / records.length) : 0;
        return [
          { label: "Candidates", value: records.length, meta: "Tracked applicants" },
          { label: "Active Pipeline", value: active, meta: `${offers} in offer stage` },
          { label: "Average Score", value: `${avgScore}/100`, meta: "Fit estimate" },
          { label: "Interview Ready", value: records.filter((item) => Number(item.interview_snapshot?.count || 0) > 0).length, meta: "Profiles with round history" },
          { label: "Contact Ready", value: records.filter((item) => item.contact_actions?.email || item.contact_actions?.whatsapp).length, meta: "Email or WhatsApp available" },
        ];
      }}
      highlightsBuilder={(records: any[]) =>
        records.slice(0, 5).map((item) => ({
          label: item.full_name || `${item.first_name} ${item.last_name || ""}`,
          meta: `${item.job?.title || "Unassigned"} · ${item.owner_name || "Unowned"}`,
          value: item.stage,
          tone: item.stage === "joined" ? "success" : item.stage === "rejected" ? "danger" : "warning",
        }))
      }
    >
      {({ filteredRecords, dependencies, refresh, openEdit, deleteRecord }: any) => (
        <KanbanBoard
          filteredRecords={filteredRecords}
          dependencies={dependencies}
          refresh={refresh}
          openEdit={openEdit}
          deleteRecord={deleteRecord}
          stakeholderView={stakeholderView}
        />
      )}
    </CrudOpsWorkspace>
  );
};

export default CandidatesPage;
