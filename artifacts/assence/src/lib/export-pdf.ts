import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PLANETS } from "./constants";
import type { Reading } from "@workspace/api-zod";
import dosisRegularUrl from "@/assets/fonts/dosis-regular.ttf?url";
import dosisSemiboldUrl from "@/assets/fonts/dosis-semibold.ttf?url";

const GOLD = [180, 140, 60] as const;
const DARK = [15, 12, 30] as const;
const DARK_MID = [28, 22, 55] as const;
const CREAM = [252, 248, 240] as const;
const MUTED = [100, 90, 130] as const;
const TEXT = [40, 32, 70] as const;

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
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 52, "F");
  }

  function drawStars(seed = 0) {
    doc.setFillColor(255, 255, 255);
    const rng = (n: number) => ((Math.sin(n * 9301 + 49297 + seed) * 49279) % 1 + 1) % 1;
    for (let i = 0; i < 38; i++) {
      const x = rng(i * 3) * W;
      const y = rng(i * 3 + 1) * 52;
      const r = rng(i * 3 + 2) * 0.6 + 0.15;
      doc.circle(x, y, r, "F");
    }
  }

  function addFooter(pageNum: number, totalPages: number) {
    doc.setFillColor(...DARK);
    doc.rect(0, H - 12, W, 12, "F");
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.text("Assence — Inteligência Astrológica", margin, H - 4.5);
    doc.setTextColor(160, 150, 190);
    doc.text(`Página ${pageNum} de ${totalPages}`, W - margin, H - 4.5, { align: "right" });
  }

  // ─── Cover page ────────────────────────────────────────────────────────────
  addPageBackground();
  drawStars();

  // Gold top bar accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 52, W, 1.2, "F");

  // Logo mark
  doc.setFillColor(...GOLD);
  doc.circle(margin + 5, 20, 5, "F");
  doc.setFillColor(...DARK);
  doc.circle(margin + 5, 20, 3, "F");
  doc.setFillColor(...GOLD);
  doc.circle(margin + 5, 20, 1.2, "F");

  // "ASSENCE" heading
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text("ASSENCE", margin + 13, 18);

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 165, 210);
  doc.text("INTELIGÊNCIA ASTROLÓGICA", margin + 13, 24);

  // Date top-right
  doc.setFontSize(7);
  doc.setTextColor(160, 150, 190);
  doc.text(
    new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
    W - margin,
    18,
    { align: "right" }
  );

  // Client name
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...TEXT);
  doc.text(reading.clientName, margin, 72);

  // Subtitle
   doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const subtitleParts: string[] = [formatBirthDate(reading.birthDate)];
  if (reading.birthTime) subtitleParts.push(reading.birthTime);
  if (reading.birthPlace) subtitleParts.push(reading.birthPlace);
  doc.text(subtitleParts.join("  •  "), margin, 80);

  // Divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, 85, margin + 60, 85);

  // Key planet cards
  const chart = reading.birthChart;
  const keyCards = [
    { label: "ASCENDENTE", value: chart.ascendant ?? "—" },
    { label: "MEIO-DO-CÉU", value: chart.midheaven ?? "—" },
    { label: "SOL", value: `${chart.sun.sign} • Casa ${chart.sun.house}` },
    { label: "LUA", value: `${chart.moon.sign} • Casa ${chart.moon.house}` },
  ];
  const cardW = (contentW - 9) / 4;
  keyCards.forEach((card, i) => {
    const x = margin + i * (cardW + 3);
    const y = 92;
    doc.setFillColor(...DARK_MID);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "F");
    doc.setFillColor(...GOLD);
    doc.rect(x, y, cardW, 1.5, "F");
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(6);
    doc.setTextColor(...GOLD);
    doc.text(card.label, x + cardW / 2, y + 7, { align: "center" });
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...CREAM);
    const lines = doc.splitTextToSize(card.value, cardW - 4);
    doc.text(lines[0], x + cardW / 2, y + 15, { align: "center" });
    if (lines[1]) {
      doc.setFontSize(7);
      doc.text(lines[1], x + cardW / 2, y + 20, { align: "center" });
    }
  });

  // ─── Planet table ──────────────────────────────────────────────────────────
  let yPos = 124;

     doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Posições Planetárias", margin, yPos);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos + 2, margin + 45, yPos + 2);
  yPos += 7;

  const planetRows: string[][] = [];
  for (const planet of PLANETS) {
    const pos = (chart as Record<string, { sign?: string; house?: number; degree?: number; retrograde?: boolean }>)[planet.id];
    if (!pos?.sign) continue;
    planetRows.push([
      planet.label,
      pos.sign,
      `Casa ${pos.house ?? "—"}`,
      pos.degree !== undefined ? `${pos.degree.toFixed(1)}°` : "—",
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
      fontSize: 8,
      cellPadding: 3,
      textColor: [...TEXT],
      lineColor: [220, 210, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...DARK_MID],
      textColor: [...GOLD],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [246, 243, 252],
    },
    bodyStyles: {
      fillColor: [...CREAM],
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
  if (chart.houseCusps && (chart.houseCusps as unknown[]).length > 0) {
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
        lineColor: [220, 210, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [...DARK_MID],
        textColor: [...GOLD],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [246, 243, 252] },
      bodyStyles: { fillColor: [...CREAM] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 20, textColor: [...GOLD] },
        1: { cellWidth: 40 },
        2: { cellWidth: 22, halign: "right", font: PDF_FONT, fontSize: 7.5 },
      },
    });
  }

  // ─── Aspects table (grouped by type) ──────────────────────────────────────
  if (chart.aspects && (chart.aspects as unknown[]).length > 0) {
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
          lineColor: [220, 210, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [...(typeColor as [number, number, number])],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [246, 243, 252] },
        bodyStyles: { fillColor: [...CREAM] },
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
    drawStars(42);

    doc.setFillColor(...GOLD);
    doc.rect(0, 52, W, 1.2, "F");

    // Mini header
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text("ASSENCE", margin, 20);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(180, 165, 210);
    doc.text(reading.clientName, margin, 26);

    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TEXT);
    doc.text("Análise Astrológica", margin, 65);

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(margin, 69, margin + 48, 69);

    const sections = parseMarkdownSections(reading.analysis);
    let y = 78;
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
              doc.setTextColor(...GOLD);
              doc.text("ASSENCE", margin, 12);
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
    doc.setPage(p);
    addFooter(p, totalPages);
  }

  const safeName = reading.clientName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, "").replace(/\s+/g, "_");
  doc.save(`Assence_${safeName}.pdf`);
}
