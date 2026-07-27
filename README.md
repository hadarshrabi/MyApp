# לינוי עיצובים

מערכת ניהול לעמדות פרחים, עובדים, נוכחות, שכר ומלאי.

## פיתוח

```bash
npm install
npm run dev
```

## בניית גרסת ייצור

```bash
npm run build
```

## הכנה לאפליקציה מקומית

לאחר בניית הפרויקט:

```bash
npx cap add android
npx cap sync android
```

במחשב macOS ניתן להוסיף את iOS:

```bash
npx cap add ios
npx cap sync ios
```

היישום בנוי ב־React, Vite ו־TypeScript. ספריית Capacitor מחברת את אותו קוד ל־Android ול־iOS.
