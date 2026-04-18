import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { base_path } from "./environment";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./style/css/feather.css";
import "./index.scss";
import "./style/icon/boxicons/boxicons/css/boxicons.min.css";
import "./style/icon/weather/weathericons.css";
import "./style/icon/typicons/typicons.css";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./style/icon/ionic/ionicons.css";
import "./style/icon/tabler-icons/webfont/tabler-icons.css";

import store from "./core/data/redux/store";
import { Provider } from "react-redux";

import ALLRoutes from "./feature-module/router/router";
import { AuthProvider } from "./core/auth/AuthContext";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={base_path}>
        <AuthProvider>
          <ALLRoutes />
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
