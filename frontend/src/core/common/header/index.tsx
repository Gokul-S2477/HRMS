import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { setDataLayout } from "../../data/redux/themeSettingSlice";
import ImageWithBasePath from "../imageWithBasePath";
import { setMobileSidebar, toggleMiniSidebar } from "../../data/redux/sidebarSlice";
import { all_routes } from "../../../feature-module/router/all_routes";
import { useAuth } from "../../auth/AuthContext";
import { getHomeRouteForRole } from "../../auth/roleAccess";
import NotificationBell from "./NotificationBell";
import { getNavigationContext } from "../../data/json/appNavigation";

const roleLabelMap: Record<string, string> = {
  super_admin: "Super Admin",
  hr: "HR Manager",
  employee: "Employee",
  stakeholder: "Stakeholder",
};

const initialsFromName = (value?: string | null) => {
  const name = String(value || "User").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
};

const Header = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const dataLayout = useSelector((state: any) => state.themeSetting.dataLayout);
  const mobileSidebar = useSelector((state: any) => state.sidebarSlice.mobileSidebar);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const homeRoute = getHomeRouteForRole(role);
  const displayName = user?.display_name || user?.username || "Workspace User";
  const email = user?.email || "";
  const roleLabel = roleLabelMap[role] || "Team Member";
  const employeeCode = user?.employee_profile?.emp_code;
  const profileRoute = role === "stakeholder" ? all_routes.analytics : all_routes.employeedetails;
  const navigationContext = useMemo(() => getNavigationContext(role, location.pathname), [role, location.pathname]);

  const quickLinks = useMemo(
    () => [
      { label: "Chat", route: all_routes.chat, icon: "brand-hipchat", tone: "chat", visible: true },
      { label: "Profile", route: profileRoute, icon: role === "stakeholder" ? "chart-bar" : "id-badge-2", tone: "profile", visible: role !== "stakeholder" || Boolean(user) },
      { label: "Payslips", route: all_routes.payslips, icon: "receipt-2", tone: "payroll", visible: ["super_admin", "hr", "employee"].includes(role) },
      { label: "Users", route: all_routes.manageusers, icon: "shield-lock", tone: "security", visible: Boolean(user?.can_manage_accounts) },
      { label: "Analytics", route: all_routes.analytics, icon: "chart-bar", tone: "insights", visible: ["super_admin", "hr", "stakeholder"].includes(role) },
    ].filter((item) => item.visible),
    [profileRoute, role, user]
  );

  const toggleMobileSidebar = () => {
    dispatch(setMobileSidebar(!mobileSidebar));
  };

  const handleToggleMiniSidebar = () => {
    if (dataLayout === "mini") {
      dispatch(setDataLayout("default"));
      localStorage.setItem("dataLayout", "default");
    } else {
      dispatch(toggleMiniSidebar());
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => undefined);
        setIsFullscreen(true);
      }
    } else if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
    }
  };

  return (
    <div className="header">
      <div className="main-header hrms-header-shell">
        <div className="header-left hrms-brand-lockup">
          <Link to={homeRoute} className="logo hrms-logo-lockup">
            <span className="hrms-logo-mark">HR</span>
            <span className="hrms-logo-copy d-none d-xl-flex">
              <strong>SmartHR</strong>
              <small>Premium workspace</small>
            </span>
          </Link>
          <Link to={homeRoute} className="dark-logo d-none">
            <ImageWithBasePath src="assets/img/logo-white.svg" alt="Logo" />
          </Link>
        </div>

        <Link id="mobile_btn" onClick={toggleMobileSidebar} className="mobile_btn" to="#sidebar">
          <span className="bar-icon">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </Link>

        <div className="header-user flex-grow-1">
          <div className="nav user-menu nav-list hrms-topbar">
            <div className="hrms-topbar-left">
              <Link id="toggle_btn" to="#" onClick={handleToggleMiniSidebar} className="hrms-icon-btn">
                <i className="ti ti-layout-sidebar-left-collapse"></i>
              </Link>

              <div className="hrms-module-chip">
                <span className="hrms-module-chip-icon">
                  <i className={`ti ti-${navigationContext?.itemIcon || navigationContext?.parentIcon || "sparkles"}`}></i>
                </span>
                <div className="min-w-0">
                  <span className="hrms-module-chip-kicker">{navigationContext?.sectionTitle || "Workspace"}</span>
                  <div className="hrms-module-chip-title text-truncate">{navigationContext?.itemLabel || "Premium HRMS"}</div>
                </div>
              </div>
            </div>

            <div className="hrms-search-shell">
              <div className="hrms-search-input-wrap">
                <span className="hrms-search-icon">
                  <i className="ti ti-search"></i>
                </span>
                <input type="text" className="form-control hrms-search-input" placeholder="Search people, payroll, leave, tickets, reports" />
                <span className="hrms-search-shortcut d-none d-md-inline-flex">
                  <kbd>CTRL</kbd>
                  <span>+</span>
                  <kbd>/</kbd>
                </span>
              </div>
              <div className="hrms-search-meta d-none d-xl-flex">
                <span><i className="ti ti-shield-check"></i> Secure role-based workspace</span>
                <span><i className="ti ti-bolt"></i> Live chat and approvals</span>
              </div>
            </div>

            <div className="hrms-topbar-actions">
              <div className="hrms-quick-actions d-none d-lg-flex">
                {quickLinks.slice(0, 4).map((item) => (
                  <Link key={item.label} to={item.route} className={`hrms-action-pill tone-${item.tone}`}>
                    <i className={`ti ti-${item.icon}`}></i>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>

              <span className="hrms-role-badge d-none d-md-inline-flex align-items-center">
                <i className="ti ti-rosette-discount-check me-2"></i>
                {roleLabel}
                {employeeCode ? <strong className="ms-2">{employeeCode}</strong> : null}
              </span>

              <Link to={all_routes.chat} className="hrms-icon-btn hrms-chat-btn position-relative" aria-label="Open chat">
                <i className="ti ti-brand-hipchat"></i>
              </Link>
              <NotificationBell />
              <button type="button" onClick={toggleFullscreen} className="hrms-icon-btn" aria-label="Toggle full screen">
                <i className={`ti ${isFullscreen ? "ti-minimize" : "ti-maximize"}`}></i>
              </button>

              <div className="dropdown profile-dropdown">
                <Link to="#" className="hrms-profile-trigger dropdown-toggle" data-bs-toggle="dropdown">
                  <div className="hrms-profile-copy d-none d-xl-block">
                    <strong>{displayName}</strong>
                    <span>{email || roleLabel}</span>
                  </div>
                  <span className="avatar avatar-sm online">
                    <span className="avatar-title rounded-circle bg-primary text-white fw-bold">
                      {initialsFromName(displayName)}
                    </span>
                  </span>
                </Link>
                <div className="dropdown-menu shadow-none dropdown-menu-end hrms-profile-menu">
                  <div className="card mb-0 border-0 shadow-sm">
                    <div className="card-header border-0 pb-0">
                      <div className="d-flex align-items-center gap-3">
                        <span className="avatar avatar-lg avatar-rounded">
                          <span className="avatar-title rounded-circle bg-primary text-white fw-bold fs-5">
                            {initialsFromName(displayName)}
                          </span>
                        </span>
                        <div className="min-w-0">
                          <h5 className="mb-1 text-truncate">{displayName}</h5>
                          <p className="fs-12 fw-medium mb-1 text-truncate">{email}</p>
                          <span className="badge badge-soft-primary">{roleLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="card-body">
                      {quickLinks.map((item) => (
                        <Link key={item.label} className="dropdown-item d-inline-flex align-items-center p-0 py-2" to={item.route}>
                          <i className={`ti ti-${item.icon} me-2`}></i>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="card-footer bg-white">
                      <button type="button" onClick={logout} className="btn btn-dark w-100">
                        <i className="ti ti-logout me-2"></i>
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dropdown mobile-user-menu">
          <Link to="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <i className="fa fa-ellipsis-v"></i>
          </Link>
          <div className="dropdown-menu dropdown-menu-end">
            {quickLinks.map((item) => (
              <Link key={item.label} className="dropdown-item" to={item.route}>
                {item.label}
              </Link>
            ))}
            <button type="button" className="dropdown-item" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
