import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const EmployeePayrollForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    const query = id ? `?edit=${id}` : "?add=1";
    navigate(`/accounts/employee-payroll${query}`, { replace: true });
  }, [id, navigate]);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid">
        <p>Redirecting to Employee Salary...</p>
      </div>
    </div>
  );
};

export default EmployeePayrollForm;
