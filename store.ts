import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  RPMFormData, 
  GeneratedRPM, 
  AppSettings, 
  LogEntry, 
  PraktikPedagogis, 
  Jenjang 
} from './types';
import { PROGRAM_KEAHLIAN_SMK } from './constants';

interface RPMStore {
  // States
  step: number;
  formData: RPMFormData;
  generatedRPM: GeneratedRPM | null;
  settings: AppSettings;
  logs: LogEntry[];
  theme: 'light' | 'dark';
  
  // Actions
  setStep: (step: number) => void;
  updateFormData: (data: Partial<RPMFormData>) => void;
  setGeneratedRPM: (rpm: GeneratedRPM | null) => void;
  updateGeneratedRPM: (data: Partial<GeneratedRPM>) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  resetForm: () => void;
  toggleTheme: () => void;
}

const getInitialAcademicSettings = () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isEven = currentMonth >= 0 && currentMonth <= 5;
  const semester = isEven ? 'Genap' : 'Ganjil';
  const tahunAjaran = isEven 
    ? `${currentYear - 1}/${currentYear}` 
    : `${currentYear}/${currentYear + 1}`;
  return { semester, tahunAjaran };
};

const initialAcademic = getInitialAcademicSettings();

const initialFormData: RPMFormData = {
  satuanPendidikan: 'UPTD SMKN Campalagian',
  namaGuru: 'ARDAN, S.Kom',
  nipGuru: '199603142022211001',
  namaKepalaSekolah: 'RASJUDDIN, S.Pd.I., MM',
  nipKepalaSekolah: '198603062022211001',
  jenjang: 'SMK',
  kelas: 'Kelas 12',
  semester: initialAcademic.semester,
  tahunAjaran: initialAcademic.tahunAjaran, 
  programKeahlian: PROGRAM_KEAHLIAN_SMK[0],
  mataPelajaran: 'Mapel Konsentrasi Keahlian TJKT',
  cp: '',
  tp: '',
  materi: '',
  jumlahPertemuan: 1,
  durasi: '4 x 45 Menit',
  pedagogiPerPertemuan: [{ meetingNumber: 1, pedagogy: PraktikPedagogis.INKUIRI }],
  dimensiLulusan: []
};

export const useRPMStore = create<RPMStore>()(
  persist(
    (set) => ({
      step: 1,
      formData: initialFormData,
      generatedRPM: null,
      settings: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
      },
      logs: [],
      theme: 'light',

      setStep: (step) => set({ step }),
      updateFormData: (data) => set((state) => ({ 
        formData: { ...state.formData, ...data } 
      })),
      setGeneratedRPM: (rpm) => set({ generatedRPM: rpm }),
      updateGeneratedRPM: (data) => set((state) => ({
        generatedRPM: state.generatedRPM ? { ...state.generatedRPM, ...data } : null
      })),
      setSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      addLog: (entry) => set((state) => ({
        logs: [entry, ...state.logs].slice(0, 50)
      })),
      clearLogs: () => set({ logs: [] }),
      resetForm: () => set({ 
        formData: initialFormData, 
        generatedRPM: null, 
        step: 1,
        logs: []
      }),
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'light' ? 'dark' : 'light' 
      })),
    }),
    {
      name: 'rpm-builder-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
