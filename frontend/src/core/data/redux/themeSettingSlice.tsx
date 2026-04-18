import { createSlice } from "@reduxjs/toolkit";

const SAFE_LAYOUTS = new Set(["default", "mini"]);
const SAFE_COLORS = new Set(["sunset", "ocean", "forest", "violet", "ruby"]);

const normalizeLayout = (value?: string | null) => {
  if (value === "default_layout") return "default";
  if (value === "mini_layout") return "mini";
  if (!value) return "default";
  return SAFE_LAYOUTS.has(value) ? value : "default";
};

const normalizeTheme = (value?: string | null) => {
  if (value === "dark_data_theme") return "dark";
  return value || "light";
};

const normalizeColor = (value?: string | null) => {
  const next = String(value || "sunset").trim().toLowerCase();
  const legacyMap: Record<string, string> = {
    primary: "sunset",
    yellow: "sunset",
    info: "ocean",
    blue: "ocean",
    success: "forest",
    green: "forest",
    danger: "ruby",
    red: "ruby",
    purple: "violet",
  };
  const mapped = legacyMap[next] || next;
  return SAFE_COLORS.has(mapped) ? mapped : "sunset";
};

const normalizeTopbarColor = (value?: string | null) => value || "white";

const applyThemeState = (state: any) => {
  document.documentElement.setAttribute("data-layout", state.dataLayout);
  document.documentElement.setAttribute("data-width", state.dataWidth);
  document.documentElement.setAttribute("data-topbar", state.dataTopBar);
  document.documentElement.setAttribute("data-topbarcolor", state.dataTopBarColor);
  document.documentElement.setAttribute("data-color", state.dataColor);
  if (state.dataTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
};

const initialState = {
  dataLayout: normalizeLayout(localStorage.getItem("dataLayout")),
  dataWidth: localStorage.getItem("dataWidth") || "fluid",
  dataCard: localStorage.getItem("dataCard") || "bordered",
  dataSidebar: localStorage.getItem("dataSidebar") || "light",
  dataSidebarAll: localStorage.getItem("dataSidebarAll") || "",
  dataTopbarAll: localStorage.getItem("dataTopbarAll") || "",
  dataTopBarColorAll: localStorage.getItem("dataTopBarColorAll") || "",
  dataColorAll: localStorage.getItem("dataColorAll") || "",
  dataTheme: normalizeTheme(localStorage.getItem("dataTheme")),
  dataTopBar: localStorage.getItem("dataTopBar") || "white",
  dataTopBarColor: normalizeTopbarColor(localStorage.getItem("dataTopBarColor") || localStorage.getItem("dataTopBarolor")),
  dataSidebarBg: localStorage.getItem("dataSidebarBg") || "",
  dataTopbarBg: localStorage.getItem("dataTopbarBg") || "",
  dataColor: normalizeColor(localStorage.getItem("dataColor")),
  dataLoader: localStorage.getItem("dataLoader") || "enable",
  isRtl: localStorage.getItem("rtl") || false,
  headerCollapse: false,
};

const themeSettingSlice = createSlice({
  name: "themeSetting",
  initialState,
  reducers: {
    setHeaderCollapse: (state, { payload }) => {
      state.headerCollapse = payload;
    },
    setDataLayout: (state, action) => {
      const nextLayout = normalizeLayout(action.payload);
      state.dataLayout = nextLayout;
      localStorage.setItem("dataLayout", nextLayout);
      applyThemeState(state);
    },
    setDataWidth: (state, action) => {
      state.dataWidth = action.payload;
      localStorage.setItem("dataWidth", action.payload);
      applyThemeState(state);
    },
    setDataCard: (state, action) => {
      state.dataCard = action.payload;
      localStorage.setItem("dataCard", action.payload);
      document.documentElement.setAttribute("data-card", action.payload);
    },
    setDataSidebar: (state, action) => {
      state.dataSidebar = action.payload;
      localStorage.setItem("dataSidebar", action.payload);
      document.documentElement.setAttribute("data-sidebar", action.payload);
    },
    setDataSidebarAll: (state, action) => {
      state.dataSidebarAll = action.payload;
      localStorage.setItem("dataSidebarAll", action.payload);
    },
    setDataColorAll: (state, action) => {
      state.dataColorAll = action.payload;
      localStorage.setItem("dataColorAll", action.payload);
    },
    setDataTopBarColorAll: (state, action) => {
      state.dataTopBarColorAll = action.payload;
      localStorage.setItem("dataTopBarColorAll", action.payload);
    },
    setDataTopbarAll: (state, action) => {
      state.dataTopbarAll = action.payload;
      localStorage.setItem("dataTopbarAll", action.payload);
    },
    setDataTheme: (state, action) => {
      state.dataTheme = normalizeTheme(action.payload);
      localStorage.setItem("dataTheme", state.dataTheme);
      applyThemeState(state);
    },
    setTopBarColor: (state, action) => {
      state.dataTopBar = action.payload;
      localStorage.setItem("dataTopBar", action.payload);
      applyThemeState(state);
    },
    setTopBarColor2: (state, action) => {
      state.dataTopBarColor = action.payload;
      localStorage.setItem("dataTopBarColor", action.payload);
      applyThemeState(state);
    },
    setDataSidebarBg: (state, action) => {
      state.dataSidebarBg = action.payload;
      localStorage.setItem("dataSidebarBg", action.payload);
      document.body.setAttribute("data-sidebarbg", action.payload);
    },
    setDataTopbarBg: (state, action) => {
      state.dataTopbarBg = action.payload;
      localStorage.setItem("dataTopbarBg", action.payload);
      document.body.setAttribute("data-topbarbg", action.payload);
    },
    setDataColor: (state, action) => {
      state.dataColor = normalizeColor(action.payload);
      localStorage.setItem("dataColor", state.dataColor);
      applyThemeState(state);
    },
    setLoader: (state, action) => {
      state.dataLoader = action.payload;
      localStorage.setItem("dataLoader", action.payload);
      document.documentElement.setAttribute("data-loader", action.payload);
    },
    setRtl: (state, action) => {
      state.isRtl = action.payload;
      localStorage.setItem("rtl", action.payload);
      document.body.setAttribute("class", action.payload);
    },
    resetAllMode: (state: any) => {
      state.dataLayout = "default";
      state.dataWidth = "fluid";
      state.dataCard = "bordered";
      state.dataSidebar = "light";
      state.dataTheme = "light";
      state.dataTopBar = "white";
      state.dataTopBarColor = "white";
      state.dataSidebarBg = "";
      state.dataTopbarBg = "";
      state.dataColor = "sunset";
      state.dataLoader = "enable";
      state.isRtl = "";
      localStorage.setItem("dataLayout", "default");
      localStorage.setItem("dataWidth", "fluid");
      localStorage.setItem("dataCard", "bordered");
      localStorage.setItem("dataSidebar", "light");
      localStorage.setItem("dataTheme", "light");
      localStorage.setItem("dataTopBar", "white");
      localStorage.setItem("dataTopBarColor", "white");
      localStorage.setItem("dataSidebarBg", "");
      localStorage.setItem("dataTopbarBg", "");
      localStorage.setItem("dataColor", "sunset");
      localStorage.setItem("dataLoader", "enable");
      localStorage.setItem("rtl", "");
      applyThemeState(state);
    },
  },
});

export const {
  setDataLayout,
  setDataWidth,
  setDataCard,
  resetAllMode,
  setTopBarColor,
  setDataTheme,
  setDataSidebar,
  setDataSidebarAll,
  setDataColorAll,
  setDataTopBarColorAll,
  setDataTopbarAll,
  setDataSidebarBg,
  setDataTopbarBg,
  setHeaderCollapse,
  setDataColor,
  setLoader,
  setTopBarColor2,
  setRtl,
} = themeSettingSlice.actions;

export default themeSettingSlice.reducer;
