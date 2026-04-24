"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Home, Calendar, Dumbbell, BarChart3, Apple, Sun, Moon, LogOut, LogIn, User, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/routine/week", label: "Rutina", icon: Calendar },
    { href: "/workout/today", label: "Entrenamiento", icon: Dumbbell },
    { href: "/metrics", label: "Métricas", icon: BarChart3 },
    { href: "/nutrition", label: "Nutrición", icon: Apple },
  ];

  const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", height: 56 }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", marginRight: 32 }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
            Coach
          </span>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--accent-primary)" }}>
            IA
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center flex-1" style={{ gap: 4 }}>
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
                  padding: "12px 18px",
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
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menú de usuario"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px 4px 4px",
                  borderRadius: 10,
                  border: "1px solid var(--glass-border)",
                  background: menuOpen ? "var(--glass-bg)" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--accent-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}>
                  {userInitial}
                </div>
                <ChevronDown
                  size={14}
                  style={{
                    color: "var(--text-secondary)",
                    transition: "transform 0.2s ease",
                    transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: 220,
                    background: "var(--bg-card)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 12,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    padding: 8,
                    zIndex: 60,
                  }}
                >
                  <div style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--glass-border)",
                    marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {session.user?.name || "Atleta"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, wordBreak: "break-all" }}>
                      {session.user?.email}
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    role="menuitem"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "var(--text-primary)",
                      fontSize: 14,
                      fontWeight: 500,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <User size={16} />
                    <span>Mi Perfil</span>
                  </Link>

                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <LogOut size={16} />
                    <span>Salir</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
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

    </header>
  );
}
