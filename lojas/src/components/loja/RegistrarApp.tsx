"use client";

import { useEffect } from "react";

/** liga o service worker (/sw.js), que deixa o celular instalar a loja como app */
export function RegistrarApp() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
