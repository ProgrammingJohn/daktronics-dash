import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BackendSnapshotSource } from "../api/BackendSnapshotSource";
import { FlaskBackendClient } from "../api/FlaskBackendClient";
import { Viewer } from "./Viewer";

const backend_url = window.location.protocol === "file:" ? "http://127.0.0.1:5000" : "";
const client = new FlaskBackendClient({ base_url: backend_url, storage: window.localStorage });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <Viewer source={new BackendSnapshotSource(client)} />
  </StrictMode>
);
