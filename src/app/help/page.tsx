import Link from "next/link";

export default function HelpPage() {
  const jsonMockup = `{
  "weekStart": "2026-03-23T00:00:00Z",
  "days": [
    {
      "dayOfWeek": "Monday", // Lunes
      "type": "Gym",
      "exercises": [
        { "name": "Sentadillas", "targetSets": 4, "targetReps": "8-10" },
        { "name": "Press Banco", "targetSets": 3, "targetReps": "10-12" }
      ]
    },
    {
      "dayOfWeek": "Tuesday", // Martes
      "type": "Cycling",
      "targetDuration": 90, // minutos
      "targetPower": "Z2 Endurance"
    }
    // ... puedes agregar el resto de los días
  ]
}`;

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      <Link href="/" style={{ color: "var(--text-secondary)", display: "inline-block", marginBottom: "16px" }}>
        &larr; Volver al Inicio
      </Link>
      
      <h1 className="title">Centro de Ayuda y FAQs</h1>
      <p className="subtitle">Todo lo que necesitas para usar CoachIA</p>

      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "16px", color: "var(--accent-primary)" }}>1. ¿Cómo debe ser el JSON de la IA?</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          Pide a tu IA que use esta estructura exacta para generar tu semana. Asegúrate de respetar las mayúsculas en `dayOfWeek` (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday) y el `type` (Gym, Cycling).
        </p>
        <pre style={{ 
          backgroundColor: "#000", 
          padding: "16px", 
          borderRadius: "var(--radius-sm)", 
          overflowX: "auto",
          fontSize: "14px",
          color: "#e2e8f0"
        }}>
          <code>{jsonMockup}</code>
        </pre>
      </section>

      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "16px", color: "var(--accent-gym)" }}>2. ¿Cómo cargar los pesos en el Gym?</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          - Entra en la tarjeta <strong>&quot;Día de Hoy&quot;</strong> desde el Inicio.<br />
          - Verás listados todos los ejercicios que la IA te programó para hoy.<br />
          - Por cada &quot;Set&quot; o serie, tienes dos campos: uno para <strong>kilos (kg)</strong> y otro para <strong>repeticiones</strong>.<br />
          - Al finalizar, pulsa <strong>&quot;Guardar Resultados&quot;</strong> al final de la página. El sistema lo guardará para siempre y recalculará tus métricas históricas.
        </p>
      </section>

      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "16px", color: "var(--accent-cycling)" }}>3. ¿Cómo registrar mi ruta de Bicicleta?</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          - Al igual que el gym, entra en <strong>&quot;Día de Hoy&quot;</strong> los días que toque bici.<br />
          - Anota tu duración real en minutos (¿Hiciste los 90 min o más?).<br />
          - Evalúa tu esfuerzo con el <strong>RPE</strong> (Rating of Perceived Exertion) de 1 a 10. (1 es paseo suave, 10 es un esfuerzo extremo máximo de tu capacidad pulmonar).
        </p>
      </section>

      <section className="card" style={{ cursor: "default" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "16px", color: "var(--text-primary)" }}>4. ¿Qué representan las métricas?</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
          - <strong>Volumen histórico</strong>: La suma de (kg × reps) de absolutamente todo lo que levantas. Si el número sube mes a mes, garantizas hipertrofia progresiva (sobrecarga).<br />
          - <strong>Récord de Sentadilla</strong>: El mayor kilo registrado en un "Set" que contenga la palabra &quot;Sentadilla&quot; o &quot;Squat&quot;.<br />
          - <strong>Promedio RPE Bici</strong>: Te ayuda a evitar el sobreentrenamiento clínico. Si tu RPE promedio siempre está por encima de 8 en bici a final de semana, es posible que necesites programar semanas de descarga estricta en Zona 2.
        </p>
      </section>
    </div>
  );
}
