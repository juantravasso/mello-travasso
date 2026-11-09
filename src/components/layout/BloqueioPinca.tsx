"use client";

import { useEffect } from "react";

/**
 * Impede o zoom por pinça no celular. O iPhone ignora `user-scalable=no` e `maximum-scale`, então o bloqueio vem de
 * `touch-action` (globals.css) e, para versões que ainda disparam o gesto, do evento `gesturestart` do Safari.
 */
export function BloqueioPinca() {
  useEffect(() => {
    const impedir = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", impedir);
    document.addEventListener("gesturechange", impedir);
    return () => {
      document.removeEventListener("gesturestart", impedir);
      document.removeEventListener("gesturechange", impedir);
    };
  }, []);
  return null;
}
