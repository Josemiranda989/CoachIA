import Link from "next/link";

export default function HelpPage() {
  const jsonMockup = `{
  "weekStart": "2026-04-14T00:00:00Z",
  "days": [
    {
      "dayOfWeek": "Monday",
      "type": "Gym",
      "exercises": [
        { "name": "Sentadillas", "targetSets": 4, "targetReps": "8-10" },
        { "name": "Press Banco", "targetSets": 3, "targetReps": "10-12" }
      ]
    },
    {
      "dayOfWeek": "Tuesday",
      "type": "Cycling",
      "targetDuration": 90,
      "targetPower": "Z2 Endurance"
    },
    {
      "dayOfWeek": "Wednesday",
      "type": "Rest"
    }
  ]
}`;

  return (
    <div className="app-container" style={{ paddingBottom: "60px" }}>
      <Link href="/" className="inline-flex items-center gap-1 mb-4 text-sm transition-colors hover:text-[var(--text-primary)]" style={{ color: "var(--text-secondary)" }}>
        &larr; Volver al Inicio
      </Link>

      <h1 className="title">Centro de Ayuda</h1>
      <p className="subtitle">Todo lo que necesitas para usar CoachIA</p>

      {/* Generar rutina con IA */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-primary)" }}>
          1. Generar Rutina con IA (Claude)
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          Desde el Dashboard, tocá <strong>&quot;Generar con IA&quot;</strong>. Seleccioná tu objetivo, cantidad de
          días de gym y ciclismo, grupos musculares de enfoque, y opcionalmente agregá notas
          (ej: &quot;tengo una lesión en el hombro&quot;). Claude genera la semana completa.
        </p>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          Podés <strong>regenerar</strong> si no te convence, y cuando estés conforme, <strong>guardarla</strong> directamente.
        </p>
      </section>

      {/* Cargar JSON manual */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-primary)" }}>
          2. Cargar Rutina Manual (JSON)
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          Si preferís armar la rutina vos mismo, desde <strong>&quot;Cargar JSON&quot;</strong> podés
          pegar un JSON con esta estructura. Respetá las mayúsculas en <code>dayOfWeek</code> (Monday-Sunday)
          y <code>type</code> (Gym, Cycling, Rest).
        </p>
        <pre className="text-xs md:text-sm" style={{
          backgroundColor: "#000",
          padding: "16px",
          borderRadius: "var(--radius-sm)",
          overflowX: "auto",
          maxWidth: "100%",
          color: "#e2e8f0"
        }}>
          <code>{jsonMockup}</code>
        </pre>
      </section>

      {/* Gym */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-gym)" }}>
          3. Registrar Pesos en el Gym
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          Entrá en <strong>&quot;Entrenamiento&quot;</strong> desde la barra de navegación. Vas a ver los
          ejercicios del día con los botones +/- para cargar <strong>kilos</strong> y <strong>repeticiones</strong> por
          cada serie. Al terminar, tocá <strong>&quot;Guardar Sesión&quot;</strong>.
        </p>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
          El sistema guarda todo y recalcula tus métricas: volumen histórico, récords personales
          y cantidad de sesiones.
        </p>
      </section>

      {/* Strava */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-cycling)" }}>
          4. Ciclismo con Strava
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          Las métricas de ciclismo (distancia, tiempo, desnivel, FC, potencia) se importan
          automáticamente desde <strong>Strava</strong>. Conectá tu cuenta desde la sección
          de <strong>Métricas</strong> y tus rides aparecen al instante.
        </p>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
          No necesitás cargar datos de bici manualmente — Strava ya los tiene.
        </p>
      </section>

      {/* Métricas */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          5. Métricas y Récords
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Volumen histórico</strong>: La suma de (kg x reps) de todo lo que levantás.
          Si sube mes a mes, estás progresando.<br />
          <strong>Récord de Sentadilla</strong>: Tu mayor peso registrado en sentadilla/squat.<br />
          <strong>Sesiones y series</strong>: Contadores totales de tu trabajo en el gym.<br />
          <strong>Récords Personales</strong>: Máximo peso por ejercicio, accesible desde Métricas.
        </p>
      </section>

      {/* Nutrición */}
      <section className="card" style={{ cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-cycling)" }}>
          6. Nutrición Ciclismo
        </h2>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
          La sección de <strong>Nutrición</strong> (en la barra de navegación) tiene una guía
          completa de alimentación para ciclismo: qué llevar en la bici, planes de combustible
          por duración de salida, hidratación, cafeína, y comidas pre-ride.
        </p>
      </section>
    </div>
  );
}
