"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Home, Calendar, Dumbbell, BarChart3, HelpCircle, Sun, Moon, LogOut, LogIn } from "lucide-react";
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

  return (
    <header className="bg-bg-card/80 backdrop-blur-md border-b border-glass-border sticky top-0 z-50">
      <div className="app-container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tighter text-white hover:opacity-80 transition-opacity">
          Coach<span className="text-accent-primary">IA</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href}
                href={link.href} 
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive 
                    ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/20" 
                    : "text-text-secondary hover:text-text-primary hover:bg-glass-bg"
                }`}
              >
                <Icon size={16} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center space-x-8">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-full bg-glass-bg border border-glass-border hover:bg-glass-border transition-colors text-text-primary"
            aria-label="Toggle theme"
          >
            {mounted && (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />)}
          </button>

          {session ? (
            <button
              onClick={() => signOut()}
              className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-full bg-glass-bg border border-glass-border text-text-secondary hover:text-red-400 hover:border-red-400/50 transition-all text-sm font-medium"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          ) : (
            <Link 
              href="/auth/login" 
              className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-full bg-accent-primary text-white hover:opacity-90 transition-all text-sm font-medium shadow-lg shadow-accent-primary/20"
            >
              <LogIn size={16} />
              <span>Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-glass-border bg-bg-card/90 backdrop-blur-lg">
        <nav className="flex justify-around py-3 px-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href}
                href={link.href} 
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isActive ? "text-accent-primary" : "text-text-secondary"
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}