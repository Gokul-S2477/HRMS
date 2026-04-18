import React from "react";
import LeavesWorkspace from "./LeavesWorkspace";

const LeavesEmployee: React.FC = () => (
  <LeavesWorkspace
    resource="/data/leave-employee/"
    title="My Leave Requests"
    subtitle="A self-service leave desk where employees can only request leave, then track who reviewed it, whether it was marked pre-informed or post-informed, and what happened next."
    buttonLabel="Request Leave"
    audience="Employee"
    mode="employee"
  />
);

export default LeavesEmployee;
