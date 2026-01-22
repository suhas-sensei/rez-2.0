import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Trading Agent - AI Trading Dashboard",
  description: "AI-powered trading agent dashboard for crypto trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className={`${instrumentSerif.variable} ${inter.variable} antialiased h-full overflow-hidden`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
