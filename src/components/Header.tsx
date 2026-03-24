"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import { Home, Calendar, Dumbbell, BarChart3, HelpCircle, Sun, Moon, LogOut, LogIn } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <header className="bg-bg-card border-b border-border-color sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-accent-primary hover:text-accent-primary/80 transition-colors">
          CoachIA
        </Link>

        <nav className="hidden md:flex space-x-6">
          <Link href="/" className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors">
            <Home size={18} />
            <span>Dashboard</span>
          </Link>
          <Link href="/routine/week" className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors">
            <Calendar size={18} />
            <span>Rutina</span>
          </Link>
          <Link href="/workout/today" className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors">
            <Dumbbell size={18} />
            <span>Entrenamiento</span>
          </Link>
          <Link href="/metrics" className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors">
            <BarChart3 size={18} />
            <span>Métricas</span>
          </Link>
          <Link href="/help" className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors">
            <HelpCircle size={18} />
            <span>Ayuda</span>
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-md bg-bg-card-hover hover:bg-border-color transition-colors"
            aria-label="Toggle theme"
          >
            {mounted && (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />)}
          </button>

          {session ? (
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden md:inline">Cerrar Sesión</span>
            </button>
          ) : (
            <Link href="/auth/login" className="flex items-center space-x-2 text-text-secondary hover:text-text-primary transition-colors">
              <LogIn size={18} />
              <span className="hidden md:inline">Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-border-color">
        <nav className="container mx-auto px-4 py-2 flex justify-around">
          <Link href="/" className="flex flex-col items-center text-text-secondary hover:text-text-primary transition-colors">
            <Home size={20} />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/routine/week" className="flex flex-col items-center text-text-secondary hover:text-text-primary transition-colors">
            <Calendar size={20} />
            <span className="text-xs">Rutina</span>
          </Link>
          <Link href="/workout/today" className="flex flex-col items-center text-text-secondary hover:text-text-primary transition-colors">
            <Dumbbell size={20} />
            <span className="text-xs">Workout</span>
          </Link>
          <Link href="/metrics" className="flex flex-col items-center text-text-secondary hover:text-text-primary transition-colors">
            <BarChart3 size={20} />
            <span className="text-xs">Métricas</span>
          </Link>
          <Link href="/help" className="flex flex-col items-center text-text-secondary hover:text-text-primary transition-colors">
            <HelpCircle size={20} />
            <span className="text-xs">Ayuda</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}