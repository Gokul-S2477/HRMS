import React from "react";
import AttendanceWorkspace from "./AttendanceWorkspace";

const AttendanceEmployee: React.FC = () => (
  <AttendanceWorkspace
    resource="/data/attendance-employee/"
    title="My Attendance Desk"
    subtitle="A self-service attendance workspace with clearer visibility into daily logs, work hours, and follow-ups before payroll closes."
    audienceLabel="Employee"
  />
);

export default AttendanceEmployee;
