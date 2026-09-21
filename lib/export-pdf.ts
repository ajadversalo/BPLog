import { jsPDF } from "jspdf";
import type { MedicationGroup, ReadingSession } from "./types";

type ExportData = {
  groups: MedicationGroup[];
  sessions: ReadingSession[];
};

const RED = [159, 29, 53] as const;
const INK = [27, 44, 43] as const;
const MUTED = [82, 99, 96] as const;
const PALE_RED = [253, 242, 244] as const;
const LINE = [224, 218, 220] as const;

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));

const formatTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

export function exportBloodPressurePdf({ groups, sessions }: ExportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 18;
  const right = pageWidth - 18;
  let y = 18;

  const addPageIfNeeded = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    y = 20;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(left, y, right, y);
    y += 10;
  };

  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const average = sortedSessions.length
    ? {
        systolic: Math.round(sortedSessions.reduce((total, session) => total + session.averageSystolic, 0) / sortedSessions.length),
        diastolic: Math.round(sortedSessions.reduce((total, session) => total + session.averageDiastolic, 0) / sortedSessions.length),
      }
    : null;
  const measurementCount = sortedSessions.reduce((total, session) => total + session.count, 0);

  doc.setFillColor(...RED);
  doc.roundedRect(left, y, right - left, 32, 5, 5, "F");
  doc.setTextColor(255, 245, 246);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("BP log", left + 8, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Blood pressure report", left + 8, y + 22);
  doc.text(`Exported ${formatDate(new Date().toISOString())}`, right - 8, y + 17, { align: "right" });
  y += 44;

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Overview", left, y);
  y += 7;

  const boxGap = 4;
  const boxWidth = (right - left - boxGap * 2) / 3;
  const stats = [
    { label: "Average", value: average ? `${average.systolic} / ${average.diastolic}` : "-" },
    { label: "Sessions", value: String(sortedSessions.length) },
    { label: "Measurements", value: String(measurementCount) },
  ];
  stats.forEach((stat, index) => {
    const x = left + index * (boxWidth + boxGap);
    doc.setFillColor(...PALE_RED);
    doc.roundedRect(x, y, boxWidth, 22, 3, 3, "F");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(stat.label, x + 5, y + 7);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(stat.value, x + 5, y + 16);
  });
  y += 34;

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Medication groups", left, y);
  y += 7;
  groups.forEach((group) => {
    const medicationText = group.medications.map((medication) => medication.dose ? `${medication.name} ${medication.dose}` : medication.name).join(", ") || "No medications listed";
    const lines = doc.splitTextToSize(`${group.name}: ${medicationText}`, right - left);
    addPageIfNeeded(lines.length * 5 + 3);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lines, left, y);
    y += lines.length * 5 + 2;
  });
  y += 6;

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Reading history", left, y);
  y += 7;

  const columns = [left, left + 32, left + 58, left + 104, right];
  const headers = ["Date", "Time", "Group", "Average", "Count"];
  doc.setFillColor(...RED);
  doc.roundedRect(left, y, right - left, 9, 2, 2, "F");
  doc.setTextColor(255, 245, 246);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  headers.forEach((header, index) => doc.text(header, columns[index] + 4, y + 6));
  y += 9;

  if (!sortedSessions.length) {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No readings saved yet.", left + 4, y + 8);
    y += 15;
  } else {
    sortedSessions.forEach((session, index) => {
      addPageIfNeeded(9);
      if (index % 2 === 0) {
        doc.setFillColor(251, 248, 249);
        doc.rect(left, y, right - left, 9, "F");
      }
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const row = [formatDate(session.createdAt), formatTime(session.time), groupNames.get(session.groupId) ?? "Medication group", `${session.averageSystolic} / ${session.averageDiastolic}`, String(session.count)];
      row.forEach((value, rowIndex) => {
        const maxWidth = rowIndex === 2 ? columns[3] - columns[2] - 6 : undefined;
        const text = maxWidth ? doc.splitTextToSize(value, maxWidth)[0] : value;
        doc.text(text, columns[rowIndex] + 4, y + 6);
      });
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(left, y + 9, right, y + 9);
      y += 9;
    });
  }

  addPageIfNeeded(20);
  y += 12;
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("For personal tracking only. This report is not a diagnosis.", left, y);

  doc.save(`bp-log-${new Date().toISOString().slice(0, 10)}.pdf`);
}
