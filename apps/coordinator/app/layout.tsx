import type { Metadata } from "next";
import { PaperShaderBackground } from "./components/PaperShaderBackground";
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
      <body>
        <PaperShaderBackground />
        {children}
        <div className="font-attribution">
          Fonts from{" "}
          <a href="https://www.onlinewebfonts.com" target="_blank" rel="noopener noreferrer">
            OnlineWebFonts
          </a>
        </div>
      </body>
    </html>
  );
}
