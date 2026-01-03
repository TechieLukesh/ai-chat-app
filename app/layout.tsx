import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import NextAuthProvider from "../components/next-auth-provider";
import AuthButton from "../components/auth-button";
import ConsoleFilter from "../components/console-filter";

export const metadata: Metadata = {
  title: "Real time chat",
  description: "Real time chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <NextAuthProvider>
          <ConsoleFilter />
          <div style={{ position: "absolute", right: 16, top: 12 }}>
            <AuthButton />
          </div>
          {/* ConversationsPanel removed per user request */}
          {children}
        </NextAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
