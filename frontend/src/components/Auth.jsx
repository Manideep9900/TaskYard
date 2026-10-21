import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = isLogin
        ? `${API_URL}/auth/login`
        : `${API_URL}/auth/register`;

      const body = isLogin
        ? { email, password }
        : { name, email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      if (isLogin) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setMessage("Registration successful. You can now login.");
        setIsLogin(true);
        setName("");
        setPassword("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Google sign-in failed.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleError = () => {
    setError("Google login failed. Please ensure third-party cookies are enabled or use email login.");
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleConfigured = Boolean(
    googleClientId &&
    !googleClientId.includes("YOUR_GOOGLE_CLIENT_ID") &&
    googleClientId.includes(".apps.googleusercontent.com")
  );

  return (
    <div className="auth-container">
      <div className="auth-card">
        <p className="eyebrow">TASKYARD</p>

        <h1>{isLogin ? "Welcome Back" : "Create Account"}</h1>

        <p className="auth-subtitle">
          {isLogin
            ? "Login to manage your tasks."
            : "Create your TaskYard account."}
        </p>

        {/* Google OAuth Button */}
        <div className="auth-google-box">
          {isGoogleConfigured ? (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text={isLogin ? "signin_with" : "signup_with"}
              shape="rectangular"
              theme="outline"
              size="large"
              width="100%"
            />
          ) : (
            <button
              type="button"
              className="auth-google-setup-btn"
              onClick={() =>
                setError(
                  "Google Sign-In requires your Google OAuth Client ID. Get one at console.cloud.google.com and paste it in frontend/.env as VITE_GOOGLE_CLIENT_ID."
                )
              }
            >
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 8 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </div>

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
            />
          )}

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
          />

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : isLogin ? "Login" : "Register"}
          </button>
        </form>

        {message && <p className="auth-success">{message}</p>}
        {error && <p className="auth-error">{error}</p>}

        <button
          className="auth-switch"
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
            setMessage("");
          }}
        >
          {isLogin
            ? "Don't have an account? Register"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

export default Auth;
