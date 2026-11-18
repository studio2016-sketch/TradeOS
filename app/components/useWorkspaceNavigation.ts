"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { connectWorkspaceNavigation, type WorkspaceSection } from "../../lib/ui/workspace-navigation";

export default function useWorkspaceNavigation() {
  // Identical server/client first render avoids hydration mismatch. URL is read after mount.
  const [active, setActive] = useState<WorkspaceSection>("Today");
  const navigation = useRef<ReturnType<typeof connectWorkspaceNavigation> | null>(null);
  useEffect(() => {
    const connection = connectWorkspaceNavigation(window, setActive);
    navigation.current = connection;
    return () => { connection.dispose(); navigation.current = null; };
  }, []);
  const navigate = useCallback((section: string) => navigation.current?.navigate(section), []);
  return [active, navigate] as const;
}
