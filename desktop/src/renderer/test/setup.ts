import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

const local_values = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => local_values.get(key) ?? null,
    setItem: (key: string, value: string) => local_values.set(key, value),
    removeItem: (key: string) => local_values.delete(key),
    clear: () => local_values.clear()
  }
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  local_values.clear();
});
