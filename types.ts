import { z } from 'zod';

export type Jenjang = 'SD' | 'SMP' | 'SMA' | 'SMK';

export enum PraktikPedagogis {
  INKUIRI = 'Inkuiri-Discovery',
  PJBL = 'PjBL',
  PROBLEM_SOLVING = 'Problem Solving',
  GAME_BASED = 'Game Based Learning',
  STATION = 'Station Learning'
}

export const DIMENSI_LULUSAN = [
  'Keimanan & Ketakwaan',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi'
] as const;

export interface MeetingPedagogy {
  meetingNumber: number;
  pedagogy: PraktikPedagogis;
}

export interface RPMFormData {
  satuanPendidikan: string;
  namaGuru: string;
  nipGuru: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  jenjang: Jenjang;
  kelas: string;
  semester: string;
  tahunAjaran: string;
  programKeahlian?: string;
  mataPelajaran: string;
  cp: string;
  tp: string;
  materi: string;
  jumlahPertemuan: number;
  durasi: string;
  pedagogiPerPertemuan: MeetingPedagogy[];
  dimensiLulusan: string[];
}

// Zod Schema for Validation
export const GeneratedRPMSchema = z.object({
  siswa: z.string(),
  lintasDisiplin: z.string(),
  topik: z.string(),
  pertanyaanPemantik: z.string(),
  pengalamanBelajar: z.array(z.object({
    pertemuan: z.number(),
    pendahuluan: z.string(),
    inti: z.string(),
    penutup: z.string()
  })),
  asesmen: z.object({
    diagnostik: z.string(),
    formatif: z.string(),
    sumatif: z.string()
  }),
  rubrik: z.string().optional(),
  lkpd: z.string().optional(),
  jurnal: z.string().optional(),
  instrumenAsesmen: z.string().optional()
});

export type GeneratedRPM = z.infer<typeof GeneratedRPMSchema>;

export interface AppSettings {
  apiKey: string;
  model: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}
