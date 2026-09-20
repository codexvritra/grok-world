import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grok World',
  description: 'A persistent little island inhabited by autonomous AI agents.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
