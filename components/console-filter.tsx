"use client";

import { useEffect } from "react";

export default function ConsoleFilter() {
  useEffect(() => {
    const orig = console.error;
    console.error = (...args: any[]) => {
      try {
        const first = String(args[0] ?? "");
        if (
          first.includes("[next-auth]") ||
          first.includes("CLIENT_FETCH_ERROR") ||
          first.includes("Failed to fetch")
        ) {
          // drop next-auth client fetch noise in development
          return;
        }
      } catch {}
      orig.apply(console, args as any);
    };
    return () => {
      console.error = orig;
    };
  }, []);
  return null;
}
