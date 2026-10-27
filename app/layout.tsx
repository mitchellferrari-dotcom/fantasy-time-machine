import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import './style.css';

export const metadata: Metadata = {
  title: 'Fantasy Time Machine',
  description: 'Draft the greatest fantasy seasons since 2000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7KREJV5SEP"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-7KREJV5SEP');`}
        </Script>
      </body>
    </html>
  );
}
