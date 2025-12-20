import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

interface CompanyInfo {
  name: string;
  slogan: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

const COMPANY_INFO: CompanyInfo = {
  name: 'KIMBO',
  slogan: 'Procurement Management System',
  address: 'Douala, Cameroun',
  phone: '+237 XXX XXX XXX',
  email: 'contact@kimbo.cm',
  website: 'www.kimbo.cm',
};

// Colors based on the design system
const COLORS = {
  primary: [232, 147, 45] as [number, number, number],      // Orange KIMBO
  primaryLight: [255, 237, 213] as [number, number, number], // Orange clair
  secondary: [89, 53, 31] as [number, number, number],      // Marron profond
  text: [30, 30, 30] as [number, number, number],
  textLight: [80, 80, 80] as [number, number, number],
  muted: [140, 140, 140] as [number, number, number],
  background: [250, 248, 245] as [number, number, number],
  success: [34, 139, 34] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
  warning: [200, 130, 50] as [number, number, number],
  warningLight: [254, 243, 199] as [number, number, number],
  danger: [180, 60, 60] as [number, number, number],
  dangerLight: [254, 226, 226] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [220, 220, 220] as [number, number, number],
};

const formatMontant = (value: number | null, currency?: string) => {
  if (!value) return '0 XOF';
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ' + (currency || 'XOF');
};

// Draw stylized logo
const drawLogo = (doc: jsPDF, x: number, y: number) => {
  // Logo background circle
  doc.setFillColor(...COLORS.primary);
  doc.circle(x + 12, y + 12, 12, 'F');
  
  // K letter stylized
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('K', x + 8, y + 17);
  
  // Company name next to logo
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, x + 28, y + 12);
  
  // Slogan
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.slogan, x + 28, y + 18);
};

// Draw decorative header band
const drawHeaderBand = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Top gradient band
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 4, 'F');
  
  // Secondary thin line
  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, 4, pageWidth, 1, 'F');
};

// Professional header with document info box
const addProfessionalHeader = (
  doc: jsPDF, 
  documentType: string, 
  reference: string,
  status: string,
  statusType: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral'
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  drawHeaderBand(doc);
  
  // Logo area
  drawLogo(doc, 14, 12);
  
  // Contact info under logo
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${COMPANY_INFO.address} | ${COMPANY_INFO.phone} | ${COMPANY_INFO.email}`, 14, 38);
  
  // Document type box (right side)
  const boxWidth = 70;
  const boxX = pageWidth - boxWidth - 14;
  
  // Document type box background
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(boxX, 10, boxWidth, 35, 3, 3, 'FD');
  
  // Document type header
  doc.setFillColor(...COLORS.secondary);
  doc.roundedRect(boxX, 10, boxWidth, 12, 3, 3, 'F');
  doc.rect(boxX, 19, boxWidth, 3, 'F'); // Cover bottom rounded corners
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(documentType, boxX + boxWidth / 2, 18, { align: 'center' });
  
  // Reference
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(reference, boxX + boxWidth / 2, 30, { align: 'center' });
  
  // Status badge
  let statusColor = COLORS.muted;
  let statusBgColor = COLORS.background;
  if (statusType === 'success') {
    statusColor = COLORS.success;
    statusBgColor = COLORS.successLight;
  } else if (statusType === 'warning') {
    statusColor = COLORS.warning;
    statusBgColor = COLORS.warningLight;
  } else if (statusType === 'danger') {
    statusColor = COLORS.danger;
    statusBgColor = COLORS.dangerLight;
  }
  
  doc.setFillColor(...statusBgColor);
  doc.roundedRect(boxX + 5, 35, boxWidth - 10, 8, 2, 2, 'F');
  doc.setTextColor(...statusColor);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(status.toUpperCase(), boxX + boxWidth / 2, 40.5, { align: 'center' });
  
  // Generation date
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Généré le ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, 
    pageWidth - 14, 
    52, 
    { align: 'right' }
  );
  
  // Separator line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.8);
  doc.line(14, 56, pageWidth - 14, 56);
  
  return 65; // Return Y position after header
};

// Section title with icon-like decoration
const addSectionTitle = (doc: jsPDF, y: number, title: string): number => {
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(14, y - 4, 4, 12, 1, 1, 'F');
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 22, y + 4);
  
  return y + 12;
};

// Info card with border
const addInfoCard = (
  doc: jsPDF, 
  startY: number, 
  title: string, 
  data: Array<{ label: string; value: string; highlight?: boolean }>
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = pageWidth - 28;
  const lineHeight = 6;
  const cardHeight = 12 + data.length * lineHeight + 8;
  
  // Card background
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, startY, cardWidth, cardHeight, 2, 2, 'FD');
  
  // Card header
  doc.setFillColor(...COLORS.background);
  doc.roundedRect(14, startY, cardWidth, 10, 2, 2, 'F');
  doc.rect(14, startY + 7, cardWidth, 3, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 18, startY + 7);
  
  // Card content
  let y = startY + 16;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  data.forEach(item => {
    doc.setTextColor(...COLORS.muted);
    doc.text(item.label, 18, y);
    
    if (item.highlight) {
      doc.setTextColor(...COLORS.primary);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(item.value, 70, y);
    y += lineHeight;
  });
  
  return startY + cardHeight + 6;
};

// Two-column info layout
const addTwoColumnInfo = (
  doc: jsPDF,
  startY: number,
  leftTitle: string,
  leftData: Array<{ label: string; value: string; highlight?: boolean }>,
  rightTitle: string,
  rightData: Array<{ label: string; value: string; highlight?: boolean }>
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 35) / 2;
  const lineHeight = 6;
  const maxLines = Math.max(leftData.length, rightData.length);
  const cardHeight = 12 + maxLines * lineHeight + 8;
  
  // Left card
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, startY, cardWidth, cardHeight, 2, 2, 'FD');
  
  doc.setFillColor(...COLORS.background);
  doc.roundedRect(14, startY, cardWidth, 10, 2, 2, 'F');
  doc.rect(14, startY + 7, cardWidth, 3, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text(leftTitle, 18, startY + 7);
  
  let y = startY + 16;
  doc.setFontSize(8);
  leftData.forEach(item => {
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, 18, y);
    if (item.highlight) {
      doc.setTextColor(...COLORS.primary);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(...COLORS.text);
    }
    doc.text(item.value, 50, y);
    y += lineHeight;
  });
  
  // Right card
  const rightX = 14 + cardWidth + 7;
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(rightX, startY, cardWidth, cardHeight, 2, 2, 'FD');
  
  doc.setFillColor(...COLORS.background);
  doc.roundedRect(rightX, startY, cardWidth, 10, 2, 2, 'F');
  doc.rect(rightX, startY + 7, cardWidth, 3, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text(rightTitle, rightX + 4, startY + 7);
  
  y = startY + 16;
  doc.setFontSize(8);
  rightData.forEach(item => {
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, rightX + 4, y);
    if (item.highlight) {
      doc.setTextColor(...COLORS.primary);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(...COLORS.text);
    }
    doc.text(item.value, rightX + 36, y);
    y += lineHeight;
  });
  
  return startY + cardHeight + 6;
};

// Amount highlight box
const addAmountBox = (doc: jsPDF, y: number, amount: number, currency: string, label: string): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(...COLORS.primaryLight);
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - 80, y, 66, 20, 3, 3, 'FD');
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text(label, pageWidth - 47, y + 6, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMontant(amount, currency), pageWidth - 47, y + 15, { align: 'center' });
  
  return y + 26;
};

// Professional footer
const addProfessionalFooter = (doc: jsPDF, documentType: string) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer background band
    doc.setFillColor(...COLORS.background);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
    
    // Footer top line
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 25, pageWidth - 14, pageHeight - 25);
    
    // Company info
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(`${COMPANY_INFO.name} - ${COMPANY_INFO.slogan}`, 14, pageHeight - 18);
    doc.text(`${COMPANY_INFO.address} | ${COMPANY_INFO.email} | ${COMPANY_INFO.website}`, 14, pageHeight - 13);
    
    // Document type and page
    doc.setTextColor(...COLORS.secondary);
    doc.setFont('helvetica', 'bold');
    doc.text(documentType, pageWidth - 14, pageHeight - 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 13, { align: 'right' });
    
    // Bottom band
    doc.setFillColor(...COLORS.secondary);
    doc.rect(0, pageHeight - 4, pageWidth, 4, 'F');
  }
};

// Watermark for drafts
const addWatermark = (doc: jsPDF, text: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  
  // Rotate and center
  doc.text(text, pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
  });
};

// ===================== DEMANDE D'ACHAT =====================
interface DAExportData {
  reference: string;
  status: string;
  statusType?: 'success' | 'warning' | 'danger' | 'neutral';
  department: string;
  category: string;
  priority: string;
  description: string;
  createdAt: string;
  createdBy: string;
  desiredDate?: string;
  totalAmount: number | null;
  currency: string;
  fournisseur?: string;
  fournisseurAddress?: string;
  fournisseurPhone?: string;
  fournisseurEmail?: string;
  justification?: string;
  validatedBy?: string;
  validatedAt?: string;
  articles: Array<{
    designation: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    total?: number;
  }>;
}

export const exportDAToPDF = (data: DAExportData) => {
  const doc = new jsPDF();
  
  // Determine status type
  let statusType: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  if (['payee', 'validee_finance'].includes(data.status.toLowerCase().replace(/\s/g, '_'))) {
    statusType = 'success';
  } else if (['rejetee', 'refusee', 'rejetee_comptabilite'].includes(data.status.toLowerCase().replace(/\s/g, '_'))) {
    statusType = 'danger';
  } else if (['en_analyse', 'chiffree', 'soumise_validation', 'en_revision'].includes(data.status.toLowerCase().replace(/\s/g, '_'))) {
    statusType = 'warning';
  }
  
  let y = addProfessionalHeader(doc, "DEMANDE D'ACHAT", data.reference, data.status, data.statusType || statusType);
  
  // Add watermark for drafts
  if (data.status.toLowerCase().includes('brouillon')) {
    addWatermark(doc, 'BROUILLON');
  }
  
  // Amount box if available
  if (data.totalAmount) {
    addAmountBox(doc, y - 5, data.totalAmount, data.currency, 'MONTANT TOTAL');
  }
  
  // Two-column info layout
  y = addTwoColumnInfo(
    doc, y,
    'Informations générales',
    [
      { label: 'Département', value: data.department },
      { label: 'Catégorie', value: data.category },
      { label: 'Priorité', value: data.priority, highlight: data.priority.toLowerCase().includes('urgent') },
      { label: 'Date souhaitée', value: data.desiredDate || 'Non définie' },
    ],
    'Traçabilité',
    [
      { label: 'Créé le', value: data.createdAt },
      { label: 'Créé par', value: data.createdBy },
      { label: 'Validé le', value: data.validatedAt || '-' },
      { label: 'Validé par', value: data.validatedBy || '-' },
    ]
  );
  
  // Fournisseur card if available
  if (data.fournisseur) {
    y = addInfoCard(doc, y, 'Fournisseur retenu', [
      { label: 'Raison sociale', value: data.fournisseur, highlight: true },
      { label: 'Adresse', value: data.fournisseurAddress || 'Non renseignée' },
      { label: 'Téléphone', value: data.fournisseurPhone || '-' },
      { label: 'Email', value: data.fournisseurEmail || '-' },
    ]);
  }
  
  // Description section
  y = addSectionTitle(doc, y, 'Description de la demande');
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'normal');
  const splitDescription = doc.splitTextToSize(data.description, 175);
  doc.text(splitDescription, 14, y);
  y += splitDescription.length * 4.5 + 8;
  
  // Justification if available
  if (data.justification) {
    y = addSectionTitle(doc, y, 'Justification du choix fournisseur');
    
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'italic');
    const splitJustif = doc.splitTextToSize(data.justification, 175);
    doc.text(splitJustif, 14, y);
    y += splitJustif.length * 4.5 + 8;
  }
  
  // Check if we need new page for table
  if (y > 200) {
    doc.addPage();
    y = 20;
  }
  
  // Articles table
  y = addSectionTitle(doc, y, `Articles / Services (${data.articles.length})`);
  
  const tableData = data.articles.map(art => [
    art.designation,
    art.quantity.toString(),
    art.unit,
    art.unitPrice ? formatMontant(art.unitPrice, data.currency) : '-',
    art.total ? formatMontant(art.total, data.currency) : '-',
  ]);
  
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', 'Unité', 'Prix Unitaire', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: COLORS.background,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    tableLineColor: COLORS.border,
    tableLineWidth: 0.1,
  });
  
  // Total row
  if (data.totalAmount) {
    const finalY = doc.lastAutoTable.finalY;
    
    doc.setFillColor(...COLORS.primaryLight);
    doc.setDrawColor(...COLORS.primary);
    doc.roundedRect(120, finalY + 2, 76, 12, 2, 2, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.secondary);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC:', 125, finalY + 10);
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(11);
    doc.text(formatMontant(data.totalAmount, data.currency), 190, finalY + 10, { align: 'right' });
  }
  
  addProfessionalFooter(doc, "Demande d'Achat");
  doc.save(`DA_${data.reference}.pdf`);
};

// ===================== BON DE LIVRAISON =====================
interface BLExportData {
  reference: string;
  status: string;
  statusType?: 'success' | 'warning' | 'danger' | 'neutral';
  department: string;
  warehouse?: string;
  blType: string;
  deliveryDate?: string;
  createdAt: string;
  createdBy: string;
  deliveredBy?: string;
  deliveredAt?: string;
  validatedBy?: string;
  validatedAt?: string;
  besoinTitle: string;
  besoinReference?: string;
  observations?: string;
  articles: Array<{
    designation: string;
    quantityOrdered: number;
    quantityDelivered: number;
    unit: string;
    ecartReason?: string;
  }>;
}

export const exportBLToPDF = (data: BLExportData) => {
  const doc = new jsPDF();
  
  let statusType: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  if (data.status.toLowerCase().includes('livr')) statusType = 'success';
  else if (data.status.toLowerCase().includes('refus')) statusType = 'danger';
  else if (data.status.toLowerCase().includes('attente') || data.status.toLowerCase().includes('valid')) statusType = 'warning';
  
  let y = addProfessionalHeader(doc, 'BON DE LIVRAISON', data.reference, data.status, data.statusType || statusType);
  
  // Two-column layout
  y = addTwoColumnInfo(
    doc, y,
    'Informations livraison',
    [
      { label: 'Département', value: data.department },
      { label: 'Type', value: data.blType },
      { label: 'Magasin', value: data.warehouse || 'Non spécifié' },
      { label: 'Date prévue', value: data.deliveryDate || 'Non définie' },
    ],
    'Traçabilité',
    [
      { label: 'Créé le', value: data.createdAt },
      { label: 'Créé par', value: data.createdBy },
      { label: 'Livré le', value: data.deliveredAt || '-' },
      { label: 'Livré par', value: data.deliveredBy || '-' },
    ]
  );
  
  // Besoin source
  y = addInfoCard(doc, y, 'Besoin source', [
    { label: 'Titre', value: data.besoinTitle, highlight: true },
    { label: 'Référence', value: data.besoinReference || '-' },
  ]);
  
  // Observations
  if (data.observations) {
    y = addSectionTitle(doc, y, 'Observations');
    
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    const splitObs = doc.splitTextToSize(data.observations, 175);
    doc.text(splitObs, 14, y);
    y += splitObs.length * 4.5 + 8;
  }
  
  // Articles table
  y = addSectionTitle(doc, y, `Articles (${data.articles.length})`);
  
  const tableData = data.articles.map(art => {
    const ecart = art.quantityOrdered - art.quantityDelivered;
    return [
      art.designation,
      art.quantityOrdered.toString(),
      art.quantityDelivered.toString(),
      ecart > 0 ? `-${ecart}` : '0',
      art.unit,
      art.ecartReason || '-',
    ];
  });
  
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Commandé', 'Livré', 'Écart', 'Unité', 'Motif']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: COLORS.background,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 50 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // Highlight negative ecarts in red
      if (data.column.index === 3 && data.cell.raw && data.cell.raw.toString().startsWith('-')) {
        data.cell.styles.textColor = COLORS.danger;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  
  // Signature zones
  const finalY = doc.lastAutoTable.finalY + 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = 80;
  
  // Delivered by signature
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, finalY, boxWidth, 30, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('Livré par:', 18, finalY + 8);
  doc.setTextColor(...COLORS.text);
  doc.text(data.deliveredBy || '________________________', 18, finalY + 16);
  doc.text('Signature:', 18, finalY + 26);
  
  // Received by signature
  doc.roundedRect(pageWidth - boxWidth - 14, finalY, boxWidth, 30, 2, 2, 'S');
  doc.setTextColor(...COLORS.muted);
  doc.text('Reçu par:', pageWidth - boxWidth - 10, finalY + 8);
  doc.setTextColor(...COLORS.text);
  doc.text('________________________', pageWidth - boxWidth - 10, finalY + 16);
  doc.text('Signature:', pageWidth - boxWidth - 10, finalY + 26);
  
  addProfessionalFooter(doc, 'Bon de Livraison');
  doc.save(`BL_${data.reference}.pdf`);
};

// ===================== ÉCRITURE COMPTABLE =====================
interface EcritureExportData {
  reference: string;
  daReference: string;
  libelle: string;
  dateEcriture: string;
  classesSyscohada: number;
  compteComptable: string;
  natureCharge: string;
  centreCout?: string;
  debit: number;
  credit: number;
  devise: string;
  modePaiement?: string;
  referencePaiement?: string;
  isValidated: boolean;
  validatedAt?: string;
  validatedBy?: string;
  createdAt: string;
  createdBy: string;
  observations?: string;
}

export const exportEcritureToPDF = (data: EcritureExportData) => {
  const doc = new jsPDF();
  
  const status = data.isValidated ? 'Validée' : 'En attente';
  const statusType = data.isValidated ? 'success' : 'warning';
  
  let y = addProfessionalHeader(doc, 'ÉCRITURE COMPTABLE', data.reference, status, statusType);
  
  // Amount box
  addAmountBox(doc, y - 5, data.debit || data.credit, data.devise, data.debit > 0 ? 'DÉBIT' : 'CRÉDIT');
  
  // Two-column layout
  y = addTwoColumnInfo(
    doc, y,
    'Informations générales',
    [
      { label: 'DA associée', value: data.daReference, highlight: true },
      { label: 'Libellé', value: data.libelle.substring(0, 30) + (data.libelle.length > 30 ? '...' : '') },
      { label: 'Date écriture', value: data.dateEcriture },
    ],
    'Traçabilité',
    [
      { label: 'Créé le', value: data.createdAt },
      { label: 'Créé par', value: data.createdBy },
      { label: 'Validé le', value: data.validatedAt || '-' },
    ]
  );
  
  // SYSCOHADA Classification
  y = addInfoCard(doc, y, 'Classification SYSCOHADA', [
    { label: 'Classe', value: `Classe ${data.classesSyscohada}`, highlight: true },
    { label: 'Compte comptable', value: data.compteComptable },
    { label: 'Nature de charge', value: data.natureCharge },
    { label: 'Centre de coût', value: data.centreCout || 'Non spécifié' },
  ]);
  
  // Montants table
  y = addSectionTitle(doc, y, 'Détail des montants');
  
  autoTable(doc, {
    startY: y,
    head: [['Débit', 'Crédit', 'Devise', 'Solde']],
    body: [[
      formatMontant(data.debit, data.devise),
      formatMontant(data.credit, data.devise),
      data.devise,
      formatMontant(data.debit - data.credit, data.devise),
    ]],
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 11,
      textColor: COLORS.text,
      fontStyle: 'bold',
      cellPadding: 6,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLORS.primaryLight,
    },
    margin: { left: 14, right: 14 },
  });
  
  y = doc.lastAutoTable.finalY + 10;
  
  // Payment info
  if (data.modePaiement) {
    y = addInfoCard(doc, y, 'Informations de paiement', [
      { label: 'Mode de paiement', value: data.modePaiement, highlight: true },
      { label: 'Référence', value: data.referencePaiement || 'Non spécifiée' },
    ]);
  }
  
  // Observations
  if (data.observations) {
    y = addSectionTitle(doc, y, 'Observations');
    
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    const splitObs = doc.splitTextToSize(data.observations, 175);
    doc.text(splitObs, 14, y);
  }
  
  addProfessionalFooter(doc, 'Écriture Comptable');
  doc.save(`ECRITURE_${data.reference}.pdf`);
};
