import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../components/Nav";
import FeedbackButton from "../components/FeedbackButton";
import AuthWrapper from "../components/AuthWrapper";
import AuthDebug from "../components/AuthDebug";
import BuildVerifier from "../components/BuildVerifier";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassMate",
  description: "Parse syllabi, track deadlines, and study smarter.",
  icons: {
    icon: [
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  const buildTimestamp = new Date().toISOString();
  const buildSha =
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.GIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    "";
  return (
    <html lang="en">
      <body className="antialiased bg-[#FAFAFA] text-slate-900">
        <BuildVerifier />
        <AuthWrapper>
          <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
                <img
                  src="/brand/classmate-owl.png"
                  alt="Classmate"
                  style={{ height: "32px", width: "auto" }}
                />
                {/* Hidden on mobile to prevent overlap with nav */}
                <span className="text-[#7BB7FF] hidden md:inline">ClassMate</span>
              </Link>
              <Nav />
            </div>
          </header>
          {children}
          <FeedbackButton />
          {/* Deployment marker: d569228-feedback-button-v2 */}
          <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-slate-400">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>&copy; {new Date().getFullYear()} ClassMate</span>
              <div className="flex items-center gap-4">
                <Link href="/privacy" className="hover:text-slate-600 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-slate-600 transition-colors">
                  Terms of Service
                </Link>
              </div>
            </div>
            {process.env.NODE_ENV !== "production" && (
              <div className="mt-2">
                Build: {buildTimestamp} | id: {buildId}
                {buildSha ? ` | sha: ${buildSha}` : ""}
                <AuthDebug />
              </div>
            )}
          </footer>
        </AuthWrapper>
      </body>
    </html>
  );
}
