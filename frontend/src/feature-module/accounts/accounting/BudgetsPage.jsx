import React from "react";
import AccountingWorkspace from "./AccountingWorkspace";
import { budgetsConfig } from "./accountingConfigs";

const BudgetsPage = () => <AccountingWorkspace config={budgetsConfig} />;

export default BudgetsPage;
