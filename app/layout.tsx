import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const sans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const serif = Noto_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "Second Reply",
      template: "%s · Second Reply",
    },
    description: "Go back into a conversation and find what you really want to say this time.",
    openGraph: {
      type: "website",
      locale: "en_US",
      title: "Second Reply",
      description: "If you could go back into that conversation.",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Second Reply" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Second Reply",
      description: "If you could go back into that conversation.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
