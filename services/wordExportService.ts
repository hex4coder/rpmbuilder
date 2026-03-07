
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType, BorderStyle, VerticalAlign, PageBreak } from "docx";
import saveAs from "file-saver";
import { RPMFormData, GeneratedRPM } from "../types";

// DOCX size is in half-points. size: 20 = 10pt.
const FONT_SIZE_CONTENT = 18; // 9pt
const FONT_SIZE_NESTED = 16;  // 8pt
const FONT_SIZE_HEADER = 20;  // 10pt
const FONT_SIZE_TITLE = 24;   // 12pt

const parseFormattedText = (text: string, fontSize: number = FONT_SIZE_CONTENT): TextRun[] => {
  if (!text) return [];
  const runs: TextRun[] = [];
  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\[\[.*?\]\])/g;
  const parts = text.split(regex);

  parts.forEach((part) => {
    if (part.startsWith('***') && part.endsWith('***')) {
      runs.push(new TextRun({ text: part.slice(3, -3), bold: true, italics: true, size: fontSize }));
    } else if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: fontSize }));
    } else if (part.startsWith('[[') && part.endsWith(']]')) {
      const label = part.slice(2, -2).toUpperCase();
      let color = "4b5563"; 
      if (label.includes("MEMAHAMI")) color = "2563eb";
      if (label.includes("MENGAPLIKASI")) color = "16a34a";
      if (label.includes("MEREFLEKSI")) color = "d97706";
      
      runs.push(new TextRun({ 
        text: ` [${label}] `, 
        bold: true, 
        size: fontSize - 2, 
        color: color,
        shading: { fill: "f3f4f6" }
      }));
    } else {
      runs.push(new TextRun({ text: part, size: fontSize }));
    }
  });
  return runs;
};

// Robust Markdown parser for Word Lampiran
const parseMarkdownForWord = (text: string): (Paragraph | Table)[] => {
  if (!text) return [];
  const elements: (Paragraph | Table)[] = [];
  const lines = text.split('\n');
  
  let currentTableRows: TableRow[] = [];

  const flushTable = () => {
    if (currentTableRows.length > 0) {
      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: currentTableRows
      }));
      elements.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      currentTableRows = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      if (trimmed.includes('---') || trimmed.match(/^[| -:]+$/)) {
        return;
      }
      
      const cells = line.split('|')
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)
        .map(c => c.trim());

      currentTableRows.push(new TableRow({
        children: cells.map((cell, idx) => new TableCell({
          children: [new Paragraph({ 
            children: parseFormattedText(cell, FONT_SIZE_NESTED), 
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 }
          })],
          borders: { 
            top: { style: BorderStyle.SINGLE, size: 1 }, 
            bottom: { style: BorderStyle.SINGLE, size: 1 }, 
            left: { style: BorderStyle.SINGLE, size: 1 }, 
            right: { style: BorderStyle.SINGLE, size: 1 } 
          },
          shading: idx === 0 || currentTableRows.length === 0 ? { fill: "f9fafb" } : undefined
        }))
      }));
    } else {
      flushTable();
      if (trimmed.startsWith('#')) {
        const content = trimmed.replace(/^#+\s*/, '');
        elements.push(new Paragraph({
          children: [new TextRun({ text: content.toUpperCase(), bold: true, size: FONT_SIZE_HEADER, color: "1e3a8a" })],
          spacing: { before: 300, after: 150 },
          border: { bottom: { color: "cccccc", space: 1, style: BorderStyle.SINGLE, size: 6 } }
        }));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(new Paragraph({
          children: [new TextRun({ text: "• ", size: FONT_SIZE_CONTENT }), ...parseFormattedText(trimmed.substring(2), FONT_SIZE_CONTENT)],
          indent: { left: 400, hanging: 200 },
          spacing: { after: 100 }
        }));
      } else if (trimmed !== '') {
        elements.push(new Paragraph({
          children: parseFormattedText(line, FONT_SIZE_CONTENT),
          alignment: AlignmentType.BOTH,
          spacing: { after: 150 }
        }));
      }
    }
  });

  flushTable();
  return elements;
};

export async function exportToWord(data: RPMFormData, generated: GeneratedRPM) {
  const createBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 1,
    color: "000000",
  });

  const fullBorder = {
    top: createBorder(),
    bottom: createBorder(),
    left: createBorder(),
    right: createBorder(),
  };

  const sectionHeaderRow = (number: number, title: string) => 
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `${number}. ${title.toUpperCase()}`, bold: true, color: "FFFFFF", size: FONT_SIZE_HEADER }),
              ],
            }),
          ],
          columnSpan: 2,
          shading: { fill: "1e3a8a" }, 
          borders: fullBorder,
          verticalAlign: VerticalAlign.CENTER,
        }),
      ],
    });

  const contentRow = (label: string, content: string | string[]) => 
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: FONT_SIZE_CONTENT })],
            }),
          ],
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: "f3f4f6" }, 
          borders: fullBorder,
          verticalAlign: VerticalAlign.TOP,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
        new TableCell({
          children: Array.isArray(content) 
            ? content.map(c => new Paragraph({ children: parseFormattedText(c), alignment: AlignmentType.BOTH, spacing: { after: 120 } }))
            : content.split('\n').map(p => new Paragraph({ children: parseFormattedText(p), alignment: AlignmentType.BOTH, spacing: { after: 120 } })),
          width: { size: 75, type: WidthType.PERCENTAGE },
          borders: fullBorder,
          verticalAlign: VerticalAlign.TOP,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
      ],
    });

  const lampiranNodes: any[] = [];
  if (generated.rubrik) {
    lampiranNodes.push(new PageBreak());
    lampiranNodes.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAMPIRAN 1: RUBRIK PENILAIAN", bold: true, size: FONT_SIZE_TITLE, color: "1e3a8a" })], spacing: { after: 400 } }));
    lampiranNodes.push(...parseMarkdownForWord(generated.rubrik));
  }
  if (generated.instrumenAsesmen) {
    lampiranNodes.push(new PageBreak());
    lampiranNodes.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAMPIRAN 2: INSTRUMEN ASESMEN", bold: true, size: FONT_SIZE_TITLE, color: "4338ca" })], spacing: { after: 400 } }));
    lampiranNodes.push(...parseMarkdownForWord(generated.instrumenAsesmen));
  }
  if (generated.lkpd) {
    lampiranNodes.push(new PageBreak());
    lampiranNodes.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAMPIRAN 3: LEMBAR KERJA PESERTA DIDIK (LKPD)", bold: true, size: FONT_SIZE_TITLE, color: "166534" })], spacing: { after: 400 } }));
    lampiranNodes.push(...parseMarkdownForWord(generated.lkpd));
  }
  if (generated.jurnal) {
    lampiranNodes.push(new PageBreak());
    lampiranNodes.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAMPIRAN 4: JURNAL REFLEKSI GURU", bold: true, size: FONT_SIZE_TITLE, color: "334155" })], spacing: { after: 400 } }));
    lampiranNodes.push(...parseMarkdownForWord(generated.jurnal));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "RENCANA PEMBELAJARAN MENDALAM (RPM)", bold: true, size: FONT_SIZE_TITLE })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.satuanPendidikan.toUpperCase(), bold: true, size: FONT_SIZE_HEADER })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tahun Pelajaran: ${data.tahunAjaran}`, italic: true, size: 16 })], spacing: { after: 400 } }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              sectionHeaderRow(1, "Identitas"),
              contentRow("Nama Satuan Pendidikan", data.satuanPendidikan),
              contentRow("Nama Guru", data.namaGuru),
              ...(data.jenjang === 'SMK' && data.programKeahlian ? [contentRow("Program Keahlian", data.programKeahlian)] : []),
              contentRow("Mata Pelajaran", data.mataPelajaran),
              contentRow("Kelas / Semester", `${data.kelas} / ${data.semester}`),
              contentRow("Durasi Pertemuan", `${data.jumlahPertemuan} Pertemuan (${data.durasi})`),

              sectionHeaderRow(2, "Identifikasi"),
              contentRow("Murid", generated.siswa),
              contentRow("Materi Pelajaran", data.materi),
              contentRow("Capaian Dimensi Lulusan", data.dimensiLulusan.join(', ')),

              sectionHeaderRow(3, "Desain Pembelajaran"),
              contentRow("Capaian Pembelajaran (CP)", data.cp),
              contentRow("Lintas Disiplin Ilmu", generated.lintasDisiplin),
              contentRow("Tujuan Pembelajaran (TP)", data.tp),
              contentRow("Topik Pembelajaran", generated.topik),
              contentRow("Pertanyaan Pemantik", generated.pertanyaanPemantik),

              sectionHeaderRow(4, "Pengalaman Belajar"),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Langkah Pembelajaran", bold: true, size: FONT_SIZE_CONTENT })] })],
                    shading: { fill: "f3f4f6" },
                    borders: fullBorder,
                    verticalAlign: VerticalAlign.TOP,
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  }),
                  new TableCell({
                    children: generated.pengalamanBelajar.flatMap(item => [
                      new Paragraph({
                        children: [new TextRun({ text: `Pertemuan ${item.pertemuan} (${data.pedagogiPerPertemuan.find(met => met.meetingNumber === item.pertemuan)?.pedagogy})`, bold: true, color: "1e40af", underline: {}, size: FONT_SIZE_CONTENT })],
                        spacing: { before: 200, after: 100 }
                      }),
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tahapan", bold: true, size: FONT_SIZE_NESTED })], alignment: AlignmentType.CENTER })], shading: { fill: "e5e7eb" }, borders: fullBorder }),
                              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Detail Kegiatan", bold: true, size: FONT_SIZE_NESTED })], alignment: AlignmentType.CENTER })], shading: { fill: "e5e7eb" }, borders: fullBorder })
                            ]
                          }),
                          new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pendahuluan", bold: true, size: FONT_SIZE_NESTED })], alignment: AlignmentType.CENTER })], borders: fullBorder }),
                              new TableCell({ children: item.pendahuluan.split('\n').map(l => new Paragraph({ children: parseFormattedText(l, FONT_SIZE_NESTED), alignment: AlignmentType.BOTH })), borders: fullBorder })
                            ]
                          }),
                          new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kegiatan Inti", bold: true, size: FONT_SIZE_NESTED })], alignment: AlignmentType.CENTER })], borders: fullBorder }),
                              new TableCell({ children: item.inti.split('\n').map(l => new Paragraph({ children: parseFormattedText(l, FONT_SIZE_NESTED), alignment: AlignmentType.BOTH })), borders: fullBorder })
                            ]
                          }),
                          new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Penutup", bold: true, size: FONT_SIZE_NESTED })], alignment: AlignmentType.CENTER })], borders: fullBorder }),
                              new TableCell({ children: item.penutup.split('\n').map(l => new Paragraph({ children: parseFormattedText(l, FONT_SIZE_NESTED), alignment: AlignmentType.BOTH })), borders: fullBorder })
                            ]
                          }),
                        ]
                      })
                    ]),
                    borders: fullBorder,
                    verticalAlign: VerticalAlign.TOP,
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  })
                ]
              }),

              sectionHeaderRow(5, "Asesmen Pembelajaran"),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Metode Asesmen", bold: true, size: FONT_SIZE_CONTENT })] })],
                    shading: { fill: "f3f4f6" },
                    borders: fullBorder,
                    verticalAlign: VerticalAlign.TOP,
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Diagnostik: ", bold: true, size: FONT_SIZE_CONTENT }), new TextRun({ text: generated.asesmen.diagnostik, size: FONT_SIZE_CONTENT })], spacing: { after: 100 } }),
                      new Paragraph({ children: [new TextRun({ text: "Formatif: ", bold: true, size: FONT_SIZE_CONTENT }), new TextRun({ text: generated.asesmen.formatif, size: FONT_SIZE_CONTENT })], spacing: { after: 100 } }),
                      new Paragraph({ children: [new TextRun({ text: "Sumatif: ", bold: true, size: FONT_SIZE_CONTENT }), new TextRun({ text: generated.asesmen.sumatif, size: FONT_SIZE_CONTENT })], spacing: { after: 100 } }),
                    ],
                    borders: fullBorder,
                    verticalAlign: VerticalAlign.TOP,
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  })
                ]
              })
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 800 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui,", size: FONT_SIZE_CONTENT })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Kepala Sekolah", size: FONT_SIZE_CONTENT })] }),
                      new Paragraph({ children: [new TextRun("")], spacing: { before: 1200 } }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.namaKepalaSekolah.toUpperCase(), bold: true, underline: {}, size: FONT_SIZE_CONTENT })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${data.nipKepalaSekolah}`, size: FONT_SIZE_CONTENT })] }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Dibuat Oleh,", size: FONT_SIZE_CONTENT })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Guru Mata Pelajaran", size: FONT_SIZE_CONTENT })] }),
                      new Paragraph({ children: [new TextRun("")], spacing: { before: 1200 } }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.namaGuru.toUpperCase(), bold: true, underline: {}, size: FONT_SIZE_CONTENT })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${data.nipGuru}`, size: FONT_SIZE_CONTENT })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          
          ...lampiranNodes
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `RPM_${data.mataPelajaran}_${data.materi.replace(/\s+/g, '_')}.docx`);
}
