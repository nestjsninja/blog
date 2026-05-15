import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "highlight.js/styles/github-dark.css";
import "./globals.css";
import { rootMetadata } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-sm font-semibold text-zinc-950">
              Henrique Weiand
            </Link>
            <div className="flex items-center gap-5 text-sm font-medium text-zinc-600">
              <Link href="/blog" className="hover:text-teal-700">
                Blog
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-teal-700"
              >
                GitHub
              </a>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
