import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiRequest } from "../api";

function Profile({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [searchParams] = useSearchParams();

  const isSuccess = searchParams.get("success") === "true" || searchParams.get("checkout") === "success";
  const isCanceled = searchParams.get("canceled") === "true" || searchParams.get("checkout") === "cancelled";

  useEffect(() => {
    apiRequest("/auth/profile")
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Poll for webhook plan activation if redirected back from Stripe
  useEffect(() => {
    if (!isSuccess || !profile || profile.plan === "premium") {
      setIsActivating(false);
      return;
    }

    setIsActivating(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const updated = await apiRequest("/auth/profile");
        setProfile(updated);
        if (updated.plan === "premium" || attempts >= 10) {
          clearInterval(interval);
          setIsActivating(false);
        }
      } catch {
        if (attempts >= 10) {
          clearInterval(interval);
          setIsActivating(false);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isSuccess, profile?.plan]);

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

        {isActivating && (
          <div
            className="status-message"
            style={{
              marginBottom: "16px",
              background: "rgba(99, 102, 241, 0.12)",
              borderRadius: "12px",
              padding: "14px 18px",
              color: "#4f46e5",
              fontWeight: 600,
            }}
          >
            ⏳ Payment received, activating your plan…
          </div>
        )}

        {isSuccess && profile?.plan === "premium" && !isActivating && (
          <div className="success-notification" role="status" style={{ position: "relative", marginBottom: "20px", left: "auto", transform: "none" }}>
            ✓ &nbsp;Payment successful! Welcome to the Premium plan.
          </div>
        )}

        {isCanceled && (
          <div className="form-error" style={{ marginBottom: "20px" }}>
            Checkout was cancelled. You can upgrade whenever you are ready.
          </div>
        )}

        {error && <p className="error-message ty-error">{error}</p>}

        {/* Top Guarantee Banner (Screenshot 5) */}
        <div className="ty-peeky-banner">
          <span className="ty-banner-lock-icon">🔒</span>
          <div className="ty-banner-copy">
            <strong>When the month ends, nothing is taken away</strong>
            <p>Your tasks stay visible, searchable, copyable and exportable — forever. Upgrading unlocks 10,000 tasks/mo, AI labeling, and full PostgreSQL BYTEA image storage.</p>
          </div>
        </div>

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

        {/* Stripe Subscription & Pricing Cards Section */}
        <section className="ty-profile-section">
          <p className="ty-eyebrow">PLANS & BILLING</p>
          <h2>Subscription Plans</h2>
          <p className="ty-section-desc">
            Choose the plan that fits your execution pace. Upgrade or manage anytime via Stripe.
          </p>

          <div className="ty-pricing-cards-grid">
            {/* Free Plan Card */}
            <div className={`ty-pricing-card ty-pricing-free ${profile?.plan !== "premium" ? "is-current" : ""}`}>
              <div className="ty-pricing-card-top">
                <span className="ty-pricing-pill ty-pill-yellow">FREE</span>
                <h3 className="ty-pricing-title">Starter</h3>
                <div className="ty-pricing-cost">
                  <span className="ty-price-amount">$0</span>
                  <span className="ty-price-period">/ month</span>
                </div>
                <p className="ty-pricing-sub">Essential personal task tracking</p>
              </div>

              <ul className="ty-pricing-features">
                <li><span className="ty-feature-check">✓</span> 100 tasks created per month</li>
                <li><span className="ty-feature-check">✓</span> Drag & Drop Kanban board</li>
                <li><span className="ty-feature-check">✓</span> 1MB image attachments</li>
                <li><span className="ty-feature-check">✓</span> Standard task categories</li>
              </ul>

              <div className="ty-pricing-action">
                {profile?.plan !== "premium" ? (
                  <button type="button" className="ty-pricing-btn-current" disabled>
                    ✓ Current Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ty-secondary-button"
                    onClick={handleManageBilling}
                    disabled={Boolean(actionLoading)}
                  >
                    Downgrade in Portal ↗
                  </button>
                )}
              </div>
            </div>

            {/* Pro Plan Card (Screenshot 5 Dark Card) */}
            <div className={`ty-pricing-card ty-pricing-pro ${profile?.plan === "premium" ? "is-current" : ""}`}>
              <div className="ty-pricing-card-top">
                <span className="ty-pricing-tag-sub">Personal</span>
                <div className="ty-pricing-cost">
                  <span className="ty-price-amount">$9.99</span>
                  <span className="ty-price-original">$19.99</span>
                </div>
                <div className="ty-pricing-badge-row">
                  <span className="ty-pricing-pill ty-pill-yellow">⚡ Launch price - save 50%</span>
                </div>
                <p className="ty-pricing-sub">once, yours for good each month</p>
                <p className="ty-pricing-tagline">
                  One subscription for your personal workflow on all devices.
                </p>
              </div>

              <ul className="ty-pricing-features">
                <li><span className="ty-feature-check">✓</span> <strong>10,000 tasks per month</strong> quota</li>
                <li><span className="ty-feature-check">✓</span> Instant AI task labels via Groq & OpenAI</li>
                <li><span className="ty-feature-check">✓</span> PostgreSQL BYTEA image storage & preview</li>
                <li><span className="ty-feature-check">✓</span> Self-service Stripe billing portal</li>
                <li><span className="ty-feature-check">✓</span> Automatic clean-up & zero bloat</li>
              </ul>

              {/* Launch Seats Bar (Screenshot 5) */}
              <div className="ty-launch-seats-box">
                <div className="ty-launch-seats-label">
                  <strong>27 of 50 launch seats left</strong>
                  <span>23 claimed</span>
                </div>
                <div className="ty-launch-seats-dots" aria-hidden="true">
                  <div className="ty-seats-bar-fill" style={{ width: "46%" }} />
                </div>
                <small className="ty-launch-seats-note">Then $19.99 for everyone after.</small>
              </div>

              <div className="ty-pricing-action">
                {profile?.plan === "premium" ? (
                  <button
                    type="button"
                    className="ty-pricing-btn-manage"
                    onClick={handleManageBilling}
                    disabled={Boolean(actionLoading)}
                  >
                    {actionLoading === "portal" ? "Opening Stripe…" : "✓ Active · Manage Subscription ↗"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ty-pricing-btn-upgrade"
                    onClick={handleUpgrade}
                    disabled={Boolean(actionLoading)}
                  >
                    {actionLoading === "upgrade" ? "Redirecting to Stripe…" : "Claim Launch Seat · $9.99/mo"}
                  </button>
                )}
              </div>
            </div>
          </div>
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

