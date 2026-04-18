import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BogglTrack — Time tracking & earnings for freelancers",
  description:
    "Track every billable minute, manage projects and clients, and invoice in one click. Works in your browser. Feels at home on your Mac.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ),
  openGraph: {
    type: "website",
    url: "/",
    siteName: "BogglTrack",
    title: "BogglTrack — Time tracking & earnings for freelancers",
    description:
      "Track every billable minute, manage projects and clients, and invoice in one click. Works in your browser. Feels at home on your Mac.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BogglTrack — Time tracking & earnings for freelancers",
    description:
      "Track every billable minute, manage projects and clients, and invoice in one click.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)] bg-background text-foreground">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
