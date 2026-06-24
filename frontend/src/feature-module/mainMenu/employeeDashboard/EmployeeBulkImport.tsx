import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { all_routes } from "../../router/all_routes";

type ImportError = {
  row: number;
  reason: string;
};

type ImportSummary = {
  total: number;
  created: number;
  errors: ImportError[];
};

const EmployeeBulkImport: React.FC = () => {
  const navigate = useNavigate();
  const routes = all_routes;

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const downloadSampleCSV = () => {
    const headers = "emp_code,first_name,last_name,email,department,designation,joining_date,employment_type,salary,phone\n";
    const sampleRow1 = "EMP-099,Arjun,Kumar,arjun@example.com,Engineering,Software Engineer,2026-06-01,Full-Time,60000,9000000099\n";
    const sampleRow2 = "EMP-100,Deepika,Sharma,deepika@example.com,HR,HR Specialist,2026-06-15,Full-Time,45000,9000000100\n";
    
    const blob = new Blob([headers + sampleRow1 + sampleRow2], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "employee_import_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setErrorMsg(null);
        setSummary(null);
      } else {
        setErrorMsg("Please upload a valid CSV file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setErrorMsg(null);
        setSummary(null);
      } else {
        setErrorMsg("Please upload a valid CSV file.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await API.post("/employees/bulk-import/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSummary(res.data);
      setFile(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.response?.data?.detail || "Upload failed. Please check your CSV format and try again.");
    } finally {
      setLoading(false);
    }
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
                  <i className="ti ti-users-group" /> Employee Directory
                </span>
                <h1 className="payroll-title fw-extrabold text-dark mb-2">Bulk Employee Import</h1>
                <p className="payroll-subtitle text-muted mb-0">
                  Import multiple employee profiles at once using a CSV template. Standard validation rules apply.
                </p>
              </div>
              <div className="col-xl-4 text-xl-end">
                <div className="d-flex flex-wrap gap-2 justify-content-xl-end">
                  <button onClick={() => navigate(routes.employeeList)} className="btn btn-white shadow-sm px-3.5 py-2 fw-semibold" style={{ borderRadius: "10px" }}>
                    <i className="ti ti-arrow-left me-1.5" /> Back to Directory
                  </button>
                  <CollapseHeader />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Left Column: Import Form */}
          <div className="col-lg-7">
            <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "18px" }}>
              <div className="card-header bg-white border-0 py-3.5">
                <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                  Upload CSV Document
                </h5>
              </div>
              <div className="card-body p-4 pt-0">
                <form onSubmit={handleSubmit}>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border border-2 border-dashed rounded-4 p-5 text-center mb-4 cursor-pointer position-relative ${
                      dragActive ? "border-primary bg-primary-subtle" : "border-muted bg-light"
                    }`}
                    style={{ transition: "all 0.2s ease" }}
                  >
                    <input
                      type="file"
                      id="csv-file-input"
                      className="position-absolute w-100 h-100 opacity-0 top-0 start-0 cursor-pointer"
                      accept=".csv"
                      onChange={handleFileChange}
                    />
                    <div className="avatar avatar-lg bg-primary-subtle text-primary rounded-circle mb-3 mx-auto" style={{ width: "56px", height: "56px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="ti ti-file-upload fs-2" />
                    </div>
                    {file ? (
                      <div>
                        <h6 className="fw-bold text-dark mb-1">{file.name}</h6>
                        <span className="text-muted small">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <div>
                        <h6 className="fw-bold text-dark mb-1">Drag and drop your CSV file here</h6>
                        <span className="text-muted small">or click to browse local files</span>
                      </div>
                    )}
                  </div>

                  {errorMsg && (
                    <div className="alert alert-danger shadow-sm border-0 mb-4" style={{ borderRadius: "12px" }}>
                      <div className="d-flex align-items-center gap-2">
                        <i className="ti ti-alert-triangle fs-5" />
                        <span className="fw-semibold small">{errorMsg}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary w-100 py-2.5"
                    disabled={loading || !file}
                    style={{ borderRadius: "12px", fontWeight: "700" }}
                  >
                    {loading ? "Processing CSV Records..." : "Begin Import Process"}
                  </button>
                </form>
              </div>
            </div>

            {/* Summary Report */}
            {summary && (
              <div className="card shadow-sm border-0" style={{ borderRadius: "18px" }}>
                <div className="card-header bg-white border-0 py-3.5">
                  <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                    Import Execution Summary
                  </h5>
                </div>
                <div className="card-body p-4 pt-0">
                  <div className="row g-3 mb-4">
                    <div className="col-6">
                      <div className="border rounded-3 p-3 bg-success-subtle text-success text-center">
                        <span className="small d-block mb-1 font-bold">Successfully Created</span>
                        <h3 className="fw-extrabold mb-0">{summary.created} Profiles</h3>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="border rounded-3 p-3 bg-danger-subtle text-danger text-center">
                        <span className="small d-block mb-1 font-bold">Failed / Skipped</span>
                        <h3 className="fw-extrabold mb-0">{summary.errors.length} Rows</h3>
                      </div>
                    </div>
                  </div>

                  {summary.errors.length > 0 && (
                    <div>
                      <h6 className="fw-bold text-dark mb-2">Import Errors Details</h6>
                      <div className="table-responsive" style={{ maxHeight: "250px" }}>
                        <table className="table table-bordered table-sm align-middle">
                          <thead className="table-light">
                            <tr>
                              <th>Row</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.errors.map((err, idx) => (
                              <tr key={idx}>
                                <td>Row {err.row}</td>
                                <td className="text-danger">{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Instructions */}
          <div className="col-lg-5">
            <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "18px" }}>
              <div className="card-header bg-white border-0 py-3.5">
                <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "16px" }}>
                  Instructions & Template
                </h5>
              </div>
              <div className="card-body p-4 pt-0">
                <p className="text-muted small mb-4">
                  Please use the standard structure. Any duplicate email addresses or employee codes will fail validation and skip creation.
                </p>

                <div className="border rounded-4 p-3 bg-light mb-4">
                  <span className="text-dark fw-bold small d-block mb-2">Required CSV Column Headers</span>
                  <div className="d-flex flex-wrap gap-1.5">
                    {["emp_code", "first_name", "last_name", "email", "phone", "joining_date", "employment_type", "salary", "department", "designation"].map((col) => (
                      <code key={col} className="bg-white border rounded px-2 py-1 text-primary" style={{ fontSize: "11.5px" }}>{col}</code>
                    ))}
                  </div>
                </div>

                <button
                  onClick={downloadSampleCSV}
                  className="btn btn-outline-primary w-100 py-2.5"
                  style={{ borderRadius: "12px", fontWeight: "700" }}
                >
                  <i className="ti ti-download me-1.5" /> Download CSV Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeBulkImport;
