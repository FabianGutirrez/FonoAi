
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportData {
  patientName: string;
  patientAge: number | string;
  transcription: string;
  analysis: string;
  date: string;
  id: string;
}

export const generateClinicalPDF = (data: PDFReportData) => {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Background
  doc.setFillColor(37, 99, 235); // Blue 600
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME CLÍNICO FONOAUDIOLÓGICO', margin, 25);

  // Subtitle/App Name
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Generado por FonoAI - Asistente de Evaluación Fonética', margin, 32);

  // Patient Info Section
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Datos del Paciente', margin, 55);

  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, 58, pageWidth - margin, 58);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${data.patientName}`, margin, 68);
  doc.text(`Edad: ${data.patientAge} años`, margin, 75);
  doc.text(`ID de Registro: ${data.id}`, margin, 82);
  doc.text(`Fecha: ${data.date}`, margin, 89);

  // Transcription Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Transcripción Literal', margin, 105);
  doc.line(margin, 108, pageWidth - margin, 108);

  autoTable(doc, {
    startY: 112,
    body: [[data.transcription || 'Sin transcripción disponible.']],
    theme: 'plain',
    styles: { 
      fontSize: 11, 
      fontStyle: 'italic',
      cellPadding: { top: 5, right: 0, bottom: 5, left: 0 },
      textColor: [51, 65, 85]
    },
    margin: { left: margin, right: margin, bottom: 20 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // Analysis Section
  if (currentY > 260) {
    doc.addPage();
    currentY = 25;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Análisis Descriptivo e Hipótesis', margin, currentY);
  doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

  // Basic markdown cleaning for PDF (removing ** for bold)
  const cleanAnalysis = data.analysis.replace(/\*\*/g, '').replace(/<br \/>/g, '\n');
  
  autoTable(doc, {
    startY: currentY + 8,
    body: [[cleanAnalysis || 'Sin análisis disponible.']],
    theme: 'plain',
    styles: { 
      fontSize: 11, 
      fontStyle: 'normal',
      cellPadding: { top: 5, right: 0, bottom: 5, left: 0 },
      textColor: [51, 65, 85]
    },
    margin: { left: margin, right: margin, bottom: 20 },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Página ${i} de ${pageCount} - Documento generado automáticamente por FonoAI. Requiere validación profesional.`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  doc.save(`FonoAI_Reporte_${data.patientName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};
