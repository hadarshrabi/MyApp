import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AppValue = { notify: (message: string) => void };
const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState("");
  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(current => current === message ? "" : current), 3500);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <AppContext.Provider value={value}>
    {notice && <div className="toast" role="status">✓ {notice}</div>}
    {children}
  </AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("חסר AppProvider");
  return value;
}
