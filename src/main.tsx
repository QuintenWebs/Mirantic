import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { MeProvider } from "@/lib/me";
import { authConfig } from "@/lib/auth-config";
import App from "./App";
import "./index.css";

function Auth0ProviderWithNavigate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <Auth0Provider
      domain={authConfig.domain}
      clientId={authConfig.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: authConfig.audience,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(appState) => {
        navigate(appState?.returnTo || "/", { replace: true });
      }}
    >
      {children}
    </Auth0Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithNavigate>
        <MeProvider>
          <App />
          <Toaster position="bottom-right" />
        </MeProvider>
      </Auth0ProviderWithNavigate>
    </BrowserRouter>
  </React.StrictMode>
);
