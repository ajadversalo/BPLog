import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const OWNER_COOKIE = "bp_log_owner";

export async function getOwner() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(OWNER_COOKIE)?.value;
  return {
    id: existing || crypto.randomUUID(),
    isNew: !existing,
  };
}

export function setOwnerCookie(response: NextResponse, ownerId: string, isNew: boolean, secure = process.env.NODE_ENV === "production") {
  if (!isNew) return response;

  response.cookies.set(OWNER_COOKIE, ownerId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure,
  });
  return response;
}
