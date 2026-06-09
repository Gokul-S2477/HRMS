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

const roleColorMap: Record<string, string> = {
  super_admin: "role-super",
  hr: "role-hr",
  employee: "role-emp",
  stakeholder: "role-stake",
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
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  React.useEffect(() => {
    if (showHeader) {
      document.body.classList.remove("header-is-hidden");
    } else {
      document.body.classList.add("header-is-hidden");
    }
    return () => document.body.classList.remove("header-is-hidden");
  }, [showHeader]);

  // Close profile dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(".nh-profile-dropdown")) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const homeRoute = getHomeRouteForRole(role);
  const displayName = user?.display_name || user?.username || "Workspace User";
  const email = user?.email || "";
  const roleLabel = roleLabelMap[role] || "Team Member";
  const roleBadgeClass = roleColorMap[role] || "role-emp";
  const employeeCode = user?.employee_profile?.emp_code;
  const profileRoute = role === "stakeholder" ? all_routes.analytics : all_routes.employeedetails;
  const navigationContext = useMemo(() => getNavigationContext(role, location.pathname), [role, location.pathname]);

  const quickLinks = useMemo(
    () => [
      { label: "Chat", route: all_routes.chat, icon: "brand-hipchat", visible: true },
      { label: "Profile", route: profileRoute, icon: role === "stakeholder" ? "chart-bar" : "id-badge-2", visible: role !== "stakeholder" || Boolean(user) },
      { label: "Payslips", route: all_routes.payslips, icon: "receipt-2", visible: ["super_admin", "hr", "employee"].includes(role) },
      { label: "Users", route: all_routes.manageusers, icon: "shield-lock", visible: Boolean(user?.can_manage_accounts) },
      { label: "Analytics", route: all_routes.analytics, icon: "chart-bar", visible: ["super_admin", "hr", "stakeholder"].includes(role) },
    ].filter((item) => item.visible),
    [profileRoute, role, user]
  );

  const toggleMobileSidebar = () => dispatch(setMobileSidebar(!mobileSidebar));

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
      document.documentElement.requestFullscreen?.().catch(() => undefined);
      setIsFullscreen(true);
    } else if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
    }
  };

  return (
    <div className="header">
      <div className="main-header nh-header-shell">

        {/* ── LEFT: Brand + Sidebar Toggle + Nav Context ── */}
        <div className="nh-header-left">
          {/* Brand */}
          <Link to={homeRoute} className="nh-brand">
            <span className="nh-brand-mark">
              <i className="ti ti-building-skyscraper" />
            </span>
            <span className="nh-brand-text">
              <strong>SmartHR</strong>
              <small>Enterprise Workspace</small>
            </span>
          </Link>

          {/* Sidebar toggle desktop */}
          <button
            id="toggle_btn"
            type="button"
            onClick={handleToggleMiniSidebar}
            className="nh-icon-btn"
            aria-label="Toggle sidebar"
          >
            <i className="ti ti-layout-sidebar-left-collapse" />
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="nh-icon-btn nh-mobile-menu d-lg-none"
            onClick={toggleMobileSidebar}
            aria-label="Open menu"
          >
            <i className="ti ti-menu-2" />
          </button>

          {/* Nav context chip — desktop */}
          <div className="nh-breadcrumb d-none d-xl-flex">
            <span className="nh-breadcrumb-icon">
              <i className={`ti ti-${navigationContext?.itemIcon || navigationContext?.parentIcon || "sparkles"}`} />
            </span>
            <div className="nh-breadcrumb-text">
              <span className="nh-breadcrumb-section">{navigationContext?.sectionTitle || "Workspace"}</span>
              <span className="nh-breadcrumb-page">{navigationContext?.itemLabel || "Premium HRMS"}</span>
            </div>
          </div>
        </div>

        {/* ── CENTRE: Search Bar ── */}
        <div className="nh-search-wrap">
          <div className="nh-search-box">
            <i className="ti ti-search nh-search-ico" />
            <input
              type="text"
              className="nh-search-input"
              placeholder="Search people, payroll, leave, tickets, reports…"
            />
            <kbd className="nh-search-kbd d-none d-md-flex">CTRL + /</kbd>
          </div>
        </div>

        {/* ── RIGHT: Actions + Profile ── */}
        <div className="nh-header-right">
          {/* Role badge */}
          <span className={`nh-role-pill ${roleBadgeClass} d-none d-xl-inline-flex`}>
            <i className="ti ti-rosette-discount-check" />
            {roleLabel}
            {employeeCode ? <strong>{employeeCode}</strong> : null}
          </span>

          {/* Icon tray */}
          <div className="nh-icon-tray">
            <Link to={all_routes.chat} className="nh-icon-btn" aria-label="Chat">
              <i className="ti ti-message-circle-2" />
            </Link>
            <NotificationBell />
            <button type="button" onClick={toggleFullscreen} className="nh-icon-btn" aria-label="Full screen">
              <i className={`ti ${isFullscreen ? "ti-minimize" : "ti-maximize"}`} />
            </button>
          </div>

          {/* Profile dropdown */}
          <div className={`nh-profile-dropdown ${profileOpen ? "nh-profile-open" : ""}`}>
            <button
              type="button"
              className="nh-avatar-btn"
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="User menu"
            >
              <span className="nh-avatar-ring">
                <span className="nh-avatar-initials">{initialsFromName(displayName)}</span>
              </span>
              <span className="nh-avatar-meta d-none d-xl-block">
                <strong>{displayName}</strong>
                <small>{email || roleLabel}</small>
              </span>
              <i className="ti ti-chevron-down nh-avatar-caret d-none d-xl-inline" />
            </button>

            {profileOpen && (
              <div className="nh-profile-panel">
                {/* Panel header */}
                <div className="nh-panel-header">
                  <div className="nh-panel-avatar">
                    <span className="nh-panel-initials">{initialsFromName(displayName)}</span>
                    <span className="nh-online-dot" />
                  </div>
                  <div className="nh-panel-meta">
                    <strong>{displayName}</strong>
                    <span>{email}</span>
                    <span className={`nh-panel-badge ${roleBadgeClass}`}>{roleLabel}</span>
                  </div>
                </div>

                {/* Quick navigation links */}
                <nav className="nh-panel-nav">
                  {quickLinks.map((item) => (
                    <Link
                      key={item.label}
                      to={item.route}
                      className="nh-panel-link"
                      onClick={() => setProfileOpen(false)}
                    >
                      <span className="nh-panel-link-ico">
                        <i className={`ti ti-${item.icon}`} />
                      </span>
                      {item.label}
                      <i className="ti ti-chevron-right nh-panel-link-arrow" />
                    </Link>
                  ))}
                </nav>

                {/* Logout */}
                <div className="nh-panel-footer">
                  <button type="button" className="nh-logout-btn" onClick={logout}>
                    <i className="ti ti-logout" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Header;
