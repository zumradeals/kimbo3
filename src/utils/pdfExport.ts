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
  addressLine2: string;
  phone1: string;
  phone2: string;
  email: string;
  website: string;
  logoUrl: string;
}

const COMPANY_INFO: CompanyInfo = {
  name: 'KIMBO AFRICA SA',
  slogan: 'KPM - Procurement Management System',
  address: 'Abidjan, Cocody Angré,',
  addressLine2: 'Les Oscars Cité Les Papayers',
  phone1: '+225 27 22 55 79 65',
  phone2: '+225 07 09 30 30 48',
  email: 'infos@kimboafricasa.com',
  website: 'www.kimboafricasa.com',
  logoUrl: 'https://media.kimboafricasa.com/logo-site.png',
};

// CHARTE KIMBO AFRICA - Couleurs officielles (AUCUN BLEU)
const COLORS = {
  // Orange KIMBO - accent principal
  orange: [232, 147, 45] as [number, number, number],
  orangeLight: [255, 237, 213] as [number, number, number],
  orangeVif: [245, 158, 11] as [number, number, number],
  
  // Marron/Brun KIMBO - titres, en-têtes
  marron: [89, 53, 31] as [number, number, number],
  marronClair: [139, 90, 60] as [number, number, number],
  
  // Neutres
  white: [255, 255, 255] as [number, number, number],
  grisClairFond: [250, 248, 245] as [number, number, number],
  grisTresClair: [245, 243, 240] as [number, number, number],
  grisAlternate: [252, 250, 248] as [number, number, number],
  
  // Texte
  textPrimary: [30, 30, 30] as [number, number, number],
  textSecondary: [80, 80, 80] as [number, number, number],
  textMuted: [120, 120, 120] as [number, number, number],
  
  // Bordures
  border: [220, 215, 210] as [number, number, number],
  borderLight: [235, 230, 225] as [number, number, number],
  
  // Statuts
  success: [34, 139, 34] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
  warning: [180, 120, 40] as [number, number, number],
  warningLight: [254, 243, 199] as [number, number, number],
  danger: [180, 60, 60] as [number, number, number],
  dangerLight: [254, 226, 226] as [number, number, number],
};

const formatMontant = (value: number | null, currency?: string) => {
  if (!value && value !== 0) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ' + (currency === 'XOF' ? 'FCFA' : (currency || 'FCFA'));
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return dateString;
  }
};

// Charger le logo en base64
const loadLogoAsBase64 = async (): Promise<string | null> => {
  try {
    const response = await fetch(COMPANY_INFO.logoUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ===================== DEMANDE D'ACHAT - REFONTE INSTITUTIONNELLE =====================
interface DAExportData {
  reference: string;
  status: string;
  statusLabel: string;
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
  // Traçabilité complète
  analyzedBy?: string;
  analyzedAt?: string;
  pricedBy?: string;
  pricedAt?: string;
  submittedValidationBy?: string;
  submittedValidationAt?: string;
  validatedFinanceBy?: string;
  validatedFinanceAt?: string;
  comptabiliseBy?: string;
  comptabiliseAt?: string;
  articles: Array<{
    designation: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    total?: number;
  }>;
}

export const exportDAToPDF = async (data: DAExportData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // Charger le logo
  const logoBase64 = await loadLogoAsBase64();
  
  // ========== EN-TÊTE ==========
  let y = 12;
  
  // Bande supérieure orange fine
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 3, 'F');
  
  // Logo KIMBO AFRICA (gauche)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, y, 35, 14);
    } catch {
      // Fallback: texte si logo non chargé
      doc.setFontSize(18);
      doc.setTextColor(...COLORS.marron);
      doc.setFont('helvetica', 'bold');
      doc.text('KIMBO AFRICA', margin, y + 10);
    }
  } else {
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('KIMBO AFRICA', margin, y + 10);
  }
  
  // Bloc document (droite)
  const boxWidth = 65;
  const boxX = pageWidth - margin - boxWidth;
  
  // Titre du document en MARRON
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text("DEMANDE D'ACHAT", boxX + boxWidth, y + 4, { align: 'right' });
  
  // Référence
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(data.reference, boxX + boxWidth, y + 11, { align: 'right' });
  
  // Badge statut
  const statusText = data.statusLabel.toUpperCase();
  let statusBgColor = COLORS.grisClairFond;
  let statusTextColor = COLORS.textMuted;
  
  const statusLower = data.status.toLowerCase();
  if (['payee', 'validee_finance'].includes(statusLower)) {
    statusBgColor = COLORS.successLight;
    statusTextColor = COLORS.success;
  } else if (['rejetee', 'refusee_finance', 'rejetee_comptabilite'].includes(statusLower)) {
    statusBgColor = COLORS.dangerLight;
    statusTextColor = COLORS.danger;
  } else if (['en_analyse', 'chiffree', 'soumise_validation', 'en_revision_achats', 'soumise'].includes(statusLower)) {
    statusBgColor = COLORS.warningLight;
    statusTextColor = COLORS.warning;
  }
  
  doc.setFontSize(7);
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.setFillColor(...statusBgColor);
  doc.roundedRect(boxX + boxWidth - statusWidth, y + 14, statusWidth, 6, 1.5, 1.5, 'F');
  doc.setTextColor(...statusTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, boxX + boxWidth - statusWidth / 2, y + 18.5, { align: 'center' });
  
  // Ligne séparatrice orange
  y = 32;
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  
  // Date de génération
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Document généré le ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`,
    pageWidth - margin, y + 5,
    { align: 'right' }
  );
  
  y = 42;
  
  // Watermark pour brouillons
  if (data.status.toLowerCase().includes('brouillon')) {
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(50);
    doc.setFont('helvetica', 'bold');
    doc.text('BROUILLON', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
  }
  
  // ========== SECTION 1: INFORMATIONS GÉNÉRALES ==========
  y = drawSectionTitle(doc, y, margin, 'INFORMATIONS GÉNÉRALES');
  
  const halfWidth = (contentWidth - 6) / 2;
  
  // Carte gauche
  doc.setFillColor(...COLORS.grisTresClair);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, halfWidth, 38, 2, 2, 'FD');
  
  // Carte droite
  doc.roundedRect(margin + halfWidth + 6, y, halfWidth, 38, 2, 2, 'FD');
  
  // Contenu gauche
  let cardY = y + 7;
  drawInfoRow(doc, margin + 4, cardY, 'Département', data.department, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Catégorie', data.category, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Priorité', data.priority, halfWidth - 8, data.priority.toLowerCase().includes('urgent'));
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Date souhaitée', formatDate(data.desiredDate) || 'Non définie', halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Demandeur', data.createdBy, halfWidth - 8);
  
  // Contenu droite  
  cardY = y + 7;
  const rightX = margin + halfWidth + 10;
  drawInfoRow(doc, rightX, cardY, 'Créée le', formatDateTime(data.createdAt), halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, rightX, cardY, 'Créé par', data.createdBy, halfWidth - 8);
  
  y += 44;
  
  // ========== SECTION 2: TRAÇABILITÉ ==========
  y = drawSectionTitle(doc, y, margin, '🔒 TRAÇABILITÉ');
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');
  
  // Liseré orange à gauche
  doc.setFillColor(...COLORS.orange);
  doc.rect(margin, y, 3, 34, 'F');
  
  const colWidth = contentWidth / 3;
  cardY = y + 7;
  
  // Colonne 1
  drawTraceItem(doc, margin + 8, cardY, 'Analyse Achats', data.analyzedBy, data.analyzedAt);
  drawTraceItem(doc, margin + 8, cardY + 10, 'Chiffrage', data.pricedBy, data.pricedAt);
  
  // Colonne 2
  drawTraceItem(doc, margin + colWidth + 4, cardY, 'Soumis validation', data.submittedValidationBy, data.submittedValidationAt);
  drawTraceItem(doc, margin + colWidth + 4, cardY + 10, 'Validé DAF/DG', data.validatedFinanceBy, data.validatedFinanceAt);
  
  // Colonne 3
  drawTraceItem(doc, margin + colWidth * 2, cardY, 'Comptabilisé', data.comptabiliseBy, data.comptabiliseAt);
  
  y += 40;
  
  // ========== SECTION 3: FOURNISSEUR ==========
  y = drawSectionTitle(doc, y, margin, 'FOURNISSEUR');
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');
  
  cardY = y + 7;
  if (data.fournisseur) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
    doc.text(data.fournisseur, margin + 4, cardY);
    
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    doc.text(data.fournisseurAddress || 'Adresse non renseignée', margin + 4, cardY + 6);
    doc.text(`Tél: ${data.fournisseurPhone || '-'}  |  Email: ${data.fournisseurEmail || '-'}`, margin + 4, cardY + 12);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'italic');
    doc.text('Non encore sélectionné', margin + 4, cardY + 5);
  }
  
  y += 30;
  
  // ========== SECTION 4: DESCRIPTION ==========
  y = drawSectionTitle(doc, y, margin, 'DESCRIPTION DE LA DEMANDE');
  
  // Bordure orange
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.5);
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  const splitDescription = doc.splitTextToSize(data.description || 'Aucune description', contentWidth - 8);
  const descHeight = Math.max(splitDescription.length * 4.5 + 8, 16);
  
  doc.roundedRect(margin, y, contentWidth, descHeight, 2, 2, 'FD');
  doc.text(splitDescription, margin + 4, y + 6);
  
  y += descHeight + 6;
  
  // Justification si présente
  if (data.justification) {
    y = drawSectionTitle(doc, y, margin, 'JUSTIFICATION DU CHOIX FOURNISSEUR');
    
    doc.setFillColor(...COLORS.grisTresClair);
    doc.setDrawColor(...COLORS.borderLight);
    
    const splitJustif = doc.splitTextToSize(data.justification, contentWidth - 8);
    const justifHeight = Math.max(splitJustif.length * 4.5 + 8, 12);
    
    doc.roundedRect(margin, y, contentWidth, justifHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'italic');
    doc.text(splitJustif, margin + 4, y + 6);
    
    y += justifHeight + 6;
  }
  
  // Vérifier si on a besoin d'une nouvelle page pour le tableau
  if (y > pageHeight - 100) {
    doc.addPage();
    y = 20;
  }
  
  // ========== SECTION 5: TABLEAU ARTICLES ==========
  y = drawSectionTitle(doc, y, margin, `ARTICLES / SERVICES (${data.articles.length})`);
  
  const tableData = data.articles.map(art => [
    art.designation,
    art.quantity.toString(),
    art.unit,
    art.unitPrice ? formatMontant(art.unitPrice, data.currency) : '-',
    art.total ? formatMontant(art.total, data.currency) : '-',
  ]);
  
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', 'Unité', 'Prix Unitaire', 'Total Ligne']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.marron,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.textPrimary,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: COLORS.grisAlternate,
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    tableLineColor: COLORS.border,
    tableLineWidth: 0.1,
  });
  
  // ========== SECTION 6: TOTAUX ==========
  const finalY = doc.lastAutoTable.finalY + 4;
  
  if (data.totalAmount) {
    // Bloc totaux à droite
    const totalsX = pageWidth - margin - 75;
    
    // Ligne Total HT (si applicable)
    doc.setFillColor(...COLORS.grisTresClair);
    doc.roundedRect(totalsX, finalY, 75, 10, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    doc.text('Total HT:', totalsX + 4, finalY + 7);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'bold');
    doc.text(formatMontant(data.totalAmount, data.currency), totalsX + 71, finalY + 7, { align: 'right' });
    
    // TOTAL TTC - ZONE VISUELLE FORTE
    doc.setFillColor(...COLORS.orangeLight);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(1);
    doc.roundedRect(totalsX, finalY + 12, 75, 14, 2, 2, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC:', totalsX + 4, finalY + 21);
    
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
    doc.text(formatMontant(data.totalAmount, data.currency), totalsX + 71, finalY + 21, { align: 'right' });
  }
  
  // ========== PIED DE PAGE ==========
  addInstitutionalFooter(doc);
  
  doc.save(`DA_${data.reference}.pdf`);
};

// Fonctions utilitaires pour le PDF DA

function drawSectionTitle(doc: jsPDF, y: number, margin: number, title: string): number {
  // Liseré orange
  doc.setFillColor(...COLORS.orange);
  doc.roundedRect(margin, y, 3, 8, 0.5, 0.5, 'F');
  
  // Titre en marron
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 6, y + 6);
  
  return y + 12;
}

function drawInfoRow(doc: jsPDF, x: number, y: number, label: string, value: string, maxWidth: number, highlight: boolean = false): void {
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  
  if (highlight) {
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
  } else {
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
  }
  
  // Tronquer si trop long
  let displayValue = value || '-';
  while (doc.getTextWidth(displayValue) > maxWidth - 35 && displayValue.length > 3) {
    displayValue = displayValue.slice(0, -4) + '...';
  }
  doc.text(displayValue, x + 32, y);
}

function drawTraceItem(doc: jsPDF, x: number, y: number, label: string, by?: string, at?: string): void {
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(label + ':', x, y);
  
  if (by) {
    doc.setTextColor(...COLORS.textPrimary);
    doc.text(by, x, y + 4);
    if (at) {
      doc.setTextColor(...COLORS.textMuted);
      doc.text(formatDate(at), x + 35, y + 4);
    }
  } else {
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'italic');
    doc.text('-', x, y + 4);
  }
}

function addInstitutionalFooter(doc: jsPDF): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  const margin = 15;
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Ligne séparatrice orange
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);
    
    // Infos entreprise
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(COMPANY_INFO.name, margin, pageHeight - 17);
    doc.text(`${COMPANY_INFO.address} ${COMPANY_INFO.addressLine2}`, margin, pageHeight - 13);
    doc.text(`${COMPANY_INFO.phone1} | ${COMPANY_INFO.email}`, margin, pageHeight - 9);
    
    // Mention légale
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Document généré automatiquement par KPM SYSTÈME – Toute modification manuelle invalide ce document',
      pageWidth / 2, pageHeight - 17,
      { align: 'center' }
    );
    
    // Pagination
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 13, { align: 'right' });
    
    // Bande marron en bas
    doc.setFillColor(...COLORS.marron);
    doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
  }
}

// ===================== BON DE LIVRAISON =====================
interface BLExportData {
  reference: string;
  status: string;
  statusLabel: string;
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

export const exportBLToPDF = async (data: BLExportData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  const logoBase64 = await loadLogoAsBase64();
  
  // ========== EN-TÊTE ==========
  let y = 12;
  
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 3, 'F');
  
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, y, 35, 14);
    } catch {
      doc.setFontSize(18);
      doc.setTextColor(...COLORS.marron);
      doc.setFont('helvetica', 'bold');
      doc.text('KIMBO AFRICA', margin, y + 10);
    }
  } else {
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('KIMBO AFRICA', margin, y + 10);
  }
  
  // Titre et référence
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('BON DE LIVRAISON', pageWidth - margin, y + 4, { align: 'right' });
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(data.reference, pageWidth - margin, y + 11, { align: 'right' });
  
  // Badge statut
  const statusText = data.statusLabel.toUpperCase();
  let statusBgColor = COLORS.grisClairFond;
  let statusTextColor = COLORS.textMuted;
  
  if (data.status.toLowerCase().includes('livr')) {
    statusBgColor = COLORS.successLight;
    statusTextColor = COLORS.success;
  } else if (data.status.toLowerCase().includes('refus')) {
    statusBgColor = COLORS.dangerLight;
    statusTextColor = COLORS.danger;
  } else if (data.status.toLowerCase().includes('attente') || data.status.toLowerCase().includes('valid')) {
    statusBgColor = COLORS.warningLight;
    statusTextColor = COLORS.warning;
  }
  
  doc.setFontSize(7);
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.setFillColor(...statusBgColor);
  doc.roundedRect(pageWidth - margin - statusWidth, y + 14, statusWidth, 6, 1.5, 1.5, 'F');
  doc.setTextColor(...statusTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 18.5, { align: 'center' });
  
  y = 32;
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  
  y = 42;
  
  // Informations livraison
  y = drawSectionTitle(doc, y, margin, 'INFORMATIONS LIVRAISON');
  
  const halfWidth = (contentWidth - 6) / 2;
  
  doc.setFillColor(...COLORS.grisTresClair);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, halfWidth, 32, 2, 2, 'FD');
  doc.roundedRect(margin + halfWidth + 6, y, halfWidth, 32, 2, 2, 'FD');
  
  let cardY = y + 7;
  drawInfoRow(doc, margin + 4, cardY, 'Département', data.department, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Type', data.blType, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Magasin', data.warehouse || 'Non spécifié', halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Date prévue', formatDate(data.deliveryDate), halfWidth - 8);
  
  cardY = y + 7;
  const rightX = margin + halfWidth + 10;
  drawInfoRow(doc, rightX, cardY, 'Créé le', formatDateTime(data.createdAt), halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, rightX, cardY, 'Créé par', data.createdBy, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, rightX, cardY, 'Livré le', formatDateTime(data.deliveredAt), halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, rightX, cardY, 'Livré par', data.deliveredBy || '-', halfWidth - 8);
  
  y += 38;
  
  // Besoin source
  y = drawSectionTitle(doc, y, margin, 'BESOIN SOURCE');
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text(data.besoinTitle, margin + 4, y + 7);
  
  doc.setTextColor(...COLORS.textMuted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(data.besoinReference || '', margin + 4, y + 12);
  
  y += 20;
  
  // Observations
  if (data.observations) {
    y = drawSectionTitle(doc, y, margin, 'OBSERVATIONS');
    
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.5);
    
    const splitObs = doc.splitTextToSize(data.observations, contentWidth - 8);
    const obsHeight = Math.max(splitObs.length * 4.5 + 8, 12);
    
    doc.roundedRect(margin, y, contentWidth, obsHeight, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    doc.text(splitObs, margin + 4, y + 6);
    
    y += obsHeight + 6;
  }
  
  // Tableau articles
  y = drawSectionTitle(doc, y, margin, `ARTICLES (${data.articles.length})`);
  
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
      fillColor: COLORS.marron,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.textPrimary,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: COLORS.grisAlternate,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 48 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (cellData) => {
      if (cellData.column.index === 3 && cellData.cell.raw && cellData.cell.raw.toString().startsWith('-')) {
        cellData.cell.styles.textColor = COLORS.danger;
        cellData.cell.styles.fontStyle = 'bold';
      }
    },
  });
  
  // Zones signatures
  const sigY = doc.lastAutoTable.finalY + 15;
  const boxWidth = 80;
  
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, sigY, boxWidth, 28, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Livré par:', margin + 4, sigY + 8);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(data.deliveredBy || '________________________', margin + 4, sigY + 14);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Signature:', margin + 4, sigY + 24);
  
  doc.roundedRect(pageWidth - margin - boxWidth, sigY, boxWidth, 28, 2, 2, 'S');
  doc.text('Reçu par:', pageWidth - margin - boxWidth + 4, sigY + 8);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text('________________________', pageWidth - margin - boxWidth + 4, sigY + 14);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Signature:', pageWidth - margin - boxWidth + 4, sigY + 24);
  
  addInstitutionalFooter(doc);
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

export const exportEcritureToPDF = async (data: EcritureExportData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  const logoBase64 = await loadLogoAsBase64();
  
  // EN-TÊTE
  let y = 12;
  
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 3, 'F');
  
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, y, 35, 14);
    } catch {
      doc.setFontSize(18);
      doc.setTextColor(...COLORS.marron);
      doc.setFont('helvetica', 'bold');
      doc.text('KIMBO AFRICA', margin, y + 10);
    }
  } else {
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('KIMBO AFRICA', margin, y + 10);
  }
  
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('ÉCRITURE COMPTABLE', pageWidth - margin, y + 4, { align: 'right' });
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(data.reference, pageWidth - margin, y + 11, { align: 'right' });
  
  // Badge statut
  const statusText = data.isValidated ? 'VALIDÉE' : 'EN ATTENTE';
  const statusBgColor = data.isValidated ? COLORS.successLight : COLORS.warningLight;
  const statusTextColor = data.isValidated ? COLORS.success : COLORS.warning;
  
  doc.setFontSize(7);
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.setFillColor(...statusBgColor);
  doc.roundedRect(pageWidth - margin - statusWidth, y + 14, statusWidth, 6, 1.5, 1.5, 'F');
  doc.setTextColor(...statusTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 18.5, { align: 'center' });
  
  y = 32;
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  
  y = 42;
  
  // Montant principal
  const amount = data.debit || data.credit;
  const amountLabel = data.debit > 0 ? 'DÉBIT' : 'CRÉDIT';
  
  doc.setFillColor(...COLORS.orangeLight);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(1);
  doc.roundedRect(pageWidth - margin - 70, y, 70, 18, 2, 2, 'FD');
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'normal');
  doc.text(amountLabel, pageWidth - margin - 35, y + 6, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMontant(amount, data.devise), pageWidth - margin - 35, y + 14, { align: 'center' });
  
  // Informations générales
  y = drawSectionTitle(doc, y, margin, 'INFORMATIONS GÉNÉRALES');
  
  const halfWidth = (contentWidth - 6) / 2;
  
  doc.setFillColor(...COLORS.grisTresClair);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, halfWidth, 28, 2, 2, 'FD');
  doc.roundedRect(margin + halfWidth + 6, y, halfWidth, 28, 2, 2, 'FD');
  
  let cardY = y + 7;
  drawInfoRow(doc, margin + 4, cardY, 'DA associée', data.daReference, halfWidth - 8, true);
  cardY += 7;
  const truncatedLibelle = data.libelle.length > 30 ? data.libelle.substring(0, 30) + '...' : data.libelle;
  drawInfoRow(doc, margin + 4, cardY, 'Libellé', truncatedLibelle, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, margin + 4, cardY, 'Date écriture', formatDate(data.dateEcriture), halfWidth - 8);
  
  cardY = y + 7;
  const rightX = margin + halfWidth + 10;
  drawInfoRow(doc, rightX, cardY, 'Créé le', formatDateTime(data.createdAt), halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, rightX, cardY, 'Créé par', data.createdBy, halfWidth - 8);
  cardY += 7;
  drawInfoRow(doc, rightX, cardY, 'Validé le', formatDateTime(data.validatedAt), halfWidth - 8);
  
  y += 34;
  
  // Classification SYSCOHADA
  y = drawSectionTitle(doc, y, margin, 'CLASSIFICATION SYSCOHADA');
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');
  
  doc.setFillColor(...COLORS.orange);
  doc.rect(margin, y, 3, 28, 'F');
  
  cardY = y + 7;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text(`Classe ${data.classesSyscohada}`, margin + 8, cardY);
  
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  doc.text(`Compte: ${data.compteComptable}`, margin + 8, cardY + 7);
  doc.text(`Nature: ${data.natureCharge}`, margin + 8, cardY + 14);
  doc.text(`Centre de coût: ${data.centreCout || 'Non spécifié'}`, margin + 8, cardY + 21);
  
  y += 34;
  
  // Tableau montants
  y = drawSectionTitle(doc, y, margin, 'DÉTAIL DES MONTANTS');
  
  autoTable(doc, {
    startY: y,
    head: [['Débit', 'Crédit', 'Devise', 'Solde']],
    body: [[
      formatMontant(data.debit, data.devise),
      formatMontant(data.credit, data.devise),
      data.devise === 'XOF' ? 'FCFA' : data.devise,
      formatMontant(data.debit - data.credit, data.devise),
    ]],
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.marron,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 11,
      textColor: COLORS.textPrimary,
      fontStyle: 'bold',
      cellPadding: 6,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLORS.orangeLight,
    },
    margin: { left: margin, right: margin },
  });
  
  y = doc.lastAutoTable.finalY + 10;
  
  // Infos paiement
  if (data.modePaiement) {
    y = drawSectionTitle(doc, y, margin, 'INFORMATIONS DE PAIEMENT');
    
    doc.setFillColor(...COLORS.grisTresClair);
    doc.setDrawColor(...COLORS.borderLight);
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
    doc.text(`Mode: ${data.modePaiement}`, margin + 4, y + 7);
    
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    doc.text(`Référence: ${data.referencePaiement || 'Non spécifiée'}`, margin + 4, y + 13);
    
    y += 22;
  }
  
  // Observations
  if (data.observations) {
    y = drawSectionTitle(doc, y, margin, 'OBSERVATIONS');
    
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.5);
    
    const splitObs = doc.splitTextToSize(data.observations, contentWidth - 8);
    const obsHeight = Math.max(splitObs.length * 4.5 + 8, 12);
    
    doc.roundedRect(margin, y, contentWidth, obsHeight, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    doc.text(splitObs, margin + 4, y + 6);
  }
  
  addInstitutionalFooter(doc);
  doc.save(`ECRITURE_${data.reference}.pdf`);
};
