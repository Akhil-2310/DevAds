import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AdFunded AI — Premium AI, funded by attention",
  description:
    "A rewarded AI coding workspace. Watch a sponsored ad, earn USDC on Monad, and run premium AI models like Claude — for free.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} dark`}>
      <body className="min-h-screen bg-bg font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
