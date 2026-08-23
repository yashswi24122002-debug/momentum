"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/components/shared/nav-items";
import { LogoutButton } from "@/components/shared/logout-button";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  indent,
}: {
  href: string;
  icon: NavItem["icon"];
  label: string;
  active: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
        indent ? "ml-3.5 border-l border-border pl-4" : "px-3",
        active
          ? "text-primary" + (indent ? "" : " bg-accent-muted-bg")
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const sectionActive = pathname.startsWith(item.href);
  const [open, setOpen] = useState(sectionActive);
  const exactActive = pathname === item.href;

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-lg text-sm font-medium transition-colors",
          exactActive
            ? "bg-accent-muted-bg text-primary"
            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        )}
      >
        <Link href={item.href} className="flex flex-1 items-center gap-3 px-3 py-2">
          <item.icon className="size-4 shrink-0" strokeWidth={exactActive ? 2.5 : 2} />
          {item.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
          className="mr-1 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      </div>
      <div className={cn("grid transition-all duration-200 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="space-y-0.5 overflow-hidden pt-0.5">
          {item.children?.map((child) => (
            <NavLink
              key={child.href}
              href={child.href}
              icon={child.icon}
              label={child.label}
              active={pathname === child.href}
              indent
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-56 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-14 items-center px-5">
        <span className="text-sm font-semibold tracking-tight text-text-primary">
          Momentum
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) =>
          item.children ? (
            <NavGroup key={item.href} item={item} pathname={pathname} />
          ) : (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname.startsWith(item.href)}
            />
          )
        )}
      </nav>
      <div className="border-t border-border p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
