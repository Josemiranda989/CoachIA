"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  decimals?: number;
  locale?: string;
};

export function CountUp({ value, duration = 900, decimals = 0, locale = "es-AR" }: Props) {
  const [displayed, setDisplayed] = useState(value >= 0 ? 0 : value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) {
      setDisplayed(0);
      return;
    }

    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayed(from + (value - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(value);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = decimals > 0
    ? displayed.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(displayed).toLocaleString(locale);

  return <>{formatted}</>;
}
