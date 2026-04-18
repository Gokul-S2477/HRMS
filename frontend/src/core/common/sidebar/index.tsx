import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";

import { setExpandMenu } from "../../data/redux/sidebarSlice";
import { getAppNavigation, type AppMenuItem } from "../../data/json/appNavigation";
import { useAuth } from "../../auth/AuthContext";
import { getHomeRouteForRole } from "../../auth/roleAccess";
import { all_routes } from "../../../feature-module/router/all_routes";

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

const containsPath = (item: AppMenuItem, pathname: string): boolean => {
  if (item.link && item.link !== "#") {
    const normalizedLink = item.link.replace(/:\w+/g, "");
    if (pathname === normalizedLink || pathname.startsWith(`${normalizedLink}/`)) {
      return true;
    }
  }
  return Boolean(item.children?.some((child) => containsPath(child, pathname)));
};

const SidebarNode: React.FC<{
  item: AppMenuItem;
  pathname: string;
  openKeys: string[];
  onToggle: (key: string) => void;
  depth?: number;
}> = ({ item, pathname, openKeys, onToggle, depth = 0 }) => {
  const hasChildren = Boolean(item.children?.length);
  const key = `${depth}-${item.label}`;
  const isOpen = openKeys.includes(key) || containsPath(item, pathname);
  const isActive = containsPath(item, pathname);
  const iconName = item.icon || (depth === 0 ? "layout-grid-add" : "point-filled");

  return (
    <li className={hasChildren ? "submenu" : ""} data-depth={depth}>
      <Link
        to={hasChildren ? "#" : item.link || "#"}
        onClick={(event) => {
          if (hasChildren) {
            event.preventDefault();
            onToggle(key);
          }
        }}
        className={`${isOpen && hasChildren ? "subdrop" : ""} ${isActive ? "active" : ""}`.trim()}
      >
        <span className={`sidebar-node-icon depth-${depth}`}>
          <i className={`ti ti-${iconName}`}></i>
        </span>
        <span className="sidebar-node-label">{item.label}</span>
        {hasChildren ? <span className="menu-arrow" /> : null}
      </Link>
      {hasChildren ? (
        <ul style={{ display: isOpen ? "block" : "none" }}>
          {item.children?.map((child) => (
            <SidebarNode
              key={`${key}-${child.label}`}
              item={child}
              pathname={pathname}
              openKeys={openKeys}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

const Sidebar = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { role, user } = useAuth();
  const [menuSearch, setMenuSearch] = useState("");
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const homeRoute = getHomeRouteForRole(role);
  const profileRoute = role === "stakeholder" ? all_routes.analytics : all_routes.employeedetails;
  const profileLabel = role === "stakeholder" ? "Insights" : "Profile";
  const canManageAccounts = Boolean(user?.can_manage_accounts);

  const sections = useMemo(() => getAppNavigation(role, menuSearch), [role, menuSearch]);

  useEffect(() => {
    const nextKeys: string[] = [];
    sections.forEach((section) => {
      section.items.forEach((item) => {
        const topKey = `0-${item.label}`;
        if (containsPath(item, location.pathname)) {
          nextKeys.push(topKey);
        }
        item.children?.forEach((child) => {
          if (containsPath(child, location.pathname)) {
            nextKeys.push(topKey, `1-${child.label}`);
          }
        });
      });
    });
    if (nextKeys.length) {
      setOpenKeys((prev) => Array.from(new Set([...prev, ...nextKeys])));
    }
  }, [location.pathname, sections]);

  const toggleNode = (key: string) => {
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
    );
  };

  const onMouseEnter = () => dispatch(setExpandMenu(true));
  const onMouseLeave = () => dispatch(setExpandMenu(false));

  const displayName = user?.display_name || user?.username || "Workspace User";
  const subtitle = roleLabelMap[role] || "Team Member";
  const employeeCode = user?.employee_profile?.emp_code;

  return (
    <div
      className="sidebar"
      id="sidebar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="sidebar-logo hrms-sidebar-brand">
        <Link to={homeRoute} className="logo logo-normal hrms-sidebar-logo">
          <span className="sidebar-brand-mark">HR</span>
          <span className="sidebar-brand-copy">
            <strong>SmartHR</strong>
            <small>Premium HRMS</small>
          </span>
        </Link>
        <Link to={homeRoute} className="logo-small hrms-sidebar-logo-compact">
          <span className="sidebar-brand-mark small">HR</span>
        </Link>
      </div>

      <div className="sidebar-header p-3 pb-2">
        <div className="sidebar-profile-card mb-3">
          <div className="d-flex align-items-center gap-3">
            <div className="avatar avatar-lg">
              <span className="avatar-title rounded-circle bg-primary-subtle text-primary fw-bold">
                {initialsFromName(displayName)}
              </span>
            </div>
            <div className="min-w-0 flex-grow-1">
              <h6 className="mb-1 text-truncate">{displayName}</h6>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="badge badge-soft-primary">{subtitle}</span>
                {employeeCode ? <span className="badge badge-soft-light">{employeeCode}</span> : null}
              </div>
            </div>
          </div>
          <div className="sidebar-profile-actions">
            <Link to={profileRoute} className="sidebar-profile-action light">
              <i className="ti ti-id-badge-2"></i>
              <span>{profileLabel}</span>
            </Link>
            <Link to={all_routes.chat} className="sidebar-profile-action accent">
              <i className="ti ti-brand-hipchat"></i>
              <span>Chat</span>
            </Link>
            {canManageAccounts ? (
              <Link to={all_routes.manageusers} className="sidebar-profile-action outline full">
                <i className="ti ti-shield-lock"></i>
                <span>Manage Login Access</span>
              </Link>
            ) : null}
          </div>
        </div>
        <div className="sidebar-search-shell input-group input-group-flat d-inline-flex">
          <span className="input-icon-addon">
            <i className="ti ti-search"></i>
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Smart search menu"
            value={menuSearch}
            onChange={(event) => setMenuSearch(event.target.value)}
          />
          <span className="input-group-text d-none d-lg-inline-flex">
            <kbd>CTRL + /</kbd>
          </span>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-inner">
          <div id="sidebar-menu" className="sidebar-menu">
            <ul>
              {sections.map((section) => (
                <React.Fragment key={section.title}>
                  <li className="menu-title">
                    <span>{section.title}</span>
                  </li>
                  {section.items.map((item) => (
                    <SidebarNode
                      key={`${section.title}-${item.label}`}
                      item={item}
                      pathname={location.pathname}
                      openKeys={openKeys}
                      onToggle={toggleNode}
                    />
                  ))}
                </React.Fragment>
              ))}
              {!sections.length ? (
                <li className="px-3 py-4 text-muted small">No menu items match your search.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
