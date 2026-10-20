import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PLANETS } from "./constants";
import type { Reading } from "@workspace/api-client-react";
import dosisRegularUrl from "@/assets/fonts/dosis-regular.ttf?url";
import dosisSemiboldUrl from "@/assets/fonts/dosis-semibold.ttf?url";

const GOLD = [180, 140, 60] as const;
const DARK = [35, 72, 82] as const;
const CREAM = [248, 246, 239] as const;
const MUTED = [105, 111, 108] as const;
const TEXT = [35, 48, 50] as const;
const WHITE = [255, 255, 255] as const;

function formatBirthDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function stripMarkdown(md: string): string {
  return md
    .replace(/\n*\*\*💬 O Poder do Verbo\*\*[\s\S]*?(?=\n+\*\*🪞 Reflexão\*\*|\n+#{1,6}\s|$)/g, "")
    .replace(/\n*\*\*💛 Conselho de Ouro\*\*[\s\S]*?(?=\n+#{1,6}\s|$)/g, "")
    .replace(/#{1,6}\s+(.+)/g, (_, t) => `\n${t.toUpperCase()}\n`)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, (m) => m)
    .replace(/^>\s+/gm, "  ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar a fonte Dosis (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function parseMarkdownSections(md: string): { heading: string | null; body: string }[] {
  const sections: { heading: string | null; body: string }[] = [];
  const lines = md.split("\n");
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)/);
    if (headingMatch) {
      if (currentBody.join("").trim() || currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
      }
      currentHeading = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentBody.join("").trim() || currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
  }
  return sections;
}

export async function exportReadingPDF(reading: Reading): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const [dosisRegular, dosisSemibold] = await Promise.all([
    fontAsBase64(dosisRegularUrl),
    fontAsBase64(dosisSemiboldUrl),
  ]);
  doc.addFileToVFS("Dosis-Regular.ttf", dosisRegular);
  doc.addFont("Dosis-Regular.ttf", "Dosis", "normal");
  doc.addFileToVFS("Dosis-Semibold.ttf", dosisSemibold);
  doc.addFont("Dosis-Semibold.ttf", "Dosis", "bold");
  const PDF_FONT = "Dosis";
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = W - margin * 2;

  function addPageBackground() {
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, W, H, "F");
  }

  function drawWordmark(x: number, y: number, large = false) {
    doc.setFont("times", "normal");
    doc.setFontSize(large ? 19 : 14);
    doc.setTextColor(18, 35, 37);
    doc.text("Assence", x, y);

    const wordmarkWidth = large ? 31 : 24;
    doc.setDrawColor(190, 174, 135);
    doc.setLineWidth(0.2);
    doc.line(x, y + 2, x + wordmarkWidth, y + 2);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text("ASTROLOGIA PARA A VIDA", x + wordmarkWidth / 2, y + 6, { align: "center" });
  }

  function drawCoverArtwork() {
    const centerX = W * 0.68;
    const centerY = H * 0.65;

    doc.setFillColor(235, 238, 229);
    doc.ellipse(W + 12, H + 8, 110, 100, "F");
    doc.setFillColor(226, 235, 231);
    doc.ellipse(W + 10, H + 1, 85, 78, "F");
    doc.setFillColor(216, 230, 231);
    doc.ellipse(W + 7, H - 5, 60, 56, "F");

    doc.setDrawColor(213, 193, 145);
    doc.setLineWidth(0.35);
    doc.ellipse(centerX, centerY, 78, 29, "S");
    doc.ellipse(centerX, centerY, 88, 38, "S");
    doc.ellipse(centerX, centerY, 98, 47, "S");

    doc.setFillColor(108, 157, 165);
    doc.circle(centerX, centerY, 39, "F");
    doc.setFillColor(125, 174, 179);
    doc.circle(centerX - 8, centerY - 8, 31, "F");
    doc.setFillColor(99, 150, 160);
    doc.circle(centerX + 7, centerY + 6, 31, "F");

    doc.setFillColor(226, 201, 145);
    doc.circle(centerX - 87, centerY + 10, 1.2, "F");
    doc.circle(centerX + 72, centerY - 29, 1, "F");
    doc.circle(centerX + 44, centerY + 41, 0.9, "F");
    doc.circle(centerX - 25, centerY + 48, 0.8, "F");
    doc.setFillColor(255, 255, 255);
    doc.circle(centerX + 39, centerY - 44, 1.4, "F");
  }

  function addFooter(pageNum: number, totalPages: number) {
    doc.setFillColor(...GOLD);
    doc.rect(0, H - 10, W, 10, "F");
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.text("Assence — Inteligência Astrológica", margin, H - 3.5);
    doc.text(`Página ${pageNum} de ${totalPages}`, W - margin, H - 3.5, { align: "right" });
  }

  // ─── Cover page ────────────────────────────────────────────────────────────
  addPageBackground();
  drawWordmark(margin, 25, true);

  doc.setFont("times", "normal");
  doc.setFontSize(27);
  doc.setTextColor(...DARK);
  doc.text("Análise Astrológica", margin, 76);
  doc.setFontSize(23);
  doc.text("Mapa Natal", margin, 89);
  drawCoverArtwork();

  // Key planet cards
  const chart = reading.birthChart;

  // ─── Birth chart overview ──────────────────────────────────────────────────
  doc.addPage();
  addPageBackground();
  drawWordmark(margin, 17);

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...TEXT);
  doc.text(reading.clientName, margin, 36);

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const subtitleParts: string[] = [formatBirthDate(reading.birthDate)];
  if (reading.birthTime) subtitleParts.push(reading.birthTime);
  if (reading.birthPlace) subtitleParts.push(reading.birthPlace);
  doc.text(subtitleParts.join("  •  "), margin, 42);

  const keyCards = [
    { label: "ASCENDENTE", value: chart.ascendant ?? "—" },
    { label: "MEIO-DO-CÉU", value: chart.midheaven ?? "—" },
    { label: "SOL", value: `${chart.sun?.sign ?? "—"} • Casa ${chart.sun?.house ?? "—"}` },
    { label: "LUA", value: `${chart.moon?.sign ?? "—"} • Casa ${chart.moon?.house ?? "—"}` },
  ];
  const cardW = (contentW - 9) / 4;
  keyCards.forEach((card, i) => {
    const x = margin + i * (cardW + 3);
    const y = 50;
    doc.setFillColor(...WHITE);
    doc.roundedRect(x, y, cardW, 20, 1.5, 1.5, "F");
    doc.setFillColor(...GOLD);
    doc.rect(x, y, cardW, 1, "F");
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(5.7);
    doc.setTextColor(...MUTED);
    doc.text(card.label, x + cardW / 2, y + 8, { align: "center" });
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(card.value, cardW - 4) as string[];
    const firstLine = lines[0] ?? "";
    doc.text(firstLine, x + cardW / 2, y + 15, { align: "center" });
    if (lines[1]) {
      doc.setFontSize(6.5);
      doc.text(lines[1], x + cardW / 2, y + 18, { align: "center" });
    }
  });

  // ─── Planet table ──────────────────────────────────────────────────────────
  let yPos = 81;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Posições Planetárias", margin, yPos);
  yPos += 7;

  const planetRows: string[][] = [];
  for (const planet of PLANETS) {
    const pos = chart[planet.id];
    if (!pos?.sign) continue;
    planetRows.push([
      planet.label,
      pos.sign,
      `Casa ${pos.house ?? "—"}`,
      pos.degree != null ? `${pos.degree.toFixed(1)}°` : "—",
      pos.retrograde ? "Rx" : "",
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Planeta", "Signo", "Casa", "Grau", ""]],
    body: planetRows,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: {
      font: PDF_FONT,
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [...TEXT],
      lineColor: [225, 218, 199],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...GOLD],
      textColor: [...WHITE],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [238, 229, 207],
    },
    bodyStyles: {
      fillColor: [...WHITE],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 28 },
      1: { cellWidth: 40 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 12, halign: "center", textColor: [...GOLD], fontStyle: "bold" },
    },
  });

  // ─── House cusps table ────────────────────────────────────────────────────
  if (chart.houseCusps?.length) {
    const cusps = chart.houseCusps as { house: number; sign: string; degrees?: number; minutes?: number }[];
    const cuspsY0 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    let cuspsY = cuspsY0;

    if (cuspsY > H - 60) {
      doc.addPage();
      addPageBackground();
      cuspsY = margin + 10;
    }

     doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text("Cúspides das Casas (Placidus)", margin, cuspsY);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(margin, cuspsY + 2, margin + 60, cuspsY + 2);

    const cuspRows = cusps.map((c) => [
      `Casa ${c.house}`,
      c.sign,
      `${c.degrees ?? 0}°${String(c.minutes ?? 0).padStart(2, "0")}'`,
    ]);

    autoTable(doc, {
      startY: cuspsY + 7,
      head: [["Casa", "Signo", "Posição"]],
      body: cuspRows,
      margin: { left: margin, right: margin },
      tableWidth: contentW / 2,
      styles: {
        font: PDF_FONT,
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [...TEXT],
        lineColor: [225, 218, 199],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [...GOLD],
        textColor: [...WHITE],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [238, 229, 207] },
      bodyStyles: { fillColor: [...WHITE] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 20, textColor: [...GOLD] },
        1: { cellWidth: 40 },
        2: { cellWidth: 22, halign: "right", font: PDF_FONT, fontSize: 7.5 },
      },
    });
  }

  // ─── Aspects table (grouped by type) ──────────────────────────────────────
  if (chart.aspects?.length) {
    const aspects = chart.aspects as { planet1: string; planet2: string; type: string; orb: number }[];
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    let aspectsY = finalY + 10;

    if (aspectsY > H - 60) {
      doc.addPage();
      addPageBackground();
      aspectsY = margin + 10;
    }

    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(`Aspectos  (${aspects.length})`, margin, aspectsY);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(margin, aspectsY + 2, margin + 35, aspectsY + 2);

    const ASPECT_ORDER = ["Conjunção", "Oposição", "Trígono", "Quadratura", "Sextil"];
    const ASPECT_COLORS: Record<string, number[]> = {
      "Conjunção":  [180, 140, 60],
      "Oposição":   [200, 80,  80],
      "Trígono":    [60,  160, 100],
      "Quadratura": [200, 120, 50],
      "Sextil":     [60,  150, 200],
    };
    const ASPECT_GLYPHS: Record<string, string> = {
      "Conjunção": "\u260C",  "Oposição": "\u260D",
      "Trígono": "\u25B3",    "Quadratura": "\u25A1",  "Sextil": "\u2736",
    };
    const grouped: Record<string, typeof aspects> = {};
    for (const t of ASPECT_ORDER) grouped[t] = [];
    for (const a of aspects) {
      if (!grouped[a.type]) grouped[a.type] = [];
      grouped[a.type].push(a);
    }

    let tableY = aspectsY + 8;

    for (const type of ASPECT_ORDER) {
      const rows = grouped[type];
      if (!rows || rows.length === 0) continue;

      // Check space
      if (tableY > H - 50) {
        doc.addPage();
        addPageBackground();
        tableY = margin + 10;
      }

      const typeColor = ASPECT_COLORS[type] ?? [...DARK];
      const glyph = ASPECT_GLYPHS[type] ?? "";

      // Type group header
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...(typeColor as [number, number, number]));
      doc.text(`${glyph}  ${type}  (${rows.length})`, margin, tableY);
      tableY += 5;

      autoTable(doc, {
        startY: tableY,
        head: [["Planeta 1", "Planeta 2", "Orbe"]],
        body: rows.map((a) => [a.planet1, a.planet2, `${a.orb.toFixed(1)}\u00B0`]),
        margin: { left: margin, right: margin },
        tableWidth: contentW,
        styles: {
          font: PDF_FONT,
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [...TEXT],
          lineColor: [225, 218, 199],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [...(typeColor as [number, number, number])],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [238, 229, 207] },
        bodyStyles: { fillColor: [...WHITE] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 60 },
          1: { fontStyle: "bold", cellWidth: 60 },
          2: { cellWidth: 25, halign: "right" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.textColor = typeColor as [number, number, number];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      tableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  // ─── Analysis section ──────────────────────────────────────────────────────
  if (reading.analysis) {
    doc.addPage();
    addPageBackground();

    // Mini header
    drawWordmark(margin, 17);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(reading.clientName, margin, 28);

    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TEXT);
    doc.text("Análise Astrológica", margin, 48);

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(margin, 52, margin + 48, 52);

    const sections = parseMarkdownSections(reading.analysis);
    let y = 61;
    const lineH = 5.2;
    const sectionGap = 5.2;
    const headingGap = 3.2;
    const pageBottom = H - 18;

    for (const section of sections) {
      if (section.heading) {
        // Check if heading fits
        if (y + 12 > pageBottom) {
          doc.addPage();
          addPageBackground();
          y = margin + 8;
        }
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(10);
        doc.setTextColor(...GOLD);
        doc.text(section.heading, margin, y);
        y += headingGap + 2;
        doc.setDrawColor(200, 180, 100);
        doc.setLineWidth(0.25);
        doc.line(margin, y, margin + Math.min(section.heading.length * 2.5, contentW), y);
        y += 4;
      }

      if (section.body.trim()) {
        const cleanBody = stripMarkdown(section.body);
        doc.setFont(PDF_FONT, "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT);

        const paragraphs = cleanBody.split(/\n\n+/);
        for (const para of paragraphs) {
          if (!para.trim()) continue;
          const wrapped = doc.splitTextToSize(para.trim(), contentW);
          for (const line of wrapped) {
            if (y + lineH > pageBottom) {
              doc.addPage();
              addPageBackground();
              y = margin + 8;
              // repeat mini header on continuation pages
              doc.setFont(PDF_FONT, "bold");
              doc.setFontSize(8);
              drawWordmark(margin, 15);
              doc.setFont(PDF_FONT, "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(...TEXT);
            }
            const isLastLine = line === wrapped[wrapped.length - 1];
            doc.text(line, margin, y, isLastLine
              ? undefined
              : { align: "justify", maxWidth: contentW });
            y += lineH;
          }
          y += 2; // paragraph gap
        }
        y += sectionGap;
      }
    }
  }

  // ─── Footers on all pages ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1) continue;
    doc.setPage(p);
    addFooter(p, totalPages);
  }

  const safeName = reading.clientName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, "").replace(/\s+/g, "_");
  doc.save(`Assence_${safeName}.pdf`);
}
