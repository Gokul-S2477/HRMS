# SmartHR - Premium HRMS Operations Workspace

SmartHR is a comprehensive, modern Human Resource Management System (HRMS) designed for unified people operations. It features a complete role-based dashboard system supporting Super Admins, HR Managers, Employees, and Stakeholders.

---

## 🏗️ Architecture Overview

The application is structured into two main components:
1. **Backend**: Built with **Django 5.2**, **Django REST Framework (DRF)**, **Simple JWT** (Authentication), and **Uvicorn/ASGI** for WebSocket support.
2. **Frontend**: Built with **React 18** (TypeScript), styled with modern layouts, Bootstrap, ApexCharts, and PrimeReact components.

---

## 🔑 Demo Accounts & Roles

The SQLite database (`backend/db.sqlite3`) comes pre-seeded with sample data and the following demo accounts. You can use these credentials to log in and test different role-based views and permissions:

| Role | Username | Password | Key Capabilities & Workspace |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `Admin@123` | Lands on Command Center. Full management of users, CRM, onboarding, payroll, finance, assets, and system audit logs. |
| **HR Manager** | `hr.manager` | `HR@12345` | Lands on Command Center. Manages employees, attendance/timesheets, approvals, payroll calculation, assets, recruitment, and onboarding. |
| **Employee** | `ravi.patel` | `Emp@12345` | Lands on My Workspace. Self-service profile, submits leave/timesheet/overtime requests, views payslips, assigned assets, and files. |
| **Stakeholder 1** | `stakeholder.one` | `Stake@12345` | Lands on Analytics. Access to company pipeline, recruitment read views, approval inbox, audit trail, and chat. |
| **Stakeholder 2** | `stakeholder.two` | `Stake@12346` | Lands on Analytics. Similar to Stakeholder 1. |

> [!TIP]
> The login screen has convenient **Demo Account shortcut buttons** on the left side of the login card. You can click on any of them to auto-fill the credentials.

---

## 🚀 How to Run the Application

Follow these steps to get both the Backend and Frontend running on your local machine.

### 1. Run the Backend (Django ASGI Server)

The backend needs to run on **port 8000** (`http://127.0.0.1:8000`), which is the configured `API_BASE_URL` in the React frontend.

1. Open a terminal and navigate to the `backend` directory:
   ```powershell
   cd backend
   ```
2. *(Optional)* Create and activate a python virtual environment:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```
3. *(Optional)* Install required dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Run the development server using **Uvicorn** (required to enable WebSockets/Chat features):
   ```powershell
   python -m uvicorn backend.asgi:application --port 8000 --reload
   ```
   *Note: If you do not require chat WebSocket features and just want to run standard HTTP APIs, you can run:*
   ```powershell
   python manage.py runserver 8000
   ```

### 2. Run the Frontend (React Development Server)

The frontend runs on **port 3000** (`http://localhost:3000`).

1. Open a **new** terminal window and navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
2. Install npm dependencies (if not already done):
   ```powershell
   npm install
   ```
3. Start the React development server:
   ```powershell
   npm start
   ```
4. Your browser should automatically open `http://localhost:3000`.

---

## 💬 Real-Time Chat & WebSockets

* The application includes a WebSockets chat system. By default, it operates using an **in-memory channel backend** (`CHAT_REALTIME_BACKEND=memory`).
* If you want to test cross-process delivery or high-availability mode, you can run a **Redis** instance locally and update your environment variables or backend settings to use `CHAT_REALTIME_BACKEND=redis`.

---

## 📋 Features to Explore

* **Leave Engine**: Submit a leave request as `ravi.patel`, log in as `hr.manager` to approve/reject it, and check how the leave ledger updates.
* **Attendance & Timesheets**: Submit a timesheet as an employee, and approve/calculate overtime as HR.
* **Recruitment Pipeline**: View jobs, candidate profiles, and refer candidates.
* **Payroll Processing**: As HR, recalculate, lock, and publish payrolls, which then become visible to the respective employees in their payslips view.
