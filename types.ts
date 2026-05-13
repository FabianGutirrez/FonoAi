
export interface User {
  uid: string;
  name: string;
  email: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  createdBy?: string;
  createdAt?: any;
}

export enum EvaluationStatus {
  Pending = 'pendiente',
  Processing = 'procesando',
  Completed = 'completada',
  Failed = 'revisión necesaria'
}

export interface Evaluation {
  id: string;
  patientId: string;
  patientName: string;
  videoName: string;
  status: EvaluationStatus;
  transcription?: string;
  analysis?: string;
  createdBy?: string;
  createdAt?: any;
}
