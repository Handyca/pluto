'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Presentation,
  LogOut,
  Sparkles,
  Users2,
  ChevronLeft,
  Activity,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  sessionCount?: number;
  className?: string;
}

export function AdminSidebar({ sessionCount = 0, className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        {
          title: 'Dashboard',
          href: '/admin',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      title: 'Sessions',
      items: [
        {
          title: 'All Sessions',
          href: '/admin',
          icon: Presentation,
          badge: sessionCount > 0 ? sessionCount : undefined,
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          title: 'User Management',
          href: '/admin/users',
          icon: Users2,
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          title: 'WS Monitor',
          href: '/admin/websocket/monitor',
          icon: Activity,
        },
      ],
    },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/admin/login' });
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-slate-950 text-white border-r border-white/10 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center w-full')}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            {!collapsed && <span className="text-lg font-bold">Pluto Admin</span>}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 mt-2 w-full"
            onClick={() => setCollapsed(false)}
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {navGroups.map((group, idx) => (
          <div key={group.title} className={cn(idx > 0 && 'mt-6')}>
            {!collapsed && (
              <div className="px-4 mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.title}
                </h3>
              </div>
            )}
            <nav className="space-y-1 px-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 h-10 px-3',
                        collapsed && 'justify-center px-2',
                        active
                          ? 'bg-white/10 text-white hover:bg-white/15'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.title}</span>
                          {item.badge !== undefined && (
                            <Badge
                              variant="secondary"
                              className="ml-auto bg-blue-500/20 text-blue-300 border-blue-500/30"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/10">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 h-10 px-3 text-gray-400 hover:text-white hover:bg-white/5',
            collapsed && 'justify-center px-2'
          )}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}
