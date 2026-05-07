import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export interface DashboardCardBadge {
  label: string;
  textClass: string;
  bgStyle: React.CSSProperties;
}

export interface DashboardCardProps {
  href: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  hoverBorderClass: string;
  title: string;
  description: string;
  delayMs: number;
  badge?: DashboardCardBadge;
}

export function DashboardCard({
  href,
  icon: Icon,
  iconBgClass,
  iconColorClass,
  hoverBorderClass,
  title,
  description,
  delayMs,
  badge,
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className={`card group relative overflow-hidden card-hover-lift animate-fade-up ${hoverBorderClass}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {badge && (
        <div
          className={`absolute top-3 right-3 badge-pulse ${badge.textClass} font-bold uppercase tracking-widest rounded-full`}
          style={{ ...badge.bgStyle, fontSize: 10, padding: "4px 8px" }}
        >
          {badge.label}
        </div>
      )}
      <div className={`mb-4 p-3 rounded-xl w-fit ${iconBgClass}`}>
        <Icon aria-hidden="true" className={iconColorClass} size={26} />
      </div>
      <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center justify-between">
        {title}
        <ArrowRight
          aria-hidden="true"
          className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
          size={18}
        />
      </h2>
      <p className="text-text-secondary text-sm leading-relaxed hidden sm:block">
        {description}
      </p>
    </Link>
  );
}
