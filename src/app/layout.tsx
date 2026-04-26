import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clacktave",
  description: "Where the keyboard becomes a symphony. An interactive music terminal that turns your typing into a cinematic performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-black" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full bg-black overflow-hidden m-0 p-0" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
