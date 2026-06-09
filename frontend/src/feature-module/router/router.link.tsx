import React from "react";
import { Route } from "react-router";
import { Navigate } from "react-router-dom";

import { all_routes as routes } from "./all_routes";
import Login from "../auth/login/login";
import Login2 from "../auth/login/login-2";
import Login3 from "../auth/login/login-3";
import Register from "../auth/register/register";
import Register2 from "../auth/register/register-2";
import Register3 from "../auth/register/register-3";
import ForgotPassword from "../auth/forgotPassword/forgotPassword";
import ForgotPassword2 from "../auth/forgotPassword/forgotPassword-2";
import ForgotPassword3 from "../auth/forgotPassword/forgotPassword-3";
import ResetPassword from "../auth/resetPassword/resetPassword";
import ResetPassword2 from "../auth/resetPassword/resetPassword-2";
import ResetPassword3 from "../auth/resetPassword/resetPassword-3";
import TwoStepVerification from "../auth/twoStepVerification/twoStepVerification";
import TwoStepVerification2 from "../auth/twoStepVerification/twoStepVerification-2";
import TwoStepVerification3 from "../auth/twoStepVerification/twoStepVerification-3";
import EmailVerification from "../auth/emailVerification/emailVerification";
import EmailVerification2 from "../auth/emailVerification/emailVerification-2";
import EmailVerification3 from "../auth/emailVerification/emailVerification-3";
import LockScreen from "../auth/lockScreen";
import ComingSoon from "../pages/comingSoon";
import UnderMaintenance from "../pages/underMaintenance";
import Error404 from "../pages/error/error-404";
import Error500 from "../pages/error/error-500";

import AdminDashboard from "../mainMenu/adminDashboard";
import EmployeeDashboard from "../mainMenu/employeeDashboard/employee-dashboard";
import LeadsDashboard from "../mainMenu/leadsDashboard";
import DealsDashboard from "../mainMenu/dealsDashboard";

import EmployeeList from "../mainMenu/employeeDashboard/employee-list";
import EmployeeGrid from "../mainMenu/employeeDashboard/employee-grid";
import EmployeeDetails from "../mainMenu/employeeDashboard/employee-details";
import Departments from "../mainMenu/employeeDashboard/departments";
import Designations from "../mainMenu/employeeDashboard/designations";
import Policies from "../mainMenu/employeeDashboard/policies";
import EmployeeAdd from "../mainMenu/employeeDashboard/employee-add";

import Holidays from "../hrm/holidays";
import LeavesAdmin from "../hrm/leaves-admin";
import LeavesEmployee from "../hrm/leaves-employee";
import LeaveSettings from "../hrm/leave-settings";
import AttendanceAdmin from "../hrm/attendance-admin";
import AttendanceEmployee from "../hrm/attendance-employee";
import TimesheetsPage from "../hrm/timesheets";
import OvertimePage from "../hrm/overtime";
import ShiftRulesPage from "../hrm/shift-rules";
import ExpensesWorkspace from "../hrm/ExpensesWorkspace";
import OrgChartWorkspace from "../hrm/OrgChartWorkspace";

import Tickets from "../tickets/tickets";
import TicketDetails from "../tickets/ticket-details";
import TicketGrid from "../tickets/tickets-grid";

import Promotion from "../performance/promotion";
import PerformanceIndicator from "../performance/performanceIndicator";
import PerformanceReview from "../performance/performanceReview";
import PerformanceAppraisal from "../performance/performanceAppraisal";
import Resignation from "../performance/resignation";
import Termination from "../performance/termination";

import TrainingList from "../training/trainingList";
import TrainingType from "../training/trainingType";

import EstimatesPage from "../sales/EstimatesPage";
import InvoicesPage from "../sales/InvoicesPage";
import PaymentsPage from "../sales/PaymentsPage";
import ExpensesPage from "../sales/ExpensesPage";
import ProvidentFundPage from "../sales/ProvidentFundPage";
import TaxesPage from "../sales/TaxesPage";
import InvoiceDetails from "../sales/invoiceDetails";

import CrmEntityWorkspace from "../crm/CrmEntityWorkspace";
import CrmEntityDetails from "../crm/CrmEntityDetails";
import CrmPipelinePage from "../crm/CrmPipelinePage";
import CrmAnalyticsPage from "../crm/CrmAnalyticsPage";
import CrmActivitiesPage from "../crm/CrmActivitiesPage";

import SalaryComponentsList from "../accounts/salary-components/SalaryComponentsList";
import SalaryComponentsForm from "../accounts/salary-components/SalaryComponentsForm";
import EmployeePayrollList from "../accounts/employee-payroll/EmployeePayrollList";
import EmployeePayrollForm from "../accounts/employee-payroll/EmployeePayrollForm";
import PayslipList from "../accounts/payslips/PayslipList";
import PayslipView from "../accounts/payslips/PayslipView";
import PayrollItems from "../accounts/payroll-items";
import FinalSettlementsPage from "../accounts/FinalSettlementsPage";

import CategoriesPage from "../accounts/accounting/CategoriesPage";
import BudgetsPage from "../accounts/accounting/BudgetsPage";
import BudgetExpensesPage from "../accounts/accounting/BudgetExpensesPage";
import BudgetRevenuesPage from "../accounts/accounting/BudgetRevenuesPage";
import JobsPage from "../recruitment/JobsPage";
import CandidatesPage from "../recruitment/CandidatesPage";
import RecruitmentInterviewsPage from "../recruitment/RecruitmentInterviewsPage";
import ReferralsPage from "../recruitment/ReferralsPage";
import CareersJobsPage from "../recruitment/public/CareersJobsPage";
import CareersJobDetailPage from "../recruitment/public/CareersJobDetailPage";
import CareersApplyPage from "../recruitment/public/CareersApplyPage";
import ApplicantAccessPage from "../recruitment/public/ApplicantAccessPage";
import ApplicantDashboardPage from "../recruitment/public/ApplicantDashboardPage";
import AssetsPage from "../liveops/AssetsPage";
import AssetCategoriesPage from "../liveops/AssetCategoriesPage";
import DocumentCategoriesPage from "../liveops/DocumentCategoriesPage";
import EmployeeDocumentsPage from "../liveops/EmployeeDocumentsPage";
import OnboardingTemplatesPage from "../liveops/OnboardingTemplatesPage";
import OnboardingDeskPage from "../liveops/OnboardingDeskPage";
import ApprovalInboxPage from "../liveops/ApprovalInboxPage";
import AuditTrailPage from "../liveops/AuditTrailPage";
import ESignDesk from "../liveops/ESignDesk";
import ESignWorkspace from "../liveops/ESignWorkspace";
import ReportsWorkspace from "../liveops/ReportsWorkspace";
import SettingsControlCenter from "../liveops/SettingsControlCenter";
import ProductivityNotesPage from "../liveops/ProductivityNotesPage";
import ProductivityTodosPage from "../liveops/ProductivityTodosPage";
import ProductivityEventsPage from "../liveops/ProductivityEventsPage";
import Manageusers from "../userManagement/manageusers";
import Chat from "../application/chat";

const HR_ALLOWED = ["super_admin", "hr"];
const HR_EMPLOYEE_ALLOWED = ["super_admin", "hr", "employee"];
const EMPLOYEE_SELF_ALLOWED = ["super_admin", "hr", "employee"];
const LEAVE_REVIEW_ALLOWED = ["super_admin", "hr", "stakeholder"];
const CHAT_ALLOWED = ["super_admin", "hr", "employee", "stakeholder"];
const REPORT_ALLOWED = ["super_admin", "hr", "stakeholder"];

export const publicRoutes = [
  { path: "/", element: <Navigate to={routes.login} />, route: Route },
  { path: routes.careersJobs, element: <CareersJobsPage />, route: Route },
  { path: routes.careersJobDetails, element: <CareersJobDetailPage />, route: Route },
  { path: routes.careersJobDetailsSimple, element: <CareersJobDetailPage />, route: Route },
  { path: routes.careersApply, element: <CareersApplyPage />, route: Route },
  { path: routes.careersApplySimple, element: <CareersApplyPage />, route: Route },
  { path: routes.applicantAccess, element: <ApplicantAccessPage />, route: Route },
  { path: routes.applicantDashboard, element: <ApplicantDashboardPage />, route: Route },
  { path: routes.login, element: <Login />, route: Route },
  { path: routes.login2, element: <Login2 />, route: Route },
  { path: routes.login3, element: <Login3 />, route: Route },
  { path: routes.register, element: <Register />, route: Route },
  { path: routes.register2, element: <Register2 />, route: Route },
  { path: routes.register3, element: <Register3 />, route: Route },
  { path: routes.forgotPassword, element: <ForgotPassword />, route: Route },
  { path: routes.forgotPassword2, element: <ForgotPassword2 />, route: Route },
  { path: routes.forgotPassword3, element: <ForgotPassword3 />, route: Route },
  { path: routes.resetPassword, element: <ResetPassword />, route: Route },
  { path: routes.resetPassword2, element: <ResetPassword2 />, route: Route },
  { path: routes.resetPassword3, element: <ResetPassword3 />, route: Route },
  { path: routes.twoStepVerification, element: <TwoStepVerification />, route: Route },
  { path: routes.twoStepVerification2, element: <TwoStepVerification2 />, route: Route },
  { path: routes.twoStepVerification3, element: <TwoStepVerification3 />, route: Route },
  { path: routes.emailVerification, element: <EmailVerification />, route: Route },
  { path: routes.emailVerification2, element: <EmailVerification2 />, route: Route },
  { path: routes.emailVerification3, element: <EmailVerification3 />, route: Route },
  { path: routes.lockScreen, element: <LockScreen />, route: Route },
  { path: routes.comingSoon, element: <ComingSoon />, route: Route },
  { path: routes.underMaintenance, element: <UnderMaintenance />, route: Route },
  { path: routes.error404, element: <Error404 />, route: Route },
  { path: routes.error500, element: <Error500 />, route: Route },
];

export const protectedRoutes = [
  { path: routes.adminDashboard, element: <AdminDashboard />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.superAdminDashboard, element: <AdminDashboard />, allowedRoles: ["super_admin"] },
  { path: routes.employeeDashboard, element: <EmployeeDashboard />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.leadsDashboard, element: <LeadsDashboard />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.dealsDashboard, element: <DealsDashboard />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.chat, element: <Chat />, allowedRoles: CHAT_ALLOWED },
  { path: routes.notes, element: <ProductivityNotesPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.todo, element: <ProductivityTodosPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.TodoList, element: <ProductivityTodosPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.calendar, element: <ProductivityEventsPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.manageusers, element: <Manageusers />, allowedRoles: ["super_admin", "hr"] },

  { path: routes.contactGrid, element: <CrmEntityWorkspace entityKey="contact" variant="grid" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.contactList, element: <CrmEntityWorkspace entityKey="contact" variant="list" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.contactDetails, element: <CrmEntityDetails entityKey="contact" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.companiesGrid, element: <CrmEntityWorkspace entityKey="company" variant="grid" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.companiesList, element: <CrmEntityWorkspace entityKey="company" variant="list" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.companiesDetails, element: <CrmEntityDetails entityKey="company" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.dealsGrid, element: <CrmEntityWorkspace entityKey="deal" variant="grid" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.dealsList, element: <CrmEntityWorkspace entityKey="deal" variant="list" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.dealsDetails, element: <CrmEntityDetails entityKey="deal" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.leadsGrid, element: <CrmEntityWorkspace entityKey="lead" variant="grid" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.leadsList, element: <CrmEntityWorkspace entityKey="lead" variant="list" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.leadsDetails, element: <CrmEntityDetails entityKey="lead" />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.pipeline, element: <CrmPipelinePage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.analytics, element: <CrmAnalyticsPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.activities, element: <CrmActivitiesPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.activity, element: <CrmActivitiesPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },

  { path: routes.employeeList, element: <EmployeeList />, allowedRoles: HR_ALLOWED },
  { path: routes.employeeAdd, element: <EmployeeAdd />, allowedRoles: HR_ALLOWED },
  { path: routes.employeeGrid, element: <EmployeeGrid />, allowedRoles: HR_ALLOWED },
  { path: routes.employeedetails, element: <EmployeeDetails />, allowedRoles: EMPLOYEE_SELF_ALLOWED },
  { path: routes.employeeDetailsView, element: <EmployeeDetails />, allowedRoles: EMPLOYEE_SELF_ALLOWED },
  { path: routes.departments, element: <Departments />, allowedRoles: HR_ALLOWED },
  { path: routes.designations, element: <Designations />, allowedRoles: HR_ALLOWED },
  { path: routes.policy, element: <Policies />, allowedRoles: ["super_admin", "hr", "employee"] },

  { path: routes.holidays, element: <Holidays />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.leaveadmin, element: <LeavesAdmin />, allowedRoles: LEAVE_REVIEW_ALLOWED },
  { path: routes.leaveemployee, element: <LeavesEmployee />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.leavesettings, element: <LeaveSettings />, allowedRoles: HR_ALLOWED },
  { path: routes.attendanceadmin, element: <AttendanceAdmin />, allowedRoles: HR_ALLOWED },
  { path: routes.attendanceemployee, element: <AttendanceEmployee />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.timesheet, element: <TimesheetsPage />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.scheduletiming, element: <ShiftRulesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.overtime, element: <OvertimePage />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.expenseClaims, element: <ExpensesWorkspace resource="/expense-claims/" title="My Expense Claims" subtitle="Track and submit your business expense reimbursements." buttonLabel="Submit Expense Claim" audience="My" mode="employee" />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.expenseApprovals, element: <ExpensesWorkspace resource="/expense-claims/" title="Expense Claims Review" subtitle="Approve, reject, and verify employee reimbursement claims." buttonLabel="Review Claim" audience="All" mode="approval" />, allowedRoles: HR_ALLOWED },
  { path: routes.orgChart, element: <OrgChartWorkspace />, allowedRoles: HR_EMPLOYEE_ALLOWED },

  { path: routes.tickets, element: <Tickets />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.ticketList, element: <Tickets />, allowedRoles: HR_EMPLOYEE_ALLOWED },
  { path: routes.ticketGrid, element: <TicketGrid />, allowedRoles: HR_ALLOWED },
  { path: routes.ticketDetails, element: <TicketDetails />, allowedRoles: HR_EMPLOYEE_ALLOWED },

  { path: routes.performanceIndicator, element: <PerformanceIndicator />, allowedRoles: HR_ALLOWED },
  { path: routes.performanceReview, element: <PerformanceReview />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.performanceAppraisal, element: <PerformanceAppraisal />, allowedRoles: HR_ALLOWED },
  { path: routes.promotion, element: <Promotion />, allowedRoles: HR_ALLOWED },
  { path: routes.resignation, element: <Resignation />, allowedRoles: HR_ALLOWED },
  { path: routes.termination, element: <Termination />, allowedRoles: HR_ALLOWED },

  { path: routes.trainingList, element: <TrainingList />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.trainingType, element: <TrainingType />, allowedRoles: HR_ALLOWED },

  { path: routes.jobgrid, element: <JobsPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.joblist, element: <JobsPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.candidatesGrid, element: <CandidatesPage variant="cards" />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.candidateslist, element: <CandidatesPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.candidateskanban, element: <CandidatesPage variant="cards" />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.recruitmentInterviews, element: <RecruitmentInterviewsPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.refferal, element: <ReferralsPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },

  { path: routes.estimate, element: <EstimatesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.invoices, element: <InvoicesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.salesInvoiceDetails, element: <InvoiceDetails />, allowedRoles: HR_ALLOWED },
  { path: routes.payments, element: <PaymentsPage />, allowedRoles: HR_ALLOWED },
  { path: routes.expenses, element: <ExpensesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.providentfund, element: <ProvidentFundPage />, allowedRoles: HR_ALLOWED },
  { path: routes.taxes, element: <TaxesPage />, allowedRoles: HR_ALLOWED },

  { path: routes.salaryComponents, element: <SalaryComponentsList />, allowedRoles: HR_ALLOWED },
  { path: routes.salaryComponentsCreate, element: <SalaryComponentsForm />, allowedRoles: HR_ALLOWED },
  { path: routes.salaryComponentsEdit, element: <SalaryComponentsForm />, allowedRoles: HR_ALLOWED },
  { path: routes.employeePayroll, element: <EmployeePayrollList />, allowedRoles: HR_ALLOWED },
  { path: routes.employeesalary, element: <EmployeePayrollList />, allowedRoles: HR_ALLOWED },
  { path: routes.employeePayrollCreate, element: <EmployeePayrollForm />, allowedRoles: HR_ALLOWED },
  { path: routes.employeePayrollEdit, element: <EmployeePayrollForm />, allowedRoles: HR_ALLOWED },
  { path: routes.addPayroll, element: <EmployeePayrollForm />, allowedRoles: HR_ALLOWED },
  { path: routes.payslips, element: <PayslipList />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.payslip, element: <PayslipList />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.payslipsView, element: <PayslipView />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.payrollItems, element: <PayrollItems />, allowedRoles: HR_ALLOWED },
  { path: routes.finalSettlements, element: <FinalSettlementsPage />, allowedRoles: HR_ALLOWED },
  { path: routes.payrollAddition, element: <PayrollItems />, allowedRoles: HR_ALLOWED },
  { path: routes.payrollOvertime, element: <PayrollItems />, allowedRoles: HR_ALLOWED },
  { path: routes.payrollDeduction, element: <PayrollItems />, allowedRoles: HR_ALLOWED },

  { path: routes.categories, element: <CategoriesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.budgets, element: <BudgetsPage />, allowedRoles: HR_ALLOWED },
  { path: routes.budgetexpenses, element: <BudgetExpensesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.budgetrevenues, element: <BudgetRevenuesPage />, allowedRoles: HR_ALLOWED },

  { path: routes.assetList, element: <AssetsPage />, allowedRoles: HR_ALLOWED },
  { path: routes.assetCategories, element: <AssetCategoriesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.documentCategories, element: <DocumentCategoriesPage />, allowedRoles: HR_ALLOWED },
  { path: routes.employeeDocuments, element: <EmployeeDocumentsPage />, allowedRoles: ["super_admin", "hr", "employee"] },
  { path: routes.onboardingTemplates, element: <OnboardingTemplatesPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.onboardingDesk, element: <OnboardingDeskPage />, allowedRoles: ["super_admin", "hr", "employee", "stakeholder"] },
  { path: routes.approvalInbox, element: <ApprovalInboxPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.auditTrail, element: <AuditTrailPage />, allowedRoles: ["super_admin", "hr", "stakeholder"] },
  { path: routes.eSignDesk, element: <ESignDesk />, allowedRoles: ["super_admin", "hr"] },
  { path: routes.eSignWorkspace, element: <ESignWorkspace />, allowedRoles: ["super_admin", "hr", "employee"] },

  { path: routes.expensesreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.invoicereport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.paymentreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.projectreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.taskreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.userreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.employeereport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.payslipreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.attendancereport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.leavereport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },
  { path: routes.dailyreport, element: <ReportsWorkspace />, allowedRoles: REPORT_ALLOWED },

  { path: routes.approvalSettings, element: <SettingsControlCenter />, allowedRoles: HR_ALLOWED },
  { path: routes.notificationssettings, element: <SettingsControlCenter />, allowedRoles: HR_ALLOWED },
  { path: routes.leaveType, element: <SettingsControlCenter />, allowedRoles: HR_ALLOWED },
];
