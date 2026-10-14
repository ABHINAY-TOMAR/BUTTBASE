import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import CommandPalette from '@/components/CommandPalette';

export const metadata: Metadata = {
  title: 'ButtBase — Control Plane',
  description: 'B.U.T.T. Base — one universal URL, infinite free Supabase nodes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-obsidian font-sans text-fg antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-6">{children}</main>
          </div>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
