import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ECTI Association",
    template: "%s | ECTI Association",
  },
  description:
    "Electrical Engineering/Electronics, Computer, Telecommunications, and Information Technology Association",
  metadataBase: new URL("https://ecti.or.th"),
  openGraph: {
    type: "website",
    siteName: "ECTI Association",
    title: "ECTI Association",
    description:
      "Electrical Engineering/Electronics, Computer, Telecommunications, and Information Technology Association",
    images: [
      {
        url: "/images/ecti-og.png",
        width: 1200,
        height: 630,
        alt: "ECTI Association Logo",
      },
    ],
    locale: "th_TH",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ECTI Association",
    description:
      "Electrical Engineering/Electronics, Computer, Telecommunications, and Information Technology Association",
    images: ["/images/ecti-og.png"],
  },
  alternates: {
    languages: {
      th: "/th",
      en: "/en",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#1565c0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${notoSansThai.variable} font-sans antialiased leading-relaxed`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
