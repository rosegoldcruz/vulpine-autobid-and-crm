import type { Metadata, Viewport } from "next";
import AuthGate from "@/app/auth-gate";
import Providers from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vulpine Drive",
  description: "A private mobile-first dashboard for the Vulpine Storage Box.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090806",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthGate>
          <Providers>{children}</Providers>
        </AuthGate>
      </body>
    </html>
  );
}
