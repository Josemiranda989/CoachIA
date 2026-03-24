"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoadRoutinePage() {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      
      router.push("/workout/today"); // Redirect on success
    } catch (err: any) {
      setError(err.message || "Invalid JSON syntax check tu JSON de la IA.");
    } finally {
      setLoading(false);
    }
  };

  const sampleJson = `{
  "weekStart": "2026-03-23T00:00:00Z",
  "days": [
    {
      "dayOfWeek": "Monday",
      "type": "Gym",
      "exercises": [
        { "name": "Sentadillas", "targetSets": 4, "targetReps": "8-10" }
      ]
    },
    {
      "dayOfWeek": "Tuesday",
      "type": "Cycling",
      "targetDuration": 90,
      "targetPower": "Z2 Endurance"
    }
  ]
}`;

  return (
    <div className="container">
      <h1 className="title">Cargar Rutina Semanal</h1>
      <p className="subtitle">Pega aquí el JSON generado por tu IA.</p>
      
      <div className="card" style={{ marginBottom: "20px" }}>
        <textarea
          className="input"
          style={{ minHeight: "300px", fontFamily: "monospace", resize: "vertical" }}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={sampleJson}
        />
        {error && <p style={{ color: "#ef4444", marginTop: "12px", fontSize: "14px" }}>{error}</p>}
        <button 
          className="btn" 
          style={{ marginTop: "16px", width: "100%" }}
          onClick={handleLoad}
          disabled={loading || !jsonText.trim()}
        >
          {loading ? "Guardando..." : "Guardar Rutina"}
        </button>
      </div>
      
      <button className="btn btn-secondary" onClick={() => router.push("/")}>
        &larr; Volver al Inicio
      </button>
    </div>
  );
}
