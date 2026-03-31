"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Home, Calendar, Dumbbell, BarChart3, HelpCircle, Sun, Moon, LogOut, LogIn, User } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/routine/week", label: "Rutina", icon: Calendar },
    { href: "/workout/today", label: "Entrenamiento", icon: Dumbbell },
    { href: "/metrics", label: "Métricas", icon: BarChart3 },
    { href: "/help", label: "Ayuda", icon: HelpCircle },
  ];

  const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 64 }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", marginRight: 48 }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
            Coach
          </span>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--accent-primary)" }}>
            IA
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex" style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  background: isActive ? "var(--accent-primary)" : "transparent",
                  boxShadow: isActive ? "0 4px 12px rgba(220, 38, 38, 0.25)" : "none",
                }}
              >
                <Icon size={16} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid var(--glass-border)",
              background: "var(--glass-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {mounted && (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />)}
          </button>

          {/* Auth area */}
          {session ? (
            <div className="hidden md:flex" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* User avatar */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
              }}>
                {userInitial}
              </div>
              <button
                onClick={() => signOut()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid var(--glass-border)",
                  background: "var(--glass-bg)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                }}
              >
                <LogOut size={16} />
                <span>Salir</span>
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="hidden md:flex"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 10,
                background: "var(--accent-primary)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)",
                transition: "all 0.2s ease",
              }}
            >
              <LogIn size={16} />
              <span>Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden" style={{
        borderTop: "1px solid var(--glass-border)",
        background: "var(--bg-card)",
        backdropFilter: "blur(16px)",
      }}>
        <nav style={{ display: "flex", justifyContent: "space-around", padding: "8px 8px 12px" }}>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 12px",
                  borderRadius: 12,
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                  background: isActive ? "rgba(220, 38, 38, 0.1)" : "transparent",
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
