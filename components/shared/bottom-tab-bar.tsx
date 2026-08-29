"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "@/components/shared/nav-items";
import type { ToolKey } from "@/lib/types/admin";

export function BottomTabBar({ isAdmin = false, enabledTools = [] }: { isAdmin?: boolean; enabledTools?: ToolKey[] }) {
  const pathname = usePathname();
  const items = visibleNavItems(isAdmin, enabledTools);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs transition-colors",
                  active ? "text-primary" : "text-text-muted"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
