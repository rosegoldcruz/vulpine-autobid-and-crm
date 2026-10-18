import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Autonomous Lead-to-Client Pipeline',
  description: 'An autonomous B2B growth engine that sources local leads, scores digital maturity, generates instant interactive website previews, and conducts automated personalized email outreach connected to GoHighLevel.',
  openGraph: {
    title: 'Autonomous Lead-to-Client Pipeline',
    description: 'An autonomous B2B growth engine that sources local leads, scores digital maturity, generates instant interactive website previews, and conducts automated personalized email outreach connected to GoHighLevel.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Autonomous Lead-to-Client Pipeline',
    description: 'An autonomous B2B growth engine that sources local leads, scores digital maturity, generates instant interactive website previews, and conducts automated personalized email outreach connected to GoHighLevel.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
