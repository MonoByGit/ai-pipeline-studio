import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Pipeline Studio",
  description: "Real-time visual AI processing pipeline for business inputs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
