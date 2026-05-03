import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PLANETS } from "./constants";
import type { Reading } from "@workspace/api-zod";

const GOLD = [180, 140, 60] as const;
const DARK = [15, 12, 30] as const;
const DARK_MID = [28, 22, 55] as const;
const CREAM = [252, 248, 240] as const;
const MUTED = [100, 90, 130] as const;
const TEXT = [40, 32, 70] as const;

function formatBirthDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function stripMarkdown(md: string): string {
  return md
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
    doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text("ASSENCE", margin + 13, 18);

  doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...TEXT);
  doc.text(reading.clientName, margin, 72);

  // Subtitle
  doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...GOLD);
    doc.text(card.label, x + cardW / 2, y + 7, { align: "center" });
    doc.setFont("helvetica", "bold");
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

  doc.setFont("helvetica", "bold");
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
      font: "helvetica",
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

  // ─── Aspects table (if any) ────────────────────────────────────────────────
  if (chart.aspects && (chart.aspects as unknown[]).length > 0) {
    const aspects = chart.aspects as { planet1: string; planet2: string; type: string; orb: number }[];
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    let aspectsY = finalY + 10;

    if (aspectsY > H - 60) {
      doc.addPage();
      addPageBackground();
      aspectsY = margin + 10;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text("Aspectos", margin, aspectsY);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(margin, aspectsY + 2, margin + 25, aspectsY + 2);

    autoTable(doc, {
      startY: aspectsY + 7,
      head: [["Planeta 1", "Aspecto", "Planeta 2", "Orbe"]],
      body: aspects.map((a) => [a.planet1, a.type, a.planet2, `${a.orb.toFixed(1)}°`]),
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      styles: {
        font: "helvetica",
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
      alternateRowStyles: { fillColor: [246, 243, 252] },
      bodyStyles: { fillColor: [...CREAM] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 40 },
        1: { cellWidth: 40 },
        2: { fontStyle: "bold", cellWidth: 40 },
        3: { cellWidth: 20, halign: "right" },
      },
    });
  }

  // ─── Analysis section ──────────────────────────────────────────────────────
  if (reading.analysis) {
    doc.addPage();
    addPageBackground();
    drawStars(42);

    doc.setFillColor(...GOLD);
    doc.rect(0, 52, W, 1.2, "F");

    // Mini header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text("ASSENCE", margin, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(180, 165, 210);
    doc.text(reading.clientName, margin, 26);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TEXT);
    doc.text("Análise Astrológica", margin, 65);

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(margin, 69, margin + 48, 69);

    const sections = parseMarkdownSections(reading.analysis);
    let y = 78;
    const lineH = 5;
    const sectionGap = 5;
    const headingGap = 3;
    const pageBottom = H - 18;

    for (const section of sections) {
      if (section.heading) {
        // Check if heading fits
        if (y + 12 > pageBottom) {
          doc.addPage();
          addPageBackground();
          y = margin + 8;
        }
        doc.setFont("helvetica", "bold");
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
        doc.setFont("helvetica", "normal");
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
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.setTextColor(...GOLD);
              doc.text("ASSENCE", margin, 12);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(...TEXT);
            }
            doc.text(line, margin, y);
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
