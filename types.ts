
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

export interface AcousticMetrics {
  pitchMean?: number;
  pitchStDev?: number;
  jitter?: number;
  shimmer?: number;
  f1Mean?: number;
  f2Mean?: number;
  speakingRate?: number; // sílabas por segundo
}

export interface DiarizationSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface PhonemeAlignment {
  word: string;
  start: number;
  end: number;
  phonemes: Array<{
    phone: string;
    start: number;
    end: number;
    score: number;
  }>;
}

export interface Evaluation {
  id: string;
  patientId: string;
  patientName: string;
  videoName: string;
  status: EvaluationStatus;
  transcription?: string;
  analysis?: string;
  acousticMetrics?: AcousticMetrics;
  diarization?: DiarizationSegment[];
  phonemeAlignments?: PhonemeAlignment[];
  createdBy?: string;
  createdAt?: any;
}
