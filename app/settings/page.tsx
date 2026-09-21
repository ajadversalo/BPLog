"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { MedicationGroup } from "../../lib/types";

const OFFLINE_GROUPS_KEY = "bp-log-preview-groups-v1";
const OFFLINE_SESSIONS_KEY = "bp-log-preview-sessions-v1";

const makeId = () => Math.random().toString(36).slice(2, 10);

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

  if (name === "heart") return <svg {...common}><path d="M20.8 8.8c0 5.1-8.8 10.2-8.8 10.2S3.2 13.9 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" /></svg>;
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2.1-5.1L13 17l2.6-6 1.5 1H21" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "arrow-left") return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 19 6v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6l7-3Z" /><path d="m9.2 12 1.8 1.8 3.9-4" /></svg>;
  return null;
}

export default function SettingsPage() {
  const [groups, setGroups] = useState<MedicationGroup[]>([]);
  const [storageMode, setStorageMode] = useState<"loading" | "cloud" | "offline">("loading");
  const [groupName, setGroupName] = useState("");
  const [medications, setMedications] = useState([{ name: "", dose: "" }]);
  const [message, setMessage] = useState("");
  const [syncCode, setSyncCode] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadGroups = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("Cloudflare D1 is not configured");
        const data = await response.json() as { groups?: MedicationGroup[] };
        if (!cancelled) {
          setGroups(data.groups ?? []);
          setStorageMode("cloud");
        }
      } catch {
        try {
          const savedGroups = window.localStorage.getItem(OFFLINE_GROUPS_KEY);
          if (!cancelled) {
            if (savedGroups) setGroups(JSON.parse(savedGroups));
            setStorageMode("offline");
          }
        } catch {
          if (!cancelled) setStorageMode("offline");
        }
      }
    };

    loadGroups();

    const loadSyncCode = async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { syncCode?: string };
        if (!cancelled) setSyncCode(data.syncCode ?? "");
      } catch {
        // The sync card remains available once the D1 migration is applied.
      }
    };

    loadSyncCode();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (storageMode !== "offline") return;
    try {
      window.localStorage.setItem(OFFLINE_GROUPS_KEY, JSON.stringify(groups));
    } catch {
      // Preview mode still works in-memory if storage is unavailable.
    }
  }, [groups, storageMode]);

  const updateMedication = (index: number, key: "name" | "dose", value: string) => {
    setMedications((current) => current.map((medication, medicationIndex) => (medicationIndex === index ? { ...medication, [key]: value } : medication)));
  };

  const addGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = groupName.trim();
    const cleanMedications = medications
      .map((medication) => ({ ...medication, name: medication.name.trim(), dose: medication.dose.trim() }))
      .filter((medication) => medication.name);
    if (!cleanName || !cleanMedications.length) return;

    let newGroup: MedicationGroup;
    if (storageMode === "cloud") {
      try {
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName, medications: cleanMedications }),
        });
        if (!response.ok) throw new Error("Could not save group");
        const data = await response.json() as { group: MedicationGroup };
        newGroup = data.group;
      } catch {
        setMessage("Cloudflare D1 is unavailable. Check your database setup.");
        return;
      }
    } else {
      newGroup = {
        id: makeId(),
        name: cleanName,
        medications: cleanMedications.map((medication) => ({ id: makeId(), ...medication })),
      };
    }

    setGroups((current) => [...current, newGroup]);
    setGroupName("");
    setMedications([{ name: "", dose: "" }]);
    setMessage(`${newGroup.name} is ready for readings.`);
  };

  const deleteGroup = async (group: MedicationGroup) => {
    if (!window.confirm(`Delete “${group.name}” and all of its readings?`)) return;

    if (storageMode === "cloud") {
      try {
        const response = await fetch(`/api/groups?id=${encodeURIComponent(group.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete group");
      } catch {
        setMessage("Cloudflare D1 is unavailable. The group was not deleted.");
        return;
      }
    } else {
      try {
        const savedSessions = window.localStorage.getItem(OFFLINE_SESSIONS_KEY);
        if (savedSessions) {
          const sessions = JSON.parse(savedSessions) as Array<{ groupId: string }>;
          window.localStorage.setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions.filter((session) => session.groupId !== group.id)));
        }
      } catch {
        // Preview mode can still remove the group from the current view.
      }
    }

    setGroups((current) => current.filter((item) => item.id !== group.id));
    setMessage(`${group.name} was deleted.`);
  };

  const copySyncCode = async () => {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
      setMessage("Sync code copied.");
    } catch {
      setMessage("Copy is unavailable. Enter the code manually on your phone.");
    }
  };

  const connectDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsConnecting(true);
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pairingCode }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not connect this device.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect this device.");
    } finally {
      setIsConnecting(false);
    }
  };

  const storageLabel = storageMode === "cloud" ? "synced to Cloudflare D1" : storageMode === "offline" ? "local preview mode" : "connecting to Cloudflare";

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to BP log home">
          <span className="brand-mark"><Icon name="heart" size={20} /></span>
          <span className="brand-name">BP log</span>
          <span className="brand-tag">settings</span>
        </Link>
        <div className="topbar-actions">
          <span className="privacy-note"><Icon name="shield" size={14} /> {storageLabel}</span>
          <Link aria-label="Back to log" className="button" href="/"><Icon name="arrow-left" size={15} /> Back to log</Link>
        </div>
      </header>

      <main className="page settings-page" id="top">
        <section className="settings-heading">
          <p className="eyebrow">Settings</p>
          <h1>Manage medication groups</h1>
          <p>Set up the routines you take readings around. Your groups will be available from the main log.</p>
        </section>

        <section className="card sync-card" aria-labelledby="sync-heading">
          <div className="card-header">
            <div>
              <h2 className="card-heading" id="sync-heading">Sync another device</h2>
              <p className="card-subheading">Use your code to see the same groups and readings on your phone.</p>
            </div>
            <Icon name="shield" size={17} />
          </div>
          <div className="sync-body">
            <div className="sync-code-panel">
              <span className="sync-label">Your sync code</span>
              <div className="sync-code-row">
                <code>{syncCode || "----------"}</code>
                <button className="button button-quiet" disabled={!syncCode} onClick={copySyncCode} type="button">Copy</button>
              </div>
              <span className="sync-help">Enter this code on another device to connect it to this log.</span>
            </div>
            <form className="pair-form" onSubmit={connectDevice}>
              <label className="field-label">Connect with a code<input inputMode="text" maxLength={10} onChange={(event) => setPairingCode(event.target.value.toUpperCase())} placeholder="10-character code" value={pairingCode} /></label>
              <button className="button button-primary" disabled={isConnecting || pairingCode.replace(/[^a-z0-9]/gi, "").length !== 10} type="submit">{isConnecting ? "Connecting..." : "Connect device"}</button>
            </form>
          </div>
        </section>

        <div className="settings-layout">
          <section className="card" aria-labelledby="group-list-heading">
            <div className="card-header">
              <div>
                <h2 className="card-heading" id="group-list-heading">Your groups</h2>
                <p className="card-subheading">{groups.length ? `${groups.length} ${groups.length === 1 ? "group" : "groups"} set up` : "Nothing set up yet"}</p>
              </div>
            </div>
            {groups.length ? (
              <div className="group-list settings-group-list">
                {groups.map((group) => (
                  <div className="group-card settings-group-card" key={group.id}>
                    <span className="group-icon"><Icon name="pulse" size={18} /></span>
                    <span className="group-info">
                      <span className="group-name">{group.name}</span>
                      <span className="group-detail">{group.medications.map((medication) => medication.dose ? `${medication.name} ${medication.dose}` : medication.name).join(" · ")}</span>
                    </span>
                    <button aria-label={`Delete ${group.name}`} className="icon-button settings-delete-button" onClick={() => deleteGroup(group)} type="button"><Icon name="trash" size={15} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state settings-empty-state">
                <div className="empty-state-icon"><Icon name="plus" size={18} /></div>
                <p className="empty-state-title">Your medication groups will appear here</p>
                <p className="empty-state-copy">Add one below to start organizing readings.</p>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="new-group-heading">
            <div className="card-header">
              <div>
                <h2 className="card-heading" id="new-group-heading">Add a medication group</h2>
                <p className="card-subheading">For example, “Morning routine” or “Before bed”.</p>
              </div>
            </div>
            <div className="form-panel settings-form-panel">
              <form className="form-panel-inner" onSubmit={addGroup}>
                <label className="field-label">Group name<input autoFocus onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Morning routine" required value={groupName} /></label>
                <div className="medication-fields">
                  {medications.map((medication, index) => (
                    <div className="medication-row" key={index}>
                      <label className="field-label">Medication<input onChange={(event) => updateMedication(index, "name", event.target.value)} placeholder="e.g. Lisinopril" required={index === 0} value={medication.name} /></label>
                      <label className="field-label">Dose <span className="field-label-muted">(optional)</span><input onChange={(event) => updateMedication(index, "dose", event.target.value)} placeholder="10 mg" value={medication.dose} /></label>
                      {medications.length > 1 ? <button aria-label={`Remove medication ${index + 1}`} className="icon-button" onClick={() => setMedications((current) => current.filter((_, medicationIndex) => medicationIndex !== index))} type="button"><Icon name="trash" size={15} /></button> : <span />}
                    </div>
                  ))}
                </div>
                <button className="add-medication" onClick={() => setMedications((current) => [...current, { name: "", dose: "" }])} type="button"><Icon name="plus" size={13} /> Add another medication</button>
                <div className="form-actions">
                  <button className="button button-primary" type="submit">Save group</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}
