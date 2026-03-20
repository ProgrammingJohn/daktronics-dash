import { ipcMain } from "electron";

export interface RequestJsonPayload {
  baseUrl: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export interface UploadTemplatePayload {
  baseUrl: string;
  fileName: string;
  bytes: number[];
}

export interface BridgeResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

function buildUrl(baseUrl: string, path: string, query?: RequestJsonPayload["query"]): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBase);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function createErrorResult(message: string, code?: string): BridgeResult<never> {
  return {
    ok: false,
    status: 0,
    error: {
      message,
      code,
    },
  };
}

export function registerBackendBridge(): void {
  ipcMain.handle("dakdash:request-json", async (_event, payload: RequestJsonPayload): Promise<BridgeResult<unknown>> => {
    try {
      const url = buildUrl(payload.baseUrl, payload.path, payload.query);
      const hasBody = payload.body !== undefined && payload.body !== null;

      const response = await fetch(url, {
        method: payload.method,
        headers: hasBody
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: hasBody ? JSON.stringify(payload.body) : undefined,
      });

      const responseData = await parseResponseBody(response);

      if (!response.ok) {
        const errorMessage =
          typeof responseData === "object" && responseData !== null && "message" in responseData
            ? String((responseData as { message?: unknown }).message || `HTTP ${response.status}`)
            : `HTTP ${response.status}`;

        const errorCode =
          typeof responseData === "object" && responseData !== null && "error_code" in responseData
            ? String((responseData as { error_code?: unknown }).error_code || "request_failed")
            : "request_failed";

        return {
          ok: false,
          status: response.status,
          error: {
            message: errorMessage,
            code: errorCode,
          },
          data: responseData,
        };
      }

      return {
        ok: true,
        status: response.status,
        data: responseData,
      };
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : "Unknown network error", "network_error");
    }
  });

  ipcMain.handle("dakdash:upload-template", async (_event, payload: UploadTemplatePayload): Promise<BridgeResult<unknown>> => {
    try {
      const url = buildUrl(payload.baseUrl, "/api/templates/upload");
      const form = new FormData();
      const bytes = Uint8Array.from(payload.bytes);
      const blob = new Blob([bytes], { type: "image/svg+xml" });
      form.append("file", blob, payload.fileName);

      const response = await fetch(url, {
        method: "POST",
        body: form,
      });

      const responseData = await parseResponseBody(response);

      if (!response.ok) {
        const errorMessage =
          typeof responseData === "object" && responseData !== null && "message" in responseData
            ? String((responseData as { message?: unknown }).message || `HTTP ${response.status}`)
            : `HTTP ${response.status}`;

        const errorCode =
          typeof responseData === "object" && responseData !== null && "error_code" in responseData
            ? String((responseData as { error_code?: unknown }).error_code || "upload_failed")
            : "upload_failed";

        return {
          ok: false,
          status: response.status,
          error: {
            message: errorMessage,
            code: errorCode,
          },
          data: responseData,
        };
      }

      return {
        ok: true,
        status: response.status,
        data: responseData,
      };
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : "Unknown upload error", "upload_failed");
    }
  });
}
