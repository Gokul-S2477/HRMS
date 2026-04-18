import React from "react";

import CrudOpsWorkspace from "./CrudOpsWorkspace";

const tasksToText = (tasks) =>
  (tasks || [])
    .map((task) => `${task.title || task.name || "Task"}|${task.task_type || "general"}|${task.sort_order || ""}`)
    .join("\n");

const textToTasks = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line, index) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, taskType, sortOrder] = line.split("|");
      return {
        title: (title || "Task").trim(),
        task_type: (taskType || "general").trim(),
        sort_order: Number(sortOrder) || (index + 1) * 10,
      };
    });

const OnboardingTemplatesPage = () => (
  <CrudOpsWorkspace
    endpoint="/onboarding/templates/"
    title="Onboarding Templates"
    subtitle="Package repeatable induction checklists for departments, roles, and pre-joining workflows so every new hire lands cleanly."
    kicker="Onboarding Setup"
    buttonLabel="Add Template"
    searchPlaceholder="Smart search template, department, role"
    emptyTitle="No onboarding templates yet"
    emptyDescription="Create a reusable playbook so IT, HR, payroll, and managers all know what gets completed for each new joiner."
    fields={[
      { name: "name", label: "Template Name", required: true },
      { name: "department_name", label: "Department" },
      { name: "role_name", label: "Role" },
      { name: "is_active", label: "Status", type: "select", options: [
        { value: true, label: "Active" },
        { value: false, label: "Inactive" },
      ] },
      { name: "description", label: "Description", type: "textarea", colClass: "col-12" },
      { name: "tasks_text", label: "Tasks", type: "textarea", colClass: "col-12", rows: 8, placeholder: "Welcome call|hr|10\nProvision laptop|it|20\nCollect documents|documents|30" },
    ]}
    filters={[
      { name: "is_active", label: "Status", accessor: "is_active", options: [
        { value: true, label: "Active" },
        { value: false, label: "Inactive" },
      ] },
    ]}
    columns={[
      { label: "Template", render: (record) => <div><div className="fw-semibold">{record.name}</div><div className="text-muted small">{record.department_name || "All departments"}</div></div> },
      { label: "Role", render: (record) => record.role_name || "General" },
      { label: "Tasks", render: (record) => `${record.task_count || (record.tasks || []).length} task(s)` },
      { label: "Status", render: (record) => <span className={`payroll-badge ${record.is_active ? "success" : "danger"}`}>{record.is_active ? "Active" : "Inactive"}</span> },
    ]}
    defaultForm={{
      name: "",
      department_name: "",
      role_name: "",
      description: "",
      tasks_text: "",
      is_active: true,
    }}
    normalizeForm={(record) => ({
      name: record.name || "",
      department_name: record.department_name || "",
      role_name: record.role_name || "",
      description: record.description || "",
      tasks_text: tasksToText(record.tasks),
      is_active: Boolean(record.is_active),
    })}
    buildPayload={(form) => ({
      name: form.name,
      department_name: form.department_name,
      role_name: form.role_name,
      description: form.description,
      is_active: String(form.is_active) === "true" || form.is_active === true,
      tasks: textToTasks(form.tasks_text),
    })}
    statsBuilder={(records) => [
      { label: "Templates", value: records.length, meta: "Reusable onboarding playbooks" },
      { label: "Active", value: records.filter((item) => item.is_active).length, meta: "Ready to assign" },
      { label: "Average Tasks", value: records.length ? Math.round(records.reduce((sum, item) => sum + (item.task_count || (item.tasks || []).length || 0), 0) / records.length) : 0, meta: "Per template" },
      { label: "Departments", value: new Set(records.map((item) => item.department_name).filter(Boolean)).size, meta: "Covered teams" },
    ]}
  />
);

export default OnboardingTemplatesPage;
