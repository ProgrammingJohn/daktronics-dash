import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { use_sport_shortcuts } from "./use_sport_shortcuts";

function Harness({ on_home }: { on_home: () => void }) {
  use_sport_shortcuts({ h: on_home });
  return <input aria-label="editing" />;
}

describe("use_sport_shortcuts", () => {
  test("fires active shortcuts, ignores editable targets, and cleans up on unmount", () => {
    const on_home = vi.fn();
    const rendered = render(<Harness on_home={on_home} />);

    fireEvent.keyDown(window, { key: "h" });
    fireEvent.keyDown(rendered.getByLabelText("editing"), { key: "h" });
    expect(on_home).toHaveBeenCalledTimes(1);

    rendered.unmount();
    fireEvent.keyDown(window, { key: "h" });
    expect(on_home).toHaveBeenCalledTimes(1);
  });
});
