import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { BackLink } from "@/components/BackLink";
import { CoachChatClient } from "./CoachChatClient";

export const metadata: Metadata = { title: "Coach" };

export default async function CoachPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="container py-8 pb-24">
      <BackLink href="/" />
      <h1 className="title">Tu Coach</h1>
      <p className="subtitle">
        Consultá o pedí ajustes de la semana — conoce tu rutina, Strava, la balanza y tu fitness.
      </p>
      <CoachChatClient />
    </div>
  );
}
