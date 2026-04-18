import React from "react";
import MovementWorkspace from "./MovementWorkspace";

const Termination: React.FC = () => (
  <MovementWorkspace
    mode="termination"
    resource="/data/terminations/"
    title="Termination"
    subtitle="A compliance-focused termination workspace with settlement tracking, notice dates, and clear case visibility."
  />
);

export default Termination;
