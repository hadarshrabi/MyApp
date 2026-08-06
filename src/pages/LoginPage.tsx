import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try { await login(email.trim(), password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ההתחברות נכשלה"); }
    finally { setSubmitting(false); }
  }

  return <main className="login-screen" dir="rtl">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><span>ל</span><div><strong>לינוי עיצובים</strong><small>מערכת ניהול עמדות פרחים</small></div></div>
      <div className="login-heading"><p>ברוכים הבאים</p><h1 id="login-title">כניסה למערכת</h1><span>הזינו את פרטי המשתמש שקיבלתם ממנהל המערכת.</span></div>
      <form onSubmit={submit}>
        <label>כתובת דוא״ל<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required placeholder="name@example.com" /></label>
        <label>סיסמה<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} placeholder="הקלדת סיסמה" /></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="primary login-submit" disabled={submitting}>{submitting ? "מתחבר…" : "כניסה"}</button>
      </form>
      <small className="login-security">החיבור מאובטח. אין לשתף את פרטי הכניסה עם אחרים.</small>
    </section>
  </main>;
}
