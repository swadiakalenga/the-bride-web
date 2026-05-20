import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TheBride",
    template: "%s · TheBride",
  },
  description: "A global community platform for churches and believers — connect, worship, and grow together in faith.",
  applicationName: "TheBride",
  keywords: ["church", "Christian", "community", "faith", "worship", "believers"],
  authors: [{ name: "TheBride" }],
  icons: {
    icon: [
      { url: "/favicon.png",   type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png",  type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png",  type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "TheBride",
    title: "TheBride — Community for Believers",
    description: "Connect, worship, and grow together in faith.",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "TheBride",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "TheBride",
    description: "A global community platform for churches and believers.",
    images: ["/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TheBride",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6a00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
