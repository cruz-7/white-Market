import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Toaster } from "sonner";

import App from "./App";
import { SettingsProvider } from "./SettingsContext";
import { convex } from "./convex-client";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <SettingsProvider>
          <App />
          <Toaster richColors position="top-right" />
        </SettingsProvider>
      </BrowserRouter>
    </ConvexAuthProvider>
  </React.StrictMode>,
);
