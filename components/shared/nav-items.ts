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
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Habits",
    href: "/habits",
    icon: CheckSquare,
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
    children: [
      { label: "Today", href: "/ideas", icon: Lightbulb },
      { label: "History", href: "/ideas/history", icon: History },
    ],
  },
  {
    label: "Content",
    href: "/content",
    icon: Camera,
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
