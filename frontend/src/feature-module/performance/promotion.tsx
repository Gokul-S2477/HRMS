import React from "react";
import MovementWorkspace from "./MovementWorkspace";

const Promotion: React.FC = () => (
  <MovementWorkspace
    mode="promotion"
    resource="/data/promotions/"
    title="Promotion"
    subtitle="A stronger promotion tracker for growth planning, designation changes, and pay-impact visibility across the organization."
  />
);

export default Promotion;
