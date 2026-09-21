import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getOwner, setOwnerCookie } from "../../../lib/owner";
import type { MedicationGroup } from "../../../lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; medications?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const medications = Array.isArray(body.medications)
      ? body.medications
          .map((medication) => {
            if (!medication || typeof medication !== "object") return null;
            const value = medication as { name?: unknown; dose?: unknown };
            return {
              name: typeof value.name === "string" ? value.name.trim() : "",
              dose: typeof value.dose === "string" ? value.dose.trim() : "",
            };
          })
          .filter((medication): medication is { name: string; dose: string } => Boolean(medication?.name))
      : [];

    if (!name || !medications.length) {
      return NextResponse.json({ error: "A group name and at least one medication are required." }, { status: 400 });
    }

    const db = getDb();
    const owner = await getOwner();
    const groupId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const group: MedicationGroup = {
      id: groupId,
      name,
      medications: medications.map((medication, position) => ({ id: crypto.randomUUID(), ...medication })),
    };

    await db.batch([
      db.prepare("INSERT INTO medication_groups (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)").bind(groupId, owner.id, name, createdAt),
      ...group.medications.map((medication, position) => db.prepare("INSERT INTO medications (id, group_id, name, dose, position) VALUES (?, ?, ?, ?, ?)").bind(medication.id, groupId, medication.name, medication.dose, position)),
    ]);

    return setOwnerCookie(NextResponse.json({ group }, { status: 201 }), owner.id, owner.isNew, new URL(request.url).protocol === "https:");
  } catch (error) {
    console.error("Failed to create medication group", error);
    return NextResponse.json({ error: "Could not save the medication group." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const groupId = new URL(request.url).searchParams.get("id") ?? "";
    if (!groupId) return NextResponse.json({ error: "A group ID is required." }, { status: 400 });

    const db = getDb();
    const owner = await getOwner();
    const group = await db.prepare("SELECT id FROM medication_groups WHERE id = ? AND owner_id = ?").bind(groupId, owner.id).first<{ id: string }>();
    if (!group) return NextResponse.json({ error: "Medication group not found." }, { status: 404 });

    await db.batch([
      db.prepare("DELETE FROM blood_pressure_readings WHERE session_id IN (SELECT id FROM reading_sessions WHERE group_id = ? AND owner_id = ?)").bind(groupId, owner.id),
      db.prepare("DELETE FROM reading_sessions WHERE group_id = ? AND owner_id = ?").bind(groupId, owner.id),
      db.prepare("DELETE FROM medications WHERE group_id = ?").bind(groupId),
      db.prepare("DELETE FROM medication_groups WHERE id = ? AND owner_id = ?").bind(groupId, owner.id),
    ]);

    return setOwnerCookie(NextResponse.json({ deleted: true }), owner.id, owner.isNew, new URL(request.url).protocol === "https:");
  } catch (error) {
    console.error("Failed to delete medication group", error);
    return NextResponse.json({ error: "Could not delete the medication group." }, { status: 503 });
  }
}
