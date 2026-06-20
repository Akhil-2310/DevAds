import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevAds — earn while you code",
  description: "Watch ads in your terminal, get paid in USDC on Monad.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
