import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getOwner, setOwnerCookie } from "../../../lib/owner";
import type { ReadingSession } from "../../../lib/types";

export const dynamic = "force-dynamic";

type IncomingReading = { systolic?: unknown; diastolic?: unknown };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { groupId?: unknown; time?: unknown; readings?: unknown };
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    const time = typeof body.time === "string" ? body.time : "";
    const incomingReadings = Array.isArray(body.readings) ? body.readings as IncomingReading[] : [];
    const readings = incomingReadings
      .map((reading) => ({
        systolic: typeof reading.systolic === "number" ? reading.systolic : Number(reading.systolic),
        diastolic: typeof reading.diastolic === "number" ? reading.diastolic : Number(reading.diastolic),
      }))
      .filter((reading) => Number.isFinite(reading.systolic) && Number.isFinite(reading.diastolic) && reading.systolic > 0 && reading.diastolic > 0);

    if (!groupId || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !readings.length) {
      return NextResponse.json({ error: "A valid group, time, and at least one reading are required." }, { status: 400 });
    }

    const db = getDb();
    const owner = await getOwner();
    const group = await db.prepare("SELECT id FROM medication_groups WHERE id = ? AND owner_id = ?").bind(groupId, owner.id).first<{ id: string }>();
    if (!group) return NextResponse.json({ error: "Medication group not found." }, { status: 404 });

    const averageSystolic = Math.round(readings.reduce((sum, reading) => sum + reading.systolic, 0) / readings.length);
    const averageDiastolic = Math.round(readings.reduce((sum, reading) => sum + reading.diastolic, 0) / readings.length);
    const session: ReadingSession = {
      id: crypto.randomUUID(),
      groupId,
      time,
      createdAt: new Date().toISOString(),
      averageSystolic,
      averageDiastolic,
      count: readings.length,
    };

    await db.batch([
      db.prepare("INSERT INTO reading_sessions (id, owner_id, group_id, reading_time, created_at, average_systolic, average_diastolic, reading_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(session.id, owner.id, session.groupId, session.time, session.createdAt, session.averageSystolic, session.averageDiastolic, session.count),
      ...readings.map((reading, position) => db.prepare("INSERT INTO blood_pressure_readings (id, session_id, systolic, diastolic, position) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), session.id, reading.systolic, reading.diastolic, position)),
    ]);

    return setOwnerCookie(NextResponse.json({ session }, { status: 201 }), owner.id, owner.isNew, new URL(request.url).protocol === "https:");
  } catch (error) {
    console.error("Failed to save BP reading", error);
    return NextResponse.json({ error: "Could not save the blood pressure reading." }, { status: 503 });
  }
}
