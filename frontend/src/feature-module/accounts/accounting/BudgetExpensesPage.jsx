import React from "react";
import AccountingWorkspace from "./AccountingWorkspace";
import { budgetExpensesConfig } from "./accountingConfigs";

const BudgetExpensesPage = () => <AccountingWorkspace config={budgetExpensesConfig} />;

export default BudgetExpensesPage;
