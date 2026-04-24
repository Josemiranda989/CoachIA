import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session as { user?: { id?: string } } | null)?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "La nueva contraseña debe ser distinta a la actual" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.password) {
      return NextResponse.json(
        { error: "Usuario sin contraseña configurada" },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Contraseña actual incorrecta" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return NextResponse.json({ message: "Contraseña actualizada" });
  } catch (error) {
    console.error("change-password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
