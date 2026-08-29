import {
  Lightbulb,
  GraduationCap,
  Briefcase,
  CheckSquare,
  Camera,
  ListChecks,
  CalendarDays,
  BarChart3,
  History,
  Images,
  FileText,
  Landmark,
  Send,
  Flame,
  ScanBarcode,
  Soup,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ToolKey } from "@/lib/types/admin";

export type NavChild = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
  /** Only ever rendered for the admin — real enforcement is server-side (lib/supabase/admin-guard.ts), this just keeps it out of a member's UI. */
  adminOnly?: boolean;
  /** Which tool_access row gates this group for a member — omitted for non-tool items (Admin). Real enforcement is the middleware (lib/admin/tool-routes.ts); this just keeps a disabled tool out of a member's nav. */
  toolKey?: ToolKey;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Habits",
    href: "/habits",
    icon: CheckSquare,
    toolKey: "habits",
    children: [
      { label: "Today", href: "/habits", icon: CheckSquare },
      { label: "Manage", href: "/habits/manage", icon: ListChecks },
      { label: "Grid", href: "/habits/grid", icon: CalendarDays },
      { label: "Dashboard", href: "/habits/dashboard", icon: BarChart3 },
    ],
  },
  {
    label: "Ideas",
    href: "/ideas",
    icon: Lightbulb,
    toolKey: "ideas",
    children: [
      { label: "Today", href: "/ideas", icon: Lightbulb },
      { label: "History", href: "/ideas/history", icon: History },
    ],
  },
  {
    label: "Content",
    href: "/content",
    icon: Camera,
    toolKey: "content",
    children: [
      { label: "Today", href: "/content", icon: Camera },
      { label: "History", href: "/content/history", icon: History },
      { label: "Library", href: "/content/library", icon: Images },
    ],
  },
  {
    label: "Masters",
    href: "/masters-abroad",
    icon: GraduationCap,
    toolKey: "masters_abroad",
    children: [
      { label: "Dashboard", href: "/masters-abroad", icon: GraduationCap },
      { label: "Universities", href: "/masters-abroad/universities", icon: Landmark },
      { label: "Tasks", href: "/masters-abroad/tasks", icon: ListChecks },
      { label: "Timeline", href: "/masters-abroad/timeline", icon: CalendarDays },
      { label: "Documents", href: "/masters-abroad/documents", icon: FileText },
    ],
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: Briefcase,
    toolKey: "jobs",
    children: [
      { label: "Feed", href: "/jobs", icon: Briefcase },
      { label: "Outreach Queue", href: "/jobs/outreach-queue", icon: Send },
      { label: "Pipeline", href: "/jobs/pipeline", icon: ListChecks },
      { label: "Resumes", href: "/jobs/resumes", icon: FileText },
    ],
  },
  {
    label: "Calories",
    href: "/calories",
    icon: Flame,
    toolKey: "calories",
    children: [
      { label: "Today", href: "/calories", icon: Flame },
      { label: "Log Food", href: "/calories/log", icon: ScanBarcode },
      { label: "History", href: "/calories/history", icon: History },
      { label: "Foods", href: "/calories/foods", icon: Soup },
      { label: "Recipes", href: "/calories/recipes", icon: FileText },
      { label: "Settings", href: "/calories/settings", icon: Settings },
    ],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

/** Shared filter used by every nav surface (sidebar, mobile drawer, bottom tab bar) — cosmetic only, real enforcement is the middleware (lib/admin/tool-routes.ts). */
export function visibleNavItems(isAdmin: boolean, enabledTools: ToolKey[]): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (isAdmin) return true;
    if (!item.toolKey) return true;
    return enabledTools.includes(item.toolKey);
  });
}
