import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import API from "../../api/axios";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmHero, HrmEmptyState } from "../hrm/hrmShared";

const reportTitles: Record<string, string> = {
  "/expenses-report": "Expense Report",
  "/invoice-report": "Invoice Report",
  "/payment-report": "Payment Report",
  "/project-report": "Project Report",
  "/task-report": "Task Report",
  "/user-report": "User Report",
  "/employee-report": "Employee Report",
  "/payslip-report": "Payslip Report",
  "/attendance-report": "Attendance Report",
  "/leave-report": "Leave Report",
  "/daily-report": "Daily Report",
};

const ReportsWorkspace: React.FC = () => {
  const location = useLocation();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await API.get("/reports/overview/");
        setCards(response.data?.cards || []);
        setSections(response.data?.sections || []);
      } catch (error) {
        console.error("Failed to load reports overview", error);
        setCards([]);
        setSections([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const title = useMemo(() => reportTitles[location.pathname] || "Reports Center", [location.pathname]);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Operational Reporting"
          title={title}
          subtitle="Review live workforce, offboarding, recruitment, overtime, and notification metrics from one reporting layer."
          action={<div className="head-icons"><CollapseHeader /></div>}
          stats={cards.slice(0, 4)}
        >
          <span className="employee-chip"><i className="ti ti-chart-bar" /> Live backend metrics</span>
          <span className="employee-chip"><i className="ti ti-clock-hour-4" /> Useful for daily HR and finance reviews</span>
        </HrmHero>

        <div className="card payroll-panel payroll-table-card mb-4">
          <div className="card-body">
            {loading ? (
              <div className="text-center py-5 text-muted">Loading reports...</div>
            ) : cards.length === 0 ? (
              <HrmEmptyState title="No report data yet" description="Once operations data starts flowing, this center will summarize the live HRMS activity here." />
            ) : (
              <div className="row g-3">
                {cards.map((card) => (
                  <div className="col-md-6 col-xl-3" key={card.label}>
                    <div className="card payroll-stat-card h-100">
                      <div className="card-body">
                        <span className="payroll-stat-label">{card.label}</span>
                        <h3 className="payroll-stat-value">{card.value}</h3>
                        <div className="payroll-stat-meta">{card.meta}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {sections?.length ? (
          <div className="row g-4">
            {sections.map((section) => (
              <div className="col-xl-4" key={section.title}>
                <div className="card payroll-section-card h-100">
                  <div className="card-body">
                    <div className="payroll-section-header">
                      <h5 className="payroll-section-title">{section.title}</h5>
                    </div>
                    <div className="payroll-summary-list">
                      {(section.items || []).map((item: any) => (
                        <div className="payroll-summary-row" key={item.label}>
                          <div>
                            <div className="payroll-primary-text">{item.label}</div>
                            <div className="payroll-secondary-text">{item.meta}</div>
                          </div>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReportsWorkspace;
