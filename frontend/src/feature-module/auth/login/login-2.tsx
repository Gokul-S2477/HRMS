import React from "react";
import { Navigate } from "react-router-dom";

import { all_routes } from "../../router/all_routes";

const Login2 = () => <Navigate to={all_routes.login} replace />;

export default Login2;
