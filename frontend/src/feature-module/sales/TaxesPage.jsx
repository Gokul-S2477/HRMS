import React from "react";
import SalesWorkspace from "./SalesWorkspace";
import { taxesConfig } from "./salesConfigs";

const TaxesPage = () => <SalesWorkspace config={taxesConfig} />;

export default TaxesPage;
