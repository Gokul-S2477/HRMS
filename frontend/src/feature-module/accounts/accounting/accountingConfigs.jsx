import React from "react";

const statusBadge = (value, helpers) => (
  <span className={`payroll-badge ${helpers.getStatusTone(value)}`.trim()}>
    <i className="ti ti-point-filled" />
    {value || "-"}
  </span>
);

const primaryCell = (icon, title, subtitle) => (
  <div className="payroll-avatar-block">
    <span className="payroll-avatar-icon">
      <i className={icon} />
    </span>
    <div>
      <div className="payroll-primary-text">{title || "-"}</div>
      <div className="payroll-secondary-text">{subtitle || "-"}</div>
    </div>
  </div>
);

const financePair = (label, value) => (
  <div className="finance-inline-pair">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const uniqueOptions = (values) =>
  Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()))).map((value) => ({
    value,
    label: value,
  }));

const getDependencyRecords = (helpers, key) =>
  Array.isArray(helpers.dependencies?.[key]) ? helpers.dependencies[key] : [];

const getCategoryRecords = (helpers) => getDependencyRecords(helpers, "categories");
const getBudgetRecords = (helpers) => getDependencyRecords(helpers, "budgets");

const getCategoryOptions = (helpers) =>
  uniqueOptions(getCategoryRecords(helpers).map((item) => item.data?.category_name));

const getSubCategoryOptions = ({ form, helpers }) =>
  uniqueOptions(
    getCategoryRecords(helpers)
      .filter((item) => !form.category_name || item.data?.category_name === form.category_name)
      .map((item) => item.data?.sub_category_name)
  );

const getBudgetOptions = (helpers) =>
  getBudgetRecords(helpers).map((item) => ({
    value: item.data?.budget_code,
    label: `${item.data?.budget_code || "BUD"} - ${item.data?.budget_title || "Untitled Budget"}`,
  }));

const findBudgetByCode = (budgetCode, helpers) =>
  getBudgetRecords(helpers).find(
    (item) => String(item.data?.budget_code || "") === String(budgetCode || "")
  );

const computeBudgetStats = (data, helpers) => {
  const allocated = helpers.toNumber(data?.allocated_budget);
  const revenue = helpers.toNumber(data?.total_revenue);
  const expense = helpers.toNumber(data?.total_expense);
  const tax = helpers.toNumber(data?.tax_amount);
  const workingBudget = allocated + revenue;
  const remaining = workingBudget - expense - tax;
  const utilized = workingBudget > 0 ? Math.min(100, Math.round(((expense + tax) / workingBudget) * 100)) : 0;

  return {
    allocated,
    revenue,
    expense,
    tax,
    workingBudget,
    remaining,
    utilized,
  };
};

const progressTone = (value) => {
  if (value >= 95) return "danger";
  if (value >= 75) return "warning";
  return "success";
};

const budgetSummary = (records, helpers) => {
  return records.reduce(
    (summary, record) => {
      const stats = computeBudgetStats(record.data || {}, helpers);
      summary.allocated += stats.allocated;
      summary.revenue += stats.revenue;
      summary.expense += stats.expense;
      summary.tax += stats.tax;
      summary.remaining += stats.remaining;
      if (stats.remaining < 0) summary.atRisk += 1;
      return summary;
    },
    { allocated: 0, revenue: 0, expense: 0, tax: 0, remaining: 0, atRisk: 0 }
  );
};

const syncBudgetTotalsByCode = async (budgetCode, helpers) => {
  if (!budgetCode) return;

  const [budgetsRes, expenseRes, revenueRes] = await Promise.all([
    helpers.api.get("/data/accounting-budgets/"),
    helpers.api.get("/data/accounting-budget-expenses/"),
    helpers.api.get("/data/accounting-budget-revenues/"),
  ]);

  const budgets = helpers.normalize(budgetsRes.data);
  const expenses = helpers.normalize(expenseRes.data);
  const revenues = helpers.normalize(revenueRes.data);

  const budget = budgets.find(
    (item) => String(item.data?.budget_code || "") === String(budgetCode || "")
  );

  if (!budget) return;

  const totalExpense = expenses
    .filter(
      (item) =>
        String(item.data?.budget_code || "") === String(budgetCode || "") &&
        ["Approved", "Paid"].includes(String(item.data?.status || ""))
    )
    .reduce((sum, item) => sum + helpers.toNumber(item.data?.amount), 0);

  const totalRevenue = revenues
    .filter(
      (item) =>
        String(item.data?.budget_code || "") === String(budgetCode || "") &&
        ["Confirmed", "Received"].includes(String(item.data?.status || ""))
    )
    .reduce((sum, item) => sum + helpers.toNumber(item.data?.amount), 0);

  const currentData = budget.data || {};
  const nextData = {
    ...currentData,
    total_expense: totalExpense,
    total_revenue: totalRevenue,
  };

  const stats = computeBudgetStats(nextData, helpers);
  nextData.remaining_amount = stats.remaining;
  nextData.utilization = stats.utilized;

  const currentStatus = String(currentData.status || "").trim();
  if (currentStatus !== "Closed") {
    const startDate = currentData.start_date ? new Date(currentData.start_date) : null;
    const hasFutureStart = startDate && !Number.isNaN(startDate.getTime()) && startDate > new Date();

    if (stats.remaining < 0) {
      nextData.status = "At Risk";
    } else if (hasFutureStart) {
      nextData.status = "Planned";
    } else {
      nextData.status = "Active";
    }
  }

  await helpers.api.put(`/data/accounting-budgets/${budget.id}/`, {
    data: nextData,
  });
};

const syncBudgetCodes = async (codes, helpers) => {
  const uniqueCodes = Array.from(new Set((codes || []).filter(Boolean)));
  await Promise.all(uniqueCodes.map((budgetCode) => syncBudgetTotalsByCode(budgetCode, helpers)));
};

const loadCategoryDependencies = async ({ api, normalize }) => {
  const categoriesRes = await api.get("/data/accounting-categories/");
  return { categories: normalize(categoriesRes.data) };
};

const loadBudgetDependencies = async ({ api, normalize }) => {
  const [categoriesRes, budgetsRes] = await Promise.all([
    api.get("/data/accounting-categories/"),
    api.get("/data/accounting-budgets/"),
  ]);

  return {
    categories: normalize(categoriesRes.data),
    budgets: normalize(budgetsRes.data),
  };
};

export const categoriesConfig = {
  resourceType: "accounting-categories",
  title: "Categories",
  kicker: "Spend Taxonomy",
  kickerIcon: "ti ti-category-plus",
  subtitle:
    "Structure the accounting tree with budget owners, review cycles, and category guardrails that keep spending clean.",
  primaryActionLabel: "Add Category",
  tableTitle: "Accounting Categories",
  tableSubtitle: "Category definitions used by budgets, expenses, and revenue planning.",
  codeField: "category_code",
  codePrefix: "CAT",
  amountField: "monthly_limit",
  statusField: "status",
  duplicateStatus: "Review",
  searchFields: ["category_code", "category_name", "sub_category_name", "owner", "department"],
  statusOptions: ["Active", "Review", "Archived"],
  fields: [
    {
      name: "category_code",
      label: "Category Code",
      required: true,
      readOnlyOnEdit: true,
      placeholder: "Auto generated",
    },
    { name: "category_name", label: "Category Name", required: true, placeholder: "Technology" },
    { name: "sub_category_name", label: "Subcategory", required: true, placeholder: "Cloud Infrastructure" },
    {
      name: "department",
      label: "Department",
      type: "select",
      required: true,
      options: ["Finance", "Operations", "Engineering", "People", "Sales"],
    },
    { name: "owner", label: "Budget Owner", required: true, placeholder: "Asha Kumar" },
    {
      name: "budget_type",
      label: "Budget Type",
      type: "select",
      required: true,
      options: ["Operating", "Capital", "Project", "Compliance"],
    },
    {
      name: "monthly_limit",
      label: "Monthly Limit",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
      hint: "Used as the planning threshold for category-level review.",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Active", "Review", "Archived"],
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Guidance, approval notes, and intended use",
    },
  ],
  getSummaryCards: (records, filtered, helpers) => {
    const activeCount = records.filter((record) => String(record.data?.status || "") === "Active").length;
    const reviewCount = records.filter((record) => String(record.data?.status || "") === "Review").length;
    const monthlyCapacity = records.reduce(
      (sum, record) => sum + helpers.toNumber(record.data?.monthly_limit),
      0
    );
    const departments = new Set(records.map((record) => record.data?.department).filter(Boolean)).size;

    return [
      { label: "Active Categories", value: activeCount, meta: `${filtered.length} visible in the current view` },
      { label: "Monthly Capacity", value: helpers.formatAmount(monthlyCapacity), meta: "Combined monthly planning threshold" },
      { label: "Departments Covered", value: departments, meta: "Distinct ownership lanes" },
      { label: "Needs Review", value: reviewCount, meta: "Categories waiting for finance validation" },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Monthly Limit",
    highlightValue: helpers.formatAmount(form.monthly_limit),
    rows: [
      { label: "Code", value: form.category_code || "-" },
      { label: "Department", value: form.department || "-" },
      { label: "Owner", value: form.owner || "-" },
      { label: "Coverage", value: `${form.category_name || "-"} / ${form.sub_category_name || "-"}` },
    ],
    note: "These categories feed the budget, expense, and revenue planning forms automatically.",
  }),
  columns: [
    {
      label: "Category",
      render: (data) => primaryCell("ti ti-category", data.category_name, data.sub_category_name),
    },
    {
      label: "Ownership",
      render: (data) => (
        <div className="finance-stack-list">
          {financePair("Department", data.department || "-")}
          {financePair("Owner", data.owner || "-")}
        </div>
      ),
    },
    {
      label: "Budget Guardrail",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          {financePair("Type", data.budget_type || "-")}
          {financePair("Limit", helpers.formatAmount(data.monthly_limit))}
        </div>
      ),
    },
    {
      label: "Status",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          <div>{statusBadge(data.status, helpers)}</div>
          <span className="payroll-secondary-text">{data.category_code || "-"}</span>
        </div>
      ),
    },
    {
      label: "Notes",
      render: (data) => <span className="finance-clamp-text">{data.description || "No category note added"}</span>,
    },
  ],
  getRowActions: (record) => {
    const status = String(record.data?.status || "");
    return [
      status === "Archived"
        ? {
            label: "Activate",
            icon: "ti ti-rotate-clockwise-2",
            variant: "btn-primary",
            successMessage: "Category activated",
            onClick: async (currentRecord, helpers) => {
              await helpers.api.put(`/data/accounting-categories/${currentRecord.id}/`, {
                data: { ...(currentRecord.data || {}), status: "Active" },
              });
            },
          }
        : {
            label: "Archive",
            icon: "ti ti-archive",
            variant: "btn-white",
            successMessage: "Category archived",
            onClick: async (currentRecord, helpers) => {
              await helpers.api.put(`/data/accounting-categories/${currentRecord.id}/`, {
                data: { ...(currentRecord.data || {}), status: "Archived" },
              });
            },
          },
    ];
  },
};

export const budgetsConfig = {
  resourceType: "accounting-budgets",
  title: "Budgets",
  kicker: "Budget Control Center",
  kickerIcon: "ti ti-report-money",
  subtitle:
    "Plan allocation windows, track live utilization, and keep every budget tied to the right accounting category.",
  primaryActionLabel: "Add Budget",
  tableTitle: "Budget Register",
  tableSubtitle: "Monitor allocation, recovery, burn rate, and operating balance from one ledger.",
  codeField: "budget_code",
  codePrefix: "BUD",
  amountField: "allocated_budget",
  statusField: "status",
  duplicateStatus: "Planned",
  searchFields: ["budget_code", "budget_title", "category_name", "owner"],
  statusOptions: ["Planned", "Active", "At Risk", "Closed"],
  loadDependencies: loadCategoryDependencies,
  fields: [
    {
      name: "budget_code",
      label: "Budget Code",
      required: true,
      readOnlyOnEdit: true,
      placeholder: "Auto generated",
    },
    { name: "budget_title", label: "Budget Title", required: true, placeholder: "FY26 Engineering Ops" },
    {
      name: "budget_type",
      label: "Budget Type",
      type: "select",
      required: true,
      options: ["Category", "Department", "Project", "Compliance"],
    },
    {
      name: "category_name",
      label: "Category",
      type: "select",
      required: true,
      options: ({ helpers }) => getCategoryOptions(helpers),
      placeholder: "Select category",
    },
    { name: "owner", label: "Budget Owner", required: true, placeholder: "Ravi Patel" },
    { name: "start_date", label: "Start Date", type: "date", required: true },
    { name: "end_date", label: "End Date", type: "date", required: true },
    {
      name: "allocated_budget",
      label: "Allocated Budget",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
    },
    {
      name: "total_revenue",
      label: "Recovered Revenue",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
      hint: "Auto-syncs from linked budget revenues when those records are confirmed or received.",
    },
    {
      name: "total_expense",
      label: "Committed Expense",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
      hint: "Auto-syncs from linked budget expenses when those records are approved or paid.",
    },
    {
      name: "tax_amount",
      label: "Tax Reserve",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Planned", "Active", "At Risk", "Closed"],
    },
    {
      name: "description",
      label: "Notes",
      type: "textarea",
      placeholder: "Operating assumptions, approvals, and spend guardrails",
    },
  ],
  preparePayload: ({ payload, helpers }) => {
    const stats = computeBudgetStats(payload, helpers);
    return {
      ...payload,
      total_revenue: helpers.toNumber(payload.total_revenue),
      total_expense: helpers.toNumber(payload.total_expense),
      tax_amount: helpers.toNumber(payload.tax_amount),
      remaining_amount: stats.remaining,
      utilization: stats.utilized,
    };
  },
  getSummaryCards: (records, filtered, helpers) => {
    const summary = budgetSummary(records, helpers);
    return [
      { label: "Allocated Budget", value: helpers.formatAmount(summary.allocated), meta: `${records.length} live budget records` },
      { label: "Recovered Revenue", value: helpers.formatAmount(summary.revenue), meta: "Confirmed + received revenue" },
      { label: "Committed Expense", value: helpers.formatAmount(summary.expense + summary.tax), meta: "Expenses plus tax reserve" },
      { label: "At Risk", value: summary.atRisk, meta: `${filtered.length} budgets visible after filters` },
    ];
  },
  getPreview: (form, helpers) => {
    const stats = computeBudgetStats(form, helpers);
    return {
      highlightLabel: "Available Balance",
      highlightValue: helpers.formatAmount(stats.remaining),
      rows: [
        { label: "Budget Code", value: form.budget_code || "-" },
        { label: "Category", value: form.category_name || "-" },
        { label: "Owner", value: form.owner || "-" },
        { label: "Utilization", value: `${stats.utilized}%` },
      ],
      note: "Linked expenses and revenues keep the budget totals current without manual reconciliation.",
    };
  },
  columns: [
    {
      label: "Budget",
      render: (data) => primaryCell("ti ti-wallet", data.budget_title, data.budget_code),
    },
    {
      label: "Window",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          {financePair("Category", data.category_name || "-")}
          {financePair("Timeline", `${helpers.formatDate(data.start_date)} - ${helpers.formatDate(data.end_date)}`)}
        </div>
      ),
    },
    {
      label: "Performance",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          {financePair("Allocated", helpers.formatAmount(data.allocated_budget))}
          {financePair("Revenue", helpers.formatAmount(data.total_revenue))}
          {financePair("Expense", helpers.formatAmount(data.total_expense))}
          {financePair("Tax", helpers.formatAmount(data.tax_amount))}
        </div>
      ),
    },
    {
      label: "Balance",
      render: (data, record, helpers) => {
        const stats = computeBudgetStats(data, helpers);
        const tone = progressTone(stats.utilized);
        return (
          <div className="finance-metric-stack">
            <div className="payroll-primary-text">{helpers.formatAmount(stats.remaining)}</div>
            <div className="finance-progress-track">
              <div className={`finance-progress-bar ${tone}`} style={{ width: `${Math.max(stats.utilized, 6)}%` }} />
            </div>
            <div className="payroll-secondary-text">{stats.utilized}% utilized</div>
          </div>
        );
      },
    },
    {
      label: "Status",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          <div>{statusBadge(data.status, helpers)}</div>
          <span className="payroll-secondary-text">{data.owner || "-"}</span>
        </div>
      ),
    },
  ],
  getRowActions: (record) => {
    const status = String(record.data?.status || "");
    return [
      status === "Closed"
        ? {
            label: "Reopen",
            icon: "ti ti-lock-open-2",
            variant: "btn-primary",
            successMessage: "Budget reopened",
            onClick: async (currentRecord, helpers) => {
              await helpers.api.put(`/data/accounting-budgets/${currentRecord.id}/`, {
                data: { ...(currentRecord.data || {}), status: "Active" },
              });
            },
          }
        : {
            label: "Close",
            icon: "ti ti-lock-check",
            variant: "btn-white",
            successMessage: "Budget closed",
            onClick: async (currentRecord, helpers) => {
              await helpers.api.put(`/data/accounting-budgets/${currentRecord.id}/`, {
                data: { ...(currentRecord.data || {}), status: "Closed" },
              });
            },
          },
    ];
  },
};

export const budgetExpensesConfig = {
  resourceType: "accounting-budget-expenses",
  title: "Budget Expenses",
  kicker: "Expense Governance",
  kickerIcon: "ti ti-receipt-tax",
  subtitle:
    "Capture committed spend against each budget, approve it cleanly, and keep utilization updated without manual edits.",
  primaryActionLabel: "Add Expense",
  tableTitle: "Budget Expense Register",
  tableSubtitle: "Every approved or paid expense rolls up into the linked budget automatically.",
  codeField: "expense_code",
  codePrefix: "BEX",
  amountField: "amount",
  statusField: "status",
  duplicateStatus: "Draft",
  searchFields: ["expense_code", "expense_name", "budget_title", "vendor_name", "category_name"],
  statusOptions: ["Draft", "Approved", "Paid", "Rejected"],
  loadDependencies: loadBudgetDependencies,
  fields: [
    {
      name: "expense_code",
      label: "Expense Code",
      required: true,
      readOnlyOnEdit: true,
      placeholder: "Auto generated",
    },
    { name: "expense_name", label: "Expense Name", required: true, placeholder: "AWS Renewal" },
    {
      name: "budget_code",
      label: "Linked Budget",
      type: "select",
      required: true,
      options: ({ helpers }) => getBudgetOptions(helpers),
    },
    {
      name: "category_name",
      label: "Category",
      type: "select",
      required: true,
      options: ({ helpers }) => getCategoryOptions(helpers),
    },
    {
      name: "sub_category_name",
      label: "Subcategory",
      type: "select",
      required: true,
      options: ({ form, helpers }) => getSubCategoryOptions({ form, helpers }),
    },
    { name: "vendor_name", label: "Vendor", required: true, placeholder: "Amazon Web Services" },
    {
      name: "amount",
      label: "Amount",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
    },
    { name: "expense_date", label: "Expense Date", type: "date", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Draft", "Approved", "Paid", "Rejected"],
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      placeholder: "Approval context, invoice reference, or reason code",
    },
  ],
  preparePayload: ({ payload, helpers }) => {
    const budget = findBudgetByCode(payload.budget_code, helpers);
    return {
      ...payload,
      amount: helpers.toNumber(payload.amount),
      budget_title: budget?.data?.budget_title || payload.budget_title || "",
    };
  },
  afterSave: async ({ payload, record, helpers }) => {
    await syncBudgetCodes([record?.data?.budget_code, payload.budget_code], helpers);
  },
  afterDelete: async ({ record, helpers }) => {
    await syncBudgetCodes([record?.data?.budget_code], helpers);
  },
  getSummaryCards: (records, filtered, helpers) => {
    const total = records.reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const approved = records
      .filter((record) => ["Approved", "Paid"].includes(String(record.data?.status || "")))
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const pending = records.filter((record) => String(record.data?.status || "") === "Draft").length;
    const largest = records.reduce(
      (max, record) => Math.max(max, helpers.toNumber(record.data?.amount)),
      0
    );

    return [
      { label: "Total Expense Logged", value: helpers.formatAmount(total), meta: `${records.length} expense records` },
      { label: "Approved Spend", value: helpers.formatAmount(approved), meta: "Approved + paid budget impact" },
      { label: "Pending Approval", value: pending, meta: `${filtered.length} records in the current result set` },
      { label: "Largest Expense", value: helpers.formatAmount(largest), meta: "Highest single transaction" },
    ];
  },
  getPreview: (form, helpers) => {
    const budget = findBudgetByCode(form.budget_code, helpers);
    return {
      highlightLabel: "Expense Amount",
      highlightValue: helpers.formatAmount(form.amount),
      rows: [
        { label: "Expense Code", value: form.expense_code || "-" },
        { label: "Budget", value: budget?.data?.budget_title || "-" },
        { label: "Vendor", value: form.vendor_name || "-" },
        { label: "Status", value: form.status || "-" },
      ],
      note: "Saving an approved or paid expense updates the linked budget totals automatically.",
    };
  },
  columns: [
    {
      label: "Expense",
      render: (data) => primaryCell("ti ti-receipt-2", data.expense_name, data.expense_code),
    },
    {
      label: "Budget",
      render: (data) => (
        <div className="finance-stack-list">
          {financePair("Budget", data.budget_title || "-")}
          {financePair("Code", data.budget_code || "-")}
        </div>
      ),
    },
    {
      label: "Category",
      render: (data) => (
        <div className="finance-stack-list">
          {financePair("Category", data.category_name || "-")}
          {financePair("Subcategory", data.sub_category_name || "-")}
        </div>
      ),
    },
    {
      label: "Amount",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          <span className="payroll-primary-text">{helpers.formatAmount(data.amount)}</span>
          <span className="payroll-secondary-text">{helpers.formatDate(data.expense_date)}</span>
        </div>
      ),
    },
    {
      label: "Status",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          <div>{statusBadge(data.status, helpers)}</div>
          <span className="payroll-secondary-text">{data.vendor_name || "-"}</span>
        </div>
      ),
    },
    {
      label: "Notes",
      render: (data) => <span className="finance-clamp-text">{data.notes || "No supporting note added"}</span>,
    },
  ],
};

export const budgetRevenuesConfig = {
  resourceType: "accounting-budget-revenues",
  title: "Budget Revenues",
  kicker: "Recovery & Forecast",
  kickerIcon: "ti ti-chart-donut-2",
  subtitle:
    "Track recoveries and forecasted inflows against budgets so finance can see how much runway each plan really has.",
  primaryActionLabel: "Add Revenue",
  tableTitle: "Budget Revenue Register",
  tableSubtitle: "Confirmed and received revenue rolls into the linked budget in real time.",
  codeField: "revenue_code",
  codePrefix: "BRE",
  amountField: "amount",
  statusField: "status",
  duplicateStatus: "Forecast",
  searchFields: ["revenue_code", "revenue_name", "budget_title", "client_name", "category_name"],
  statusOptions: ["Forecast", "Confirmed", "Received", "Cancelled"],
  loadDependencies: loadBudgetDependencies,
  fields: [
    {
      name: "revenue_code",
      label: "Revenue Code",
      required: true,
      readOnlyOnEdit: true,
      placeholder: "Auto generated",
    },
    { name: "revenue_name", label: "Revenue Name", required: true, placeholder: "Quarterly Support Recovery" },
    {
      name: "budget_code",
      label: "Linked Budget",
      type: "select",
      required: true,
      options: ({ helpers }) => getBudgetOptions(helpers),
    },
    {
      name: "category_name",
      label: "Category",
      type: "select",
      required: true,
      options: ({ helpers }) => getCategoryOptions(helpers),
    },
    {
      name: "sub_category_name",
      label: "Subcategory",
      type: "select",
      required: true,
      options: ({ form, helpers }) => getSubCategoryOptions({ form, helpers }),
    },
    { name: "client_name", label: "Client / Source", required: true, placeholder: "Acme Health" },
    {
      name: "amount",
      label: "Amount",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
    },
    { name: "revenue_date", label: "Revenue Date", type: "date", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Forecast", "Confirmed", "Received", "Cancelled"],
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      placeholder: "Collection milestone, source note, or billing reference",
    },
  ],
  preparePayload: ({ payload, helpers }) => {
    const budget = findBudgetByCode(payload.budget_code, helpers);
    return {
      ...payload,
      amount: helpers.toNumber(payload.amount),
      budget_title: budget?.data?.budget_title || payload.budget_title || "",
    };
  },
  afterSave: async ({ payload, record, helpers }) => {
    await syncBudgetCodes([record?.data?.budget_code, payload.budget_code], helpers);
  },
  afterDelete: async ({ record, helpers }) => {
    await syncBudgetCodes([record?.data?.budget_code], helpers);
  },
  getSummaryCards: (records, filtered, helpers) => {
    const total = records.reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const realized = records
      .filter((record) => String(record.data?.status || "") === "Received")
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const forecast = records
      .filter((record) => ["Forecast", "Confirmed"].includes(String(record.data?.status || "")))
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const collections = records.filter((record) => String(record.data?.status || "") === "Received").length;

    return [
      { label: "Revenue Logged", value: helpers.formatAmount(total), meta: `${records.length} revenue records` },
      { label: "Collected", value: helpers.formatAmount(realized), meta: "Revenue already received" },
      { label: "Pipeline", value: helpers.formatAmount(forecast), meta: "Forecast + confirmed inflows" },
      { label: "Collections", value: collections, meta: `${filtered.length} records visible after filters` },
    ];
  },
  getPreview: (form, helpers) => {
    const budget = findBudgetByCode(form.budget_code, helpers);
    return {
      highlightLabel: "Revenue Amount",
      highlightValue: helpers.formatAmount(form.amount),
      rows: [
        { label: "Revenue Code", value: form.revenue_code || "-" },
        { label: "Budget", value: budget?.data?.budget_title || "-" },
        { label: "Source", value: form.client_name || "-" },
        { label: "Status", value: form.status || "-" },
      ],
      note: "Confirmed and received revenue updates the linked budget recovery total automatically.",
    };
  },
  columns: [
    {
      label: "Revenue",
      render: (data) => primaryCell("ti ti-cash-banknote", data.revenue_name, data.revenue_code),
    },
    {
      label: "Budget",
      render: (data) => (
        <div className="finance-stack-list">
          {financePair("Budget", data.budget_title || "-")}
          {financePair("Code", data.budget_code || "-")}
        </div>
      ),
    },
    {
      label: "Category",
      render: (data) => (
        <div className="finance-stack-list">
          {financePair("Category", data.category_name || "-")}
          {financePair("Subcategory", data.sub_category_name || "-")}
        </div>
      ),
    },
    {
      label: "Amount",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          <span className="payroll-primary-text">{helpers.formatAmount(data.amount)}</span>
          <span className="payroll-secondary-text">{helpers.formatDate(data.revenue_date)}</span>
        </div>
      ),
    },
    {
      label: "Status",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          <div>{statusBadge(data.status, helpers)}</div>
          <span className="payroll-secondary-text">{data.client_name || "-"}</span>
        </div>
      ),
    },
    {
      label: "Notes",
      render: (data) => <span className="finance-clamp-text">{data.notes || "No supporting note added"}</span>,
    },
  ],
};
