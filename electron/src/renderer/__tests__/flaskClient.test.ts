import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFlaskClient } from "@/api/flaskClient";

describe("flaskClient", () => {
  beforeEach(() => {
    Object.defineProperty(window, "dakdashApi", {
      configurable: true,
      writable: true,
      value: {
      requestJson: vi.fn(),
      uploadTemplate: vi.fn(),
      },
    });
  });

  it("returns normalized data on success", async () => {
    window.dakdashApi.requestJson.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        message: null,
        data: {
          status: "ok",
        },
      },
    });

    const client = createFlaskClient("http://127.0.0.1:5001");
    const result = await client.getHealth();

    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("ok");
  });

  it("surfaces backend envelope errors", async () => {
    window.dakdashApi.requestJson.mockResolvedValue({
      ok: false,
      status: 409,
      data: {
        message: "live mode is enabled; manual updates are blocked",
        data: null,
        error_code: "mode_conflict",
      },
      error: {
        message: "HTTP 409",
        code: "request_failed",
      },
    });

    const client = createFlaskClient("http://127.0.0.1:5001");
    const result = await client.manualUpdate({ home_score: 1 });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("mode_conflict");
  });

  it("uses bridge errors when response is not an envelope", async () => {
    window.dakdashApi.requestJson.mockResolvedValue({
      ok: false,
      status: 0,
      error: {
        message: "Network down",
        code: "network_error",
      },
    });

    const client = createFlaskClient("http://127.0.0.1:5001");
    const result = await client.getState();

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("Network down");
    expect(result.error?.code).toBe("network_error");
  });
});
