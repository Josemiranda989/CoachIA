import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuthResult =
  | { authenticated: true; userId: string }
  | { authenticated: false; error: string; status: number };

export async function resolveAuth(
  request: Request
): Promise<AuthResult> {
  // 1. Check internal API key (for n8n / cron calls)
  const internalKey = request.headers.get("x-internal-key");
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (internalKey && expectedKey && internalKey === expectedKey) {
    // Internal call — resolve to the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return { authenticated: false, error: "No user found", status: 500 };
    }
    return { authenticated: true, userId: user.id };
  }

  // 2. Check session (normal browser auth)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return { authenticated: false, error: "Unauthorized", status: 401 };
  }

  return { authenticated: true, userId };
}
