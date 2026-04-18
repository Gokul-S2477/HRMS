import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Outlet, useLocation } from "react-router-dom";

import Header from "../core/common/header";
import Sidebar from "../core/common/sidebar";
import ThemeSettings from "../core/common/theme-settings";
import DeleteModal from "../core/modals/deleteModal";

import "bootstrap/dist/js/bootstrap.bundle.min.js";

interface FeatureProps {
  children?: ReactNode;
}

const Feature: React.FC<FeatureProps> = ({ children }) => {
  const location = useLocation();

  const headerCollapse = useSelector((state: any) => state.themeSetting?.headerCollapse ?? false);
  const mobileSidebar = useSelector((state: any) => state.sidebarSlice?.mobileSidebar ?? false);
  const miniSidebar = useSelector((state: any) => state.sidebarSlice?.miniSidebar ?? false);
  const expandMenu = useSelector((state: any) => state.sidebarSlice?.expandMenu ?? false);

  const dataWidth = useSelector((state: any) => state.themeSetting?.dataWidth ?? "fluid");
  const rawLayout = useSelector((state: any) => state.themeSetting?.dataLayout ?? "default");
  const dataLayout = rawLayout === "mini" ? "mini" : "default";
  const dataTheme = useSelector((state: any) => state.themeSetting?.dataTheme ?? "light");
  const dataTopBar = useSelector((state: any) => state.themeSetting?.dataTopBar ?? "white");
  const dataTopBarColor = useSelector((state: any) => state.themeSetting?.dataTopBarColor ?? "white");
  const dataColor = useSelector((state: any) => state.themeSetting?.dataColor ?? "sunset");
  const dataSidebarAll = useSelector((state: any) => state.themeSetting?.dataSidebarAll ?? "");
  const dataColorAll = useSelector((state: any) => state.themeSetting?.dataColorAll ?? "");
  const dataTopBarColorAll = useSelector((state: any) => state.themeSetting?.dataTopBarColorAll ?? "");
  const dataTopbarAll = useSelector((state: any) => state.themeSetting?.dataTopbarAll ?? "");
  const dataLoader = useSelector((state: any) => state.themeSetting?.dataLoader ?? "disable");

  const [showLoader, setShowLoader] = React.useState(true);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-layout", dataLayout);
    document.documentElement.setAttribute("data-width", dataWidth);
    document.documentElement.setAttribute("data-topbar", dataTopBar);
    document.documentElement.setAttribute("data-topbarcolor", dataTopBarColor);
    document.documentElement.setAttribute("data-color", dataColor);
    if (dataTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [dataColor, dataLayout, dataTheme, dataTopBar, dataTopBarColor, dataWidth]);

  React.useEffect(() => {
    if (dataLoader === "enable") {
      setShowLoader(true);
      const timeout = setTimeout(() => setShowLoader(false), 1200);
      return () => clearTimeout(timeout);
    }
    setShowLoader(false);
  }, [location.pathname, dataLoader]);

  return (
    <>
      <style>
        {`
          :root {
            --sidebar--rgb-picr: ${dataSidebarAll};
            --topbar--rgb-picr: ${dataTopbarAll};
            --topbarcolor--rgb-picr: ${dataTopBarColorAll};
            --primary-rgb-picr: ${dataColorAll};
          }
        `}
      </style>

      <div
        className={`
          ${dataLayout === "mini" || dataWidth === "box" ? "mini-sidebar" : ""}
          ${miniSidebar && dataLayout !== "mini" ? "mini-sidebar" : ""}
          ${dataWidth === "box" ? "layout-box-mode" : ""}
          ${headerCollapse ? "header-collapse" : ""}
          ${(expandMenu && miniSidebar) || (expandMenu && dataLayout === "mini") ? "expand-menu" : ""}
        `}
      >
        {showLoader ? (
          <div id="global-loader">
            <div className="page-loader"></div>
          </div>
        ) : null}

        <div className={`main-wrapper ${mobileSidebar ? "slide-nav" : ""}`}>
          <Header />
          <Sidebar />
          {children ? children : <Outlet />}
          <DeleteModal />
          {!location.pathname.includes("layout") ? <ThemeSettings /> : null}
        </div>

        <div className="sidebar-overlay"></div>
      </div>
    </>
  );
};

export default Feature;
