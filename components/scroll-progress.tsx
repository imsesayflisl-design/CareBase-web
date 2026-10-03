"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thin gradient bar pinned to the top of the viewport that tracks how far the
 * user has scrolled through the page. Updates are throttled to animation frames
 * and driven by a GPU-friendly transform.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      frame.current = null;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      setProgress(value);
    };

    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-[#1763b8] via-[#28b8ad] to-[#a76ff1]"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}