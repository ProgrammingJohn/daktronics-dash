import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeBackendClient } from "../api/FakeBackendClient";
import { SessionProvider } from "../state/SessionProvider";
import { App } from "./App";

describe("App", () => {
  it("renders the frontend foundation", () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );
    expect(screen.getByRole("heading", { name: "Launch a session" })).toBeVisible();
  });
});
