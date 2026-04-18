import React from "react";
import SalesWorkspace from "./SalesWorkspace";
import { invoicesConfig } from "./salesConfigs";

const InvoicesPage = () => <SalesWorkspace config={invoicesConfig} />;

export default InvoicesPage;
