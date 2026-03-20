import { contextBridge, ipcRenderer } from "electron";
import type { RequestJsonPayload, UploadTemplatePayload } from "./backendBridge.js";

const api = {
  requestJson: (payload: RequestJsonPayload) => ipcRenderer.invoke("dakdash:request-json", payload),
  uploadTemplate: (payload: UploadTemplatePayload) => ipcRenderer.invoke("dakdash:upload-template", payload),
};

contextBridge.exposeInMainWorld("dakdashApi", api);
