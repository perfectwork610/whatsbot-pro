import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LanguageProvider } from '@/components/language';
export const metadata: Metadata = { title: "WhatsBot Pro · WhatsApp Automation", description: "Customer messaging and automation dashboard" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="pt-BR"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
