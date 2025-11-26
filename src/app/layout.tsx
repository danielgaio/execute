import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Execute - Agent-First Execution",
  description: "12-Week Execution Framework powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
