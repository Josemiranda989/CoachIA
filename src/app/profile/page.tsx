import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  const athleteData = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { fcMax: true, lthr: true },
  });

  return (
    <ProfileClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? "",
        fcMax: athleteData?.fcMax ?? null,
        lthr: athleteData?.lthr ?? null,
      }}
    />
  );
}
