
import OpenAI from "openai";
import { RPMFormData, GeneratedRPM, AppSettings, LogEntry } from "../types";
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

  const prompt = `
    Hasilkan konten RPM (Rencana Pembelajaran Mendalam) dalam format JSON sesuai spesifikasi berikut:
    
    Data Konteks:
    Sekolah: ${formData.satuanPendidikan}
    Jenjang/Kelas: ${formData.jenjang} / ${formData.kelas}
    ${formData.jenjang === 'SMK' ? `Program Keahlian: ${formData.programKeahlian}` : ''}
    Mata Pelajaran: ${formData.mataPelajaran}
    Materi: ${formData.materi}
    Capaian Pembelajaran (CP): ${formData.cp}
    Tujuan Pembelajaran (TP): ${formData.tp}
    
    BATASAN JUMLAH PERTEMUAN (SANGAT PENTING):
    JUMLAH PERTEMUAN HARUS TEPAT: ${formData.jumlahPertemuan} PERTEMUAN.
    Durasi Total: ${formData.durasi}
    
    MODEL PEMBELAJARAN PER PERTEMUAN:
    ${formData.pedagogiPerPertemuan.map(p => `- Pertemuan ${p.meetingNumber}: ${p.pedagogy}`).join('\n')}
    
    DIMENSI PROFIL LULUSAN:
    ${formData.dimensiLulusan.join(', ')}

    INSTRUKSI OUTPUT:
    1. Properti "pengalamanBelajar" HARUS berisi ARRAY dengan TEPAT ${formData.jumlahPertemuan} OBJEK.
    2. Setiap objek dalam "pengalamanBelajar" harus memiliki detail Aktivitas Murid (Pendahuluan, Inti, Penutup) sesuai Model Pembelajaran yang diminta di atas.
    3. Gunakan kata 'Murid' untuk merujuk pada peserta didik.
    4. Output HARUS JSON MURNI.
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
    
    onLog?.({ timestamp: getTimestamp(), message: "Data diterima, memvalidasi sinkronisasi pertemuan...", type: 'info' });
    const parsed = JSON.parse(fullContent) as GeneratedRPM;
    
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
