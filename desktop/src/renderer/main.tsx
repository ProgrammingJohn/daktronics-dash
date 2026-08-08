import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { FakeBackendClient } from "./api/FakeBackendClient";
import { SessionProvider } from "./state/SessionProvider";
import "./styles/global.css";
import "./styles/tokens.css";

const client = new FakeBackendClient(window.localStorage);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <SessionProvider client={client}>
      <App />
    </SessionProvider>
  </StrictMode>
);
