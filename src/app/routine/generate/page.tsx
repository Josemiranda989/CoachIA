import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { GenerateRoutineForm } from "./GenerateRoutineForm";

export const metadata: Metadata = { title: "Generar rutina" };

export default function GenerateRoutinePage() {
  return (
    <div className="app-container py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-accent-primary-soft rounded-xl">
          <Sparkles className="text-accent-primary" size={24} aria-hidden="true" />
        </div>
        <h1 className="title text-3xl md:text-4xl">Generar Rutina con IA</h1>
      </div>
      <p className="subtitle mb-8">Describí tus objetivos y IA arma tu semana completa.</p>

      <GenerateRoutineForm />

      <Link href="/" className="btn btn-secondary mt-6 inline-block">
        &larr; Volver al Inicio
      </Link>
    </div>
  );
}
