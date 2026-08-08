import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { FlaskBackendClient } from "./api/FlaskBackendClient";
import { SessionProvider } from "./state/SessionProvider";
import "./styles/global.css";
import "./styles/tokens.css";

const backend_url = window.location.protocol === "file:" ? "http://127.0.0.1:5000" : "";
const client = new FlaskBackendClient({ base_url: backend_url, storage: window.localStorage });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <SessionProvider client={client}>
      <App />
    </SessionProvider>
  </StrictMode>
);
