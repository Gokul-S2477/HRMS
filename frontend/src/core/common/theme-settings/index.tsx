import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  resetAllMode,
  setDataColor,
  setDataLayout,
  setDataTheme,
  setDataWidth,
  setLoader,
  setTopBarColor,
  setTopBarColor2,
} from "../../data/redux/themeSettingSlice";
import ImageWithBasePath from "../imageWithBasePath";

const LAYOUT_OPTIONS = [
  { id: "defaultLayout", value: "default", label: "Default", image: "assets/img/theme/default.svg", note: "Best for the full premium workspace." },
  { id: "miniLayout", value: "mini", label: "Compact", image: "assets/img/theme/mini.svg", note: "Keeps more content visible without breaking navigation." },
];

const PALETTE_OPTIONS = [
  { value: "sunset", label: "Sunset", chips: ["#ff7a1a", "#ff9a56", "#ffe2cd"] },
  { value: "ocean", label: "Ocean", chips: ["#1677ff", "#4ba3ff", "#d9ecff"] },
  { value: "forest", label: "Forest", chips: ["#12805c", "#26b37d", "#d8f5ea"] },
  { value: "violet", label: "Violet", chips: ["#6f4ef6", "#9a7bff", "#ece5ff"] },
  { value: "ruby", label: "Ruby", chips: ["#d64545", "#ff7a7a", "#ffe0e0"] },
];

const ThemeSettings = () => {
  const dispatch = useDispatch();
  const theme = useSelector((state: any) => state.themeSetting);

  useEffect(() => {
    document.documentElement.setAttribute("data-layout", theme.dataLayout || "default");
    document.documentElement.setAttribute("data-width", theme.dataWidth || "fluid");
    document.documentElement.setAttribute("data-topbar", theme.dataTopBar || "white");
    document.documentElement.setAttribute("data-topbarcolor", theme.dataTopBarColor || "white");
    document.documentElement.setAttribute("data-color", theme.dataColor || "sunset");
    if (theme.dataTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme.dataColor, theme.dataLayout, theme.dataTheme, theme.dataTopBar, theme.dataTopBarColor, theme.dataWidth]);

  return (
    <>
      <div className="sidebar-contact">
        <button
          type="button"
          className="toggle-theme hrms-theme-trigger"
          data-bs-toggle="offcanvas"
          data-bs-target="#theme-setting"
          aria-controls="theme-setting"
          aria-label="Open layout and theme settings"
        >
          <span className="hrms-theme-trigger-ring"></span>
          <i className="ti ti-palette"></i>
        </button>
      </div>

      <div className="sidebar-themesettings offcanvas offcanvas-end" id="theme-setting" tabIndex={-1}>
        <div className="offcanvas-header hrms-theme-header">
          <div>
            <span className="hrms-theme-kicker">Design Studio</span>
            <h3 className="mb-1 text-white">Theme and workspace controls</h3>
            <p className="text-light mb-0">Switch palettes, button colors, shell tone, and safe layouts from one premium floating control.</p>
          </div>
          <Link
            to="#"
            className="custom-btn-close d-flex align-items-center justify-content-center text-white"
            data-bs-dismiss="offcanvas"
          >
            <i className="ti ti-x" />
          </Link>
        </div>

        <div className="themesettings-inner offcanvas-body">
          <div className="card payroll-section-card mb-4">
            <div className="card-body">
              <div className="payroll-section-header mb-3">
                <h5 className="payroll-section-title">Brand Palette</h5>
                <span className="payroll-filter-meta">Buttons, badges, loaders</span>
              </div>
              <div className="row g-3">
                {PALETTE_OPTIONS.map((palette) => (
                  <div className="col-6" key={palette.value}>
                    <button
                      type="button"
                      className={`hrms-palette-card ${theme.dataColor === palette.value ? "active" : ""}`}
                      onClick={() => dispatch(setDataColor(palette.value))}
                    >
                      <span className="hrms-palette-swatches">
                        {palette.chips.map((chip) => (
                          <span key={`${palette.value}-${chip}`} style={{ background: chip }}></span>
                        ))}
                      </span>
                      <strong>{palette.label}</strong>
                      <small>Apply to primary buttons and accents</small>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card payroll-section-card mb-4">
            <div className="card-body">
              <div className="payroll-section-header mb-3">
                <h5 className="payroll-section-title">Theme Mode</h5>
                <span className="payroll-filter-meta">Surface + header tone</span>
              </div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className={`btn ${theme.dataTheme === "light" ? "btn-primary" : "btn-light"}`} onClick={() => dispatch(setDataTheme("light"))}>Light Surface</button>
                <button type="button" className={`btn ${theme.dataTheme === "dark" ? "btn-primary" : "btn-light"}`} onClick={() => dispatch(setDataTheme("dark"))}>Dark Surface</button>
                <button type="button" className={`btn ${theme.dataWidth === "fluid" ? "btn-primary" : "btn-light"}`} onClick={() => dispatch(setDataWidth("fluid"))}>Fluid Width</button>
                <button type="button" className={`btn ${theme.dataWidth === "box" ? "btn-primary" : "btn-light"}`} onClick={() => dispatch(setDataWidth("box"))}>Boxed Width</button>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Header tone</label>
                  <select className="form-select" value={theme.dataTopBar} onChange={(event) => dispatch(setTopBarColor(event.target.value))}>
                    <option value="white">Soft Light</option>
                    <option value="dark">Executive Dark</option>
                    <option value="color">Brand Accent</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Header contrast</label>
                  <select className="form-select" value={theme.dataTopBarColor} onChange={(event) => dispatch(setTopBarColor2(event.target.value))}>
                    <option value="white">Light Contrast</option>
                    <option value="dark">Dark Contrast</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Page loader</label>
                  <select className="form-select" value={theme.dataLoader} onChange={(event) => dispatch(setLoader(event.target.value))}>
                    <option value="enable">Enabled</option>
                    <option value="disable">Disabled</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card payroll-section-card mb-4">
            <div className="card-body">
              <div className="payroll-section-header mb-3">
                <h5 className="payroll-section-title">Safe Layouts</h5>
                <span className="payroll-filter-meta">HRMS-ready</span>
              </div>
              <div className="row g-3">
                {LAYOUT_OPTIONS.map((option) => (
                  <div className="col-6" key={option.value}>
                    <button
                      type="button"
                      className={`hrms-layout-card ${theme.dataLayout === option.value ? "active" : ""}`}
                      onClick={() => dispatch(setDataLayout(option.value))}
                    >
                      <span className="d-block mb-2 layout-img">
                        <ImageWithBasePath src={option.image} alt={option.label} />
                      </span>
                      <strong>{option.label}</strong>
                      <small>{option.note}</small>
                    </button>
                  </div>
                ))}
              </div>
              <div className="finance-note-card mt-3">
                <i className="ti ti-shield-check" />
                <span>Horizontal, stacked, and two-column template layouts stay hidden until they are rebuilt for the live HRMS navigation.</span>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between gap-3">
            <button type="button" className="btn btn-light w-50" onClick={() => dispatch(resetAllMode())}>
              Reset
            </button>
            <button type="button" className="btn btn-primary w-50" data-bs-dismiss="offcanvas">
              Apply Theme
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ThemeSettings;
