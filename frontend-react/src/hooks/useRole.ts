import { useState, useCallback, useEffect } from "react";
import type { Role } from "@/lib/constants";

const STORAGE_KEY = "cri-workflow-role";

export function useRole() {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "gtm" || saved === "pm" || saved === "engineering" || saved === "admin") return saved;
    return "gtm";
  });

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(STORAGE_KEY, r);
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setRoleState(e.newValue as Role);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { role, setRole };
}
