import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "לינוי עיצובים | מערכת ניהול",
  description: "ניהול עובדים, שכר, מלאי ועמדות הפרחים של לינוי עיצובים.",
  openGraph: {
    title: "לינוי עיצובים",
    description: "ניהול חכם. פריחה בכל עמדה.",
    type: "website",
    locale: "he_IL",
    images: [{ url: "/og.png", width: 1736, height: 909, alt: "לינוי עיצובים — מערכת ניהול" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "לינוי עיצובים",
    description: "ניהול חכם. פריחה בכל עמדה.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
