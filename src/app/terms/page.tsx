import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description: "Condiciones de uso de CoachIA.",
};

export default function TermsPage() {
  return (
    <div className="app-container" style={{ maxWidth: 760, paddingBottom: 80 }}>
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text-secondary)",
          textDecoration: "none",
          fontSize: 14,
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={16} />
        Volver
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <FileText size={26} style={{ color: "var(--accent-primary)" }} aria-hidden="true" />
        <h1 className="title" style={{ marginBottom: 0 }}>Términos de Servicio</h1>
      </div>
      <p className="subtitle" style={{ marginBottom: 32 }}>
        Última actualización: 15 de mayo de 2026
      </p>

      <Section title="1. Qué es CoachIA">
        <p>
          CoachIA es una aplicación personal de entrenamiento de ciclismo y gimnasio operada por José
          Miranda como proyecto personal/hobby, no como servicio comercial. Genera rutinas personalizadas
          con inteligencia artificial basadas en tu historial real de Strava y de gym.
        </p>
        <p>
          Al usar CoachIA aceptás estos términos. Si no estás de acuerdo, simplemente no uses la app.
        </p>
      </Section>

      <Section title="2. Qué CoachIA NO es">
        <List
          items={[
            "No es un servicio médico ni reemplaza a un profesional de la salud.",
            "No es un servicio profesional de coaching deportivo certificado.",
            "No tiene SLA ni garantía de disponibilidad.",
            "No es un producto comercial — es un proyecto personal compartido con amigos y conocidos.",
          ]}
        />
      </Section>

      <Section title="3. Sin garantías">
        <p>
          La app se ofrece "tal cual" (as-is). El servicio corre en infraestructura personal y puede
          interrumpirse en cualquier momento sin aviso: mantenimiento, problemas de red, decisiones del
          operador, etc.
        </p>
        <p>
          No garantizo que las rutinas generadas sean perfectas, óptimas o adecuadas para vos. La AI puede
          equivocarse — siempre usá tu criterio. Si dudás de una prescripción, no la ejecutes.
        </p>
      </Section>

      <Section title="4. Tu responsabilidad sobre tu salud">
        <p>
          <strong>Importante:</strong> entrenar implica riesgo de lesión. Antes de seguir cualquier rutina
          que la app genere, asegurate de:
        </p>
        <List
          items={[
            "Haber tenido un chequeo médico reciente que confirme que podés hacer ejercicio.",
            "Conocer tus límites y respetarlos. Las prescripciones de la app son orientativas, no obligatorias.",
            "Detener el entrenamiento ante cualquier dolor agudo, mareo o malestar.",
            "Consultar a un profesional (médico, kinesiólogo, entrenador certificado) ante dudas específicas sobre tu salud o técnica.",
          ]}
        />
        <p>
          La app no se hace responsable de lesiones, sobreentrenamiento ni consecuencias derivadas del
          uso de las rutinas generadas.
        </p>
      </Section>

      <Section title="5. Tu cuenta">
        <p>
          Sos responsable de mantener tu contraseña segura. Si alguien accede a tu cuenta usando tu
          password, los datos que vea o modifique son responsabilidad tuya, no mía.
        </p>
        <p>
          Te pido que solo cargues datos reales tuyos. Las rutinas se calibran a tu PR de sentadilla,
          a tu velocidad promedio en bici, a tu FCmax. Si cargás datos falsos las prescripciones van a
          ser malas para vos.
        </p>
      </Section>

      <Section title="6. Datos de Strava">
        <p>
          Si conectás tu cuenta de Strava, autorizás a CoachIA a leer tu historial de actividades de
          ciclismo. Esa autorización podés revocarla en cualquier momento desde tu cuenta de Strava
          (settings → Authorized Applications).
        </p>
        <p>
          Yo no controlo la disponibilidad de Strava ni la precisión de los datos que Strava me devuelve.
          Si Strava cambia su API y se rompe algo, lo arreglo cuando puedo.
        </p>
      </Section>

      <Section title="7. Cancelar tu cuenta">
        <p>
          Si querés borrar tu cuenta y todos los datos asociados, escribime a <Email />. Borro todo
          dentro de los 30 días y te confirmo cuando esté hecho.
        </p>
        <p>
          También puedo cerrar tu cuenta si detecto uso malicioso (intentos de explotar la app, scraping,
          ataques al servidor). En esos casos te aviso pero no te debo justificación detallada.
        </p>
      </Section>

      <Section title="8. Cambios al servicio">
        <p>
          Como proyecto personal, las funcionalidades pueden cambiar, agregarse o sacarse sin previo
          aviso. Para cambios importantes (cambios de URL, baja de servicio prolongada, cambio en cómo
          se manejan los datos) intento avisar por email o Telegram.
        </p>
      </Section>

      <Section title="9. Limitación de responsabilidad">
        <p>
          Hasta el máximo permitido por la ley, no soy responsable de ningún daño directo, indirecto,
          incidental o consecuente derivado del uso de la app, incluyendo (pero no limitado a) lesiones
          físicas, pérdida de datos, fallas del servicio, decisiones de entrenamiento mal calibradas o
          interrupciones de Strava/Telegram/Resend/los modelos de IA.
        </p>
      </Section>

      <Section title="10. Ley aplicable y contacto">
        <p>
          Estos términos se rigen por la legislación de la República Argentina. Para cualquier consulta
          o reclamo, escribime a <Email />.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
        {title}
      </h2>
      <div style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Email() {
  return (
    <a
      href="mailto:josemiranda989@gmail.com"
      style={{ color: "var(--accent-primary)", textDecoration: "underline" }}
    >
      josemiranda989@gmail.com
    </a>
  );
}
