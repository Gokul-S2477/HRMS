import React from "react";
import { Outlet, useLocation } from "react-router-dom";

// Type definition (for clean TS)
interface AuthFeatureProps {}

const AuthFeature: React.FC<AuthFeatureProps> = () => {
  const location = useLocation();

  // Layout pages that should be centered
  const layoutPages = [
    "/coming-soon",
    "/under-maintenance",
    "/under-construction",
  ];

  const isSpecialLayout = layoutPages.includes(location.pathname);

  return (
    <div
      className={`bg-linear-gradiant ${
        isSpecialLayout ? "d-flex align-items-center justify-content-center" : ""
      }`}
      style={{ minHeight: "100vh" }}
    >
      <div className="main-wrapper">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthFeature;
