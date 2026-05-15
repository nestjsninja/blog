import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
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

const ninjaLogo = "/nestjs-ninja.png";

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
      <body className="flex min-h-full flex-col bg-[#0b0714] text-zinc-100">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0714]/90 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={ninjaLogo}
                alt="NestJS Ninja logo"
                width={36}
                height={36}
                className="rounded-md ring-1 ring-violet-400/30"
                priority
              />
              <span className="text-sm font-semibold text-white">
                NestJS Ninja
              </span>
            </Link>
            <div className="flex items-center gap-5 text-sm font-medium text-zinc-300">
              <Link href="/blog" className="hover:text-violet-300">
                Blog
              </Link>
              <a
                href="https://medium.com/nestjs-ninja"
                target="_blank"
                rel="noreferrer"
                className="hover:text-violet-300"
              >
                Medium
              </a>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
