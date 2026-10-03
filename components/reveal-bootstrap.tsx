"use client";

import { useEffect } from "react";

export function RevealBootstrap() {
  useEffect(() => {
    document.documentElement.classList.add("reveal-ready");
    return () => document.documentElement.classList.remove("reveal-ready");
  }, []);

  return null;
}