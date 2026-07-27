import { createContext, useContext, useState, type ReactNode } from "react";

type AppValue = { notify: (message: string) => void; openModal: (title: string) => void };
const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); };
  return <AppContext.Provider value={{ notify, openModal: setModal }}>
    {notice && <div className="toast" role="status">✓ {notice}</div>}
    {modal && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={modal}>
      <form className="modal" onSubmit={(event) => { event.preventDefault(); setModal(""); notify("הפרטים נשמרו בהצלחה"); }}>
        <button type="button" className="modal-close" onClick={() => setModal("")} aria-label="סגירה">×</button>
        <h2>{modal}</h2><p>מלאו את הפרטים ושמרו את השינויים.</p>
        <label>שם<input required placeholder="הקלדת שם" /></label>
        <label>שיוך לעמדה<select><option>עזריאלי</option><option>שרונה</option><option>דיזנגוף</option><option>רמת אביב</option></select></label>
        <div><button type="button" className="secondary" onClick={() => setModal("")}>ביטול</button><button className="primary">שמירה</button></div>
      </form>
    </div>}
    {children}
  </AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider חסר");
  return value;
}
