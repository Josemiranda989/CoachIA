import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className="container">
      <h1 className="title">CoachIA Dashboard</h1>
      <p className="subtitle">Bienvenido de vuelta. Veamos la rutina de la semana.</p>
      
      <div className={styles.grid}>
        <Link href="/routine/load" className="card">
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Cargar Rutina 🤖</h2>
          <p style={{ color: "var(--text-secondary)" }}>Pega el JSON de tu IA con la semana completa.</p>
        </Link>
        <Link href="/routine/week" className="card">
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Toda la Semana 🗓️</h2>
          <p style={{ color: "var(--text-secondary)" }}>Resumen completo de tu rutina planificada.</p>
        </Link>
        <Link href="/workout/today" className="card">
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Día de Hoy 🏃‍♂️</h2>
          <p style={{ color: "var(--text-secondary)" }}>Ver y anotar tus pesos o métricas de hoy.</p>
        </Link>
        <Link href="/metrics" className="card">
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Métricas 📊</h2>
          <p style={{ color: "var(--text-secondary)" }}>Evolución de carga, fatiga en bici, etc.</p>
        </Link>
        <Link href="/help" className="card">
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Ayuda / FAQs ℹ️</h2>
          <p style={{ color: "var(--text-secondary)" }}>Estructura JSON y guías de uso.</p>
        </Link>
      </div>
    </div>
  );
}
