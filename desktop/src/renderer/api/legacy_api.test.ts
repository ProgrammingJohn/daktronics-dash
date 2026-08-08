import { beforeEach, describe, expect, test, vi } from "vitest";
// @ts-expect-error The legacy wizard remains plain browser JavaScript.
import { startService } from "../../../../static/js/api.js";

describe("legacy startService", () => {
  beforeEach(() => {
    vi.stubGlobal("$", { ajax: vi.fn() });
  });

  test("sends the expected ESP device identity", async () => {
    vi.mocked((globalThis as any).$.ajax).mockImplementation((options: any) => {
      options.success({ message: "Started" });
    });

    await startService("football", "synced", "10.0.0.20", 1234, "wt32-test");

    const options = vi.mocked((globalThis as any).$.ajax).mock.calls[0]?.[0] as any;
    expect(JSON.parse(options.data)).toEqual({
      scoreboard: "football",
      method: "synced",
      ip: "10.0.0.20",
      port: 1234,
      device_id: "wt32-test"
    });
  });

  test("surfaces backend validation and availability messages", async () => {
    vi.mocked((globalThis as any).$.ajax).mockImplementation((options: any) => {
      options.error({ responseJSON: { error: "Wrong device ID" } }, "error", "Bad Request");
    });

    await expect(
      startService("football", "synced", "10.0.0.20", 1234, "wrong")
    ).rejects.toThrow("Wrong device ID");
  });
});
