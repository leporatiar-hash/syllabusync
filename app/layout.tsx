import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import Nav from "./components/Nav";
import AuthWrapper from "./components/AuthWrapper";
import AuthDebug from "./components/AuthDebug";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClassMate",
  description: "Parse syllabi, track deadlines, and study smarter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-[#FAFAFA] text-slate-900`}>
        <AuthWrapper>
          <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <Image
                  src="/brand/classmate-owl.png"
                  alt="Classmate"
                  width={160}
                  height={48}
                  priority
                  style={{ height: "32px", width: "auto" }}
                />
                <span>ClassMate</span>
              </Link>
              <Nav />
            </div>
          </header>
          {children}
          <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-slate-400">
            Build: {buildId}
            <AuthDebug />
          </footer>
        </AuthWrapper>
      </body>
    </html>
  );
}
