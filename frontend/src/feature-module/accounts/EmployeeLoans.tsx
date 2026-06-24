import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { formatDisplayDate, formatMoney, normalizeList } from "../mainMenu/employeeDashboard/employeeShared";

type Installment = {
  id: number;
  month: string;
  year: number;
  amount: string;
  status: "pending" | "deducted" | "waived";
};

type Loan = {
  id: number;
  employee: {
    id: number;
    first_name: string;
    last_name?: string;
    emp_code: string;
  };
  loan_type: "advance" | "personal_loan" | "vehicle_loan";
  principal_amount: string;
  sanctioned_amount: string;
  interest_rate: string;
  total_installments: number;
  installments_paid: number;
  monthly_emi: string;
  start_date: string;
  end_date?: string;
  status: "pending" | "approved" | "active" | "closed" | "rejected";
  notes?: string;
  installments?: Installment[];
};

const LOAN_TYPES = [
  { value: "advance", label: "Salary Advance" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "vehicle_loan", label: "Vehicle Loan" },
];

const STATUS_TONES: Record<string, string> = {
  pending: "warning",
  approved: "info",
  active: "success",
  closed: "secondary",
  rejected: "danger",
};

const EmployeeLoans: React.FC = () => {
  const { user, role } = useAuth();
  const isHR = role === "super_admin" || role === "hr";

  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // Loan Request Form
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [loanType, setLoanType] = useState("personal_loan");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("12");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isHR ? "employee-loans/" : `employee-loans/?employee_id=${user?.employee_profile?.id || ""}`;
      const [loansRes, employeesRes] = await Promise.all([
        API.get(endpoint),
        isHR ? API.get("employees/") : Promise.resolve({ data: [] }),
      ]);
      setLoans(normalizeList<Loan>(loansRes.data));
      if (isHR) {
        setEmployees(normalizeList<any>(employeesRes.data));
      }
    } catch (error) {
      console.error("Failed to load loan data", error);
    } finally {
      setLoading(false);
    }
  }, [isHR, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const activeLoans = loans.filter((l) => l.status === "active");
    const totalPrincipal = activeLoans.reduce((sum, l) => sum + Number(l.sanctioned_amount || 0), 0);
    const totalEmi = activeLoans.reduce((sum, l) => sum + Number(l.monthly_emi || 0), 0);
    const pendingCount = loans.filter((l) => l.status === "pending").length;

    return {
      activeCount: activeLoans.length,
      totalPrincipal,
      totalEmi,
      pendingCount,
    };
  }, [loans]);

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmpId = isHR ? targetEmployeeId : user?.employee_profile?.id;
    if (!finalEmpId) {
      alert("Please select an employee profile.");
      return;
    }
    if (!principalAmount || Number(principalAmount) <= 0) {
      alert("Please enter a valid loan amount.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee: Number(finalEmpId),
        loan_type: loanType,
        principal_amount: principalAmount,
        sanctioned_amount: principalAmount, // default to requested principal
        interest_rate: "0.00",
        total_installments: Number(totalInstallments),
        monthly_emi: (Number(principalAmount) / Number(totalInstallments)).toFixed(2),
        start_date: new Date().toISOString().split("T")[0],
        status: "pending",
        notes,
      };

      await API.post("employee-loans/", payload);
      alert("Loan application submitted successfully!");
      setShowApplyModal(false);
      // Reset form
      setPrincipalAmount("");
      setNotes("");
      loadData();
    } catch (err) {
      console.error("Failed to apply for loan:", err);
      alert("Unable to submit loan application.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (loanId: number, newStatus: string) => {
    if (!window.confirm(`Are you sure you want to mark this loan as ${newStatus}?`)) return;
    try {
      await API.patch(`employee-loans/${loanId}/`, { status: newStatus });
      alert(`Loan status updated to ${newStatus}.`);
      if (selectedLoan?.id === loanId) {
        setSelectedLoan((prev) => prev ? { ...prev, status: newStatus as any } : null);
      }
      loadData();
    } catch (err) {
      console.error("Failed to update loan status:", err);
      alert("Failed to update status.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        {/* Hero Header */}
        <div className="card payroll-hero mb-4">
          <div className="card-body">
            <div className="row align-items-center g-4">
              <div className="col-lg-8 employee-hero-copy">
                <span className="payroll-kicker">
                  <i className="ti ti-cash" /> Financial Wellness
                </span>
                <h1 className="payroll-title">Loans & Advances</h1>
                <p className="payroll-subtitle">
                  Apply for salary advances or personal loans, track remaining balances, and review monthly installment deductions directly from salary payslips.
                </p>
                <div className="employee-chip-row">
                  <span className="employee-chip">
                    <i className="ti ti-activity" /> {stats.activeCount} Active Loans
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-wallet" /> {formatMoney(stats.totalPrincipal)} Active Principal
                  </span>
                  <span className="employee-chip">
                    <i className="ti ti-receipt" /> {formatMoney(stats.totalEmi)}/mo Total EMI Deductions
                  </span>
                  {stats.pendingCount > 0 && (
                    <span className="employee-chip bg-warning-light text-warning">
                      <i className="ti ti-alert-circle" /> {stats.pendingCount} Pending Applications
                    </span>
                  )}
                </div>
              </div>
              <div className="col-lg-4 text-lg-end">
                <div className="payroll-hero-actions">
                  <button className="btn btn-primary" onClick={() => setShowApplyModal(true)}>
                    <i className="ti ti-plus me-1" /> Request Loan / Advance
                  </button>
                  <div className="head-icons">
                    <CollapseHeader />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Left Column: Loans Register */}
          <div className="col-xl-8">
            <div className="card payroll-panel payroll-table-card">
              <div className="payroll-table-header">
                <div>
                  <h5>Loans Register</h5>
                  <div className="payroll-table-subtitle">
                    All personal loans, advance balances, and repayments logs.
                  </div>
                </div>
              </div>

              <div className="payroll-table-shell">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                    <p className="mt-2 text-muted">Retrieving loan accounts...</p>
                  </div>
                ) : loans.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ti ti-coin text-muted display-4 mb-3" />
                    <h6>No loan accounts found</h6>
                    <p className="text-muted">You have no pending or active loan accounts currently.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          {isHR && <th>Employee</th>}
                          <th>Type</th>
                          <th>Principal</th>
                          <th>EMI</th>
                          <th>Progress</th>
                          <th>Status</th>
                          <th className="text-end">Repayments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.map((loan) => {
                          const progress = loan.total_installments > 0
                            ? Math.round((loan.installments_paid / loan.total_installments) * 100)
                            : 0;

                          return (
                            <tr
                              key={loan.id}
                              className={`cursor-pointer ${selectedLoan?.id === loan.id ? "table-active" : ""}`}
                              onClick={() => setSelectedLoan(loan)}
                            >
                              {isHR && (
                                <td>
                                  <div className="payroll-primary-text">
                                    {loan.employee ? `${loan.employee.first_name} ${loan.employee.last_name || ""}`.trim() : "Unknown"}
                                  </div>
                                  <div className="payroll-secondary-text">{loan.employee?.emp_code}</div>
                                </td>
                              )}
                              <td>
                                <div className="payroll-primary-text text-capitalize">
                                  {loan.loan_type.replace("_", " ")}
                                </div>
                                <div className="payroll-secondary-text">Start: {formatDisplayDate(loan.start_date)}</div>
                              </td>
                              <td>{formatMoney(Number(loan.sanctioned_amount))}</td>
                              <td>{formatMoney(Number(loan.monthly_emi))}</td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <div className="finance-progress-track flex-grow-1" style={{ width: 70 }}>
                                    <div
                                      className="finance-progress-bar success"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <small className="fw-semibold">{loan.installments_paid}/{loan.total_installments}</small>
                                </div>
                              </td>
                              <td>
                                <span className={`badge bg-${STATUS_TONES[loan.status]}-light text-${STATUS_TONES[loan.status]} px-3 py-2 text-capitalize`}>
                                  {loan.status}
                                </span>
                              </td>
                              <td className="text-end">
                                <button
                                  className="btn btn-sm btn-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLoan(loan);
                                  }}
                                >
                                  View Schedule
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Loan Details & Schedule */}
          <div className="col-xl-4">
            {selectedLoan ? (
              <div className="card employee-section-card">
                <div className="card-header border-bottom">
                  <h5 className="mb-1 text-capitalize">{selectedLoan.loan_type.replace("_", " ")} Account</h5>
                  <p className="payroll-table-subtitle mb-0">ID: LOAN-{selectedLoan.id}</p>
                </div>
                <div className="card-body">
                  <div className="payroll-summary-highlight mb-3">
                    <small>Remaining Repayments Balance</small>
                    <h3>
                      {formatMoney(
                        Number(selectedLoan.sanctioned_amount) -
                        (Number(selectedLoan.monthly_emi) * selectedLoan.installments_paid)
                      )}
                    </h3>
                  </div>

                  <div className="employee-summary-list mb-4">
                    <div className="employee-summary-row">
                      <span>Borrower</span>
                      <strong>
                        {selectedLoan.employee
                          ? `${selectedLoan.employee.first_name} ${selectedLoan.employee.last_name || ""}`.trim()
                          : "-"}
                      </strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Principal Approved</span>
                      <strong>{formatMoney(Number(selectedLoan.sanctioned_amount))}</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Monthly Installment (EMI)</span>
                      <strong>{formatMoney(Number(selectedLoan.monthly_emi))}</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Repayment Period</span>
                      <strong>{selectedLoan.total_installments} Months</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Paid Installments</span>
                      <strong>{selectedLoan.installments_paid} of {selectedLoan.total_installments}</strong>
                    </div>
                    <div className="employee-summary-row">
                      <span>Start Date</span>
                      <strong>{formatDisplayDate(selectedLoan.start_date)}</strong>
                    </div>
                    {selectedLoan.notes && (
                      <div className="mt-3 border-top pt-2">
                        <small className="text-muted d-block">Loan Request Notes</small>
                        <p className="mb-0 text-secondary">{selectedLoan.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions for HR/Admin */}
                  {isHR && selectedLoan.status === "pending" && (
                    <div className="d-flex gap-2 mb-4">
                      <button
                        className="btn btn-success flex-grow-1"
                        onClick={() => handleStatusUpdate(selectedLoan.id, "approved")}
                      >
                        Approve Loan
                      </button>
                      <button
                        className="btn btn-outline-danger flex-grow-1"
                        onClick={() => handleStatusUpdate(selectedLoan.id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {isHR && selectedLoan.status === "approved" && (
                    <button
                      className="btn btn-primary w-100 mb-4"
                      onClick={() => handleStatusUpdate(selectedLoan.id, "active")}
                    >
                      Activate Loan (Start Repayments)
                    </button>
                  )}

                  {/* Installment History List */}
                  <h6 className="mb-3">Installments Schedule</h6>
                  {selectedLoan.installments && selectedLoan.installments.length > 0 ? (
                    <div className="d-grid gap-2" style={{ maxHeight: 300, overflowY: "auto" }}>
                      {selectedLoan.installments.map((inst) => {
                        let statusBadge = "bg-warning-light text-warning";
                        if (inst.status === "deducted") statusBadge = "bg-success-light text-success";
                        if (inst.status === "waived") statusBadge = "bg-secondary-light text-secondary";

                        return (
                          <div
                            key={inst.id}
                            className="border rounded-4 p-3 d-flex justify-content-between align-items-center bg-light-gradient"
                          >
                            <div>
                              <strong>{inst.month} {inst.year}</strong>
                              <div className="text-muted small">Installment amount</div>
                            </div>
                            <div className="text-end">
                              <strong>{formatMoney(Number(inst.amount))}</strong>
                              <span className={`badge ${statusBadge} d-block mt-1 text-capitalize`}>
                                {inst.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-light rounded-4">
                      <p className="text-muted mb-0 small">Repayment plan installments will generate when activated.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card employee-section-card h-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
                <i className="ti ti-cash-register display-4 text-muted mb-3" />
                <h5>Repayments Schedule</h5>
                <p className="text-muted">Select any loan from the register to check its repayment schedule, remaining payments, and installment status details.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apply Loan Modal */}
      {showApplyModal && (
        <>
          <div className="modal show d-block payroll-modal" tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Request Loan / Advance</h5>
                  <button type="button" className="btn-close" onClick={() => setShowApplyModal(false)} />
                </div>
                <form onSubmit={handleApplyLoan}>
                  <div className="modal-body">
                    {isHR ? (
                      <div className="mb-3">
                        <label className="form-label">Employee Profile</label>
                        <select
                          className="form-select"
                          value={targetEmployeeId}
                          onChange={(e) => setTargetEmployeeId(e.target.value)}
                          required
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name || ""} ({emp.emp_code})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <label className="form-label">Employee</label>
                        <input
                          className="form-control"
                          value={`${user?.employee_profile?.first_name || ""} ${user?.employee_profile?.last_name || ""}`}
                          disabled
                        />
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label">Loan Type</label>
                      <select
                        className="form-select"
                        value={loanType}
                        onChange={(e) => setLoanType(e.target.value)}
                      >
                        {LOAN_TYPES.map((lt) => (
                          <option key={lt.value} value={lt.value}>
                            {lt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Requested Principal Amount (INR)</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 50000"
                        value={principalAmount}
                        onChange={(e) => setPrincipalAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Repayment Tenure (Months)</label>
                      <select
                        className="form-select"
                        value={totalInstallments}
                        onChange={(e) => setTotalInstallments(e.target.value)}
                      >
                        <option value="1">1 Month (Advance)</option>
                        <option value="3">3 Months</option>
                        <option value="6">6 Months</option>
                        <option value="12">12 Months (1 Year)</option>
                        <option value="24">24 Months (2 Years)</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Request Notes / Reason</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Brief explanation for why this loan is needed."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light" onClick={() => setShowApplyModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? "Submitting..." : "Submit Application"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
};

export default EmployeeLoans;
