import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vulpine Auto Bidder",
  description: "Autonomous cabinet revenue engine — bid generation pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-vulpine-coal text-gray-200 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}