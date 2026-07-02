import { Home, Calendar, Dumbbell, BarChart3, Apple, Bot, type LucideIcon } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  /** Short label used by BottomNav (mobile). Falls back to `label` when absent. */
  shortLabel?: string;
  icon: LucideIcon;
  /** Whether the link is shown in the mobile bottom navigation. */
  mobile: boolean;
};

export const navLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: Home, mobile: true },
  { href: "/routine/week", label: "Rutina", icon: Calendar, mobile: true },
  { href: "/workout/today", label: "Entrenamiento", shortLabel: "Hoy", icon: Dumbbell, mobile: true },
  { href: "/coach", label: "Coach", icon: Bot, mobile: true },
  { href: "/metrics", label: "Métricas", icon: BarChart3, mobile: true },
  { href: "/nutrition", label: "Nutrición", icon: Apple, mobile: false },
];
