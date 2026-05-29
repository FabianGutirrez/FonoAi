import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportData {
  patientName: string;
  patientAge: number | string;
  transcription: string;
  analysis: string;
  date: string;
  id: string;
  showTranscription?: boolean;
  acousticMetrics?: {
    pitchMean?: number;
    pitchStDev?: number;
    jitter?: number;
    shimmer?: number;
    f1Mean?: number;
    f2Mean?: number;
    speakingRate?: number;
  } | null;
  diarization?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }> | null;
  phonemeAlignments?: Array<{
    word: string;
    start: number;
    end: number;
    phonemes: Array<{
      phone: string;
      start: number;
      end: number;
      score: number;
    }>;
  }> | null;
}

export const generateClinicalPDF = (data: PDFReportData) => {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Background
  doc.setFillColor(30, 41, 59); // Slate 800 (Senior and high-end)
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME CLÍNICO FONOAUDIOLÓGICO AVANZADO', margin, 24);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Integración de Biometría de Voz: WhisperX + Praat + MFA + Pyannote', margin, 32);

  // Patient Info Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Datos Generales del Paciente', margin, 55);

  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, 58, pageWidth - margin, 58);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // Grid system for info
  doc.text(`Paciente: ${data.patientName}`, margin, 66);
  doc.text(`Edad: ${data.patientAge} años`, margin + 100, 66);
  doc.text(`ID de Registro: ${data.id}`, margin, 73);
  doc.text(`Fecha de Evaluación: ${data.date}`, margin + 100, 73);

  let currentY = 85;

  // --- ACUSTICA PRAAT SECTION ---
  if (data.acousticMetrics) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Biometría Acústica Laríngea y de Resonancia (Praat)', margin, currentY);
    doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

    const metrics = data.acousticMetrics;
    const bodyRows = [
      ['F0 Promedio (Tono base)', `${metrics.pitchMean?.toFixed(1) || '—'} Hz`, 'Indica el tono fundamental promedio del paciente. Normal infantil: 220-300Hz.'],
      ['Desviación Estándar F0', `${metrics.pitchStDev?.toFixed(1) || '—'} Hz`, 'Refleja variabilidad tonal. Valores bajos indican monotonía verbal.'],
      ['Jitter Local', `${metrics.jitter?.toFixed(2) || '—'} %`, 'Inestabilidad del periodo (micro-perturbación). Normal < 1.0%.'],
      ['Shimmer Local', `${metrics.shimmer?.toFixed(2) || '—'} %`, 'Inestabilidad de amplitud (intensidad). Normal < 3.8%.'],
      ['Formante F1 Promedio', `${metrics.f1Mean?.toFixed(1) || '—'} Hz`, 'Resonador fonoarticulatorio 1 (asociado a apertura vertical mandibular).'],
      ['Formante F2 Promedio', `${metrics.f2Mean?.toFixed(1) || '—'} Hz`, 'Resonador fonoarticulatorio 2 (asociado a retracción/protrusión lingual).'],
      ['Ritmo de Habla', `${metrics.speakingRate?.toFixed(1) || '—'} sílabas/s`, 'Tasa de articulación fluida. Normal infantil: 2.5 - 3.5 sílabas/seg.']
    ];

    autoTable(doc, {
      startY: currentY + 6,
      head: [['Parámetro Acústico', 'Valor Hallado', 'Significancia Clínica']],
      body: bodyRows,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 30, textColor: [37, 99, 235] },
        2: { cellWidth: 90 }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // --- DIARIZACION PYANNOTE SECTION ---
  if (data.diarization && data.diarization.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 25;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Diarización de Habla y Análisis de Turnos (Pyannote & WhisperX)', margin, currentY);
    doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

    const diarizationRows = data.diarization.map(d => [
      `[${d.start.toFixed(1)}s - ${d.end.toFixed(1)}s]`,
      d.speaker,
      d.text
    ]);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['Intervalo de Tiempo', 'Interlocutor', 'Intervención Transcrita']],
      body: diarizationRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'italic' },
        1: { cellWidth: 35, fontStyle: 'bold', textColor: [30, 41, 59] },
        2: { cellWidth: 100 }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // --- MULTIPHONEME MFA SECTION ---
  if (data.phonemeAlignments && data.phonemeAlignments.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 25;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Alineación Fonética Segmental (Montreal Forced Aligner - MFA)', margin, currentY);
    doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

    const alignmentsRows = data.phonemeAlignments.map(pa => [
      pa.word,
      `[${pa.start.toFixed(2)}s - ${pa.end.toFixed(2)}s]`,
      pa.phonemes.map(ph => `/${ph.phone}/`).join(' '),
      pa.phonemes.map(ph => `${(ph.score * 100).toFixed(0)}%`).join(' | ')
    ]);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['Palabra de Prueba', 'Intervalo Temporal', 'Alineación de Fonemas', 'Nivel de Confianza (MFA)']],
      body: alignmentsRows,
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 35 },
        2: { cellWidth: 55, fontStyle: 'bold', textColor: [220, 38, 38] },
        3: { cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // --- TRANSCRIPCIÓN Y ANÁLISIS CLÍNICO ---
  if (data.showTranscription !== false && data.transcription) {
    if (currentY > 200) {
      doc.addPage();
      currentY = 25;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Transcripción Literal Completa', margin, currentY);
    doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

    autoTable(doc, {
      startY: currentY + 6,
      body: [[`"${data.transcription}"` || 'Sin transcripción registrada.']],
      theme: 'plain',
      styles: { 
        fontSize: 9, 
        fontStyle: 'italic',
        lineHeight: 1.4,
        cellPadding: { top: 6, right: 10, bottom: 6, left: 10 },
        textColor: [71, 85, 105],
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin, bottom: 10 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  if (currentY > 200) {
    doc.addPage();
    currentY = 25;
  }

  const analysisSectionNum = (data.showTranscription !== false && data.transcription) ? '6' : '5';

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${analysisSectionNum}. Análisis Clínico de Razonamiento Fonoaudiológico (Gemini)`, margin, currentY);
  doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

  // Clean Markdown
  const cleanAnalysis = data.analysis.replace(/\*\*/g, '').replace(/<br \/>/g, '\n');

  autoTable(doc, {
    startY: currentY + 6,
    body: [[cleanAnalysis || 'Análisis descriptivo fonoaudiológico pendiente.']],
    theme: 'plain',
    styles: { 
      fontSize: 8.5, 
      lineHeight: 1.4,
      cellPadding: { top: 4, right: 0, bottom: 4, left: 0 },
      textColor: [51, 65, 85]
    },
    margin: { left: margin, right: margin, bottom: 20 },
  });

  // Footer decoration and numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Página ${i} de ${pageCount} | Reporte Clínico Multipipeline FonoAI (WhisperX + Praat + MFA + Pyannote + Gemini). Requiere interpretación clínica experta.`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`FonoAI_Reporte_Avanzado_${data.patientName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};
