export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import GoogleFitSection from "./GoogleFitSection";

export default async function MetricsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  const googleFitConnected = userId
    ? !!(await prisma.user.findUnique({
        where: { id: userId },
        select: { googleFitAccessToken: true },
      }))?.googleFitAccessToken
    : false;

  const allLogs = await prisma.workoutLog.findMany({
    include: {
      exercise: {
        include: {
          dailyWorkout: {
            include: { routine: true }
          }
        }
      }
    }
  });

  const cyclingWorkouts = await prisma.dailyWorkout.findMany({
    where: { type: "Cycling", completed: true }
  });

  const totalVolume = allLogs.reduce((acc, log) => acc + (log.reps * log.weight), 0);
  const maxSquat = allLogs.filter(l => l.exercise.name.toLowerCase().includes("sentadilla") || l.exercise.name.toLowerCase().includes("squat")).reduce((max, log) => log.weight > max ? log.weight : max, 0);

  const avgCyclingDistance = cyclingWorkouts.length > 0 
    ? (cyclingWorkouts.reduce((acc, w) => acc + (w.distance || 0), 0) / cyclingWorkouts.length).toFixed(1) 
    : "N/A";

  const avgCyclingHR = cyclingWorkouts.length > 0 
    ? Math.round(cyclingWorkouts.reduce((acc, w) => acc + (w.averageHeartRate || 0), 0) / cyclingWorkouts.length)
    : "N/A";

  const totalCyclingMins = cyclingWorkouts.reduce((acc, w) => acc + (w.actualDuration || 0), 0);

  return (
    <div className="app-container">
      <Link href="/" style={{ color: "var(--text-secondary)", display: "inline-block", marginBottom: "16px" }}>
        &larr; Volver
      </Link>
      <h1 className="title">Métricas 📊</h1>
      <p className="subtitle">Tu progreso general</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        <div className="card">
          <h3 style={{ color: "var(--accent-gym)" }}>Gym: Volumen Histórico</h3>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>{totalVolume} <span style={{fontSize: "16px", color: "var(--text-secondary)"}}>kg</span></p>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Peso total levantado sumando todos tus sets</p>
        </div>

        <div className="card">
          <h3 style={{ color: "var(--accent-gym)" }}>Gym: Récord Sentadilla</h3>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>{maxSquat} <span style={{fontSize: "16px", color: "var(--text-secondary)"}}>kg</span></p>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Tu peso máximo registrado</p>
        </div>

        <div className="card">
          <h3 style={{ color: "var(--accent-cycling)" }}>Bici: Tiempo Total</h3>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>{totalCyclingMins} <span style={{fontSize: "16px", color: "var(--text-secondary)"}}>min</span></p>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Tiempo total acumulado sobre la bici</p>
        </div>

        <div className="card">
          <h3 style={{ color: "var(--accent-cycling)" }}>Bici: Distancia Media</h3>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>{avgCyclingDistance} <span style={{fontSize: "16px", color: "var(--text-secondary)"}}>km</span></p>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Distancia promedio por sesión</p>
        </div>

        <div className="card">
          <h3 style={{ color: "var(--accent-cycling)" }}>Bici: Promedio FC</h3>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0" }}>{avgCyclingHR} <span style={{fontSize: "16px", color: "var(--text-secondary)"}}>bpm</span></p>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Frecuencia cardíaca media</p>
        </div>

        <Link href="/metrics/records" className="card" style={{ border: "1px solid var(--accent-gym)" }}>
          <h3 style={{ color: "var(--accent-gym)" }}>Ver Todos los Récords 🏆</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: "12px", fontSize: "14px" }}>
            Consulta el máximo peso y reps logradas en cada ejercicio.
          </p>
        </Link>

        <GoogleFitSection isConnected={googleFitConnected} />
      </div>
    </div>
  );
}
