import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Roast My Wallet | Your Wallet is Trash",
  description: "Get brutally roasted for your terrible trading decisions. Paste your Solana wallet and prepare to be humiliated.",
};

import { Analytics } from "@vercel/analytics/react";

// ... existing code ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
