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

const buildInvoiceLineItems = (data, helpers) => {
  const items = Array.isArray(data?.line_items) && data.line_items.length
    ? data.line_items
    : [
        {
          label: data?.project_name || data?.description || "General Service",
          qty: 1,
          cost: helpers.toNumber(data?.amount),
          discount: 0,
        },
      ];

  return items.map((item) => ({
    label: item.label || "General Service",
    qty: helpers.toNumber(item.qty) || 1,
    cost: helpers.toNumber(item.cost),
    discount: helpers.toNumber(item.discount),
  }));
};

const syncInvoiceByNumber = async (invoiceNumber, helpers) => {
  if (!invoiceNumber) return;

  const [invoiceRes, paymentRes] = await Promise.all([
    helpers.api.get("/data/invoices/"),
    helpers.api.get("/data/payments/"),
  ]);

  const invoices = helpers.normalize(invoiceRes.data);
  const payments = helpers.normalize(paymentRes.data);

  const invoice = invoices.find(
    (item) => String(item.data?.invoice_number || "") === String(invoiceNumber)
  );

  if (!invoice) return;

  const completedPaidAmount = payments
    .filter(
      (payment) =>
        String(payment.data?.invoice_number || "") === String(invoiceNumber) &&
        String(payment.data?.status || "") === "Completed"
    )
    .reduce((sum, payment) => sum + helpers.toNumber(payment.data?.amount), 0);

  const invoiceAmount = helpers.toNumber(invoice.data?.amount);
  const dueDate = invoice.data?.due_date ? new Date(invoice.data.due_date) : null;
  const now = new Date();

  let status = invoice.data?.status || "Sent";
  if (completedPaidAmount >= invoiceAmount && invoiceAmount > 0) {
    status = "Paid";
  } else if (completedPaidAmount > 0) {
    status = "Partially Paid";
  } else if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < now) {
    status = "Overdue";
  } else {
    status = "Sent";
  }

  await helpers.api.put(`/data/invoices/${invoice.id}/`, {
    data: {
      ...invoice.data,
      paid_amount: completedPaidAmount,
      status,
    },
  });
};

export const estimatesConfig = {
  resourceType: "estimates",
  title: "Estimates",
  kicker: "Proposal Pipeline",
  kickerIcon: "ti ti-file-text-ai",
  subtitle:
    "Track quotations from draft to conversion, keep client pricing aligned, and move approved estimates into invoices in one place.",
  primaryActionLabel: "Add Estimate",
  tableTitle: "Estimate Register",
  tableSubtitle: "Manage proposals, due dates, and conversion readiness.",
  codeField: "estimate_number",
  codePrefix: "EST",
  amountField: "amount",
  statusField: "status",
  duplicateStatus: "Draft",
  searchFields: ["estimate_number", "client_name", "project_name", "description"],
  statusOptions: ["Draft", "Sent", "Accepted", "Converted", "Expired"],
  fields: [
    {
      name: "estimate_number",
      label: "Estimate Number",
      required: true,
      readOnlyOnEdit: true,
      placeholder: "Auto generated",
    },
    { name: "client_name", label: "Client Name", required: true, placeholder: "Sara Inc" },
    { name: "project_name", label: "Project Name", required: true, placeholder: "Website Revamp" },
    { name: "issue_date", label: "Issue Date", type: "date", required: true },
    { name: "expiry_date", label: "Expiry Date", type: "date", required: true },
    { name: "amount", label: "Estimated Amount", type: "number", required: true, min: "0", step: "0.01" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Draft", "Sent", "Accepted", "Converted", "Expired"],
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Scope, deliverables, and notes",
    },
  ],
  getSummaryCards: (records, filtered, helpers) => {
    const totalAmount = records.reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const acceptedAmount = records
      .filter((record) => ["Accepted", "Converted"].includes(String(record.data?.status || "")))
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const pendingReview = records.filter((record) => ["Draft", "Sent"].includes(String(record.data?.status || ""))).length;
    const expiringSoon = records.filter((record) => {
      if (!record.data?.expiry_date) return false;
      const expiry = new Date(record.data.expiry_date);
      const diff = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;

    return [
      { label: "Estimate Value", value: helpers.formatAmount(totalAmount), meta: `${records.length} total proposals` },
      { label: "Accepted Value", value: helpers.formatAmount(acceptedAmount), meta: `${filtered.length} currently visible` },
      { label: "Pending Review", value: pendingReview, meta: "Draft and sent estimates" },
      { label: "Expiring Soon", value: expiringSoon, meta: "Due within 7 days" },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Estimated Value",
    highlightValue: helpers.formatAmount(form.amount),
    rows: [
      { label: "Estimate Number", value: form.estimate_number || "-" },
      { label: "Client", value: form.client_name || "-" },
      { label: "Project", value: form.project_name || "-" },
      { label: "Expiry", value: helpers.formatDate(form.expiry_date) },
    ],
    note: "Accepted estimates can be converted into invoices directly from the table.",
  }),
  columns: [
    {
      label: "Estimate",
      render: (data) => primaryCell("ti ti-file-invoice", data.estimate_number, data.client_name),
    },
    {
      label: "Project",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{data.project_name || "-"}</div>
          <div className="payroll-secondary-text">
            Issued {helpers.formatDate(data.issue_date)} | Expires {helpers.formatDate(data.expiry_date)}
          </div>
        </div>
      ),
    },
    {
      label: "Value",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{helpers.formatAmount(data.amount)}</div>
          <div className="mt-2">{statusBadge(data.status, helpers)}</div>
        </div>
      ),
    },
    {
      label: "Description",
      render: (data) => <span className="finance-clamp-text">{data.description || "No scope notes added"}</span>,
    },
  ],
  getRowActions: (record, helpers) => {
    const status = String(record.data?.status || "");
    if (status === "Converted") return [];
    return [
      {
        label: "Convert",
        icon: "ti ti-arrows-transfer-up",
        variant: "btn-primary",
        confirmation: "Convert this estimate into an invoice?",
        successMessage: "Estimate converted into invoice",
        onClick: async (currentRecord, currentHelpers) => {
          const data = currentRecord.data || {};
          const invoicePayload = {
            invoice_number: currentHelpers.createCode("INV"),
            client_name: data.client_name || "Client",
            project_name: data.project_name || "Project",
            issue_date: new Date().toISOString().slice(0, 10),
            due_date: data.expiry_date || new Date().toISOString().slice(0, 10),
            amount: currentHelpers.toNumber(data.amount),
            paid_amount: 0,
            tax_rate: 0,
            status: "Sent",
            email: "",
            phone: "",
            address: "",
            description: data.description || "Converted from estimate",
            notes: "Created from estimate conversion.",
            terms: "Payment due by the invoice due date.",
            line_items: buildInvoiceLineItems(
              {
                project_name: data.project_name,
                description: data.description,
                amount: data.amount,
              },
              currentHelpers
            ),
          };

          await currentHelpers.api.post("/data/invoices/", { data: invoicePayload });
          await currentHelpers.api.put(`${currentHelpers.endpoint}${currentRecord.id}/`, {
            data: {
              ...data,
              status: "Converted",
            },
          });
        },
      },
    ];
  },
};

export const invoicesConfig = {
  resourceType: "invoices",
  title: "Invoices",
  kicker: "Revenue Operations",
  kickerIcon: "ti ti-file-invoice",
  subtitle:
    "Monitor billing, payment collection, and aging risk with invoice actions built into the same workspace.",
  primaryActionLabel: "Add Invoice",
  tableTitle: "Invoice Ledger",
  tableSubtitle: "Track billed value, collected amount, and overdue follow-ups.",
  codeField: "invoice_number",
  codePrefix: "INV",
  amountField: "amount",
  statusField: "status",
  duplicateStatus: "Draft",
  searchFields: ["invoice_number", "client_name", "project_name", "email", "status"],
  statusOptions: ["Draft", "Sent", "Partially Paid", "Paid", "Overdue"],
  fields: [
    { name: "invoice_number", label: "Invoice Number", required: true, readOnlyOnEdit: true },
    { name: "client_name", label: "Client Name", required: true },
    { name: "project_name", label: "Project Name", required: true },
    { name: "issue_date", label: "Issue Date", type: "date", required: true },
    { name: "due_date", label: "Due Date", type: "date", required: true },
    { name: "amount", label: "Invoice Amount", type: "number", required: true, min: "0", step: "0.01" },
    { name: "paid_amount", label: "Paid Amount", type: "number", min: "0", step: "0.01" },
    { name: "tax_rate", label: "Tax Rate (%)", type: "number", min: "0", step: "0.01" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Draft", "Sent", "Partially Paid", "Paid", "Overdue"],
    },
    { name: "email", label: "Client Email", type: "email" },
    { name: "phone", label: "Client Phone" },
    { name: "address", label: "Billing Address", colClass: "col-12" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Invoice summary and services" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Client-facing note" },
    { name: "terms", label: "Terms", type: "textarea", placeholder: "Payment terms" },
  ],
  preparePayload: ({ payload, helpers }) => ({
    ...payload,
    line_items: buildInvoiceLineItems(payload, helpers),
  }),
  getSummaryCards: (records, filtered, helpers) => {
    const billed = records.reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const collected = records.reduce((sum, record) => sum + helpers.toNumber(record.data?.paid_amount), 0);
    const overdueCount = records.filter((record) => String(record.data?.status || "") === "Overdue").length;
    const outstanding = billed - collected;
    return [
      { label: "Billed", value: helpers.formatAmount(billed), meta: `${records.length} invoices` },
      { label: "Collected", value: helpers.formatAmount(collected), meta: "Cash realized" },
      { label: "Outstanding", value: helpers.formatAmount(outstanding), meta: `${filtered.length} visible records` },
      { label: "Overdue", value: overdueCount, meta: "Need follow-up" },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Invoice Amount",
    highlightValue: helpers.formatAmount(form.amount),
    rows: [
      { label: "Invoice Number", value: form.invoice_number || "-" },
      { label: "Client", value: form.client_name || "-" },
      { label: "Due Date", value: helpers.formatDate(form.due_date) },
      { label: "Paid Amount", value: helpers.formatAmount(form.paid_amount) },
    ],
    note: "Mark invoices paid from the table or sync collection automatically through payments.",
  }),
  columns: [
    {
      label: "Invoice",
      render: (data) => primaryCell("ti ti-file-invoice", data.invoice_number, data.client_name),
    },
    {
      label: "Project / Due",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{data.project_name || "-"}</div>
          <div className="payroll-secondary-text">
            Issued {helpers.formatDate(data.issue_date)} | Due {helpers.formatDate(data.due_date)}
          </div>
        </div>
      ),
    },
    {
      label: "Amounts",
      render: (data, record, helpers) => {
        const balance = helpers.toNumber(data.amount) - helpers.toNumber(data.paid_amount);
        return (
          <div className="finance-stack-list">
            {financePair("Invoice", helpers.formatAmount(data.amount))}
            {financePair("Paid", helpers.formatAmount(data.paid_amount))}
            {financePair("Balance", helpers.formatAmount(balance))}
          </div>
        );
      },
    },
    {
      label: "Status",
      render: (data, record, helpers) => statusBadge(data.status, helpers),
    },
  ],
  getRowActions: (record, helpers) => {
    const actions = [
      {
        label: "View",
        icon: "ti ti-eye",
        variant: "btn-white",
        to: helpers.routes.salesInvoiceDetails.replace(":id", record.id),
      },
    ];

    if (String(record.data?.status || "") !== "Paid") {
      actions.push({
        label: "Mark Paid",
        icon: "ti ti-check",
        variant: "btn-primary",
        successMessage: "Invoice marked as paid",
        onClick: async (currentRecord, currentHelpers) => {
          const data = currentRecord.data || {};
          await currentHelpers.api.put(`${currentHelpers.endpoint}${currentRecord.id}/`, {
            data: {
              ...data,
              status: "Paid",
              paid_amount: currentHelpers.toNumber(data.amount),
            },
          });
        },
      });
    }

    return actions;
  },
};

export const paymentsConfig = {
  resourceType: "payments",
  title: "Payments",
  kicker: "Collection Desk",
  kickerIcon: "ti ti-credit-card-pay",
  subtitle:
    "Capture customer payments, keep invoice balances synced, and track collection health without leaving the module.",
  primaryActionLabel: "Add Payment",
  tableTitle: "Payment Activity",
  tableSubtitle: "Log incoming payments and monitor settlement progress.",
  codeField: "payment_number",
  codePrefix: "PAY",
  amountField: "amount",
  statusField: "status",
  duplicateStatus: "Pending",
  searchFields: ["payment_number", "invoice_number", "client_name", "method", "reference"],
  statusOptions: ["Completed", "Pending", "Failed", "Refunded"],
  fields: [
    { name: "payment_number", label: "Payment Number", required: true, readOnlyOnEdit: true },
    { name: "invoice_number", label: "Invoice Number", required: true, placeholder: "INV-001" },
    { name: "client_name", label: "Client Name", required: true },
    { name: "payment_date", label: "Payment Date", type: "date", required: true },
    {
      name: "method",
      label: "Payment Method",
      type: "select",
      required: true,
      options: ["Bank Transfer", "Card", "Cash", "UPI", "Cheque"],
    },
    { name: "amount", label: "Amount Received", type: "number", required: true, min: "0", step: "0.01" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Completed", "Pending", "Failed", "Refunded"],
    },
    { name: "reference", label: "Reference ID" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Settlement notes" },
  ],
  getSummaryCards: (records, filtered, helpers) => {
    const received = records
      .filter((record) => String(record.data?.status || "") === "Completed")
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const pending = records.filter((record) => String(record.data?.status || "") === "Pending").length;
    const refunded = records
      .filter((record) => String(record.data?.status || "") === "Refunded")
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    return [
      { label: "Collections", value: helpers.formatAmount(received), meta: `${records.length} payments logged` },
      { label: "Pending Settlement", value: pending, meta: "Waiting to clear" },
      { label: "Refunded", value: helpers.formatAmount(refunded), meta: `${filtered.length} visible records` },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Payment Amount",
    highlightValue: helpers.formatAmount(form.amount),
    rows: [
      { label: "Payment Number", value: form.payment_number || "-" },
      { label: "Invoice Number", value: form.invoice_number || "-" },
      { label: "Method", value: form.method || "-" },
      { label: "Status", value: form.status || "-" },
    ],
    note: "Completed payments automatically update the matched invoice paid amount.",
  }),
  columns: [
    {
      label: "Payment",
      render: (data) => primaryCell("ti ti-receipt-2", data.payment_number, data.client_name),
    },
    {
      label: "Invoice / Date",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{data.invoice_number || "-"}</div>
          <div className="payroll-secondary-text">{helpers.formatDate(data.payment_date)}</div>
        </div>
      ),
    },
    {
      label: "Method / Amount",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{data.method || "-"}</div>
          <div className="payroll-secondary-text">{helpers.formatAmount(data.amount)}</div>
        </div>
      ),
    },
    {
      label: "Status",
      render: (data, record, helpers) => statusBadge(data.status, helpers),
    },
  ],
  afterSave: async ({ payload, record, helpers }) => {
    const invoiceNumbers = [payload.invoice_number, record?.data?.invoice_number].filter(Boolean);
    for (const invoiceNumber of [...new Set(invoiceNumbers)]) {
      await syncInvoiceByNumber(invoiceNumber, helpers);
    }
  },
  afterDelete: async ({ record, helpers }) => {
    await syncInvoiceByNumber(record.data?.invoice_number, helpers);
  },
};

export const expensesConfig = {
  resourceType: "expenses",
  title: "Expenses",
  kicker: "Spend Control",
  kickerIcon: "ti ti-report-money",
  subtitle:
    "Track spend requests, vendor costs, and reimbursement status with a cleaner expense control panel.",
  primaryActionLabel: "Add Expense",
  tableTitle: "Expense Register",
  tableSubtitle: "Review outflow by category, vendor, and settlement channel.",
  codeField: "expense_number",
  codePrefix: "EXP",
  amountField: "amount",
  statusField: "status",
  duplicateStatus: "Pending",
  searchFields: ["expense_number", "category", "vendor", "paid_via", "notes"],
  statusOptions: ["Pending", "Approved", "Paid", "Rejected"],
  fields: [
    { name: "expense_number", label: "Expense Number", required: true, readOnlyOnEdit: true },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: ["Travel", "Utilities", "Operations", "Software", "Marketing", "Payroll"],
    },
    { name: "vendor", label: "Vendor / Payee", required: true },
    { name: "expense_date", label: "Expense Date", type: "date", required: true },
    { name: "amount", label: "Amount", type: "number", required: true, min: "0", step: "0.01" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Pending", "Approved", "Paid", "Rejected"],
    },
    {
      name: "paid_via",
      label: "Paid Via",
      type: "select",
      options: ["Bank", "Card", "Cash", "Cheque", "UPI"],
    },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Expense summary or justification" },
  ],
  getSummaryCards: (records, filtered, helpers) => {
    const spend = records.reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const approved = records
      .filter((record) => ["Approved", "Paid"].includes(String(record.data?.status || "")))
      .reduce((sum, record) => sum + helpers.toNumber(record.data?.amount), 0);
    const pending = records.filter((record) => String(record.data?.status || "") === "Pending").length;
    return [
      { label: "Total Spend", value: helpers.formatAmount(spend), meta: `${records.length} expense entries` },
      { label: "Approved Spend", value: helpers.formatAmount(approved), meta: `${filtered.length} visible records` },
      { label: "Pending Claims", value: pending, meta: "Awaiting approval" },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Expense Amount",
    highlightValue: helpers.formatAmount(form.amount),
    rows: [
      { label: "Expense Number", value: form.expense_number || "-" },
      { label: "Category", value: form.category || "-" },
      { label: "Vendor", value: form.vendor || "-" },
      { label: "Paid Via", value: form.paid_via || "-" },
    ],
    note: "Approved expenses can be settled later while keeping the same record lifecycle.",
  }),
  columns: [
    {
      label: "Expense",
      render: (data) => primaryCell("ti ti-wallet", data.expense_number, data.category),
    },
    {
      label: "Vendor / Date",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{data.vendor || "-"}</div>
          <div className="payroll-secondary-text">{helpers.formatDate(data.expense_date)}</div>
        </div>
      ),
    },
    {
      label: "Amount / Channel",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{helpers.formatAmount(data.amount)}</div>
          <div className="payroll-secondary-text">{data.paid_via || "Not assigned"}</div>
        </div>
      ),
    },
    {
      label: "Status",
      render: (data, record, helpers) => statusBadge(data.status, helpers),
    },
  ],
};

export const providentFundConfig = {
  resourceType: "provident-fund",
  title: "Provident Fund",
  kicker: "Statutory Contributions",
  kickerIcon: "ti ti-building-bank",
  subtitle:
    "Track provident fund contributions with employee and employer shares, filing status, and UAN references in one ledger.",
  primaryActionLabel: "Add Contribution",
  tableTitle: "Provident Fund Ledger",
  tableSubtitle: "Monitor employee contributions and monthly filing readiness.",
  codeField: "fund_number",
  codePrefix: "PF",
  amountField: "total_contribution",
  statusField: "status",
  duplicateStatus: "Pending",
  searchFields: ["fund_number", "employee_name", "fund_type", "uan"],
  statusOptions: ["Filed", "Pending", "Hold"],
  fields: [
    { name: "fund_number", label: "Contribution Number", required: true, readOnlyOnEdit: true },
    { name: "employee_name", label: "Employee Name", required: true },
    {
      name: "fund_type",
      label: "Fund Type",
      type: "select",
      required: true,
      options: ["Employee Provident Fund", "Voluntary Provident Fund", "Pension Contribution"],
    },
    { name: "month", label: "Month", required: true, placeholder: "March 2026" },
    { name: "employee_share", label: "Employee Share", type: "number", required: true, min: "0", step: "0.01" },
    { name: "organization_share", label: "Organization Share", type: "number", required: true, min: "0", step: "0.01" },
    { name: "uan", label: "UAN / Reference" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Filed", "Pending", "Hold"],
    },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Contribution remarks" },
  ],
  preparePayload: ({ payload, helpers }) => ({
    ...payload,
    total_contribution:
      helpers.toNumber(payload.employee_share) + helpers.toNumber(payload.organization_share),
  }),
  getSummaryCards: (records, filtered, helpers) => {
    const employeeTotal = records.reduce(
      (sum, record) => sum + helpers.toNumber(record.data?.employee_share),
      0
    );
    const organizationTotal = records.reduce(
      (sum, record) => sum + helpers.toNumber(record.data?.organization_share),
      0
    );
    const pending = records.filter((record) => String(record.data?.status || "") === "Pending").length;
    return [
      { label: "Employee Share", value: helpers.formatAmount(employeeTotal), meta: `${records.length} contribution entries` },
      { label: "Employer Share", value: helpers.formatAmount(organizationTotal), meta: `${filtered.length} visible records` },
      { label: "Pending Filings", value: pending, meta: "Need statutory follow-up" },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Total Contribution",
    highlightValue: helpers.formatAmount(
      helpers.toNumber(form.employee_share) + helpers.toNumber(form.organization_share)
    ),
    rows: [
      { label: "Contribution Number", value: form.fund_number || "-" },
      { label: "Employee", value: form.employee_name || "-" },
      { label: "Cycle", value: form.month || "-" },
      { label: "UAN", value: form.uan || "-" },
    ],
    note: "Employee and organization shares are combined into a total contribution automatically.",
  }),
  columns: [
    {
      label: "Member",
      render: (data) => primaryCell("ti ti-shield-dollar", data.employee_name, data.fund_number),
    },
    {
      label: "Fund / Cycle",
      render: (data) => (
        <div>
          <div className="payroll-primary-text">{data.fund_type || "-"}</div>
          <div className="payroll-secondary-text">{data.month || "-"}</div>
        </div>
      ),
    },
    {
      label: "Contribution",
      render: (data, record, helpers) => (
        <div className="finance-stack-list">
          {financePair("Employee", helpers.formatAmount(data.employee_share))}
          {financePair("Employer", helpers.formatAmount(data.organization_share))}
          {financePair("Total", helpers.formatAmount(data.total_contribution))}
        </div>
      ),
    },
    {
      label: "Status",
      render: (data, record, helpers) => statusBadge(data.status, helpers),
    },
  ],
};

export const taxesConfig = {
  resourceType: "taxes",
  title: "Taxes",
  kicker: "Tax Matrix",
  kickerIcon: "ti ti-percentage",
  subtitle:
    "Maintain tax rules, rates, and effective dates with a simple admin surface for finance operations.",
  primaryActionLabel: "Add Tax Rule",
  tableTitle: "Tax Register",
  tableSubtitle: "Review active tax rules, categories, and effective dates.",
  codeField: "tax_code",
  codePrefix: "TAX",
  amountField: "rate",
  statusField: "status",
  duplicateStatus: "Draft",
  searchFields: ["tax_name", "tax_code", "tax_type", "description"],
  statusOptions: ["Active", "Draft", "Archived"],
  fields: [
    { name: "tax_name", label: "Tax Name", required: true },
    { name: "tax_code", label: "Tax Code", required: true, readOnlyOnEdit: true },
    {
      name: "tax_type",
      label: "Tax Type",
      type: "select",
      required: true,
      options: ["GST", "VAT", "Service Tax", "Payroll Tax", "Withholding"],
    },
    { name: "rate", label: "Rate (%)", type: "number", required: true, min: "0", step: "0.01" },
    { name: "effective_from", label: "Effective From", type: "date", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["Active", "Draft", "Archived"],
    },
    { name: "description", label: "Description", type: "textarea", placeholder: "Applicability and notes" },
  ],
  getSummaryCards: (records, filtered, helpers) => {
    const activeCount = records.filter((record) => String(record.data?.status || "") === "Active").length;
    const avgRate = records.length
      ? records.reduce((sum, record) => sum + helpers.toNumber(record.data?.rate), 0) / records.length
      : 0;
    const latest = records
      .map((record) => record.data?.effective_from)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];
    return [
      { label: "Tax Rules", value: records.length, meta: `${filtered.length} visible rules` },
      { label: "Active Rules", value: activeCount, meta: "Currently applied" },
      { label: "Average Rate", value: `${avgRate.toFixed(1)}%`, meta: "Across all configured rules" },
      { label: "Latest Effective", value: latest ? helpers.formatDate(latest) : "-", meta: "Most recent update" },
    ];
  },
  getPreview: (form, helpers) => ({
    highlightLabel: "Rate",
    highlightValue: `${helpers.toNumber(form.rate).toFixed(2)}%`,
    rows: [
      { label: "Tax Name", value: form.tax_name || "-" },
      { label: "Tax Code", value: form.tax_code || "-" },
      { label: "Type", value: form.tax_type || "-" },
      { label: "Effective From", value: helpers.formatDate(form.effective_from) },
    ],
    note: "Use archived status when a rule is no longer active but should stay in history.",
  }),
  columns: [
    {
      label: "Tax Rule",
      render: (data) => primaryCell("ti ti-tax", data.tax_name, data.tax_code),
    },
    {
      label: "Type / Effective",
      render: (data, record, helpers) => (
        <div>
          <div className="payroll-primary-text">{data.tax_type || "-"}</div>
          <div className="payroll-secondary-text">Effective {helpers.formatDate(data.effective_from)}</div>
        </div>
      ),
    },
    {
      label: "Rate",
      render: (data) => <div className="payroll-primary-text">{Number(data.rate || 0).toFixed(2)}%</div>,
    },
    {
      label: "Status",
      render: (data, record, helpers) => statusBadge(data.status, helpers),
    },
  ],
};
