import { useEffect } from "react";

export function use_sport_shortcuts(shortcuts: Readonly<Record<string, () => void>>): void {
  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      "keydown",
      (event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.matches("input, select, textarea") || target.isContentEditable)
        ) {
          return;
        }
        const action = shortcuts[event.key.toLowerCase()];
        if (action !== undefined) {
          event.preventDefault();
          action();
        }
      },
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [shortcuts]);
}
