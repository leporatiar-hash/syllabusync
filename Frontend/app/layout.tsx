import type { Metadata } from "next";
import AuthWrapper from "../components/AuthWrapper";
import BuildVerifier from "../components/BuildVerifier";
import SiteChrome from "../components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassMate",
  description: "Parse syllabi, track deadlines, and study smarter.",
  metadataBase: new URL("https://tryclassmate.com"),
  openGraph: {
    title: "ClassMate",
    description: "Parse syllabi, track deadlines, and study smarter.",
    siteName: "ClassMate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClassMate",
    description: "Parse syllabi, track deadlines, and study smarter.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
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
  return (
    <html lang="en">
      <body className="antialiased bg-[#FAFAFA] text-slate-900">
        <BuildVerifier />
        <AuthWrapper>
          <SiteChrome>{children}</SiteChrome>
        </AuthWrapper>
      </body>
    </html>
  );
}
