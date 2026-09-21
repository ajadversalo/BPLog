import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getOwner, setOwnerCookie } from "../../../lib/owner";
import type { AppState, MedicationGroup, ReadingSession } from "../../../lib/types";

export const dynamic = "force-dynamic";

type GroupRow = { id: string; name: string };
type MedicationRow = { id: string; group_id: string; name: string; dose: string };
type SessionRow = {
  id: string;
  group_id: string;
  reading_time: string;
  created_at: string;
  average_systolic: number;
  average_diastolic: number;
  reading_count: number;
};

export async function GET(request: Request) {
  try {
    const db = getDb();
    const owner = await getOwner();
    const [groupResult, medicationResult, sessionResult] = await Promise.all([
      db.prepare("SELECT id, name FROM medication_groups WHERE owner_id = ? ORDER BY created_at ASC").bind(owner.id).all<GroupRow>(),
      db.prepare("SELECT m.id, m.group_id, m.name, m.dose FROM medications m INNER JOIN medication_groups g ON g.id = m.group_id WHERE g.owner_id = ? ORDER BY m.group_id, m.position ASC").bind(owner.id).all<MedicationRow>(),
      db.prepare("SELECT id, group_id, reading_time, created_at, average_systolic, average_diastolic, reading_count FROM reading_sessions WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100").bind(owner.id).all<SessionRow>(),
    ]);

    const medicationsByGroup = new Map<string, MedicationGroup["medications"]>();
    for (const row of medicationResult.results) {
      const current = medicationsByGroup.get(row.group_id) ?? [];
      current.push({ id: row.id, name: row.name, dose: row.dose });
      medicationsByGroup.set(row.group_id, current);
    }

    const state: AppState = {
      groups: groupResult.results.map((row) => ({ id: row.id, name: row.name, medications: medicationsByGroup.get(row.id) ?? [] })),
      sessions: sessionResult.results.map((row): ReadingSession => ({
        id: row.id,
        groupId: row.group_id,
        time: row.reading_time,
        createdAt: row.created_at,
        averageSystolic: row.average_systolic,
        averageDiastolic: row.average_diastolic,
        count: row.reading_count,
      })),
    };

    return setOwnerCookie(NextResponse.json(state), owner.id, owner.isNew, new URL(request.url).protocol === "https:");
  } catch (error) {
    console.error("Failed to load BP log state", error);
    return NextResponse.json({ error: "The Cloudflare database is not available yet." }, { status: 503 });
  }
}
