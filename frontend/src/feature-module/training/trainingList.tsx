import React from "react";
import CatalogWorkspace, { renderDateCell, renderStatusBadge } from "../hrm/CatalogWorkspace";

const STATUS_OPTIONS = ["Scheduled", "Running", "Completed", "Cancelled"];
const DELIVERY_OPTIONS = ["Classroom", "Remote", "Hybrid"];

const participantCount = (value?: string) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean).length;

const TrainingList: React.FC = () => (
  <CatalogWorkspace
    resource="/data/training-sessions/"
    kicker="Learning Ops"
    title="Training"
    subtitle="Manage training sessions with cost, participants, delivery mode, and lifecycle status in a cleaner workspace."
    buttonLabel="Add Training"
    emptyIcon="ti ti-users-group"
    emptyTitle="No training sessions scheduled"
    emptyDescription="Once sessions are planned, this board keeps trainers, participants, dates, and costs visible."
    initialForm={{
      training_type: "",
      trainer: "",
      participants: "",
      start_date: "",
      end_date: "",
      description: "",
      cost: "",
      delivery_mode: "Remote",
      status: "Scheduled",
    }}
    fields={[
      { name: "training_type", label: "Training Type", placeholder: "React Essentials", required: true },
      { name: "trainer", label: "Trainer", placeholder: "Anthony Lewis" },
      { name: "participants", label: "Participants", placeholder: "Asha Kumar, David Lin" },
      { name: "delivery_mode", label: "Delivery Mode", type: "select", options: DELIVERY_OPTIONS },
      { name: "start_date", label: "Start Date", type: "date" },
      { name: "end_date", label: "End Date", type: "date" },
      { name: "cost", label: "Cost", type: "number", placeholder: "300" },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
      { name: "description", label: "Description", type: "textarea", placeholder: "Outcome, scope, and delivery plan.", colClass: "col-12" },
    ]}
    filterOptions={[
      { name: "status", label: "All statuses", options: STATUS_OPTIONS },
      { name: "delivery_mode", label: "All delivery modes", options: DELIVERY_OPTIONS },
    ]}
    dateField="start_date"
    searchPlaceholder="Smart search training, trainer, participants"
    quickFilters={[
      { key: "running", label: "Running", predicate: (record: any) => record.data?.status === "Running" },
      { key: "remote", label: "Remote", predicate: (record: any) => record.data?.delivery_mode === "Remote" },
      { key: "high-attendance", label: "3+ participants", predicate: (record: any) => participantCount(record.data?.participants) >= 3 },
    ]}
    columns={[
      {
        key: "training_type",
        label: "Training Type",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.training_type || "-"}</div>
            <div className="payroll-secondary-text">{record.data?.delivery_mode || "Delivery mode pending"}</div>
          </div>
        ),
      },
      {
        key: "trainer",
        label: "Trainer",
        render: (record: any) => (
          <div>
            <div className="payroll-primary-text">{record.data?.trainer || "-"}</div>
            <div className="payroll-secondary-text">
              {participantCount(record.data?.participants)} participants
            </div>
          </div>
        ),
      },
      {
        key: "window",
        label: "Duration",
        render: (record: any) =>
          renderDateCell(record.data?.start_date, `to ${record.data?.end_date ? new Date(record.data.end_date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "-"}`),
      },
      { key: "cost", label: "Cost", render: (record: any) => record.data?.cost ? `$${record.data.cost}` : "-" },
      { key: "status", label: "Status", render: (record: any) => renderStatusBadge(record.data?.status) },
    ]}
    getStats={(records: any[]) => [
      { label: "Sessions", value: records.length, meta: "Training operations at a glance" },
      { label: "Running", value: records.filter((record) => record.data?.status === "Running").length, meta: "Currently live" },
      { label: "Completed", value: records.filter((record) => record.data?.status === "Completed").length, meta: "Ready for follow-up" },
      {
        label: "Participants",
        value: records.reduce((sum, record) => sum + participantCount(record.data?.participants), 0),
        meta: "Total invited or enrolled",
      },
    ]}
    getHighlights={(records: any[]) =>
      records.slice(0, 5).map((record) => ({
        label: record.data?.training_type || "Training",
        meta: record.data?.trainer || "Trainer pending",
        value: record.data?.status || "Scheduled",
        tone: record.data?.status === "Completed" ? "success" : record.data?.status === "Running" ? "info" : "warning",
      }))
    }
    preparePayload={(form: any) => ({
      ...form,
      training_type: form.training_type.trim(),
      trainer: form.trainer.trim(),
      participants: form.participants.trim(),
      description: form.description.trim(),
      cost: form.cost,
    })}
  />
);

export default TrainingList;
