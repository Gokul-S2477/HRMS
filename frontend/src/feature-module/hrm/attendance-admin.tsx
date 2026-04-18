import React from "react";
import AttendanceWorkspace from "./AttendanceWorkspace";

const AttendanceAdmin: React.FC = () => (
  <AttendanceWorkspace
    resource="/data/attendance-admin/"
    title="Attendance Control"
    subtitle="A richer attendance desk for HR and operations teams with work-hour insights, punctuality tracking, and fast employee filters."
    audienceLabel="Admin"
  />
);

export default AttendanceAdmin;
