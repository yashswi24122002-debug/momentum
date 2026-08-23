import {
  Lightbulb,
  GraduationCap,
  Briefcase,
  CheckSquare,
  Camera,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Habits", href: "/habits", icon: CheckSquare },
  { label: "Ideas", href: "/ideas", icon: Lightbulb },
  { label: "Content", href: "/content", icon: Camera },
  { label: "Masters", href: "/masters-abroad", icon: GraduationCap },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
];
