import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { getUpcomingRaces } from "@/lib/queries/getRaces";
import { RacesClient } from "./RacesClient";

export const metadata: Metadata = { title: "Carreras" };

export default async function RacesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  const races = await getUpcomingRaces(session.user.id);

  return (
    <div className="app-container py-10">
      <BackLink href="/" />
      <h1 className="title">Carreras</h1>
      <p className="subtitle">Tus próximos objetivos, con cuenta regresiva.</p>
      <RacesClient initialRaces={races} />
    </div>
  );
}
