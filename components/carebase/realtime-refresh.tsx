"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CarebaseRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let cursor = Date.now() - 10_000;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(
          "/api/hospital/events?after=" + encodeURIComponent(new Date(cursor).toISOString()),
          { cache: "no-store" }
        );
        if (!response.ok || !active) return;
        const data = (await response.json()) as { events?: { createdAt: string }[] };
        if (data.events?.length) {
          cursor = Math.max(...data.events.map((event) => new Date(event.createdAt).getTime()));
          router.refresh();
        }
      } catch {
        // A later poll retries transient connection errors.
      }
    };
    const timer = window.setInterval(poll, 12_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
