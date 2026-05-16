import type { Metadata } from "next";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Cómo CoachIA maneja tus datos personales y de entrenamiento.",
};

export default function PrivacyPage() {
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
        <Shield size={26} style={{ color: "var(--accent-primary)" }} aria-hidden="true" />
        <h1 className="title" style={{ marginBottom: 0 }}>Política de Privacidad</h1>
      </div>
      <p className="subtitle" style={{ marginBottom: 32 }}>
        Última actualización: 15 de mayo de 2026
      </p>

      <Section title="1. Qué es CoachIA y quién la opera">
        <p>
          CoachIA es una aplicación personal de entrenamiento de ciclismo y gimnasio operada por
          José Miranda como proyecto personal/hobby. La app vive en infraestructura propia (homelab) en
          Argentina y no es un servicio comercial.
        </p>
        <p>
          Esta política explica qué datos personales recopilo cuando usás la app, para qué los uso y con
          quién los comparto.
        </p>
      </Section>

      <Section title="2. Qué información recopilo">
        <p>Cuando creás una cuenta y usás CoachIA, se recopila lo siguiente:</p>
        <List
          items={[
            "Datos de cuenta: nombre, email, contraseña (hash bcrypt, jamás texto plano).",
            "Datos de entrenamiento que cargás vos: sesiones de gym (ejercicios, series, repeticiones, peso), peso corporal, porcentaje de grasa y músculo si los registrás.",
            "Configuración fisiológica opcional: FCmax, LTHR (umbral de FC) para calibrar las zonas de entrenamiento.",
            "Datos de Strava (si conectás tu cuenta): historial de actividades de ciclismo (distancia, tiempo, velocidad, frecuencia cardíaca, potencia, cadencia, desnivel), tokens de acceso y refresh, ID de atleta.",
            "Sesiones de navegación (cookies de NextAuth para mantener tu login).",
          ]}
        />
      </Section>

      <Section title="3. Para qué uso tus datos">
        <List
          items={[
            "Generar rutinas personalizadas usando inteligencia artificial, calibradas a tu historial real (PRs de gym, distancias de Strava, zonas FC).",
            "Mostrarte estadísticas y progreso en el dashboard.",
            "Exportar workouts a tu ciclocomputer en formato .fit con targets de FC y cadencia.",
            "Enviarte notificaciones cuando se genera una rutina nueva (vía Telegram) y emails de auth (verificación, reset de contraseña).",
          ]}
        />
        <p>
          <strong>No vendo, alquilo ni cedo tus datos a terceros con fines comerciales.</strong> No hay
          analytics de tracking ni publicidad.
        </p>
      </Section>

      <Section title="4. Dónde se almacenan tus datos">
        <p>
          Tus datos viven en una base SQLite que corre en mi homelab personal, en Argentina. No hay
          servicios en la nube intermedios (sin AWS, sin Vercel KV, sin Supabase). El acceso al servidor
          está restringido por túnel Cloudflare.
        </p>
        <p>
          Hago backups locales periódicos. No tengo procedimientos formales de DR/HA — es un servicio
          personal y la disponibilidad no está garantizada (ver Términos de Servicio).
        </p>
      </Section>

      <Section title="5. Servicios de terceros con los que se comparten datos">
        <p>
          Para que CoachIA funcione, algunos datos pasan por servicios externos. Cada uno tiene su propia
          política de privacidad que te invito a revisar:
        </p>
        <List
          items={[
            "Strava (strava.com): vos autorizás explícitamente vía OAuth. Yo accedo a tus actividades de ciclismo con scope activity:read_all. Podés revocar el acceso desde Strava en cualquier momento.",
            "Google Gemini (google.com): el contenido del prompt para generar la rutina semanal incluye tus PRs de gym y resumen de rides recientes. NO incluye tu nombre, email ni datos identificatorios.",
            "OpenCode (opencode.com): mismo uso que Gemini pero para mesociclos mensuales de 4 semanas.",
            "Telegram (telegram.org): notificaciones cuando se genera una rutina pendiente de aprobación. Solo el mensaje, sin datos sensibles.",
            "Resend (resend.com): envío de emails de autenticación (verificación de cuenta, reset de contraseña).",
          ]}
        />
      </Section>

      <Section title="6. Tus derechos sobre tus datos">
        <p>En cualquier momento podés pedirme:</p>
        <List
          items={[
            "Acceso a todos los datos que tengo sobre vos.",
            "Exportación en formato legible (JSON o similar).",
            "Borrado completo de tu cuenta y todos los datos asociados.",
            "Corrección de cualquier dato incorrecto.",
            "Revocación de la conexión con Strava (también podés hacerlo directamente desde tu cuenta de Strava).",
          ]}
        />
        <p>
          Para cualquiera de estas solicitudes, escribime a <Email />. Te respondo dentro de los 30 días.
        </p>
      </Section>

      <Section title="7. Seguridad">
        <p>
          Las contraseñas se almacenan hasheadas con bcrypt. Las comunicaciones con el servidor van por
          HTTPS (TLS) vía Cloudflare. Los tokens de Strava se guardan en la DB y se refrescan automáticamente
          (con borrado automático si el refresh falla).
        </p>
        <p>
          Que quede claro: este es un proyecto hobby, no tengo certificaciones de seguridad (SOC 2, ISO).
          Aplico buenas prácticas pero la app no está diseñada para almacenar información sensible más
          allá de tu historial de entrenamiento.
        </p>
      </Section>

      <Section title="8. Cambios a esta política">
        <p>
          Si cambian las prácticas de privacidad de la app, actualizo esta página y modifico la fecha de
          "última actualización" arriba. Para cambios significativos (nuevos terceros, nuevos tipos de
          datos recopilados) te aviso por email.
        </p>
      </Section>

      <Section title="9. Contacto">
        <p>
          Para cualquier pregunta sobre esta política o sobre tus datos, escribime a <Email />.
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
