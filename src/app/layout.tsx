import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clacktave",
  description: "Procedural Keyboard Synthesizer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-black" suppressHydrationWarning>
      <body className="h-full bg-black overflow-hidden m-0 p-0" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
