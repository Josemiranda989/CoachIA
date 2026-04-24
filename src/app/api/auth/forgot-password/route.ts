import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, isEmailConfigured } from "@/lib/email";
import crypto from "crypto";

const RESET_EXPIRY_MS = 60 * 60 * 1000;
const GENERIC_RESPONSE = {
  message: "Si existe una cuenta con ese email, te enviamos un link para restablecer la contraseña.",
};

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isEmailConfigured()) {
      console.error("[forgot-password] RESEND_API_KEY no configurada");
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const plainToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(plainToken).digest("hex");
      const expires = new Date(Date.now() + RESET_EXPIRY_MS);

      await prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });

      await prisma.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token: hashedToken,
          expires,
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "";
      const resetUrl = `${baseUrl}/auth/reset-password?token=${plainToken}`;

      try {
        await sendPasswordResetEmail({
          to: normalizedEmail,
          resetUrl,
          userName: user.name,
        });
      } catch (err) {
        console.error("[forgot-password] Fallo envío de email:", err);
      }
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("[forgot-password] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
