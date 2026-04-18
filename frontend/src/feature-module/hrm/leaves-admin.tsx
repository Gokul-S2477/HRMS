import React from "react";
import LeavesWorkspace from "./LeavesWorkspace";

const LeavesAdmin: React.FC = () => (
  <LeavesWorkspace
    resource="/data/leave-employee/"
    title="Leave Approvals"
    subtitle="An approval desk for HR and stakeholders to review requests, record whether the employee informed before or after the leave date, and keep reviewer attribution on every decision."
    buttonLabel="Review Leave"
    audience="Approval"
    mode="approval"
  />
);

export default LeavesAdmin;
