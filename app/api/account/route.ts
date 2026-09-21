import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getOwner, setOwnerCookie } from "../../../lib/owner";

export const dynamic = "force-dynamic";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createSyncCode() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const owner = await getOwner();
    let account = await db.prepare("SELECT sync_code FROM sync_accounts WHERE owner_id = ?").bind(owner.id).first<{ sync_code: string }>();

    if (!account) {
      account = { sync_code: createSyncCode() };
      await db.prepare("INSERT INTO sync_accounts (owner_id, sync_code, created_at) VALUES (?, ?, ?)").bind(owner.id, account.sync_code, new Date().toISOString()).run();
    }

    return setOwnerCookie(NextResponse.json({ syncCode: account.sync_code }), owner.id, owner.isNew, new URL(request.url).protocol === "https:");
  } catch (error) {
    console.error("Failed to load sync account", error);
    return NextResponse.json({ error: "The sync account is not available yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.replace(/[^a-z0-9]/gi, "").toUpperCase() : "";
    if (code.length !== 10) return NextResponse.json({ error: "Enter the 10-character sync code." }, { status: 400 });

    const db = getDb();
    const account = await db.prepare("SELECT owner_id FROM sync_accounts WHERE sync_code = ?").bind(code).first<{ owner_id: string }>();
    if (!account) return NextResponse.json({ error: "That sync code was not found." }, { status: 401 });

    const response = NextResponse.json({ connected: true });
    return setOwnerCookie(response, account.owner_id, true, new URL(request.url).protocol === "https:");
  } catch (error) {
    console.error("Failed to connect sync account", error);
    return NextResponse.json({ error: "Could not connect this device." }, { status: 503 });
  }
}
