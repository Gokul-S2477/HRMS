import React from "react";
import { Navigate } from "react-router-dom";

import { all_routes } from "../../router/all_routes";

const Register2 = () => <Navigate to={all_routes.register} replace />;

export default Register2;
