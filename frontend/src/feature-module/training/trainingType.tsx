import React from "react";
import CatalogWorkspace, { renderStatusBadge, renderDateCell } from "../hrm/CatalogWorkspace";
import { formatDisplayDate } from "../hrm/hrmShared";

const STATUS_OPTIONS = ["active", "completed", "cancelled"];
const TYPE_OPTIONS = ["internal", "external", "online"];

const TrainingType: React.FC = () => (
  <CatalogWorkspace
    resource="training-programs/"
    kicker="Learning & Development"
    title="Training Catalog"
    subtitle="Configure organizational training modules, establish mandatory courses, and track seats, duration, and trainers in one master catalog."
    buttonLabel="Add Training Program"
    emptyIcon="ti ti-school"
    emptyTitle="No courses defined yet"
    emptyDescription="Once training courses are defined, HR can plan sessions, enroll employees, and track qualifications."
    initialForm={{
      title: "",
      description: "",
      trainer_name: "",
      training_type: "internal",
      start_date: "",
      end_date: "",
      duration_hours: "8",
      venue: "Main Conference Hall",
      cost_per_head: "0",
      max_seats: "25",
      status: "active",
      skills_covered: "",
      is_mandatory: false,
    }}
    fields={[
      { name: "title", label: "Program Title", placeholder: "React Native & Mobile Dev Essentials", required: true },
      { name: "trainer_name", label: "Trainer Name", placeholder: "Professor John Doe", required: true },
      { name: "training_type", label: "Delivery Format", type: "select", options: TYPE_OPTIONS },
      { name: "status", label: "Program Status", type: "select", options: STATUS_OPTIONS },
      { name: "start_date", label: "Start Date", type: "date", required: true },
      { name: "end_date", label: "End Date", type: "date", required: true },
      { name: "duration_hours", label: "Duration (Hours)", type: "number", placeholder: "8" },
      { name: "max_seats", label: "Max Seats", type: "number", placeholder: "25" },
      { name: "cost_per_head", label: "Cost Per Participant (INR)", type: "number", placeholder: "0" },
      { name: "venue", label: "Venue / Online Link", placeholder: "Main Office Hall" },
      { name: "skills_covered", label: "Skills Covered (comma separated)", placeholder: "React, Mobile App Dev" },
      { name: "is_mandatory", label: "Mandatory for all department staff?", type: "checkbox" },
      { name: "description", label: "Description / Course Agenda", type: "textarea", placeholder: "Outline the key learnings, prerequisites, and evaluation structure...", colClass: "col-12" },
    ]}
    filterOptions={[
      { name: "status", label: "All statuses", options: STATUS_OPTIONS },
      { name: "training_type", label: "All formats", options: TYPE_OPTIONS },
    ]}
    dateField="start_date"
    searchPlaceholder="Search catalog title, trainer, skills..."
    quickFilters={[
      { key: "mandatory", label: "Mandatory only", predicate: (record: any) => record.data?.is_mandatory === true },
      { key: "online", label: "Online format", predicate: (record: any) => record.data?.training_type === "online" },
    ]}
    columns={[
      {
        key: "title",
        label: "Program Title",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.title || "-"}</div>
            <div className="payroll-secondary-text text-capitalize">
              {record.data?.training_type || "internal"} • {record.data?.duration_hours || "0"} hrs
            </div>
          </div>
        ),
      },
      {
        key: "trainer_name",
        label: "Trainer & Venue",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.trainer_name || "-"}</div>
            <div className="payroll-secondary-text">{record.data?.venue || "TBD"}</div>
          </div>
        ),
      },
      {
        key: "duration",
        label: "Timeline & Seats",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">
              {record.data?.start_date ? formatDisplayDate(record.data.start_date) : "-"}
            </div>
            <div className="payroll-secondary-text">Limit: {record.data?.max_seats || "unlimited"} seats</div>
          </div>
        ),
      },
      {
        key: "mandatory",
        label: "Mandatory?",
        render: (record: any) => (
          <span className={`badge bg-${record.data?.is_mandatory ? "danger" : "light"}-light text-${record.data?.is_mandatory ? "danger" : "secondary"} px-2 py-1`}>
            {record.data?.is_mandatory ? "Yes" : "No"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (record: any) => (
          <span className={`badge bg-${record.data?.status === "active" ? "success" : "secondary"}-light text-${record.data?.status === "active" ? "success" : "secondary"} px-3 py-2 text-capitalize`}>
            {record.data?.status || "active"}
          </span>
        ),
      },
    ]}
    getStats={(records: any[]) => [
      { label: "Total Courses", value: records.length, meta: "Defined programs in catalog" },
      { label: "Active", value: records.filter((record) => record.data?.status === "active").length, meta: "Scheduling active" },
      { label: "Mandatory", value: records.filter((record) => record.data?.is_mandatory === true).length, meta: "Company-wide requirements" },
      {
        label: "Total Classroom Hours",
        value: records.reduce((sum, record) => sum + Number(record.data?.duration_hours || 0), 0),
        meta: "Combined catalog duration",
      },
    ]}
    getHighlights={(records: any[]) =>
      records.slice(0, 5).map((record) => ({
        label: record.data?.title || "Training",
        meta: record.data?.trainer_name || "Trainer pending",
        value: record.data?.status || "active",
        tone: record.data?.status === "active" ? "success" : "warning",
      }))
    }
    preparePayload={(form: any) => ({
      ...form,
      title: form.title.trim(),
      trainer_name: form.trainer_name.trim(),
      description: form.description.trim(),
      skills_covered: form.skills_covered.trim(),
      is_mandatory: Boolean(form.is_mandatory),
    })}
  />
);

export default TrainingType;
