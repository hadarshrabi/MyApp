# לינוי עיצובים

מערכת ניהול בעברית וב־RTL לעמדות פרחים, עובדים, נוכחות, מכירות ומלאי.

## סביבת פיתוח

דרישות: Node.js 22 ומעלה, Docker Desktop.

```bash
docker compose up -d postgres
copy .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

יש להחליף את כל ערכי הסודות שבקובץ `.env`. הסקריפט ליצירת נתוני ההדגמה דורש
`SEED_ADMIN_PASSWORD` ו־`SEED_EMPLOYEE_PASSWORD`, ואינו מכיל סיסמאות ברירת מחדל.

## API ובדיקות

```bash
npm run api:dev
npm test
```

PostgreSQL הוא מקור האמת היחיד. Prisma משמש לגישה למסד, למיגרציות ולנתוני
ההדגמה. אין בפרויקט שכבת D1 או SQLite.

## בניית גרסת ייצור

```bash
npm run build
```

## הכנה לאפליקציה מקומית

לאחר הבנייה:

```bash
npx cap add android
npx cap sync android
```

במחשב macOS ניתן להוסיף iOS:

```bash
npx cap add ios
npx cap sync ios
```

לפני העלאה לייצור יש לעבור על [רשימת בקרות האבטחה](SECURITY_CHECKLIST.md) ועל
[נוהל הגיבוי והשחזור](docs/BACKUP_AND_RESTORE.md).

## הרצה מלאה עם Docker

להרצת React, Express ו־PostgreSQL בפקודה אחת, העתיקו את `.env.example` אל
`.env`, החליפו את ערכי ה־placeholder, והריצו:

```bash
docker compose up --build
```

הוראות מלאות ל־health checks, migrations, seed ואיפוס סביבת הפיתוח נמצאות
ב־[מדריך הפיתוח המקומי עם Docker](docs/LOCAL_DOCKER.md).
