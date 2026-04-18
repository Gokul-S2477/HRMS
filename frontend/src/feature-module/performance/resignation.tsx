import React from "react";
import MovementWorkspace from "./MovementWorkspace";

const Resignation: React.FC = () => (
  <MovementWorkspace
    mode="resignation"
    resource="/data/resignations/"
    title="Resignation"
    subtitle="A more advanced resignation workspace with searchable cases, notice tracking, handover status, and clean audit history."
  />
);

export default Resignation;
