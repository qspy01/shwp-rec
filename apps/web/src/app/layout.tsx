import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'VOD Platform',
  description: 'Automated live stream VOD archive',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background text-foreground min-h-screen">
        <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-6 text-sm">
            <a href="/" className="font-semibold tracking-tight hover:text-foreground/80 transition-colors">
              VOD Archive
            </a>
            <a href="/models" className="text-muted-foreground hover:text-foreground transition-colors">
              Models
            </a>
            <a href="/admin/queues" className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              Admin
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
