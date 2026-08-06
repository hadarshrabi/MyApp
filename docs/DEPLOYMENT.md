# פריסת Node/Express + PostgreSQL

היישום נפרס כשירות Node יחיד: Express מגיש את ה־API ואת קובצי React הבנויים
מאותו origin. PostgreSQL חייב להיות שירות מנוהל ברשת פרטית; אין לחשוף את פורט
המסד לאינטרנט.

## דרישות מהספק

- הרצת Docker או Node.js 22.
- חיבור ל־PostgreSQL פרטי עם TLS.
- HTTPS מנוהל וכתובת קבועה.
- מנהל סודות ומשתני סביבה.
- ניטור, הפעלה מחדש וגיבויים.

## משתני סביבה

`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`,
`ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `APP_ORIGIN`,
`NODE_ENV=production`, `PORT` ו־`HOST=0.0.0.0`.

`APP_ORIGIN` חייב להיות הכתובת הציבורית המדויקת, ללא wildcard.

## תהליך

1. יוצרים PostgreSQL פרטי ומגדירים גיבויים ו־TLS.
2. בונים את `Dockerfile`.
3. מגדירים את הסודות אצל ספק האירוח.
4. השירות מריץ `prisma migrate deploy` לפני הפעלת השרת.
5. מריצים seed רק בסביבת פיתוח ייעודית, עם `SEED_ADMIN_PASSWORD`
   ו־`SEED_EMPLOYEE_PASSWORD` במנהל הסודות.
6. מאמתים את `/login`, שני התפקידים, refresh, logout ו־403 לעובד.

ChatGPT Sites והפריסה הישנה אינם יעד מתאים לגרסה זו: היעד הקודם בנוי עבור
Cloudflare Worker ואינו מספק תהליך Node מתמשך עם PostgreSQL פרטי.
