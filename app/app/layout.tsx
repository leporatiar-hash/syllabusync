import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Nav from "./components/Nav";
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
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} antialiased bg-[#FAFAFA] text-slate-900`}>
          <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA] text-white shadow-sm">
                  C
                </span>
                <span>ClassMate</span>
              </Link>
              <Nav />
              <div className="flex items-center gap-3">
                <SignedOut>
                  <Link
                    href="/sign-in"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-md"
                  >
                    Get Started
                  </Link>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
