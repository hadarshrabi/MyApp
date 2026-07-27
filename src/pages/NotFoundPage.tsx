import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <section className="empty-page"><h2>העמוד לא נמצא</h2><p>ייתכן שהכתובת השתנתה או שהעמוד אינו זמין.</p><Link className="primary" to="/">חזרה לסקירה</Link></section>;
}
