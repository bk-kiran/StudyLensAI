"use client";

import { useEffect } from "react";

export function DisableErrorOverlay() {
  useEffect(() => {
    // Disable Next.js error overlay for screen recording
    const disableErrorOverlay = () => {
      // Remove error overlay if it exists
      const errorOverlay = document.getElementById("__next-build-watcher");
      if (errorOverlay) {
        errorOverlay.style.display = "none";
      }

      // Remove React error overlay
      const reactErrorOverlay = document.querySelector(
        '[data-nextjs-dialog]'
      ) as HTMLElement;
      if (reactErrorOverlay) {
        reactErrorOverlay.style.display = "none";
      }

      // Hide any error boundaries
      const errorBoundaries = document.querySelectorAll(
        '[data-nextjs-toast], [data-nextjs-error]'
      );
      errorBoundaries.forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });
    };

    // Run immediately and on interval to catch dynamically added overlays
    disableErrorOverlay();
    const interval = setInterval(disableErrorOverlay, 100);

    // Also prevent error events from showing overlay
    const handleError = (e: ErrorEvent) => {
      e.preventDefault();
      return false;
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      clearInterval(interval);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}

