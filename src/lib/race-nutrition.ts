// Plan de nutrición + checklist de equipo para el día de carrera, generado a
// partir de los datos reales de la Race (distancia, desnivel, disciplina,
// hora de salida, duración estimada) en vez de contenido estático por
// distancia como el de la ficha inicial de Trepada al Indio.

export type NutritionEvent = { time: string; title: string; body: string };
export type ChecklistGroup = { title: string; items: string[] };

type Discipline = "cycling" | "running" | "trail";

function normalizeDiscipline(discipline: string): Discipline {
  return discipline === "running" || discipline === "trail" ? discipline : "cycling";
}

function effortBucket(hours: number): "short" | "medium" | "long" {
  if (hours < 1.5) return "short";
  if (hours < 4) return "medium";
  return "long";
}

// Heurística gruesa SOLO para elegir el bucket de fueling cuando el atleta no
// cargó una duración estimada propia. Nunca se muestra como dato real.
function roughHours(discipline: Discipline, distanceKm: number, elevationM: number | null): number {
  const climbPenaltyKm = (elevationM ?? 0) / 100; // cada 100m de D+ ~ 1km extra de "costo"
  const effectiveKm = distanceKm + climbPenaltyKm;
  const avgKmh = discipline === "cycling" ? 22 : discipline === "trail" ? 7 : 10;
  return effectiveKm / avgKmh;
}

function offsetLabel(startTime: string | null, minutesBeforeStart: number): string {
  if (!startTime) {
    return minutesBeforeStart >= 60
      ? `T-${Math.round(minutesBeforeStart / 60)}h`
      : `T-${minutesBeforeStart}min`;
  }
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m - minutesBeforeStart;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function buildNutritionPlan(params: {
  discipline: string;
  distanceKm: number | null;
  elevationM: number | null;
  estimatedHours: number | null;
  startTime: string | null;
}): NutritionEvent[] {
  const disc = normalizeDiscipline(params.discipline);
  const hours = params.estimatedHours ?? (params.distanceKm ? roughHours(disc, params.distanceKm, params.elevationM) : 2);
  const bucket = effortBucket(hours);
  const t = (min: number) => offsetLabel(params.startTime, min);

  const events: NutritionEvent[] = [
    {
      time: "2-3 días antes",
      title: "Carga liviana de carbohidratos",
      body: "Sumá arroz, papa, pan, fruta en cada comida. Nada de probar comidas nuevas esta semana.",
    },
    {
      time: "Noche anterior",
      title: "Cena simple, carbos + proteína magra",
      body: "Bajá la fibra y la grasa para no arrancar con el estómago revuelto. Hidratación normal, sin excederte.",
    },
    {
      time: t(180),
      title: "Desayuno principal",
      body: "Tostadas o pan con miel/mermelada, banana, algo de proteína liviana. Nada que no hayas probado antes.",
    },
    {
      time: t(30),
      title: "Snack de arranque",
      body: disc === "cycling"
        ? "Medio gel o banana + últimos sorbos de bebida isotónica en el bidón."
        : "Media banana o un gel. Últimos sorbos de agua, sin excederte.",
    },
  ];

  if (bucket === "short") {
    events.push({
      time: "Durante",
      title: "Con líquido alcanza",
      body: disc === "cycling"
        ? "Con agua/isotónica en el bidón alcanza para esta duración."
        : "Con agua alcanza para esta distancia.",
    });
  } else if (bucket === "medium") {
    events.push({
      time: "Durante",
      title: "30-60g de carbohidratos por hora",
      body: disc === "cycling"
        ? "Un gel cada 45min aprox., o barritas cortas accesibles en el cuadro. Bebida con electrolitos en el bidón."
        : "Un gel cada 45min aprox., o banana en las postas.",
    });
  } else {
    events.push({
      time: "Durante",
      title: "40-60g/hora, sólido + gel",
      body: disc === "cycling"
        ? "Alterná geles con barritas o frutos secos accesibles en el cuadro/bolsillos. Sales si hace calor."
        : "Alterná geles con frutos secos, banana o barritas en las postas. Sales si transpirás mucho.",
    });
  }

  events.push({
    time: "Después",
    title: "Recuperación",
    body: "Proteína + carbos apenas puedas — no dejes pasar más de una hora.",
  });

  return events;
}

export function buildEquipmentChecklist(discipline: string): ChecklistGroup[] {
  if (normalizeDiscipline(discipline) === "cycling") {
    return [
      {
        title: "Bici y equipo",
        items: [
          "Bici revisada (cadena, frenos, presión de cubiertas)",
          "Cámara de repuesto + parche + inflador/CO2",
          "Multiherramienta",
          "Casco",
        ],
      },
      {
        title: "Hidratación y nutrición",
        items: [
          "Bidones cargados (agua + isotónica)",
          "Geles/barritas ya probados en entreno, accesibles en el cuadro",
          "Sales si hace calor",
        ],
      },
      {
        title: "Vestimenta",
        items: ["Ropa técnica acorde al pronóstico (viento/lluvia si aplica)", "Guantes, lentes, protector solar"],
      },
      {
        title: "Antes de salir",
        items: [
          "GPS/ciclocomputador cargado, con el recorrido si está disponible",
          "Dorsal y documentación lista la noche anterior",
        ],
      },
    ];
  }

  return [
    {
      title: "Esenciales",
      items: [
        "Zapatillas ya rodadas — nunca estrenar el día de carrera",
        "Medias técnicas sin costuras",
        "Ropa técnica transpirable acorde al pronóstico",
        "Gorra o buff + protector solar",
        "Vaselina en zonas de roce",
      ],
    },
    {
      title: "Hidratación y nutrición",
      items: ["Chaleco o cinturón de hidratación", "Geles/barritas ya probados en entreno", "Sales si hace calor"],
    },
    {
      title: "Seguridad",
      items: ["Manta térmica y silbato si el reglamento lo exige", "Celular cargado"],
    },
    {
      title: "Antes de salir",
      items: ["Dorsal, ropa y nutrición listos la noche anterior", "Reloj GPS cargado"],
    },
  ];
}
