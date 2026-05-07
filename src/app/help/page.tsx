import Link from "next/link";
import { BackLink } from "@/components/BackLink";

export default function HelpPage() {
  return (
    <div className="app-container" style={{ paddingBottom: "60px" }}>
      <BackLink href="/" label="Volver al Inicio" />

      <h1 className="title">Centro de Ayuda</h1>
      <p className="subtitle">Todo lo que necesitas para usar CoachIA</p>

      {/* 1. Mesociclo automático */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-primary)" }}>
          1. Mesociclo mensual automático
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          El 1ro de cada mes a las 9am, un cron genera automáticamente tu <strong>mesociclo de 4 semanas</strong>:
          una estructura de gym que se repite cada semana + ciclismo progresivo
          (build → build → peak → recovery).
        </p>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          Recibís un Telegram con el resumen y las 4 routines quedan en estado{" "}
          <strong>&quot;pendientes&quot;</strong>. Revisalas en <Link href="/routine/pending" className="underline" style={{ color: "var(--accent-primary)" }}>Rutinas pendientes</Link> —
          tap <strong>&quot;Aprobar mesociclo&quot;</strong> para activarlas todas de una.
        </p>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          Si querés generar una semana extra fuera del ciclo natural (ej: empezar una nueva rutina
          antes del 1ro), usá <strong>&quot;Generar con IA&quot;</strong> desde el Dashboard.
        </p>
      </section>

      {/* 2. Gym — sets y reps básico */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-gym)" }}>
          2. Gym: sets, reps y carga
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Un set (o serie)</strong> es un grupo de repeticiones sin descanso entre ellas. Si decís
          <em> &quot;4 sets de 8-10&quot;</em>, significa: descansás, hacés 8-10 reps, descansás, hacés otras 8-10,
          y así 4 veces.
        </p>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Rangos de reps y para qué sirven:</strong>
        </p>
        <ul className="text-text-secondary" style={{ lineHeight: "1.8", paddingLeft: "20px", marginBottom: "12px" }}>
          <li><strong>1-5 reps:</strong> fuerza máxima. Pesos altos, &gt;85% de tu máximo.</li>
          <li><strong>6-12 reps:</strong> hipertrofia (crecimiento muscular). La zona más usada para estética y funcional.</li>
          <li><strong>12-20 reps:</strong> resistencia muscular. Bueno para accesorios (bíceps, laterales, abdominales).</li>
        </ul>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Elegir la carga:</strong> la última rep del set debe ser <em>difícil pero limpia</em>. Si hacés
          10 reps y podrías haber hecho 5 más, el peso está bajo. Si no llegás al mínimo del rango,
          está alto.
        </p>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Progresión:</strong> cuando hagas el rango alto con buena forma varias semanas seguidas,
          subí la carga 2.5-5kg. En ejercicios chicos (curl, laterales) el incremento es de 1-2kg.
        </p>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          <strong>Descanso entre sets:</strong> 60-90s para hipertrofia, 2-3min para fuerza. No te sientes 5min
          al teléfono — el ritmo es parte del estímulo.
        </p>
      </section>

      {/* 3. Registro de sesión gym */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-gym)" }}>
          3. Registrar tu sesión
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          En <Link href="/workout/today" className="underline" style={{ color: "var(--accent-gym)" }}>Entrenamiento</Link> vas a ver los
          ejercicios del día con un bloque por set. Cargá <strong>kilos</strong> y <strong>repeticiones reales</strong> de cada
          set y tap <strong>&quot;Guardar sesión&quot;</strong> al terminar.
        </p>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          El sistema sugiere el peso del último entreno como punto de partida, pero podés ajustarlo
          con +/-. Todo queda registrado para recalcular tus métricas y PRs.
        </p>
      </section>

      {/* 4. Ciclismo — zonas de potencia */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-cycling)" }}>
          4. Ciclismo: zonas de intensidad
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          Las rutinas de bici usan el <strong>sistema Coggan de 5 zonas</strong>, basado en tu FTP
          (<em>Functional Threshold Power</em>: la potencia máxima que podés sostener 1 hora).
        </p>
        <ul className="text-text-secondary" style={{ lineHeight: "1.8", paddingLeft: "20px", marginBottom: "12px" }}>
          <li><strong>Z1 Recovery</strong> (&lt;55% FTP): rides post-piernas, muy suave. Charlar sin esfuerzo.</li>
          <li><strong>Z2 Endurance</strong> (56-75% FTP): el 80% de tu volumen. Conversación fluida. Es donde vive el sábado largo.</li>
          <li><strong>Z3 Tempo</strong> (76-90% FTP): &quot;confortable rápido&quot;. Frases cortas, no oraciones.</li>
          <li><strong>Z4 Threshold</strong> (91-105% FTP): umbral. Sostenible 30-60min max. Palabras sueltas.</li>
          <li><strong>Z5 VO2max</strong> (106-120% FTP): máximo aeróbico. Sostenible 3-8min.</li>
        </ul>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Si no tenés powermeter</strong>, usá el <em>RPE</em> (esfuerzo percibido) equivalente:
        </p>
        <ul className="text-text-secondary" style={{ lineHeight: "1.8", paddingLeft: "20px", marginBottom: "12px" }}>
          <li>&quot;Suave&quot; / &quot;muy suave&quot; = Z1-Z2 bajo</li>
          <li>&quot;Ligero&quot; = Z2</li>
          <li>&quot;Medio exigido&quot; = Z3</li>
          <li>&quot;Fuerte sostenible&quot; = Z4</li>
          <li>&quot;Máximo / all-out&quot; = Z5+</li>
        </ul>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          <strong>Intervalos</strong>: los entrenos con &quot;4x4min Z4 / 3min Z2 rec&quot; significan 4 repeticiones
          de 4 minutos en Z4, con 3 minutos en Z2 de recuperación entre cada una. Calentamiento y
          vuelta a la calma siempre en Z1-Z2, nunca saltar.
        </p>
      </section>

      {/* 5. Strava */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-cycling)" }}>
          5. Ciclismo con Strava
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          Las métricas reales de ciclismo (distancia, tiempo, desnivel, FC, potencia) se importan
          automáticamente desde <strong>Strava</strong>. Conectá tu cuenta desde la sección
          de <strong>Métricas</strong> y tus rides aparecen al instante.
        </p>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          No necesitás cargar datos de bici manualmente — Strava ya los tiene. El sistema usa tu
          historial (km, velocidad, FC, watts) para calibrar la dificultad de cada mesociclo.
        </p>
      </section>

      {/* 6. Wiki de ejercicios */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "#38bdf8" }}>
          6. Wiki de ejercicios
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          En <Link href="/wiki" className="underline" style={{ color: "#38bdf8" }}>Wiki</Link> tenés la ficha técnica
          de cada ejercicio de tu rutina: foto de ejemplo, descripción, grupos musculares, ejecución
          paso a paso y tips de coach.
        </p>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          Úsalo antes de empezar la serie si no te acordás de la forma correcta, o cuando aparece un
          ejercicio nuevo en tu rutina. Navegás entre ejercicios con los botones <em>anterior/siguiente</em>.
        </p>
      </section>

      {/* 7. Métricas */}
      <section className="card" style={{ marginBottom: "24px", cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4 text-text-primary">
          7. Métricas y récords
        </h2>
        <p className="text-text-secondary" style={{ marginBottom: "12px", lineHeight: "1.6" }}>
          <strong>Volumen histórico:</strong> la suma de (kg × reps) de todo lo que levantás. Si sube mes a
          mes, estás progresando.<br />
          <strong>Récords personales:</strong> el máximo peso registrado por cada ejercicio, accesible desde
          Métricas.<br />
          <strong>Sesiones y series:</strong> contadores totales de tu trabajo en el gym.<br />
          <strong>Strava:</strong> km acumulados YTD, horas en bici, desnivel, últimas salidas.
        </p>
      </section>

      {/* 8. Nutrición */}
      <section className="card" style={{ cursor: "default" }}>
        <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: "var(--accent-cycling)" }}>
          8. Nutrición ciclismo
        </h2>
        <p className="text-text-secondary" style={{ lineHeight: "1.6" }}>
          La sección de <Link href="/nutrition" className="underline" style={{ color: "var(--accent-cycling)" }}>Nutrición</Link> tiene una guía
          completa de alimentación para ciclismo: qué llevar en la bici, planes de combustible
          por duración de salida, hidratación, cafeína, y comidas pre-ride.
        </p>
      </section>
    </div>
  );
}
