# HRMS Role Test Checklist

## Shared Smoke Checks
- Use separate sessions for `super_admin`, `hr`, `stakeholder`, and `employee`.
- Confirm the route guard blocks direct URL access for pages outside each role.
- Confirm API responses match the UI guardrails: a blocked page should also return `403` or scoped data from the server.
- Confirm the floating settings button opens, the offcanvas stays aligned, and only HRMS-safe layouts (`Default`, `Mini`) are available.

## Super Admin
- Login should land on the command center.
- Can open CRM, Employee, HRM, Recruitment, Finance, Administration, User Access, Chat, Reports, and Settings.
- Can manage HR, stakeholder, and employee accounts.
- Can manage document categories, employee documents, onboarding templates, onboarding desk, approvals, and audit trail.
- Can view payroll, final settlements, offboarding, assets, and recruitment.
- Can read notifications and open chat threads.

## HR
- Login should land on the command center.
- Can create employees and employee logins, but should not manage super admin accounts.
- Can approve or reject leave with notice timing metadata.
- Can manage attendance, timesheets, overtime, recruitment, payroll, accounting, assets, reports, onboarding, approvals, and settings.
- Can verify employee documents and see all employee documents.
- Can manage onboarding templates and complete onboarding records/tasks.
- Can access approval inbox and audit trail.
- Can use chat with employees, stakeholders, and admins.

## Stakeholder
- Login should land on analytics.
- Can access analytics, pipeline, activities, reports, chat, leave inbox, approval inbox, audit trail, onboarding desk, onboarding templates, and recruitment read views.
- Can approve or reject leave from the leave inbox when stakeholder approval is enabled.
- Can view audit history, candidate pipelines, and contact candidates through the recruitment UI.
- Cannot manage employee directory, employee logins, payroll setup, document categories, onboarding template writes, asset management, or settings control pages.
- Generic CRM read access should work, but generic create/update/delete actions should be blocked unless specifically allowed.

## Employee
- Login should land on `My Workspace`.
- Can open only self-service pages: profile, payslips, holidays, leave, attendance, timesheets, overtime, tickets, training, chat, employee documents, and own onboarding desk.
- Can request leave but cannot approve or reject it.
- Can create or edit only own timesheets, overtime entries, tickets, and employee documents.
- Can view only own leave balances, leave ledger, asset assignments, payroll records, employee documents, onboarding records/tasks, tickets, and training sessions.
- Cannot open recruitment, accounting, sales, reports overview, approval inbox, audit trail, settings, or user management.

## Chat WebSocket
- Open chat in two browser sessions with different roles.
- New messages should appear without manual refresh.
- Typing indicator should show for the active thread.
- Presence should move between online and offline states.
- Read receipts should update after the other participant opens the thread.
- If `CHAT_REALTIME_BACKEND=redis` is configured with the `redis` package installed, repeat the test with two backend processes to confirm cross-process delivery.
- Fallback mode should still work if the socket disconnects.

## Leave Engine
- Employee request should create a pending hold in leave ledger.
- HR or stakeholder approval should convert hold to approved debit.
- Rejection should remove the hold.
- Holiday and weekend days should not be counted as leave days.
- Employee dashboard should reflect pre-informed and post-informed leave days.

## Attendance Operations
- Employee-submitted timesheets should remain `draft` or `submitted` only.
- HR approval should stamp approver and approval time.
- Employee overtime requests should remain `requested` until HR acts.
- HR approval should calculate payroll amount and approval metadata.
- Shift rules should drive late minutes, early exit, and payroll-impact hours.

## Payroll & Final Settlement
- Employees should see only their own payroll records.
- Employees should not see salary components, compliance profiles, or final settlements.
- HR should be able to recalculate, publish, and lock payroll.
- Offboarding approval should create or refresh a final settlement record.
- Settlement approval and `mark paid` should update the linked offboarding case.

## Documents & Onboarding
- Employee uploads should become `pending` and notify HR.
- HR verification should stamp verifier and verification time.
- Employees should only see their own documents and onboarding plans/tasks.
- Stakeholders should have read-only onboarding visibility.
- HR should be able to sync onboarding tasks from template and complete records.

## Recruitment
- Public careers pages should show open public jobs.
- Applicant email code login should prevent repeated anonymous applications for the same job.
- HR can manage jobs, candidates, referrals, and candidate progression.
- Stakeholder can view jobs/candidates/referrals and log candidate contact, but cannot create or edit jobs.
- Employee access should be denied.

## Assets
- HR can manage asset categories and asset assignments.
- Employee can view only own assigned assets.
- Stakeholder access should be denied.

## Reports & Settings
- Reports overview should be blocked for employees and available for HR/stakeholders/admin.
- Settings control center should be available only to HR/admin.
- Approval inbox counts should reflect pending leave/timesheet/overtime/payroll/final settlement/offboarding items.
- Audit trail should be visible only to HR/stakeholders/admin.
