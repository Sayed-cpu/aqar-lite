import type { Metadata, Viewport } from "next";
import { plexArabic, plexLatin } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "عقار لايت",
  description: "نظام بيع الوحدات العقارية بالتقسيط",
};

export const viewport: Viewport = {
  themeColor: "#0a3326",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} ${plexLatin.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
