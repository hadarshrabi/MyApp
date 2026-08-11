import { useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installHintDismissed, setInstallHintDismissed] = useState(() => sessionStorage.getItem("pwa-install-hint-dismissed") === "1");
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisterError(error) { console.error("PWA registration failed", error); },
  });

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  const showIosInstallHint = useMemo(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as NavigatorWithStandalone).standalone);
    return ios && !standalone && !installHintDismissed;
  }, [installHintDismissed]);

  const dismissInstallHint = () => {
    sessionStorage.setItem("pwa-install-hint-dismissed", "1");
    setInstallHintDismissed(true);
  };

  return <div className="pwa-status-layer" aria-live="polite">
    {!online && <div className="pwa-offline-banner" role="status">אין חיבור לאינטרנט. נתונים ופעולות לא יישמרו עד לחזרת החיבור.</div>}
    {needRefresh && <aside className="pwa-update-prompt" role="status" aria-label="עדכון אפליקציה זמין">
      <div><strong>גרסה חדשה זמינה</strong><span>אפשר לעדכן כשתסיימו את הפעולה הנוכחית.</span></div>
      <div className="pwa-prompt-actions">
        <button type="button" className="secondary" onClick={() => setNeedRefresh(false)}>אחר כך</button>
        <button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>עדכון עכשיו</button>
      </div>
    </aside>}
    {showIosInstallHint && <aside className="pwa-install-hint" role="status" aria-label="התקנת האפליקציה באייפון">
      <button type="button" className="pwa-dismiss" onClick={dismissInstallHint} aria-label="סגירת הוראות התקנה">×</button>
      <strong>הוספה למסך הבית</strong>
      <span>לחצו על שיתוף ב־Safari ואז על „הוספה למסך הבית”.</span>
    </aside>}
  </div>;
}
