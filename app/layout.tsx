import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Measure how honest and self-consistent LLMs are — do they act the way they say they would?";

export const metadata: Metadata = {
  title: {
    default: "Authenticity Bench",
    template: "%s | Authenticity Bench",
  },
  description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://authenticity-bench.vercel.app"
  ),
  openGraph: {
    title: "Authenticity Bench",
    description,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Authenticity Bench",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
