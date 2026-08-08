import { useCallback, useEffect, useRef, useState } from "react";

interface ClockValue {
  minutes: number;
  seconds: number;
}

interface GameClockOptions {
  clock: ClockValue;
  on_tick(clock: ClockValue): Promise<void> | void;
}

function decrement(clock: ClockValue): ClockValue {
  const total = Math.max(0, clock.minutes * 60 + clock.seconds - 1);
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

export function use_game_clock({ clock, on_tick }: GameClockOptions) {
  const [running, set_running] = useState(false);
  const remaining_ref = useRef(clock);
  const on_tick_ref = useRef(on_tick);
  const in_flight_ref = useRef(false);
  on_tick_ref.current = on_tick;

  useEffect(() => {
    remaining_ref.current = clock;
  }, [clock.minutes, clock.seconds]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (in_flight_ref.current) return;
      const current = remaining_ref.current;
      if (current.minutes === 0 && current.seconds === 0) {
        set_running(false);
        return;
      }

      const next = decrement(current);
      remaining_ref.current = next;
      in_flight_ref.current = true;
      void Promise.resolve(on_tick_ref.current(next)).finally(() => {
        in_flight_ref.current = false;
      });
      if (next.minutes === 0 && next.seconds === 0) set_running(false);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const start = useCallback(() => {
    if (remaining_ref.current.minutes > 0 || remaining_ref.current.seconds > 0) {
      set_running(true);
    }
  }, []);
  const stop = useCallback(() => set_running(false), []);

  return { running, start, stop };
}
