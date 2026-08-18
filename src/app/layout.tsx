import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Money Tracker - Catatan Keuangan Rumah Tangga",
  description: "Aplikasi pencatat keuangan rumah tangga (suami & istri) dengan sinkronisasi otomatis ke Google Sheets dan PWA.",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Money Tracker",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <div className="page-container max-w-md mx-auto relative shadow-2xl shadow-black/50 bg-background min-h-screen">
              {children}
              <BottomNav />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
