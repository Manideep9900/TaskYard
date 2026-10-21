import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.jsx";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "dummy-client-id";

// Restore route if redirected via static 404 fallback
const pendingRoute = sessionStorage.getItem("taskyard_route");
if (pendingRoute) {
  sessionStorage.removeItem("taskyard_route");
  window.history.replaceState(null, "", pendingRoute);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>
);
