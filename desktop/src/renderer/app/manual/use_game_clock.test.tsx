import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { use_game_clock } from "./use_game_clock";

describe("use_game_clock", () => {
  afterEach(() => vi.useRealTimers());

  test("counts down once per second and stops at zero", async () => {
    vi.useFakeTimers();
    const on_tick = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      use_game_clock({ clock: { minutes: 0, seconds: 2 }, on_tick })
    );

    act(() => result.current.start());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(on_tick).toHaveBeenLastCalledWith({ minutes: 0, seconds: 1 });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(on_tick).toHaveBeenLastCalledWith({ minutes: 0, seconds: 0 });
    expect(result.current.running).toBe(false);
  });

  test("does not overlap backend clock writes", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const on_tick = vi.fn(
      () => new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHook(() =>
      use_game_clock({ clock: { minutes: 0, seconds: 5 }, on_tick })
    );

    act(() => result.current.start());
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(on_tick).toHaveBeenCalledTimes(1);
    await act(async () => finish?.());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(on_tick).toHaveBeenCalledTimes(2);
  });
});
