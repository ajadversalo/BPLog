"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MedicationGroup, Measurement, ReadingSession } from "../lib/types";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const OFFLINE_GROUPS_KEY = "bp-log-preview-groups-v1";
const OFFLINE_SESSIONS_KEY = "bp-log-preview-sessions-v1";

const makeId = () => Math.random().toString(36).slice(2, 10);

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const emptyMeasurement = (): Measurement => ({ id: makeId(), systolic: "", diastolic: "" });

const formatTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const isToday = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "heart") {
    return (
      <svg {...common}>
        <path d="M20.8 8.8c0 5.1-8.8 10.2-8.8 10.2S3.2 13.9 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
      </svg>
    );
  }
  if (name === "pulse") {
    return (
      <svg {...common}>
        <path d="M3 12h4l2.1-5.1L13 17l2.6-6 1.5 1H21" />
      </svg>
    );
  }
  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }
  if (name === "chevron") {
    return (
      <svg {...common}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 19 6v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6l7-3Z" />
        <path d="m9.2 12 1.8 1.8 3.9-4" />
      </svg>
    );
  }
  if (name === "download") {
    return (
      <svg {...common}>
        <path d="M12 3v11M8 10l4 4 4-4M5 20h14" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M7 3v4M17 3v4M3.5 9h17" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (name === "info") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg {...common}>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-1.3-3.1h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3.1-1.3v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z" />
      </svg>
    );
  }
  return null;
}

export default function Home() {
  const [groups, setGroups] = useState<MedicationGroup[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([emptyMeasurement()]);
  const [readingTime, setReadingTime] = useState(getCurrentTime);
  const [toast, setToast] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [storageMode, setStorageMode] = useState<"loading" | "cloud" | "offline">("loading");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("Cloudflare D1 is not configured");
        const data = await response.json() as { groups: MedicationGroup[]; sessions: ReadingSession[] };
        if (!cancelled) {
          setGroups(data.groups ?? []);
          setSessions(data.sessions ?? []);
          setStorageMode("cloud");
        }
      } catch {
        try {
          const savedGroups = window.localStorage.getItem(OFFLINE_GROUPS_KEY);
          const savedSessions = window.localStorage.getItem(OFFLINE_SESSIONS_KEY);
          if (!cancelled) {
            if (savedGroups) setGroups(JSON.parse(savedGroups));
            if (savedSessions) setSessions(JSON.parse(savedSessions));
            setStorageMode("offline");
          }
        } catch {
          if (!cancelled) setStorageMode("offline");
        }
      }
    };

    loadState();

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", () => setInstallPrompt(null));
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) setSelectedGroupId(groups[0].id);
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]?.id ?? null);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (storageMode !== "offline") return;
    try {
      window.localStorage.setItem(OFFLINE_GROUPS_KEY, JSON.stringify(groups));
      window.localStorage.setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // Preview mode still works in-memory if storage is unavailable.
    }
  }, [groups, sessions, storageMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const todaySessions = sessions.filter((session) => isToday(session.createdAt));
  const todayMeasurements = todaySessions.reduce((total, session) => total + session.count, 0);
  const todayAverage = todaySessions.length
    ? {
        systolic: Math.round(todaySessions.reduce((total, session) => total + session.averageSystolic, 0) / todaySessions.length),
        diastolic: Math.round(todaySessions.reduce((total, session) => total + session.averageDiastolic, 0) / todaySessions.length),
      }
    : null;

  const averages = useMemo(() => {
    const valid = measurements.filter((measurement) => Number(measurement.systolic) > 0 && Number(measurement.diastolic) > 0);
    if (!valid.length) return null;
    const systolic = valid.reduce((total, measurement) => total + Number(measurement.systolic), 0) / valid.length;
    const diastolic = valid.reduce((total, measurement) => total + Number(measurement.diastolic), 0) / valid.length;
    if (![systolic, diastolic].every(Number.isFinite)) return null;
    return { systolic: Math.round(systolic), diastolic: Math.round(diastolic), count: valid.length };
  }, [measurements]);

  const recentSessions = [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const updateMeasurement = (id: string, key: "systolic" | "diastolic", value: string) => {
    setMeasurements((current) => current.map((measurement) => (measurement.id === id ? { ...measurement, [key]: value.replace(/[^0-9]/g, "") } : measurement)));
  };

  const saveReading = async () => {
    if (!selectedGroup || !averages) return;
    let session: ReadingSession;
    const validMeasurements = measurements.filter((measurement) => Number(measurement.systolic) > 0 && Number(measurement.diastolic) > 0);
    if (storageMode === "cloud") {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: selectedGroup.id,
            time: readingTime,
            readings: validMeasurements.map((measurement) => ({ systolic: Number(measurement.systolic), diastolic: Number(measurement.diastolic) })),
          }),
        });
        if (!response.ok) throw new Error("Could not save reading");
        const data = await response.json() as { session: ReadingSession };
        session = data.session;
      } catch {
        setToast("Cloudflare D1 is unavailable. Check your database setup.");
        return;
      }
    } else {
      session = {
        id: makeId(),
        groupId: selectedGroup.id,
        time: readingTime,
        createdAt: new Date().toISOString(),
        averageSystolic: averages.systolic,
        averageDiastolic: averages.diastolic,
        count: averages.count,
      };
    }

    setSessions((current) => [...current, session]);
    setMeasurements([emptyMeasurement()]);
    setReadingTime(getCurrentTime());
    setToast("Reading saved to your log.");
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const exportPdf = async () => {
    if (!groups.length && !sessions.length) {
      setToast("Add a medication group or reading before exporting.");
      return;
    }

    setIsExporting(true);
    try {
      const { exportBloodPressurePdf } = await import("../lib/export-pdf");
      exportBloodPressurePdf({ groups, sessions });
      setToast("PDF report downloaded.");
    } catch {
      setToast("Could not create the PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  const storageLabel = storageMode === "cloud" ? "synced to Cloudflare D1" : storageMode === "offline" ? "local preview mode" : "connecting to Cloudflare";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BP log home">
          <span className="brand-mark"><Icon name="heart" size={20} /></span>
          <span className="brand-name">BP log</span>
          <span className="brand-tag">your daily health note</span>
        </a>
        <div className="topbar-actions">
          <span className="privacy-note"><Icon name="shield" size={14} /> {storageLabel}</span>
          <Link aria-label="Open settings" className="icon-button topbar-settings" href="/settings">
            <Icon name="settings" size={17} />
          </Link>
          {installPrompt && (
            <button className="button" onClick={installApp} type="button">
              <Icon name="download" size={15} /> Install app
            </button>
          )}
        </div>
      </header>

      <main className="page" id="top">
        <div className="dashboard-grid">
          <div className="main-column">
            <section className="card log-card" id="log-card" aria-labelledby="log-heading">
              <div className="card-header">
                <div>
                  <h2 className="card-heading" id="log-heading">Log a reading</h2>
                  <p className="card-subheading">Enter as many measurements as you took.</p>
                </div>
                {groups.length > 0 && (
                  <label className="group-select">
                    <span>Group</span>
                    <select aria-label="Medication group" onChange={(event) => setSelectedGroupId(event.target.value)} value={selectedGroupId ?? ""}>
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {selectedGroup ? (
                <div className="log-body">
                  <div className="log-meta">
                    <label className="field-label time-field">Time<input aria-label="Reading time" onChange={(event) => setReadingTime(event.target.value)} required type="time" value={readingTime} /></label>
                    <span className="discreet-hint">Multiple readings are averaged together below.</span>
                  </div>
                  <div className="readings-header"><span>#</span><span>Systolic</span><span>Diastolic</span><span /></div>
                  {measurements.map((measurement, index) => (
                    <div className="reading-row" key={measurement.id}>
                      <span className="reading-number">{index + 1}</span>
                      <input aria-label={`Reading ${index + 1} systolic`} className="reading-input" inputMode="numeric" maxLength={3} onChange={(event) => updateMeasurement(measurement.id, "systolic", event.target.value)} placeholder="120" value={measurement.systolic} />
                      <input aria-label={`Reading ${index + 1} diastolic`} className="reading-input" inputMode="numeric" maxLength={3} onChange={(event) => updateMeasurement(measurement.id, "diastolic", event.target.value)} placeholder="80" value={measurement.diastolic} />
                      {measurements.length > 1 ? <button aria-label={`Remove reading ${index + 1}`} className="reading-delete" onClick={() => setMeasurements((current) => current.filter((item) => item.id !== measurement.id))} type="button"><Icon name="trash" size={14} /></button> : <span />}
                    </div>
                  ))}
                  <button className="add-medication" onClick={() => setMeasurements((current) => [...current, emptyMeasurement()])} type="button"><Icon name="plus" size={13} /> Add another reading</button>
                  <div className="average-bar">
                    <div className="average-label"><strong>Session average</strong><span>{averages ? `${averages.count} ${averages.count === 1 ? "reading" : "readings"} included` : "Complete a row to calculate"}</span></div>
                    <div className="average-number">{averages ? `${averages.systolic} / ${averages.diastolic}` : "— / —"}<small>mmHg</small></div>
                  </div>
                  <div className="log-actions">
                    <span className="discreet-hint">Saved privately on this device.</span>
                    <button className="button button-primary" disabled={!averages} onClick={saveReading} type="button">Save reading</button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="pulse" size={18} /></div>
                  <p className="empty-state-title">Choose a medication group first</p>
                  <p className="empty-state-copy">Your readings will stay organized inside the group you choose.</p>
                  <Link className="button button-primary" href="/settings">Create a group</Link>
                </div>
              )}
            </section>
          </div>

          <aside className="side-column">
            <section className="card side-card" aria-labelledby="today-heading">
              <div className="card-header">
                <div>
                  <h2 className="card-heading" id="today-heading">Today at a glance</h2>
                  <p className="card-subheading">A small snapshot, not a diagnosis.</p>
                </div>
                <Icon name="calendar" size={17} />
              </div>
              <div className="stat-grid">
                <div className="stat-box"><div className="stat-label">Average</div><div className="stat-value">{todayAverage ? `${todayAverage.systolic}/${todayAverage.diastolic}` : "—"} <span className="stat-unit">mmHg</span></div></div>
                <div className="stat-box"><div className="stat-label">Measurements</div><div className="stat-value">{todayMeasurements || "—"}</div></div>
              </div>
            </section>

            <section className="card side-card" aria-labelledby="recent-heading">
              <div className="card-header">
                <div>
                  <h2 className="card-heading" id="recent-heading">Recent readings</h2>
                  <p className="card-subheading">Your latest saved sessions.</p>
                </div>
                <Icon name="clock" size={17} />
              </div>
              <div className="recent-list">
                {recentSessions.length ? recentSessions.map((session) => {
                  const group = groups.find((item) => item.id === session.groupId);
                  return <div className="recent-item" key={session.id}><span className="recent-dot" /><div className="recent-main"><div className="recent-reading">{session.averageSystolic} / {session.averageDiastolic} <span className="stat-unit">mmHg</span></div><div className="recent-group">{group?.name ?? "Medication group"} · {session.count} {session.count === 1 ? "reading" : "readings"}</div></div><span className="recent-time">{formatTime(session.time)}</span></div>;
                }) : <p className="empty-recent">Saved readings will show up here after your first check-in.</p>}
              </div>
            </section>

            <div className="side-note"><div className="side-note-heading"><Icon name="info" size={15} /> A gentle reminder</div><p>BP log is for keeping notes over time. If a reading concerns you, follow the guidance from your healthcare professional.</p></div>
          </aside>
        </div>
        <div className="export-footer">
          <button className="button" disabled={isExporting || (!groups.length && !sessions.length)} onClick={exportPdf} type="button">
            <Icon name="download" size={15} /> {isExporting ? "Preparing..." : "Export PDF"}
          </button>
        </div>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
