import { PageIntro } from "../components/PageIntro";

export function SettingsPage() {
  return <><PageIntro title="הגדרות" text="הגדרות תפעוליות שנקבעות במערכת." />
    <div className="settings-grid settings-readonly">
      <section className="panel form-card"><h3>נוכחות לפי עמדה</h3><p>רדיוס ההחתמה מוגדר בנפרד לכל עמדה וניתן לעריכה במסך העמדות.</p></section>
      <section className="panel form-card"><h3>תפקידים ותעריפים</h3><p>התפקיד והתעריף נשמרים בכרטיס העובד ומשמשים לחישובי השכר.</p></section>
      <section className="panel form-card"><h3>הרשאות</h3><p>עובדים רואים רק את העמדה והמלאי המשויכים אליהם. פעולות ניהול מוגבלות למנהל.</p></section>
    </div>
  </>;
}
