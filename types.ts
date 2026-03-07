
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

export interface GeneratedRPM {
  siswa: string;
  lintasDisiplin: string;
  topik: string;
  pertanyaanPemantik: string;
  pengalamanBelajar: {
    pertemuan: number;
    pendahuluan: string;
    inti: string;
    penutup: string;
  }[];
  asesmen: {
    diagnostik: string;
    formatif: string;
    sumatif: string;
  };
  // Lampiran
  rubrik?: string;
  lkpd?: string;
  jurnal?: string;
  instrumenAsesmen?: string;
}

export interface AppSettings {
  apiKey: string;
  model: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}
