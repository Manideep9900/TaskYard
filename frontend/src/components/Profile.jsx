import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiRequest } from "../api";

function Profile({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [searchParams] = useSearchParams();

  const checkoutStatus = searchParams.get("checkout");

  useEffect(() => {
    apiRequest("/auth/profile")
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    setActionLoading("upgrade");
    setError("");
    try {
      const data = await apiRequest("/billing/create-checkout", {
        method: "POST",
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const handleManageBilling = async () => {
    setActionLoading("portal");
    setError("");
    try {
      const data = await apiRequest("/billing/portal", {
        method: "POST",
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const theme = localStorage.getItem("taskyard-theme") || "dark";

  if (loading) {
    return (
      <div className="ty-profile-page" data-theme={theme}>
        <div className="ty-profile-container">
          <p className="status-message">Loading profile…</p>
        </div>
      </div>
    );
  }

  const tasksCreated = profile?.usage?.tasks_created || 0;
  const taskLimit = profile?.usage?.limit || 100;
  const usagePercent = Math.min(100, Math.round((tasksCreated / taskLimit) * 100));

  return (
    <div className="ty-profile-page" data-theme={theme}>
      <div className="ty-profile-container">
        <div className="ty-profile-nav">
          <Link to="/dashboard" className="ty-back-link">
            ← Back to Dashboard
          </Link>
        </div>

        {checkoutStatus === "success" && (
          <div className="success-notification" role="status" style={{ position: "relative", marginBottom: "20px", left: "auto", transform: "none" }}>
            ✓ &nbsp;Payment successful! Welcome to the Premium plan.
          </div>
        )}

        {checkoutStatus === "cancelled" && (
          <div className="form-error" style={{ marginBottom: "20px" }}>
            Checkout was cancelled. You can upgrade whenever you are ready.
          </div>
        )}

        {error && <p className="error-message ty-error">{error}</p>}

        {/* User Card */}
        <section className="ty-profile-card">
          <div className="ty-profile-card-header">
            <div className="ty-profile-avatar-wrap">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="ty-profile-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="ty-profile-avatar-fallback">
                  {(profile?.name || profile?.email || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="ty-profile-header-info">
              <div className="ty-profile-name-row">
                <h1>{profile?.name || "Your Account"}</h1>
                <span className={`ty-plan-badge ty-plan-${profile?.plan || "free"}`}>
                  {profile?.plan === "premium" ? "⭐ Premium Plan" : "Free Plan"}
                </span>
              </div>
              <p className="ty-profile-email">{profile?.email}</p>
            </div>
          </div>
        </section>

        {/* Monthly Usage Limit Section */}
        <section className="ty-profile-section">
          <div className="ty-profile-section-head">
            <div>
              <p className="ty-eyebrow">MONTHLY USAGE LIMITS</p>
              <h2>Task Creation Usage</h2>
            </div>
            <span className="ty-usage-fraction">
              <strong>{tasksCreated}</strong> / {taskLimit.toLocaleString()} tasks
            </span>
          </div>

          <div className="ty-usage-bar-track">
            <div
              className={`ty-usage-bar-fill ${usagePercent >= 90 ? "ty-usage-warning" : ""}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          <div className="ty-usage-footer">
            <small>
              {profile?.plan === "free"
                ? "Free plan gives you 100 tasks each month."
                : "Premium plan gives you 10,000 tasks each month."}
            </small>
            <span className="ty-usage-percent-text">{usagePercent}% used</span>
          </div>
        </section>

        {/* Stripe Subscription Section */}
        <section className="ty-profile-section">
          <p className="ty-eyebrow">BILLING & SUBSCRIPTION</p>
          <h2>Subscription Details</h2>

          {profile?.plan === "premium" ? (
            <div className="ty-billing-box">
              <div className="ty-billing-status">
                <span className="ty-billing-icon">✓</span>
                <div>
                  <strong>Active Premium Subscription</strong>
                  <p>You have access to 10,000 tasks/month and all premium features.</p>
                </div>
              </div>

              <button
                className="ty-secondary-button"
                onClick={handleManageBilling}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "portal" ? "Opening Stripe Portal…" : "Manage Billing & Invoices ↗"}
              </button>
            </div>
          ) : (
            <div className="ty-upgrade-box">
              <div>
                <h3>Upgrade to Premium</h3>
                <p>Get up to 10,000 tasks/month, priority AI labeling, and unlimited attachments.</p>
                <ul className="ty-plan-features">
                  <li>✓ 10,000 monthly task limit (vs 100 on Free)</li>
                  <li>✓ AI task labels on demand</li>
                  <li>✓ Stripe customer portal for self-service cancellation</li>
                </ul>
              </div>

              <button
                className="ty-upgrade-cta-button"
                onClick={handleUpgrade}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "upgrade" ? "Redirecting to Stripe…" : "⭐ Upgrade to Premium"}
              </button>
            </div>
          )}
        </section>

        {/* Account Details */}
        <section className="ty-profile-section">
          <p className="ty-eyebrow">SECURITY</p>
          <h2>Account Details</h2>

          <div className="ty-details-list">
            <div className="ty-detail-row">
              <span className="ty-detail-label">Email Address</span>
              <span className="ty-detail-value">{profile?.email}</span>
            </div>
            <div className="ty-detail-row">
              <span className="ty-detail-label">Sign-in Methods</span>
              <span className="ty-detail-value">
                {[
                  profile?.has_password && "Password",
                  profile?.has_google && "Google OAuth",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Password"}
              </span>
            </div>
          </div>
        </section>

        {/* Logout */}
        <div className="ty-profile-actions">
          <button className="ty-logout-button ty-profile-logout-btn" onClick={onLogout}>
            Log out of TaskYard ↗
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;

