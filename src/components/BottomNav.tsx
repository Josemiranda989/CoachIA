"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Dumbbell, BarChart3 } from "lucide-react";

const navLinks = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/routine/week", label: "Rutina", icon: Calendar },
  { href: "/workout/today", label: "Hoy", icon: Dumbbell },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--bg-card)",
        borderTop: "1px solid var(--glass-border)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.2)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 4px" }}>
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "8px 12px",
                minHeight: 56,
                minWidth: 56,
                borderRadius: 12,
                textDecoration: "none",
                transition: "all 0.2s ease",
                color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                background: isActive ? "rgba(220, 38, 38, 0.1)" : "transparent",
              }}
            >
              <Icon size={22} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
