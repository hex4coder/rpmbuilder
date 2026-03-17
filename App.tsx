import React, { useState, useEffect } from 'react';
import { 
  PraktikPedagogis, 
  DIMENSI_LULUSAN
} from './types';
import { KELAS_OPTIONS, PROGRAM_KEAHLIAN_SMK, TAHUN_AJARAN_OPTIONS } from './constants';
import { generateRPMContent, generateCP, generateTP, generateAttachment, testAIConnection } from './services/aiService';
import { exportToWord } from './services/wordExportService';
import { RPMTable } from './components/RPMTable';
import { useRPMStore } from './store';
import { 
  FileText, 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Wand2, 
  FileType, 
  Printer, 
  Check, 
  Sparkles,
  Settings as SettingsIcon,
  X,
  Key,
  Cpu,
  Target,
  Zap,
  RotateCcw,
  Moon,
  Sun
} from 'lucide-react';

const App: React.FC = () => {
  const { 
    step, setStep, 
    formData, updateFormData, 
    generatedRPM, setGeneratedRPM, updateGeneratedRPM,
    settings, setSettings,
    logs, addLog, clearLogs,
    resetForm,
    theme, toggleTheme
  } = useRPMStore();

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

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");

  const handleStream = (chunk: string) => {
    setStreamingText(prev => (prev + chunk).slice(-1000));
  };

  useEffect(() => {
    const models = ['google/gemini-2.0-flash-001', 'google/gemini-2.0-pro-exp-02-05:free', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 'deepseek/deepseek-chat'];
    setIsCustomModel(!models.includes(settings.model));
  }, [settings.model]);

  useEffect(() => {
    const newList = [...formData.pedagogiPerPertemuan];
    if (formData.jumlahPertemuan > newList.length) {
      for (let i = newList.length + 1; i <= formData.jumlahPertemuan; i++) {
        newList.push({ meetingNumber: i, pedagogy: PraktikPedagogis.INKUIRI });
      }
      updateFormData({ pedagogiPerPertemuan: newList });
    } else if (formData.jumlahPertemuan < newList.length) {
      newList.splice(formData.jumlahPertemuan);
      updateFormData({ pedagogiPerPertemuan: newList });
    }
  }, [formData.jumlahPertemuan]);

  useEffect(() => {
    const options = KELAS_OPTIONS[formData.jenjang];
    const defaultClass = options.includes('Kelas 12') ? 'Kelas 12' : options[0];
    if (!options.includes(formData.kelas)) {
      updateFormData({ kelas: defaultClass });
    }
  }, [formData.jenjang]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateFormData({ [name]: value });
  };

  const handleDimensiChange = (dimensi: string) => {
    const current = formData.dimensiLulusan;
    const updated = current.includes(dimensi) 
      ? current.filter(d => d !== dimensi) 
      : [...current, dimensi];
    updateFormData({ dimensiLulusan: updated });
  };

  const updatePedagogy = (index: number, val: PraktikPedagogis) => {
    const newList = [...formData.pedagogiPerPertemuan];
    newList[index].pedagogy = val;
    updateFormData({ pedagogiPerPertemuan: newList });
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
    clearLogs();
    setStreamingText("");
    try {
      const result = await generateCP(formData.jenjang, formData.kelas, formData.mataPelajaran, formData.materi, settings, addLog, handleStream);
      updateFormData({ cp: result });
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
    clearLogs();
    setStreamingText("");
    try {
      const result = await generateTP(formData.jenjang, formData.kelas, formData.mataPelajaran, formData.materi, formData.cp, numTP, settings, addLog, handleStream);
      updateFormData({ tp: result });
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
    clearLogs();
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
    setStreamingText("");
    addLog({ timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }), message: `Proses: Menghasilkan lampiran ${type.toUpperCase()}`, type: 'info' });
    try {
      const content = await generateAttachment(type, formData, generatedRPM, settings, addLog, handleStream);
      updateGeneratedRPM({ [type]: content });
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

  const handleReset = () => {
    if (confirm("Apakah Anda yakin ingin menghapus semua data dan memulai dari awal?")) {
      resetForm();
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    const success = await testAIConnection(settings);
    setConnectionStatus(success ? 'success' : 'error');
    setIsTestingConnection(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-10 px-4 sm:px-6 transition-colors duration-300">
      
      {/* Tombol Navigasi Cepat */}
      <div className="fixed top-6 right-6 flex flex-col gap-3 z-40 no-print">
        <button 
          onClick={() => setShowSettings(true)}
          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          title="Pengaturan AI"
        >
          <SettingsIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <button 
          onClick={toggleTheme}
          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          title="Ganti Tema"
        >
          {theme === 'light' ? <Moon className="w-6 h-6 text-slate-600" /> : <Sun className="w-6 h-6 text-amber-400" />}
        </button>
        <button 
          onClick={handleReset}
          className="p-3 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 rounded-full shadow-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group"
          title="Reset Form"
        >
          <RotateCcw className="w-6 h-6 text-red-400 group-hover:text-red-600" />
        </button>
      </div>

      {/* Modal Settings */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> Pengaturan AI
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-500" /> OpenRouter API Key
                </label>
                <input 
                  type="password" 
                  value={settings.apiKey}
                  onChange={(e) => {
                    setSettings({ apiKey: e.target.value });
                    setConnectionStatus('idle');
                  }}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-xl border-slate-300 dark:border-slate-700 shadow-sm p-3 border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-500" /> Model AI
                </label>
                <select 
                  value={isCustomModel ? 'custom' : settings.model}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConnectionStatus('idle');
                    if (val === 'custom') {
                      setIsCustomModel(true);
                    } else {
                      setIsCustomModel(false);
                      setSettings({ model: val });
                    }
                  }}
                  className="w-full rounded-xl border-slate-300 dark:border-slate-700 shadow-sm p-3 border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Cepat & Pintar)</option>
                  <option value="google/gemini-2.0-pro-exp-02-05:free">Gemini 2.0 Pro Exp (Gratis/Limit)</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Terbaik)</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini (Ekonomis)</option>
                  <option value="deepseek/deepseek-chat">DeepSeek V3 (Sangat Murah)</option>
                  <option value="custom">-- Kustom (Masukkan ID Manual) --</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !settings.apiKey}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTestingConnection ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  Test Koneksi
                </button>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                >
                  Simpan
                </button>
              </div>

              {connectionStatus === 'success' && (
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in">
                  Koneksi Berhasil! AI siap digunakan.
                </div>
              )}
              {connectionStatus === 'error' && (
                <div className="text-center p-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800 animate-in fade-in">
                  Koneksi Gagal. Periksa kembali API Key atau model Anda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="mb-10 text-center no-print">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-blue-600 p-2 rounded-lg shadow-md">
            <FileText className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Generator <span className="text-blue-600">RPM</span></h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">Sistem cerdas penyusun Rencana Pembelajaran Mendalam otomatis untuk guru profesional.</p>
      </header>

      <main className="w-full max-w-5xl relative">
        {/* AI Process Console */}
        {(isGenerating || isSuggestingCP || isSuggestingTP || isGenRubrik || isGenLKPD || isGenJurnal || isGenInstrumen) && (
          <div className="mb-8 bg-slate-900 dark:bg-black rounded-xl p-4 font-mono text-xs overflow-hidden border border-slate-700 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 no-print">
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
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar flex flex-col-reverse border-r border-slate-800 pr-2">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 animate-in fade-in duration-300 ${i === 0 ? 'text-blue-100 font-bold' : 'text-slate-500'}`}>
                    <span className="shrink-0">[{log.timestamp}]</span>
                    <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-black/30 rounded p-2 border border-slate-800/50 min-h-[80px] max-h-40 overflow-y-auto custom-scrollbar">
                <div className="text-emerald-500/80 leading-relaxed break-all whitespace-pre-wrap text-[10px]">
                  {streamingText || "Waiting for model stream..."}
                  <span className="inline-block w-1.5 h-3 bg-emerald-500 animate-pulse ml-0.5"></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-700 dark:text-slate-100">
              <span className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-sm text-slate-500 dark:text-slate-400">1/2</span>
              Informasi Pengajar & Satuan Pendidikan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Satuan Pendidikan</span>
                  <input type="text" name="satuanPendidikan" value={formData.satuanPendidikan} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Guru</span>
                  <input type="text" name="namaGuru" value={formData.namaGuru} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">NIP Guru</span>
                  <input type="text" name="nipGuru" value={formData.nipGuru} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <div className="flex gap-4">
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Semester</span>
                    <select name="semester" value={formData.semester} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100">
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </label>
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tahun Ajaran</span>
                    <select name="tahunAjaran" value={formData.tahunAjaran} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100">
                      {TAHUN_AJARAN_OPTIONS.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Kepala Sekolah</span>
                  <input type="text" name="namaKepalaSekolah" value={formData.namaKepalaSekolah} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">NIP Kepala Sekolah</span>
                  <input type="text" name="nipKepalaSekolah" value={formData.nipKepalaSekolah} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <div className="flex gap-4">
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenjang</span>
                    <select name="jenjang" value={formData.jenjang} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100">
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                      <option value="SMK">SMK</option>
                    </select>
                  </label>
                  <label className="block flex-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kelas</span>
                    <select name="kelas" value={formData.kelas} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100">
                      {KELAS_OPTIONS[formData.jenjang].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                </div>
                {formData.jenjang === 'SMK' && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Program Keahlian</span>
                    <select name="programKeahlian" value={formData.programKeahlian} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-500">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-700 dark:text-slate-100">
              <button type="button" onClick={() => setStep(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded mr-2"><ChevronLeft className="dark:text-slate-400" /></button>
              <span className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-sm text-slate-500 dark:text-slate-400">2/2</span>
              Detail Kurikulum & Pembelajaran
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mata Pelajaran</span>
                  <input type="text" name="mataPelajaran" value={formData.mataPelajaran} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Materi Pokok</span>
                  <input type="text" name="materi" value={formData.materi} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" placeholder="Contoh: Turunan Fungsi" />
                </label>
                <label className="block">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Capaian Pembelajaran (CP)</span>
                    <button 
                      type="button" 
                      onClick={handleSuggestCP} 
                      disabled={isSuggestingCP || isSuggestingTP} 
                      className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-md hover:bg-blue-100 font-bold text-[10px] uppercase tracking-wider transition-all"
                    >
                      {isSuggestingCP ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                      Sarankan CP
                    </button>
                  </div>
                  <textarea name="cp" value={formData.cp} onChange={handleInputChange} rows={4} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="CP akan diisi otomatis atau manual..." />
                </label>

                <label className="block">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tujuan Pembelajaran (TP)</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800 rounded-md overflow-hidden shadow-sm">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 uppercase">Jumlah</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="10" 
                          value={numTP} 
                          onChange={(e) => setNumTP(parseInt(e.target.value) || 1)}
                          className="w-10 border-l border-emerald-50 dark:border-emerald-800 p-1 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none bg-emerald-50/30 dark:bg-emerald-900/30"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleSuggestTP} 
                        disabled={isSuggestingTP || isSuggestingCP} 
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-md hover:bg-emerald-100 font-bold text-[10px] uppercase tracking-wider transition-all"
                      >
                        {isSuggestingTP ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Sarankan TP
                      </button>
                    </div>
                  </div>
                  <textarea name="tp" value={formData.tp} onChange={handleInputChange} rows={4} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" placeholder="TP akan diisi otomatis atau manual..." />
                </label>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah Pertemuan</span>
                    <input type="number" min="1" max="10" name="jumlahPertemuan" value={formData.jumlahPertemuan} onChange={(e) => updateFormData({ jumlahPertemuan: parseInt(e.target.value) || 1 })} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Durasi</span>
                    <input type="text" name="durasi" value={formData.durasi} onChange={handleInputChange} className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 shadow-sm p-2.5 border bg-white dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3">Model Pembelajaran per Pertemuan</h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {formData.pedagogiPerPertemuan.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="w-24 font-medium text-slate-600 dark:text-slate-400">Pertemuan {item.meetingNumber}</span>
                        <select 
                          value={item.pedagogy}
                          onChange={(e) => updatePedagogy(idx, e.target.value as PraktikPedagogis)}
                          className="flex-1 rounded border-slate-300 dark:border-slate-700 p-2 text-sm border bg-white dark:bg-slate-800 dark:text-slate-100"
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
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3 text-center md:text-left">Dimensi Profil Lulusan</h3>
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
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'
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
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
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
             <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-4 mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
              <button 
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" /> Edit Data
              </button>
              
              <div className="flex flex-wrap gap-2">
                {(['rubrik', 'instrumenAsesmen', 'lkpd', 'jurnal'] as const).map(type => (
                  <button 
                    key={type}
                    onClick={() => handleGenerateExtra(type)}
                    disabled={isGenRubrik || isGenLKPD || isGenJurnal || isGenInstrumen}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${generatedRPM[type] ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                  >
                    {(isGenRubrik || isGenLKPD || isGenJurnal || isGenInstrumen) ? <Loader2 className="w-4 h-4 animate-spin" /> : (generatedRPM[type] ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />)}
                    {type === 'instrumenAsesmen' ? 'Asesmen' : type.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                 <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 shadow transition-colors text-sm font-bold"
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

            <RPMTable 
              data={formData} 
              generated={generatedRPM} 
              onUpdate={(updated) => setGeneratedRPM(updated)} 
            />
            
            <div className="mt-8 text-center text-slate-500 dark:text-slate-400 text-sm no-print mb-10">
              <p>Dibuat otomatis dengan AI Ardan • {new Date().getFullYear()}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
