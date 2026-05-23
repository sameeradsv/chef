import type { Metadata, Viewport } from "next";
import {
  Newsreader,
  Space_Grotesk,
  Instrument_Serif,
  DM_Sans,
  JetBrains_Mono,
  Inter,
} from "next/font/google";
import { AuthWrapper } from "@/components/AuthWrapper";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const fontVars = [
  newsreader.variable,
  spaceGrotesk.variable,
  instrumentSerif.variable,
  dmSans.variable,
  jetbrainsMono.variable,
  inter.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Chef — Kitchen Decisions",
  description: "Cook vs order vs eat out — with honest tradeoffs",
  applicationName: "Chef",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chef",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1c1a17",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVars}>
      <head>
        {/* Prevent theme flash on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('chef-theme')||'hearth';document.documentElement.setAttribute('data-theme',t);})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
