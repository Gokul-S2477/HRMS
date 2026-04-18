import React from "react";
import SalesWorkspace from "../../sales/SalesWorkspace";

const AccountingWorkspace = ({ config }) => (
  <SalesWorkspace
    config={{
      rootLabel: "Finance & Accounts",
      moduleLabel: "Accounting",
      ...config,
    }}
  />
);

export default AccountingWorkspace;
