'use client';

import { AdminSidebar } from '@/components/admin-sidebar';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
  sessionCount?: number;
}

export function AdminLayout({ children, sessionCount }: AdminLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar sessionCount={sessionCount} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
