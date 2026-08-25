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
  { label: "Masters", href: "/masters-abroad", icon: GraduationCap },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
];
