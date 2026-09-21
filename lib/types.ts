export type Medication = {
  id: string;
  name: string;
  dose: string;
};

export type MedicationGroup = {
  id: string;
  name: string;
  medications: Medication[];
};

export type Measurement = {
  id: string;
  systolic: string;
  diastolic: string;
};

export type ReadingSession = {
  id: string;
  groupId: string;
  time: string;
  createdAt: string;
  averageSystolic: number;
  averageDiastolic: number;
  count: number;
};

export type AppState = {
  groups: MedicationGroup[];
  sessions: ReadingSession[];
};
