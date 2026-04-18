import React from "react";
import { Route, Routes } from "react-router";

import { publicRoutes, protectedRoutes } from "./router.link";
import Feature from "../feature";
import AuthFeature from "../authFeature";
import ProtectedRoute from "../../core/auth/ProtectedRoute";
import RoleRoute from "../../core/auth/RoleRoute";

const Router = () => {
  return (
    <Routes>
      <Route element={<AuthFeature />}>
        {publicRoutes.map((route, idx) => (
          <Route key={idx} path={route.path} element={route.element} />
        ))}
      </Route>

      <Route element={<ProtectedRoute />}>
        {protectedRoutes.map((route, idx) => (
          <Route
            key={idx}
            path={route.path}
            element={
              <Feature>
                {route.allowedRoles ? (
                  <RoleRoute
                    allowedRoles={route.allowedRoles}
                    forbiddenPath={(route as any).forbiddenPath}
                  >
                    {route.element}
                  </RoleRoute>
                ) : (
                  route.element
                )}
              </Feature>
            }
          />
        ))}
      </Route>
    </Routes>
  );
};

export default Router;
