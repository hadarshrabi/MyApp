import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const rememberedEmailKey = "linoy-login-remembered-email";

function loadRememberedEmail() {
  try {
    const stored = JSON.parse(localStorage.getItem(rememberedEmailKey) ?? "null") as { email?: string; expiresAt?: number } | null;
    if (stored?.email && stored.expiresAt && stored.expiresAt > Date.now()) return stored.email;
    localStorage.removeItem(rememberedEmailKey);
  } catch { localStorage.removeItem(rememberedEmailKey); }
  return "";
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState(loadRememberedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(loadRememberedEmail()));
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim();
      await login(normalizedEmail, password);
      if (rememberEmail) localStorage.setItem(rememberedEmailKey, JSON.stringify({ email: normalizedEmail, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
      else localStorage.removeItem(rememberedEmailKey);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ההתחברות נכשלה"); }
    finally { setSubmitting(false); }
  }

  return <main className="login-screen" dir="rtl">
    <svg className="login-botanical login-botanical-top" viewBox="0 0 220 220" aria-hidden="true"><g fill="none" stroke="currentColor" strokeLinecap="round"><path d="M210 8C150 55 112 111 84 207"/><path d="M175 39c-39-5-64 8-76 38 35 7 62-4 76-38Z"/><path d="M139 86c-35-1-58 14-67 45 35 3 59-12 67-45Z"/><path d="M107 139c-31 2-51 18-56 47 31-1 51-17 56-47Z"/><path d="M189 20c-6 27 2 47 25 60 8-27-1-47-25-60Z"/><path d="M155 65c-4 29 7 49 32 60 5-29-6-49-32-60Z"/></g></svg>
    <svg className="login-botanical login-botanical-bottom" viewBox="0 0 220 220" aria-hidden="true"><g fill="none" stroke="currentColor" strokeLinecap="round"><path d="M10 212C70 165 108 109 136 13"/><path d="M45 181c39 5 64-8 76-38-35-7-62 4-76 38Z"/><path d="M81 134c35 1 58-14 67-45-35-3-59 12-67 45Z"/><path d="M113 81c31-2 51-18 56-47-31 1-51 17-56 47Z"/><path d="M31 200c6-27-2-47-25-60-8 27 1 47 25 60Z"/><path d="M65 155c4-29-7-49-32-60-5 29 6 49 32 60Z"/></g></svg>
    <div className="login-content">
      <header className="login-brand">
        <span className="login-logo" aria-hidden="true"><svg viewBox="0 0 88 88"><path className="logo-letter" d="M31 18v34c0 11 6 17 17 17h13"/><path d="M31 27c-8-1-13-6-14-14 8 0 14 5 14 14Zm22 31c3-10 10-15 20-14-2 10-9 15-20 14Z"/><circle cx="19" cy="12" r="3"/><path d="M56 66c2-12 8-21 18-28"/></svg></span>
        <div className="login-brand-title"><i /><strong>לינוי עיצובים</strong><i /></div>
        <small>מערכת ניהול עמדות פרחים</small>
      </header>
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-heading"><p>ברוכים הבאים</p><h1 id="login-title">כניסה למערכת</h1><span>הזינו את פרטי המשתמש שקיבלתם ממנהל המערכת.</span></div>
      <form onSubmit={submit}>
        <label className="login-field">כתובת דוא״ל<span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span><input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required placeholder="name@example.com" /></span></label>
        <label className="login-field">סיסמה<span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} placeholder="הקלדת סיסמה" /><button type="button" className="login-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "הסתרת סיסמה" : "הצגת סיסמה"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{showPassword && <path d="M4 4 20 20"/>}</svg></button></span></label>
        <div className="login-options"><label><input type="checkbox" checked={rememberEmail} onChange={event => setRememberEmail(event.target.checked)} />זכור אותי</label><button type="button" onClick={() => setError("לאיפוס סיסמה יש לפנות למנהל המערכת.")}>שכחת סיסמה?</button></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="primary login-submit" disabled={submitting}>{submitting ? "מתחבר…" : "היכנס למערכת"}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg></button>
      </form>
      <div className="login-security"><div><i /><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-5"/></svg></span><i /></div><strong>החיבור מאובטח</strong><small>אין לשתף את פרטי הכניסה עם אחרים</small></div>
    </section>
    </div>
  </main>;
}
