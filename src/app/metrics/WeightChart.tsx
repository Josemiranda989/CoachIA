import { prisma } from "@/lib/prisma";
import { WeightChartView, type ChartData } from "./WeightChartView";

export async function WeightChart({ userId }: { userId: string }) {
  const records = await prisma.bodyWeight.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 60,
  });

  // Sort ascending for the chart (most recent on the right)
  const data: ChartData[] = records
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({
      date: r.date.toISOString(),
      label: r.date.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
      weight: r.weight,
      bodyFat: r.bodyFat,
      muscle: r.muscle,
    }));

  return <WeightChartView data={data} />;
}
