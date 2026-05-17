import type { Metadata, Viewport } from "next";
import { AuthWrapper } from "@/components/AuthWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chef — Kitchen Decisions",
  description: "Cook vs order vs eat out — with honest tradeoffs",
  applicationName: "Chef",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chef",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#e8a54b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
