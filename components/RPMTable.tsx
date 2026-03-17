import React, { useState } from 'react';
import { RPMFormData, GeneratedRPM } from '../types';
import { Edit3, Check } from 'lucide-react';

interface RPMTableProps {
  data: RPMFormData;
  generated: GeneratedRPM;
  onUpdate?: (updated: GeneratedRPM) => void;
}

const SectionHeader: React.FC<{ title: string; number: number }> = ({ title, number }) => (
  <tr className="bg-blue-900 dark:bg-blue-950 text-white font-bold">
    <td colSpan={2} className="p-2 uppercase text-center border border-gray-400 dark:border-slate-700 text-xs tracking-wider">
      {number}. {title}
    </td>
  </tr>
);

const Row: React.FC<{ label: string; content: React.ReactNode }> = ({ label, content }) => (
  <tr className="border border-gray-400 dark:border-slate-700">
    <td className="p-2 font-semibold bg-gray-50 dark:bg-slate-900/50 dark:text-slate-300 border-r border-gray-400 dark:border-slate-700 w-1/4 align-top text-xs">
      {label}
    </td>
    <td className="p-2 text-justify whitespace-pre-wrap text-xs leading-relaxed dark:text-slate-300">
      {content}
    </td>
  </tr>
);

const EditableCell: React.FC<{ 
  value: any; 
  isEditing: boolean; 
  onChange: (val: string) => void;
  rich?: boolean;
}> = ({ value, isEditing, onChange, rich = true }) => {
  const safeValue = typeof value === 'string' ? value : String(value || '');
  
  if (isEditing) {
    return (
      <textarea
        value={safeValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-blue-300 dark:border-blue-800 rounded bg-blue-50/50 dark:bg-blue-950/30 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-[11px] leading-relaxed min-h-[80px]"
        rows={Math.max(3, safeValue.split('\n').length)}
      />
    );
  }
  return rich ? <>{formatRichText(safeValue)}</> : <>{safeValue}</>;
};

const formatRichText = (text: any) => {
  if (!text || typeof text !== 'string') return "";
  
  // Highlight "Diferensiasi:" (Fitur 3)
  const differentiatedText = text.replace(/(Diferensiasi:)/gi, "**$1**");

  const parts = differentiatedText.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\[\[.*?\]\]|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('***') && part.endsWith('***')) {
      return <strong key={i}><em className="font-bold italic">{part.slice(3, -3)}</em></strong>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-blue-700 dark:text-blue-400">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded font-mono text-[10px] border border-slate-200 dark:border-slate-700">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 transition-colors font-medium">
            {match[1]}
          </a>
        );
      }
    }
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const label = part.slice(2, -2);
      let colorClass = "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
      if (label.toLowerCase().includes("memahami")) colorClass = "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      if (label.toLowerCase().includes("mengaplikasi")) colorClass = "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
      if (label.toLowerCase().includes("merefleksi")) colorClass = "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      return <span key={i} className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mx-0.5 border align-middle uppercase ${colorClass}`}>{label}</span>;
    }
    return part;
  });
};

const renderMarkdown = (text: any) => {
  if (!text || typeof text !== 'string') return null;
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let codeBlock: string[] = [];
  let isCodeBlock = false;

  const flushTable = (key: number) => {
    if (tableRows.length === 0) return;
    const filteredRows = tableRows.filter(row => !row.every(cell => cell.match(/^[-:| ]+$/)));
    if (filteredRows.length > 0) {
      result.push(
        <div key={`table-wrapper-${key}`} className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-gray-400 dark:border-slate-700 text-[10px]">
            <thead>
              <tr className="bg-gray-100 dark:bg-slate-800">
                {filteredRows[0].map((cell, i) => (
                  <th key={i} className="border border-gray-400 dark:border-slate-700 p-2 text-center font-bold dark:text-slate-200">{formatRichText(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(1).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  {row.map((cell, j) => (
                    <td key={j} className="border border-gray-400 dark:border-slate-700 p-2 dark:text-slate-300">{formatRichText(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableRows = [];
  };

  const flushCodeBlock = (key: number) => {
    if (codeBlock.length === 0) return;
    result.push(
      <pre key={`code-block-${key}`} className="bg-slate-900 text-slate-100 p-4 rounded-lg my-4 overflow-x-auto font-mono text-[10px] leading-relaxed border border-slate-700">
        <code>{codeBlock.join('\n')}</code>
      </pre>
    );
    codeBlock = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (isCodeBlock) { flushCodeBlock(idx); isCodeBlock = false; }
      else { isCodeBlock = true; }
      return;
    }
    if (isCodeBlock) { codeBlock.push(line); return; }
    if (trimmed.startsWith('|')) {
      const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
      tableRows.push(cells);
    } else {
      flushTable(idx);
      if (trimmed.startsWith('#')) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const content = trimmed.replace(/^#+\s*/, '');
        const sizes = ["text-base", "text-sm", "text-xs", "text-[10px]"];
        result.push(<h4 key={idx} className={`font-bold mt-5 mb-2 uppercase border-b border-gray-300 dark:border-slate-700 pb-1 text-blue-900 dark:text-blue-400 ${sizes[level-1] || 'text-xs'}`}>{formatRichText(content)}</h4>);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        result.push(<li key={idx} className="ml-5 list-disc mb-1 dark:text-slate-300">{formatRichText(trimmed.substring(2))}</li>);
      } else if (trimmed !== '') {
        result.push(<p key={idx} className="mb-3 leading-relaxed dark:text-slate-300">{formatRichText(line)}</p>);
      }
    }
  });
  flushTable(lines.length);
  flushCodeBlock(lines.length);
  return <div className="markdown-render space-y-1">{result}</div>;
};

export const RPMTable: React.FC<RPMTableProps> = ({ data, generated, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleFieldChange = (field: keyof GeneratedRPM, value: any) => {
    if (onUpdate) onUpdate({ ...generated, [field]: value });
  };

  const handleMeetingChange = (index: number, field: string, value: string) => {
    if (onUpdate) {
      const newMeetings = [...generated.pengalamanBelajar];
      newMeetings[index] = { ...newMeetings[index], [field]: value };
      onUpdate({ ...generated, pengalamanBelajar: newMeetings });
    }
  };

  const handleAsesmenChange = (field: string, value: string) => {
    if (onUpdate) onUpdate({ ...generated, asesmen: { ...generated.asesmen, [field]: value } });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 shadow-2xl rounded-lg mx-auto max-w-5xl rpm-container overflow-hidden text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 relative transition-colors duration-300">
      <div className="absolute top-8 right-8 no-print flex items-center gap-2">
        {isEditing && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 animate-pulse">Mode Edit Aktif</span>}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm border ${isEditing ? 'bg-green-600 text-white border-green-700' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-slate-700'}`}
        >
          {isEditing ? <><Check className="w-3.5 h-3.5" /> Selesai</> : <><Edit3 className="w-3.5 h-3.5" /> Edit Hasil AI</>}
        </button>
      </div>

      <div className="text-center mb-8 border-b-4 border-double border-black dark:border-slate-700 pb-4">
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-1 dark:text-white">Rencana Pembelajaran Mendalam (RPM)</h1>
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-400">{data.satuanPendidikan}</h2>
        <p className="text-sm font-medium italic text-gray-500 dark:text-slate-400 mt-1">Tahun Pelajaran: {data.tahunAjaran}</p>
      </div>

      <table className="w-full border-collapse border-2 border-gray-600 dark:border-slate-700 text-xs mb-8">
        <tbody>
          <SectionHeader number={1} title="Identitas" />
          <Row label="Nama Satuan Pendidikan" content={data.satuanPendidikan} />
          <Row label="Nama Guru" content={data.namaGuru} />
          {data.jenjang === 'SMK' && data.programKeahlian && <Row label="Program Keahlian" content={data.programKeahlian} />}
          <Row label="Mata Pelajaran" content={data.mataPelajaran} />
          <Row label="Kelas / Semester" content={`${data.kelas} / ${data.semester}`} />
          <Row label="Durasi Pertemuan" content={`${data.jumlahPertemuan} Pertemuan (${data.durasi})`} />

          <SectionHeader number={2} title="Identifikasi" />
          <Row label="Murid" content={<EditableCell value={generated.siswa} isEditing={isEditing} onChange={(v) => handleFieldChange('siswa', v)} />} />
          <Row label="Materi Pelajaran" content={data.materi} />
          <Row label="Capaian Dimensi Lulusan" content={data.dimensiLulusan.join(', ')} />

          <SectionHeader number={3} title="Desain Pembelajaran" />
          <Row label="Capaian Pembelajaran (CP)" content={data.cp} />
          <Row label="Lintas Disiplin Ilmu" content={<EditableCell value={generated.lintasDisiplin} isEditing={isEditing} onChange={(v) => handleFieldChange('lintasDisiplin', v)} />} />
          <Row label="Tujuan Pembelajaran (TP)" content={data.tp} />
          <Row label="Topik Pembelajaran" content={<EditableCell value={generated.topik} isEditing={isEditing} onChange={(v) => handleFieldChange('topik', v)} />} />
          <Row label="Pertanyaan Pemantik" content={<EditableCell value={generated.pertanyaanPemantik} isEditing={isEditing} onChange={(v) => handleFieldChange('pertanyaanPemantik', v)} />} />

          <SectionHeader number={4} title="Pengalaman Belajar" />
          <Row 
            label="Langkah Pembelajaran" 
            content={
              <div className="space-y-8">
                {generated.pengalamanBelajar.map((item, idx) => (
                  <div key={item.pertemuan} className="border-b-2 border-dashed border-slate-300 dark:border-slate-700 pb-6 last:border-0">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded text-[10px] uppercase">Pertemuan {item.pertemuan}</span>
                       <span className="text-blue-900 dark:text-blue-400 font-bold text-[10px] uppercase">{data.pedagogiPerPertemuan.find(p => p.meetingNumber === item.pertemuan)?.pedagogy}</span>
                    </div>
                    <table className="w-full border-collapse border border-gray-500 dark:border-slate-700 text-[10px] leading-relaxed">
                      <thead>
                        <tr className="bg-slate-200 dark:bg-slate-800">
                          <th className="border border-gray-500 dark:border-slate-700 p-2 w-[120px] text-center uppercase font-black dark:text-slate-200">Tahapan</th>
                          <th className="border border-gray-500 dark:border-slate-700 p-2 text-center uppercase font-black dark:text-slate-200">Detail Aktivitas Murid</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-500 dark:border-slate-700 p-2 font-bold text-center bg-gray-50 dark:bg-slate-900 align-middle">Pendahuluan</td>
                          <td className="border border-gray-500 dark:border-slate-700 p-2 text-justify"><EditableCell value={item.pendahuluan} isEditing={isEditing} onChange={(v) => handleMeetingChange(idx, 'pendahuluan', v)} /></td>
                        </tr>
                        <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                          <td className="border border-gray-500 dark:border-slate-700 p-2 font-bold text-center bg-blue-50 dark:bg-blue-900/20 align-middle">Kegiatan Inti</td>
                          <td className="border border-gray-500 dark:border-slate-700 p-2 text-justify"><EditableCell value={item.inti} isEditing={isEditing} onChange={(v) => handleMeetingChange(idx, 'inti', v)} /></td>
                        </tr>
                        <tr>
                          <td className="border border-gray-500 dark:border-slate-700 p-2 font-bold text-center bg-gray-50 dark:bg-slate-900 align-middle">Penutup</td>
                          <td className="border border-gray-500 dark:border-slate-700 p-2 text-justify"><EditableCell value={item.penutup} isEditing={isEditing} onChange={(v) => handleMeetingChange(idx, 'penutup', v)} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            } 
          />

          <SectionHeader number={5} title="Asesmen Pembelajaran" />
          <Row 
            label="Metode Asesmen" 
            content={
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(generated.asesmen).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                    <div className="font-black text-[10px] text-blue-900 dark:text-blue-400 uppercase mb-1">{key}</div>
                    <div className="text-[11px]"><EditableCell value={val} isEditing={isEditing} onChange={(v) => handleAsesmenChange(key, v)} rich={false} /></div>
                  </div>
                ))}
              </div>
            } 
          />
        </tbody>
      </table>

      {(generated.rubrik || generated.lkpd || generated.jurnal || generated.instrumenAsesmen) && (
        <div className="mt-12 border-t-4 border-double border-gray-500 dark:border-slate-700 pt-10">
          <h3 className="text-center font-black text-xl mb-10 uppercase tracking-widest decoration-blue-600 dark:decoration-blue-400 underline underline-offset-8">Lampiran Dokumen</h3>
          {[
            { id: 'rubrik', label: 'Rubrik Penilaian Mendalam', color: 'bg-blue-900 dark:bg-blue-950' },
            { id: 'lkpd', label: 'Lembar Kerja Murid (LKM/LKPD)', color: 'bg-green-800 dark:bg-green-950' },
            { id: 'jurnal', label: 'Jurnal Refleksi Guru', color: 'bg-slate-800 dark:bg-slate-950' },
            { id: 'instrumenAsesmen', label: 'Instrumen Asesmen (Saran Soal & Tugas)', color: 'bg-indigo-700 dark:bg-indigo-950' }
          ].map((lampiran, index) => {
            const content = generated[lampiran.id as keyof GeneratedRPM] as string;
            if (!content) return null;
            return (
              <div key={lampiran.id} className="mb-16 page-break-before">
                <div className={`${lampiran.color} text-white py-2 px-4 font-black uppercase text-xs inline-block mb-4 rounded-r-lg shadow-sm no-print`}>
                  Lampiran {index + 1}: {lampiran.label}
                </div>
                <div className="text-xs border-2 border-gray-200 dark:border-slate-700 p-6 rounded-xl bg-white dark:bg-slate-900/50 shadow-inner">
                  <EditableCell value={content} isEditing={isEditing} onChange={(v) => handleFieldChange(lampiran.id as keyof GeneratedRPM, v)} rich={!isEditing} />
                  {!isEditing && renderMarkdown(content)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-20 flex justify-between px-10 text-xs">
        <div className="text-center w-64">
          <p className="mb-20 dark:text-slate-400">Mengetahui,<br/><span className="font-bold text-slate-900 dark:text-slate-200">Kepala Sekolah</span></p>
          <p className="font-black underline uppercase text-sm dark:text-white">{data.namaKepalaSekolah}</p>
          <p className="font-medium text-gray-600 dark:text-slate-400">NIP. {data.nipKepalaSekolah}</p>
        </div>
        <div className="text-center w-64">
          <p className="mb-20 dark:text-slate-400">Dibuat Oleh,<br/><span className="font-bold text-slate-900 dark:text-slate-200">Guru Mata Pelajaran</span></p>
          <p className="font-black underline uppercase text-sm dark:text-white">{data.namaGuru}</p>
          <p className="font-medium text-gray-600 dark:text-slate-400">NIP. {data.nipGuru}</p>
        </div>
      </div>
    </div>
  );
};
