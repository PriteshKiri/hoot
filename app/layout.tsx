import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoot — Real-Time Quiz Platform",
  description:
    "Create and run interactive quiz events with real-time leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans overflow-x-hidden">{children}</body>
    </html>
  );
}
