import React, { useEffect, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";

type EmployeeMin = {
  id: number;
  first_name: string;
  last_name?: string;
  emp_code: string;
};

const StatutoryReports: React.FC = () => {
  const { user } = useAuth();
  const routes = all_routes;

  const [activeTab, setActiveTab] = useState<"pf" | "esi" | "register" | "form16">("pf");
  const [month, setMonth] = useState("March");
  const [year, setYear] = useState("2026");
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeMin[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const isHR = user?.role === "super_admin" || user?.role === "hr";

  useEffect(() => {
    if (!isHR) {
      setActiveTab("form16");
    }
  }, [isHR]);

  // Load employee list for Form 16 selection (Admin/HR only)
  useEffect(() => {
    if (isHR) {
      API.get("/employees/tree/")
        .then((res) => {
          const list: EmployeeMin[] = [];
          const traverse = (nodes: any[]) => {
            nodes.forEach((n) => {
              list.push({
                id: n.id,
                first_name: n.first_name,
                last_name: n.last_name,
                emp_code: n.emp_code
              });
              if (n.children) traverse(n.children);
            });
          };
          if (Array.isArray(res.data)) {
            traverse(res.data);
          } else if (res.data?.results) {
            traverse(res.data.results);
          }
          setEmployees(list);
          if (list.length > 0) {
            setSelectedEmp(String(list[0].id));
          }
        })
        .catch((err) => console.error("Failed to load employee list", err));
    } else {
      if (user?.employee_profile?.id) {
        setSelectedEmp(String(user.employee_profile.id));
      }
    }
  }, [isHR, user]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      let endpoint = "";
      let params: Record<string, string> = {};

      if (activeTab === "pf") {
        endpoint = "/reports/pf-challan/";
        params = { month, year };
      } else if (activeTab === "esi") {
        endpoint = "/reports/esi-report/";
        params = { month, year };
      } else if (activeTab === "register") {
        endpoint = "/reports/salary-register/";
        params = { month, year };
      } else if (activeTab === "form16") {
        endpoint = "/reports/form16/";
        params = { year, employee_id: selectedEmp };
      }

      const res = await API.get(endpoint, { params });
      setReportData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to generate report. Make sure payroll is calculated for the period.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    let headers: string[] = [];
    let rows: any[] = [];
    let filename = "";

    if (activeTab === "pf") {
      headers = ["emp_code", "name", "uan", "basic_salary", "employee_pf", "employer_pf"];
      rows = reportData.records || [];
      filename = `PF_Challan_${month}_${year}.csv`;
    } else if (activeTab === "esi") {
      headers = ["emp_code", "name", "esi_number", "gross_salary", "employee_esi", "employer_esi"];
      rows = reportData.records || [];
      filename = `ESI_Report_${month}_${year}.csv`;
    } else if (activeTab === "register") {
      headers = ["emp_code", "name", "department", "designation", "basic_salary", "gross_salary", "total_deductions", "net_salary"];
      rows = reportData.records || [];
      filename = `Salary_Register_${month}_${year}.csv`;
    } else if (activeTab === "form16") {
      headers = ["quarter", "gross_amount"];
      rows = [
        { quarter: "Q1 (Apr-Jun)", gross_amount: reportData.quarterly_gross?.Q1 },
        { quarter: "Q2 (Jul-Sep)", gross_amount: reportData.quarterly_gross?.Q2 },
        { quarter: "Q3 (Oct-Dec)", gross_amount: reportData.quarterly_gross?.Q3 },
        { quarter: "Q4 (Jan-Mar)", gross_amount: reportData.quarterly_gross?.Q4 },
        { quarter: "Total Taxable Income", gross_amount: reportData.total_taxable_income },
        { quarter: "Professional Tax Paid", gross_amount: reportData.professional_tax_paid },
      ];
      filename = `Form16_TDS_${reportData.name}_${year}.csv`;
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = row[h] !== undefined ? row[h] : "";
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        {/* Banner Welcome */}
        <div className="card payroll-hero mb-4 border-0 shadow-sm" style={{ borderRadius: "20px" }}>
          <div className="card-body p-4">
            <div className="row g-4 align-items-center">
              <div className="col-xl-8">
                <span className="payroll-kicker bg-primary text-white px-3 py-1 rounded-pill mb-2 d-inline-flex align-items-center gap-1.5" style={{ fontSize: "12px", fontWeight: "600" }}>
                  <i className="ti ti-report-money" /> Indian Compliance Reporting
                </span>
                <h1 className="payroll-title fw-extrabold text-dark mb-2">Statutory & Tax Center</h1>
                <p className="payroll-subtitle text-muted mb-0">
                  Generate Indian compliant reports including PF Challan records, ESI contribution tables, Monthly Salary Register sheets, and Form 16 TDS estimators.
                </p>
              </div>
              <div className="col-xl-4 text-xl-end">
                <div className="d-flex flex-wrap gap-2 justify-content-xl-end">
                  <CollapseHeader />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "16px" }}>
          <div className="card-body p-3">
            <ul className="nav nav-pills gap-2" style={{ borderBottom: "none" }}>
              {isHR && (
                <>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === "pf" ? "active" : "btn-light"}`}
                      onClick={() => { setActiveTab("pf"); setReportData(null); }}
                      style={{ borderRadius: "10px", fontWeight: "600" }}
                    >
                      PF Challan
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === "esi" ? "active" : "btn-light"}`}
                      onClick={() => { setActiveTab("esi"); setReportData(null); }}
                      style={{ borderRadius: "10px", fontWeight: "600" }}
                    >
                      ESI Contribution
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === "register" ? "active" : "btn-light"}`}
                      onClick={() => { setActiveTab("register"); setReportData(null); }}
                      style={{ borderRadius: "10px", fontWeight: "600" }}
                    >
                      Salary Register
                    </button>
                  </li>
                </>
              )}
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "form16" ? "active" : "btn-light"}`}
                  onClick={() => { setActiveTab("form16"); setReportData(null); }}
                  style={{ borderRadius: "10px", fontWeight: "600" }}
                >
                  Form 16 Estimator
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Filters and Control Panel */}
        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "16px" }}>
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              {activeTab !== "form16" && (
                <div className="col-md-3">
                  <label className="form-label text-muted small fw-bold">Select Month</label>
                  <select className="form-select" value={month} onChange={(e) => setMonth(e.target.value)} style={{ borderRadius: "10px" }}>
                    {months.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-md-3">
                <label className="form-label text-muted small fw-bold">Select Year</label>
                <select className="form-select" value={year} onChange={(e) => setYear(e.target.value)} style={{ borderRadius: "10px" }}>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2027">2027</option>
                </select>
              </div>
              {activeTab === "form16" && isHR && (
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-bold">Select Employee</label>
                  <select className="form-select" value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)} style={{ borderRadius: "10px" }}>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name || ""} ({emp.emp_code})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-md-3 d-flex gap-2">
                <button onClick={fetchReport} className="btn btn-primary w-100 py-2.5" disabled={loading} style={{ borderRadius: "10px", fontWeight: "700" }}>
                  {loading ? "Generating..." : "Generate Report"}
                </button>
                {reportData && (
                  <button onClick={handleExportCSV} className="btn btn-outline-secondary py-2.5 px-3" style={{ borderRadius: "10px" }} title="Export to CSV">
                    <i className="ti ti-download fs-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Display Error */}
        {error && (
          <div className="alert alert-danger shadow-sm border-0 mb-4" style={{ borderRadius: "12px" }}>
            <div className="d-flex align-items-center gap-2">
              <i className="ti ti-alert-triangle fs-5" />
              <span className="fw-semibold small">{error}</span>
            </div>
          </div>
        )}

        {/* Report Content Panel */}
        {reportData && (
          <div className="card shadow-sm border-0" style={{ borderRadius: "18px", overflow: "hidden" }}>
            <div className="card-header bg-light py-3.5 border-0">
              <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                Report Preview
              </h5>
            </div>
            <div className="card-body p-4">
              {activeTab === "pf" && (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Employee Code</th>
                        <th>Name</th>
                        <th>UAN</th>
                        <th className="text-end">Basic Salary (₹)</th>
                        <th className="text-end">Employee PF (12%) (₹)</th>
                        <th className="text-end">Employer PF (12%) (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.records?.map((rec: any, idx: number) => (
                        <tr key={idx}>
                          <td className="fw-semibold">{rec.emp_code}</td>
                          <td>{rec.name}</td>
                          <td><code>{rec.uan}</code></td>
                          <td className="text-end">{rec.basic_salary.toLocaleString("en-IN")}</td>
                          <td className="text-end text-danger fw-semibold">{rec.employee_pf.toLocaleString("en-IN")}</td>
                          <td className="text-end text-success fw-semibold">{rec.employer_pf.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                      {reportData.records?.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="table-light fw-bold border-top border-2">
                      <tr>
                        <td colSpan={3}>Summary Totals</td>
                        <td className="text-end">₹ {reportData.totals?.basic_salary.toLocaleString("en-IN")}</td>
                        <td className="text-end text-danger">₹ {reportData.totals?.employee_pf.toLocaleString("en-IN")}</td>
                        <td className="text-end text-success">₹ {reportData.totals?.employer_pf.toLocaleString("en-IN")}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {activeTab === "esi" && (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Employee Code</th>
                        <th>Name</th>
                        <th>ESI Number</th>
                        <th className="text-end">Gross Salary (₹)</th>
                        <th className="text-end">Employee ESI (0.75%) (₹)</th>
                        <th className="text-end">Employer ESI (3.25%) (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.records?.map((rec: any, idx: number) => (
                        <tr key={idx}>
                          <td className="fw-semibold">{rec.emp_code}</td>
                          <td>{rec.name}</td>
                          <td><code>{rec.esi_number}</code></td>
                          <td className="text-end">{rec.gross_salary.toLocaleString("en-IN")}</td>
                          <td className="text-end text-danger fw-semibold">{rec.employee_esi.toLocaleString("en-IN")}</td>
                          <td className="text-end text-success fw-semibold">{rec.employer_esi.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                      {reportData.records?.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted">No records found. (Gross salary &lt;= ₹21,000 for ESI eligibility).</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="table-light fw-bold border-top border-2">
                      <tr>
                        <td colSpan={3}>Summary Totals</td>
                        <td className="text-end">₹ {reportData.totals?.gross_salary.toLocaleString("en-IN")}</td>
                        <td className="text-end text-danger">₹ {reportData.totals?.employee_esi.toLocaleString("en-IN")}</td>
                        <td className="text-end text-success">₹ {reportData.totals?.employer_esi.toLocaleString("en-IN")}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {activeTab === "register" && (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Employee Code</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th className="text-end">Basic (₹)</th>
                        <th className="text-end">Gross (₹)</th>
                        <th className="text-end">Deductions (₹)</th>
                        <th className="text-end text-primary">Net Pay (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.records?.map((rec: any, idx: number) => (
                        <tr key={idx}>
                          <td className="fw-semibold">{rec.emp_code}</td>
                          <td>{rec.name}</td>
                          <td>{rec.department}</td>
                          <td>{rec.designation}</td>
                          <td className="text-end">{rec.basic_salary.toLocaleString("en-IN")}</td>
                          <td className="text-end">{rec.gross_salary.toLocaleString("en-IN")}</td>
                          <td className="text-end text-danger">{rec.total_deductions.toLocaleString("en-IN")}</td>
                          <td className="text-end text-success fw-bold">{rec.net_salary.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "form16" && (
                <div>
                  <div className="row g-4 mb-4">
                    <div className="col-md-6">
                      <table className="table table-bordered align-middle">
                        <tbody>
                          <tr>
                            <td className="fw-bold bg-light" style={{ width: "40%" }}>Assessee Name</td>
                            <td>{reportData.name}</td>
                          </tr>
                          <tr>
                            <td className="fw-bold bg-light">PAN Card Number</td>
                            <td><code>{reportData.pan}</code></td>
                          </tr>
                          <tr>
                            <td className="fw-bold bg-light">Financial Year</td>
                            <td>{reportData.year} - {Number(reportData.year) + 1}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="col-md-6">
                      <table className="table table-bordered align-middle">
                        <tbody>
                          <tr>
                            <td className="fw-bold bg-light" style={{ width: "50%" }}>Total Taxable Gross Income</td>
                            <td className="fw-bold text-success">₹ {reportData.total_taxable_income?.toLocaleString("en-IN")}</td>
                          </tr>
                          <tr>
                            <td className="fw-bold bg-light">Professional Tax Deducted</td>
                            <td className="fw-bold text-danger">₹ {reportData.professional_tax_paid?.toLocaleString("en-IN")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <h5 className="fw-bold mb-3" style={{ fontSize: "14.5px" }}>Quarterly Gross Salary Breakdown</h5>
                  <div className="row g-3 mb-4">
                    {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                      <div key={q} className="col-md-3">
                        <div className="border rounded-3 p-3 bg-light text-center">
                          <span className="text-muted small d-block mb-1">{q} (Gross)</span>
                          <h4 className="fw-bold mb-0 text-dark">₹ {reportData.quarterly_gross?.[q]?.toLocaleString("en-IN") || 0}</h4>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h5 className="fw-bold mb-3" style={{ fontSize: "14.5px" }}>TDS Deducted Monthly Log</h5>
                  <div className="table-responsive" style={{ maxWidth: "500px" }}>
                    <table className="table table-bordered align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Month</th>
                          <th className="text-end">TDS Deposited (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.monthly_tds?.map((tds: any, idx: number) => (
                          <tr key={idx}>
                            <td>{tds.month}</td>
                            <td className="text-end text-danger fw-semibold">{tds.tds.toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                        {reportData.monthly_tds?.length === 0 && (
                          <tr>
                            <td colSpan={2} className="text-center text-muted">No tax deductions recorded.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatutoryReports;
