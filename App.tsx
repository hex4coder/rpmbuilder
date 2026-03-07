import React, { useState, useEffect } from 'react';
import { 
  RPMFormData, 
  Jenjang, 
  PraktikPedagogis, 
  DIMENSI_LULUSAN, 
  GeneratedRPM,
  MeetingPedagogy,
  AppSettings
} from './types';
import { KELAS_OPTIONS, PROGRAM_KEAHLIAN_SMK, TAHUN_AJARAN_OPTIONS } from './constants';
import { generateRPMContent, generateCP, generateTP, generateAttachment } from './services/geminiService';
import { exportToWord } from './services/wordExportService';
import { RPMTable } from './components/RPMTable';
import { 
  FileText, 
  Sparkles, 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Wand2, 
  FileType, 
  Printer, 
  Check, 
  ClipboardCheck, 
  BookOpen, 
  PenTool,
  ListChecks,
  Settings as SettingsIcon,
  X,
  Key,
  Cpu,
  Target,
  Zap
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggestingCP, setIsSuggestingCP] = useState(false);
  const [isSuggestingTP, setIsSuggestingTP] = useState(false);
  const [numTP, setNumTP] = useState(3);
  const [isExporting, setIsExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  
  const [isGenRubrik, setIsGenRubrik] = useState(false);
  const [isGenLKPD, setIsGenLKPD] = useState(false);
  const [isGenJurnal, setIsGenJurnal] = useState(false);
  const [isGenInstrumen, setIsGenInstrumen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [generatedRPM, setGeneratedRPM] = useState<GeneratedRPM | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [streamingText, setStreamingText] = useState<string>("");

  // Load Settings from LocalStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('rpm_settings');
    if (saved) return JSON.parse(saved);
    return {
      apiKey: (process.env.OPENROUTER_API_KEY as string) || '',
      model: 'google/gemini-2.0-flash-001'
    };
  });

  const addLog = (entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 50));
  };

  const handleStream = (chunk: string) => {
    setStreamingText(prev => (prev + chunk).slice(-1000));
  };

  useEffect(() => {
    localStorage.setItem('rpm_settings', JSON.stringify(settings));
    const models = ['google/gemini-2.0-flash-001', 'google/gemini-2.0-pro-exp-02-05:free', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 'deepseek/deepseek-chat'];
    setIsCustomModel(!models.includes(settings.model));
  }, [settings]);

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

  const initialSettings = getInitialAcademicSettings();

  const [formData, setFormData] = useState<RPMFormData>({
    satuanPendidikan: 'UPTD SMKN Campalagian',
    namaGuru: 'ARDAN, S.Kom',
    nipGuru: '199603142022211001',
    namaKepalaSekolah: 'RASJUDDIN, S.Pd.I., MM',
    nipKepalaSekolah: '198603062022211001',
    jenjang: 'SMK',
    kelas: 'Kelas 12',
    semester: initialSettings.semester,
    tahunAjaran: initialSettings.tahunAjaran, 
    programKeahlian: PROGRAM_KEAHLIAN_SMK[0],
    mataPelajaran: 'Mapel Konsentrasi Keahlian TJKT',
    cp: '',
    tp: '',
    materi: '',
    jumlahPertemuan: 1,
    durasi: '4 x 45 Menit',
    pedagogiPerPertemuan: [{ meetingNumber: 1, pedagogy: PraktikPedagogis.INKUIRI }],
    dimensiLulusan: []
  });

  useEffect(() => {
    setFormData(prev => {
      const newList = [...prev.pedagogiPerPertemuan];
      if (prev.jumlahPertemuan > newList.length) {
        for (let i = newList.length + 1; i <= prev.jumlahPertemuan; i++) {
          newList.push({ meetingNumber: i, pedagogy: PraktikPedagogis.INKUIRI });
        }
      } else if (prev.jumlahPertemuan < newList.length) {
        newList.splice(prev.jumlahPertemuan);
      }
      return { ...prev, pedagogiPerPertemuan: newList };
    });
  }, [formData.jumlahPertemuan]);

  useEffect(() => {
    setFormData(prev => {
      const options = KELAS_OPTIONS[prev.jenjang];
      const defaultClass = options.includes('Kelas 12') ? 'Kelas 12' : options[0];
      return { ...prev, kelas: defaultClass };
    });
  }, [formData.jenjang]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDimensiChange = (dimensi: string) => {
    setFormData(prev => {
      const current = prev.dimensiLulusan;
      const updated = current.includes(dimensi) 
        ? current.filter(d => d !== dimensi) 
        : [...current, dimensi];
      return { ...prev, dimensiLulusan: updated };
    });
  };

  const updatePedagogy = (index: number, val: PraktikPedagogis) => {
    setFormData(prev => {
      const newList = [...prev.pedagogiPerPertemuan];
      newList[index].pedagogy = val;
      return { ...prev, pedagogiPerPertemuan: newList };
    });
  };

  const handleSuggestCP = async () => {
    if (!formData.mataPelajaran || !formData.materi) {
      alert("Harap isi Mata Pelajaran dan Materi Pokok terlebih dahulu.");
      return;
    }
    if (!settings.apiKey) {
      setShowSettings(true);
      alert("Harap masukkan OpenRouter API Key di menu Pengaturan.");
      return;
    }
    setIsSuggestingCP(true);
    setError(null);
    setLogs([]);
    setStreamingText("");
    try {
      const result = await generateCP(formData.jenjang, formData.kelas, formData.mataPelajaran, formData.materi, settings, addLog, handleStream);
      setFormData(prev => ({ ...prev, cp: result }));
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil saran CP.');
    } finally {
      setIsSuggestingCP(false);
    }
  };

  const handleSuggestTP = async () => {
    if (!formData.mataPelajaran || !formData.materi) {
      alert("Harap isi Mata Pelajaran dan Materi Pokok terlebih dahulu.");
      return;
    }
    if (!settings.apiKey) {
      setShowSettings(true);
      alert("Harap masukkan OpenRouter API Key di menu Pengaturan.");
      return;
    }
    setIsSuggestingTP(true);
    setError(null);
    setLogs([]);
    setStreamingText("");
    try {
      const result = await generateTP(formData.jenjang, formData.kelas, formData.mataPelajaran, formData.materi, formData.cp, numTP, settings, addLog, handleStream);
      setFormData(prev => ({ ...prev, tp: result }));
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil saran TP.');
    } finally {
      setIsSuggestingTP(false);
    }
  };

  const handleGenerate = async () => {
    if (!settings.apiKey) {
      setShowSettings(true);
      alert("Harap masukkan OpenRouter API Key di menu Pengaturan.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setLogs([]);
    setStreamingText("");
    try {
      const result = await generateRPMContent(formData, settings, addLog, handleStream);
      setGeneratedRPM(result);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateExtra = async (type: 'rubrik' | 'lkpd' | 'jurnal' | 'instrumenAsesmen') => {
    if (!generatedRPM) return;
    
    const setters = {
      rubrik: setIsGenRubrik,
      lkpd: setIsGenLKPD,
      jurnal: setIsGenJurnal,
      instrumenAsesmen: setIsGenInstrumen
    };

    setters[type](true);
    setLogs([]);
    setStreamingText("");
    addLog({ timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }), message: `Proses: Menghasilkan lampiran ${type.toUpperCase()}`, type: 'info' });
    try {
      const content = await generateAttachment(type, formData, generatedRPM, settings, addLog, handleStream);
      setGeneratedRPM(prev => prev ? { ...prev, [type]: content } : null);
    } catch (err) {
      alert(`Gagal generate ${type}`);
    } finally {
      setters[type](false);
    }
  };

  const handleExportWord = async () => {
    if (!generatedRPM) return;
    setIsExporting(true);
    try {
      await exportToWord(formData, generatedRPM);
    } catch (err) {
      console.error(err);
      alert("Gagal mengekspor file Word.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 sm:px-6">
      
      {/* Tombol Settings */}
      <button 
        onClick={() => setShowSettings(true)}
        className="fixed top-6 right-6 p-3 bg-white border border-slate-200 rounded-full shadow-lg hover:bg-slate-50 transition-all z-40 no-print"
      >
        <SettingsIcon className="w-6 h-6 text-slate-600" />
      </button>

      {/* Modal Settings */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> Pengaturan AI
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-500" /> OpenRouter API Key
                </label>
                <input 
                  type="password" 
                  value={settings.apiKey}
                  onChange={(e) => setSettings(s => ({...s, apiKey: e.target.value}))}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-xl border-slate-300 shadow-sm p-3 border bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                />
                <p className="mt-2 text-[10px] text-slate-400">Dapatkan API Key di <a href="https://openrouter.ai/keys" target="_blank" className="underline text-blue-500">openrouter.ai</a></p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-500" /> Model AI
                </label>
                <div className="space-y-3">
                  <select 
                    value={isCustomModel ? 'custom' : settings.model}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setIsCustomModel(true);
                      } else {
                        setIsCustomModel(false);
                        setSettings(s => ({...s, model: val}));
                      }
                    }}
                    className="w-full rounded-xl border-slate-300 shadow-sm p-3 border bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Cepat & Pintar)</option>
                    <option value="google/gemini-2.0-pro-exp-02-05:free">Gemini 2.0 Pro Exp (Gratis/Limit)</option>
                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Terbaik)</option>
                    <option value="openai/gpt-4o-mini">GPT-4o Mini (Ekonomis)</option>
                    <option value="deepseek/deepseek-chat">DeepSeek V3 (Sangat Murah)</option>
                    <option value="custom">-- Kustom (Masukkan ID Manual) --</option>
                  </select>

                  {isCustomModel && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <input 
                        type="text" 
                        value={settings.model}
                        onChange={(e) => setSettings(s => ({...s, model: e.target.value}))}
                        placeholder="Contoh: meta-llama/llama-3.1-405b"
                        className="w-full rounded-xl border-blue-200 shadow-sm p-3 border bg-blue-50 focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm" 
                      />
                      <p className="mt-1.5 text-[10px] text-slate-400">Lihat ID model lengkap di <a href="https://openrouter.ai/models" target="_blank" className="underline text-blue-500 font-medium">openrouter.ai/models</a></p>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-10 text-center no-print">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-blue-600 p-2 rounded-lg shadow-md">
            <FileText className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Generator <span className="text-blue-600">RPM</span></h1>
        </div>
        <p className="text-slate-500 max-w-md mx-auto">Sistem cerdas penyusun Rencana Pembelajaran Mendalam otomatis untuk guru profesional.</p>
      </header>

      <main className="w-full max-w-5xl relative">
        {/* AI Process Console (Global) */}
        {(isGenerating || isSuggestingCP || isSuggestingTP || isGenRubrik || isGenLKPD || isGenJurnal || isGenInstrumen) && (
          <div className="mb-8 bg-slate-900 rounded-xl p-4 font-mono text-xs overflow-hidden border border-slate-700 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 no-print">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                </div>
                <span className="text-slate-400 font-bold ml-2 uppercase tracking-tighter">AI Output Console</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{settings.model.split('/')[1] || settings.model}</span>
                <span className="text-blue-400 animate-pulse text-[10px] font-bold">STREAMING</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logs Column */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar flex flex-col-reverse border-r border-slate-800 pr-2">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 animate-in fade-in duration-300 ${i === 0 ? 'text-blue-100 font-bold' : 'text-slate-500'}`}>
                    <span className="shrink-0">[{log.timestamp}]</span>
                    <span className={
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-green-400' : 
                      log.type === 'warning' ? 'text-amber-400' : 
                      'text-blue-300'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>

              {/* Streaming Column */}
              <div className="bg-black/30 rounded p-2 border border-slate-800/50 min-h-[80px] max-h-40 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] text-slate-600 mb-1 uppercase tracking-tighter border-b border-slate-800 pb-1 flex justify-between">
                  <span>Raw Output Data</span>
                  <span className="text-blue-500/50">{streamingText.length} chars</span>
                </div>
                <div className="text-emerald-500/80 leading-relaxed break-all whitespace-pre-wrap">
                  {streamingText || "Waiting for model stream..."}
                  <span className="inline-block w-1.5 h-3 bg-emerald-500 animate-pulse ml-0.5"></span>
                </div>
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-700">
              <span className="bg-slate-100 p-1.5 rounded text-sm text-slate-500">1/2</span>
              Informasi Pengajar & Satuan Pendidikan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nama Satuan Pendidikan</span>
                  <input type="text" name="satuanPendidikan" value={formData.satuanPendidikan} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nama Guru</span>
                  <input type="text" name="namaGuru" value={formData.namaGuru} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">NIP Guru</span>
                  <input type="text" name="nipGuru" value={formData.nipGuru} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                </label>
                <div className="flex gap-4">
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700">Semester</span>
                    <select name="semester" value={formData.semester} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white">
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </label>
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700">Tahun Ajaran</span>
                    <select name="tahunAjaran" value={formData.tahunAjaran} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white">
                      {TAHUN_AJARAN_OPTIONS.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Nama Kepala Sekolah</span>
                  <input type="text" name="namaKepalaSekolah" value={formData.namaKepalaSekolah} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">NIP Kepala Sekolah</span>
                  <input type="text" name="nipKepalaSekolah" value={formData.nipKepalaSekolah} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                </label>
                <div className="flex gap-4">
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700">Jenjang</span>
                    <select name="jenjang" value={formData.jenjang} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white">
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                      <option value="SMK">SMK</option>
                    </select>
                  </label>
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700">Kelas</span>
                    <select name="kelas" value={formData.kelas} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white">
                      {KELAS_OPTIONS[formData.jenjang].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                </div>
                {formData.jenjang === 'SMK' && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Program Keahlian</span>
                    <select name="programKeahlian" value={formData.programKeahlian} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white">
                      {PROGRAM_KEAHLIAN_SMK.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </div>
            <div className="mt-10 flex justify-end">
              <button 
                type="button"
                onClick={() => setStep(2)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
              >
                Selanjutnya <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200 animate-in slide-in-from-right duration-500">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-700">
              <button type="button" onClick={() => setStep(1)} className="p-1 hover:bg-slate-100 rounded mr-2"><ChevronLeft /></button>
              <span className="bg-slate-100 p-1.5 rounded text-sm text-slate-500">2/2</span>
              Detail Kurikulum & Pembelajaran
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Mata Pelajaran</span>
                  <input type="text" name="mataPelajaran" value={formData.mataPelajaran} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Materi Pokok</span>
                  <input type="text" name="materi" value={formData.materi} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" placeholder="Contoh: Turunan Fungsi" />
                </label>
                <label className="block">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-sm font-medium text-slate-700">Capaian Pembelajaran (CP)</span>
                    <button 
                      type="button" 
                      onClick={handleSuggestCP} 
                      disabled={isSuggestingCP || isSuggestingTP} 
                      className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md hover:bg-blue-100 font-bold text-[10px] uppercase tracking-wider transition-all"
                    >
                      {isSuggestingCP ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                      Sarankan CP
                    </button>
                  </div>
                  <textarea name="cp" value={formData.cp} onChange={handleInputChange} rows={4} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="CP akan diisi otomatis atau manual..." />
                </label>

                <label className="block">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-slate-700">Tujuan Pembelajaran (TP)</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-emerald-100 rounded-md overflow-hidden shadow-sm">
                        <span className="text-[9px] font-bold text-slate-400 px-2 uppercase">Jumlah</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="10" 
                          value={numTP} 
                          onChange={(e) => setNumTP(parseInt(e.target.value) || 1)}
                          className="w-10 border-l border-emerald-50 p-1 text-center text-xs font-bold text-emerald-700 focus:outline-none bg-emerald-50/30"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleSuggestTP} 
                        disabled={isSuggestingTP || isSuggestingCP} 
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md hover:bg-emerald-100 font-bold text-[10px] uppercase tracking-wider transition-all"
                      >
                        {isSuggestingTP ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Sarankan TP
                      </button>
                    </div>
                  </div>
                  <textarea name="tp" value={formData.tp} onChange={handleInputChange} rows={4} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" placeholder="TP akan diisi otomatis atau manual..." />
                </label>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <label className="block">
                    <span className="text-sm font-medium text-slate-700">Jumlah Pertemuan</span>
                    <input type="number" min="1" max="10" name="jumlahPertemuan" value={formData.jumlahPertemuan} onChange={(e) => setFormData(p => ({...p, jumlahPertemuan: parseInt(e.target.value) || 1}))} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Durasi (Default: 4x45')</span>
                    <input type="text" name="durasi" value={formData.durasi} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 border bg-white" />
                  </label>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-sm text-slate-700 mb-3">Model Pembelajaran per Pertemuan</h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {formData.pedagogiPerPertemuan.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="w-24 font-medium text-slate-600">Pertemuan {item.meetingNumber}</span>
                        <select 
                          value={item.pedagogy}
                          onChange={(e) => updatePedagogy(idx, e.target.value as PraktikPedagogis)}
                          className="flex-1 rounded border-slate-300 p-2 text-sm border bg-white"
                        >
                          {Object.values(PraktikPedagogis).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-3 text-center md:text-left">Dimensi Profil Lulusan</h3>
                  <div className="flex flex-wrap gap-2">
                    {DIMENSI_LULUSAN.map(dim => {
                      const isSelected = formData.dimensiLulusan.includes(dim);
                      return (
                        <button
                          key={dim}
                          type="button"
                          onClick={() => handleDimensiChange(dim)}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                            ${isSelected 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                              : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                            }
                          `}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {dim}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                Error: {error}
              </div>
            )}

            <div className="mt-10 flex justify-end">
              <button 
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sedang Menyusun RPM...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Buat RPM Sekarang
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && generatedRPM && (
          <div className="animate-in slide-in-from-bottom duration-500 pb-20">
             <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
              <button 
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" /> Edit Data
              </button>
              
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleGenerateExtra('rubrik')}
                  disabled={isGenRubrik}
                  title="Generate Rubrik Penilaian"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${generatedRPM.rubrik ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'}`}
                >
                  {isGenRubrik ? <Loader2 className="w-4 h-4 animate-spin" /> : (generatedRPM.rubrik ? <Check className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />)}
                  {generatedRPM.rubrik ? 'Rubrik Terbuat' : 'Rubrik Penilaian'}
                </button>
                <button 
                  onClick={() => handleGenerateExtra('instrumenAsesmen')}
                  disabled={isGenInstrumen}
                  title="Generate Saran Instrumen Asesmen"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${generatedRPM.instrumenAsesmen ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'}`}
                >
                  {isGenInstrumen ? <Loader2 className="w-4 h-4 animate-spin" /> : (generatedRPM.instrumenAsesmen ? <Check className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />)}
                  {generatedRPM.instrumenAsesmen ? 'Saran Asesmen Terbuat' : 'Contoh/Saran Asesmen'}
                </button>
                <button 
                  onClick={() => handleGenerateExtra('lkpd')}
                  disabled={isGenLKPD}
                  title="Generate Lembar Kerja Peserta Didik"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${generatedRPM.lkpd ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'}`}
                >
                  {isGenLKPD ? <Loader2 className="w-4 h-4 animate-spin" /> : (generatedRPM.lkpd ? <Check className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />)}
                  {generatedRPM.lkpd ? 'LKPD Terbuat' : 'Buat LKPD'}
                </button>
                <button 
                  onClick={() => handleGenerateExtra('jurnal')}
                  disabled={isGenJurnal}
                  title="Generate Jurnal Refleksi Guru"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${generatedRPM.jurnal ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'}`}
                >
                  {isGenJurnal ? <Loader2 className="w-4 h-4 animate-spin" /> : (generatedRPM.jurnal ? <Check className="w-4 h-4" /> : <PenTool className="w-4 h-4" />)}
                  {generatedRPM.jurnal ? 'Jurnal Terbuat' : 'Jurnal Guru'}
                </button>
              </div>

              <div className="flex gap-2">
                 <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow transition-colors text-sm font-bold"
                >
                  <Printer className="w-4 h-4" /> Cetak
                </button>
                <button 
                  onClick={handleExportWord}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow transition-colors disabled:opacity-50 text-sm font-bold"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType className="w-4 h-4" />}
                  Word
                </button>
              </div>
            </div>

            <RPMTable data={formData} generated={generatedRPM} />
            
            <div className="mt-8 text-center text-slate-500 text-sm no-print mb-10">
              <p>Dibuat otomatis dengan AI Ardan • {new Date().getFullYear()}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
