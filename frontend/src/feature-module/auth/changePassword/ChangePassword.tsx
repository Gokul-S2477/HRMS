import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import { useAuth } from "../../../core/auth/AuthContext";
import { getHomeRouteForRole } from "../../../core/auth/roleAccess";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentVisible, setCurrentVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await API.post("/auth/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccessMessage("Password changed successfully! Redirecting...");
      
      // Refresh local user state so must_change_password becomes false
      const updatedUser = await refreshUser();
      
      setTimeout(() => {
        const homeRoute = getHomeRouteForRole(updatedUser?.effective_role || updatedUser?.role);
        navigate(homeRoute, { replace: true });
      }, 1500);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Failed to change password. Please verify your current password.";
      setErrorMessage(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-premium-page">
      <div className="auth-premium-shell justify-content-center">
        <section className="auth-premium-form-wrap col-md-6 col-lg-5">
          <div className="auth-premium-form-card">
            <div className="auth-premium-form-head text-center">
              <span className="auth-premium-kicker">Security Update Required</span>
              <h2>Set a New Password</h2>
              <p>
                Your account password has been reset by an administrator. For security purposes,
                you must set a new strong password before accessing your workspace.
              </p>
            </div>

            {errorMessage && (
              <div className="alert alert-danger auth-login-alert" role="alert">
                <i className="ti ti-alert-circle me-2"></i>
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success auth-login-alert" role="alert">
                <i className="ti ti-circle-check me-2"></i>
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-premium-form">
              {/* Current Password */}
              <div className="auth-field">
                <label className="form-label">Temporary / Current Password</label>
                <div className="auth-field-shell auth-password-shell">
                  <span className="auth-field-icon">
                    <i className="ti ti-lock"></i>
                  </span>
                  <input
                    type={currentVisible ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="form-control"
                    placeholder="Enter current or temporary password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setCurrentVisible(!currentVisible)}
                  >
                    <i className={`ti ${currentVisible ? "ti-eye" : "ti-eye-off"}`}></i>
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="auth-field">
                <label className="form-label">New Password</label>
                <div className="auth-field-shell auth-password-shell">
                  <span className="auth-field-icon">
                    <i className="ti ti-shield-lock"></i>
                  </span>
                  <input
                    type={newVisible ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-control"
                    placeholder="Set a new strong password (min 8 chars)"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setNewVisible(!newVisible)}
                  >
                    <i className={`ti ${newVisible ? "ti-eye" : "ti-eye-off"}`}></i>
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="auth-field">
                <label className="form-label">Confirm New Password</label>
                <div className="auth-field-shell auth-password-shell">
                  <span className="auth-field-icon">
                    <i className="ti ti-checks"></i>
                  </span>
                  <input
                    type={confirmVisible ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-control"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setConfirmVisible(!confirmVisible)}
                  >
                    <i className={`ti ${confirmVisible ? "ti-eye" : "ti-eye-off"}`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-100 auth-submit-btn mt-3"
                disabled={submitting}
              >
                {submitting ? "Updating Password..." : "Update & Enter Workspace"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChangePassword;
