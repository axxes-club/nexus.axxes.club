"use client"

import { useEffect } from "react"

/**
 * Registers the static-asset service worker.
 *
 * Only in production: in development an un-cached worker would serve yesterday's
 * chunks against today's source and the app would appear to be randomly broken.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration must never break the page; the app works without it.
      })
    }

    // Registering after load keeps the worker off the critical path.
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
