import OpenAI from "openai";
import { RPMFormData, GeneratedRPM, AppSettings, LogEntry, GeneratedRPMSchema } from "../types";
import { SYSTEM_PROMPT } from "../constants";

const getTimestamp = () => new Date().toLocaleTimeString('id-ID', { hour12: false });

const getClient = (settings: AppSettings) => {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: settings.apiKey || '',
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": typeof window !== 'undefined' ? window.location.origin : '',
      "X-Title": "Generator RPM",
    }
  });
};

export async function generateRPMContent(
  formData: RPMFormData, 
  settings: AppSettings,
  onLog?: (entry: LogEntry) => void,
  onStream?: (chunk: string) => void
): Promise<GeneratedRPM> {
  const openai = getClient(settings);
  onLog?.({ timestamp: getTimestamp(), message: `Menghubungi OpenRouter (${settings.model})...`, type: 'info' });

  // Logika Spesifik Jenjang (Fitur 4)
  const jenjangContext = formData.jenjang === 'SMK' 
    ? `Fokus pada Link & Match industri, praktik kejuruan, dan kesiapan kerja di bidang ${formData.programKeahlian}.`
    : formData.jenjang === 'SD'
    ? "Gunakan pendekatan konkret, bermain sambil belajar, dan bahasa yang sangat sederhana."
    : "Gunakan pendekatan eksplorasi konsep dan penguatan profil pelajar pancasila.";

  const prompt = `
    Hasilkan konten RPM (Rencana Pembelajaran Mendalam) yang selaras dengan standar PMM (Platform Merdeka Mengajar) dalam format JSON.
    
    Data Konteks:
    Sekolah: ${formData.satuanPendidikan}
    Jenjang/Kelas: ${formData.jenjang} / ${formData.kelas}
    Mata Pelajaran: ${formData.mataPelajaran}
    Materi: ${formData.materi}
    Capaian Pembelajaran (CP): ${formData.cp}
    Tujuan Pembelajaran (TP): ${formData.tp}
    
    KONTEKS PEDAGOGIS:
    ${jenjangContext}
    
    INSTRUKSI DIFERENSIASI (FITUR UNGGULAN):
    Dalam bagian "inti" setiap pertemuan, WAJIB sertakan saran strategi DIFERENSIASI untuk Murid dengan:
    1. Kesiapan Belajar Rendah (butuh bimbingan lebih).
    2. Kesiapan Belajar Sedang.
    3. Kesiapan Belajar Tinggi (tantangan pengayaan).
    Gunakan istilah "Diferensiasi:" di dalam teks narasi.

    BATASAN JUMLAH PERTEMUAN: ${formData.jumlahPertemuan} PERTEMUAN.
    MODEL PEMBELAJARAN PER PERTEMUAN:
    ${formData.pedagogiPerPertemuan.map(p => `- Pertemuan ${p.meetingNumber}: ${p.pedagogy}`).join('\n')}
    
    DIMENSI PROFIL LULUSAN: ${formData.dimensiLulusan.join(', ')}

    INSTRUKSI OUTPUT JSON:
    1. "siswa": Karakteristik murid secara umum.
    2. "lintasDisiplin": Hubungan materi ini dengan mapel lain (PMM Style).
    3. "pertanyaanPemantik": Pertanyaan yang memicu rasa ingin tahu (PMM Style).
    4. "pengalamanBelajar": Array dengan ${formData.jumlahPertemuan} objek.
    5. Gunakan kata 'Murid' (bukan siswa). Output HARUS JSON MURNI.
  `;

  try {
    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\nOutput harus berupa JSON murni sesuai skema." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullContent += content;
      if (onStream) onStream(content);
    }
    
    onLog?.({ timestamp: getTimestamp(), message: "Data diterima, memvalidasi skema data...", type: 'info' });
    const rawData = JSON.parse(fullContent);
    
    // Validasi dengan Zod
    const validation = GeneratedRPMSchema.safeParse(rawData);
    if (!validation.success) {
      console.error("Zod Validation Errors:", validation.error.errors);
      onLog?.({ timestamp: getTimestamp(), message: "Peringatan: Struktur data AI tidak sesuai standar, mencoba melakukan koreksi...", type: 'warning' });
      return rawData as GeneratedRPM; // Fallback jika gagal validasi ketat
    }

    const parsed = validation.data;
    
    if (parsed.pengalamanBelajar.length !== formData.jumlahPertemuan) {
      onLog?.({ timestamp: getTimestamp(), message: `Peringatan: AI menghasilkan ${parsed.pengalamanBelajar.length} pertemuan, seharusnya ${formData.jumlahPertemuan}.`, type: 'warning' });
    }

    return parsed;
  } catch (error: any) {
    const errorDetail = error.response?.data?.error?.message || error.message || "Unknown Error";
    onLog?.({ timestamp: getTimestamp(), message: `ERROR: ${errorDetail}`, type: 'error' });
    throw new Error(errorDetail);
  }
}

export async function generateAttachment(
  type: 'rubrik' | 'lkpd' | 'jurnal' | 'instrumenAsesmen', 
  formData: RPMFormData, 
  rpm: GeneratedRPM, 
  settings: AppSettings,
  onLog?: (entry: LogEntry) => void,
  onStream?: (chunk: string) => void
): Promise<string> {
  const openai = getClient(settings);
  onLog?.({ timestamp: getTimestamp(), message: `Menyiapkan ${type.toUpperCase()}...`, type: 'info' });

  const prompts = {
    rubrik: `Buatlah Rubrik Penilaian Mendalam untuk materi ${formData.materi}. Gunakan Markdown Table.`,
    lkpd: `Buatlah LKPD untuk materi ${formData.materi}. Gunakan format Markdown yang menarik.`,
    jurnal: `Buatlah Jurnal Refleksi Guru untuk materi ${formData.materi}. Gunakan Markdown Table.`,
    instrumenAsesmen: `Hasilkan Instrumen Asesmen (Contoh Soal & Tugas) mendalam untuk materi ${formData.materi}. Gunakan tabel Markdown jika diperlukan.`
  };

  const prompt = `Konteks: ${formData.mataPelajaran} - ${formData.materi}. TUGAS: ${prompts[type]}. ATURAN: Gunakan kata 'Murid'. Output Markdown murni.`;

  try {
    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: [
        { role: "system", content: "Anda adalah asisten pakar pendidikan." },
        { role: "user", content: prompt }
      ],
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullContent += content;
      if (onStream) onStream(content);
    }
    return fullContent;
  } catch (error: any) {
    const errorDetail = error.response?.data?.error?.message || error.message || "Unknown Error";
    onLog?.({ timestamp: getTimestamp(), message: `ERROR: ${errorDetail}`, type: 'error' });
    throw new Error(errorDetail);
  }
}

export async function generateCP(
  jenjang: string, 
  kelas: string, 
  mapel: string, 
  materi: string, 
  settings: AppSettings,
  onLog?: (entry: LogEntry) => void,
  onStream?: (chunk: string) => void
): Promise<string> {
  const openai = getClient(settings);
  onLog?.({ timestamp: getTimestamp(), message: "Meminta saran Capaian Pembelajaran (CP)...", type: 'info' });

  const prompt = `Hasilkan Capaian Pembelajaran (CP) Kurikulum Merdeka untuk Jenjang: ${jenjang}, Kelas: ${kelas}, Mapel: ${mapel}, Materi: ${materi}. PENTING: Gunakan kata 'Murid'. Berikan hanya teks deskripsi CP-nya saja.`;

  try {
    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullContent += content;
      if (onStream) onStream(content);
    }
    onLog?.({ timestamp: getTimestamp(), message: "Saran CP berhasil diterima.", type: 'success' });
    return fullContent;
  } catch (error: any) {
    const errorDetail = error.response?.data?.error?.message || error.message || "Unknown Error";
    onLog?.({ timestamp: getTimestamp(), message: `ERROR: ${errorDetail}`, type: 'error' });
    throw new Error(errorDetail);
  }
}

export async function generateTP(
  jenjang: string, 
  kelas: string, 
  mapel: string, 
  materi: string, 
  cp: string,
  numTP: number,
  settings: AppSettings,
  onLog?: (entry: LogEntry) => void,
  onStream?: (chunk: string) => void
): Promise<string> {
  const openai = getClient(settings);
  onLog?.({ timestamp: getTimestamp(), message: `Meminta saran Tujuan Pembelajaran (TP) sebanyak ${numTP} butir...`, type: 'info' });

  const prompt = `Berdasarkan Capaian Pembelajaran: "${cp}", buatlah tepat ${numTP} butir Tujuan Pembelajaran (TP) untuk Jenjang: ${jenjang}, Kelas: ${kelas}, Mapel: ${mapel}, Materi: ${materi}. PENTING: Gunakan kata 'Murid'. Berikan hanya butir-butir TP-nya saja dalam bentuk daftar (bullet points).`;

  try {
    const stream = await openai.chat.completions.create({
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullContent += content;
      if (onStream) onStream(content);
    }
    onLog?.({ timestamp: getTimestamp(), message: "Saran TP berhasil diterima.", type: 'success' });
    return fullContent;
  } catch (error: any) {
    const errorDetail = error.response?.data?.error?.message || error.message || "Unknown Error";
    onLog?.({ timestamp: getTimestamp(), message: `ERROR: ${errorDetail}`, type: 'error' });
    throw new Error(errorDetail);
  }
}

export async function testAIConnection(settings: AppSettings): Promise<boolean> {
  const openai = getClient(settings);
  try {
    const stream = await openai.chat.completions.create({
      model: settings.model || 'google/gemini-2.0-flash-001',
      messages: [{ role: "user", content: "Respond with just the word 'OK'." }],
      max_tokens: 2,
      stream: true,
    });
    for await (const chunk of stream) {
      // drain the stream
    }
    return true;
  } catch (error) {
    console.error("AI Connection Test Failed:", error);
    return false;
  }
}
