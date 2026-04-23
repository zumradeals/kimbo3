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

const formatMontant = (value: number | null, _currency?: string) => {
  if (!value && value !== 0) return '0 FCFA';
  // ARRONDI COMPTABLE DAF: arrondi au supérieur (ceil) pour tous les montants
  const rounded = Math.ceil(value);
  // Utiliser un espace comme séparateur de milliers pour éviter les problèmes d'affichage PDF
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // KPM utilise exclusivement le XOF (Franc CFA) - paramètre currency ignoré
  return formatted + ' FCFA';
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

// Logo KIMBO AFRICA en Base64 pré-encodé pour éviter les problèmes CORS
// Logo simplifié textuel pour garantir l'affichage
const drawKimboLogo = (doc: jsPDF, x: number, y: number, width: number): void => {
  // Fond orange arrondi pour le K
  doc.setFillColor(...COLORS.orange);
  doc.roundedRect(x, y, 12, 12, 2, 2, 'F');
  
  // Lettre K en blanc
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('K', x + 3.8, y + 8.5);
  
  // Texte KIMBO AFRICA
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('KIMBO', x + 15, y + 6);
  
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.orange);
  doc.text('AFRICA', x + 15, y + 12);
};

// ===================== DEMANDE D'ACHAT - VERSION COMPACTE 1 PAGE =====================
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
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);
  
  // ========== EN-TÊTE COMPACT ==========
  let y = 8;
  
  // Bande supérieure orange
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 2.5, 'F');
  
  // Logo KIMBO stylisé
  drawKimboLogo(doc, margin, y, 50);
  
  // Bloc document à droite
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text("DEMANDE D'ACHAT", pageWidth - margin, y + 4, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(data.reference, pageWidth - margin, y + 10, { align: 'right' });
  
  // Badge statut compact
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
  
  doc.setFontSize(6);
  const statusWidth = doc.getTextWidth(statusText) + 6;
  doc.setFillColor(...statusBgColor);
  doc.roundedRect(pageWidth - margin - statusWidth, y + 13, statusWidth, 5, 1, 1, 'F');
  doc.setTextColor(...statusTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 16.5, { align: 'center' });
  
  // Ligne séparatrice
  y = 24;
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  
  y = 28;
  
  // Watermark brouillon
  if (data.status.toLowerCase().includes('brouillon')) {
    doc.setTextColor(235, 235, 235);
    doc.setFontSize(45);
    doc.setFont('helvetica', 'bold');
    doc.text('BROUILLON', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
  }
  
  // ========== INFOS GÉNÉRALES - LAYOUT HORIZONTAL COMPACT ==========
  doc.setFillColor(...COLORS.grisTresClair);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'FD');
  
  const col1X = margin + 4;
  const col2X = margin + contentWidth * 0.25;
  const col3X = margin + contentWidth * 0.5;
  const col4X = margin + contentWidth * 0.75;
  
  // Ligne 1
  drawCompactInfo(doc, col1X, y + 6, 'Département', data.department);
  drawCompactInfo(doc, col2X, y + 6, 'Catégorie', data.category);
  drawCompactInfo(doc, col3X, y + 6, 'Priorité', data.priority, data.priority.toLowerCase().includes('urgent'));
  drawCompactInfo(doc, col4X, y + 6, 'Date souhaitée', formatDate(data.desiredDate) || '-');
  
  // Ligne 2
  drawCompactInfo(doc, col1X, y + 13, 'Demandeur', data.createdBy);
  drawCompactInfo(doc, col2X, y + 13, 'Créée le', formatDate(data.createdAt));
  
  y += 22;
  
  // ========== FOURNISSEUR - COMPACT ==========
  drawMiniSectionTitle(doc, margin, y, 'Fournisseur');
  y += 5;
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
  
  if (data.fournisseur) {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
    doc.text(data.fournisseur, margin + 4, y + 5);
    
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    const contactInfo = [data.fournisseurAddress, data.fournisseurPhone, data.fournisseurEmail].filter(Boolean).join(' • ');
    doc.text(contactInfo || '-', margin + 4, y + 10);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'italic');
    doc.text('Non encore sélectionné', margin + 4, y + 7);
  }
  
  y += 16;
  
  // ========== DESCRIPTION - COMPACT ==========
  drawMiniSectionTitle(doc, margin, y, 'Description');
  y += 5;
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  const splitDesc = doc.splitTextToSize(data.description || '-', contentWidth - 8);
  const descLines = Math.min(splitDesc.length, 3); // Max 3 lignes
  const descHeight = descLines * 4 + 4;
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, descHeight, 1.5, 1.5, 'FD');
  doc.text(splitDesc.slice(0, 3), margin + 4, y + 5);
  
  y += descHeight + 4;
  
  // ========== TABLEAU ARTICLES COMPACT ==========
  drawMiniSectionTitle(doc, margin, y, `Articles / Services (${data.articles.length})`);
  y += 4;
  
  const tableData = data.articles.map(art => [
    art.designation.length > 40 ? art.designation.substring(0, 37) + '...' : art.designation,
    art.quantity.toString(),
    art.unit,
    art.unitPrice ? formatMontant(art.unitPrice, data.currency) : '-',
    art.total ? formatMontant(art.total, data.currency) : '-',
  ]);
  
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', 'Unité', 'P.U.', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.marron,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLORS.textPrimary,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: COLORS.grisAlternate,
    },
    columnStyles: {
      0: { cellWidth: 65, halign: 'left' },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    tableLineColor: COLORS.border,
    tableLineWidth: 0.1,
  });
  
  // ========== TOTAUX ==========
  const finalY = doc.lastAutoTable.finalY + 3;
  
  if (data.totalAmount) {
    const totalsX = pageWidth - margin - 60;
    
    // TOTAL TTC - bien visible
    doc.setFillColor(...COLORS.orangeLight);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.8);
    doc.roundedRect(totalsX, finalY, 60, 12, 2, 2, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC:', totalsX + 4, finalY + 7);
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
    doc.text(formatMontant(data.totalAmount, data.currency), totalsX + 56, finalY + 7, { align: 'right' });
  }
  
  // ========== TRAÇABILITÉ - EN BAS COMPACT ==========
  const traceY = Math.max(finalY + 20, pageHeight - 55);
  
  drawMiniSectionTitle(doc, margin, traceY, '🔒 Traçabilité');
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, traceY + 4, contentWidth, 16, 1.5, 1.5, 'FD');
  
  // Liseré orange
  doc.setFillColor(...COLORS.orange);
  doc.rect(margin, traceY + 4, 2.5, 16, 'F');
  
  const traceCol = contentWidth / 5;
  const ty = traceY + 10;
  
  drawMiniTrace(doc, margin + 6, ty, 'Analyse', data.analyzedBy);
  drawMiniTrace(doc, margin + traceCol, ty, 'Chiffrage', data.pricedBy);
  drawMiniTrace(doc, margin + traceCol * 2, ty, 'Soumission', data.submittedValidationBy);
  drawMiniTrace(doc, margin + traceCol * 3, ty, 'Valid. Finance', data.validatedFinanceBy);
  drawMiniTrace(doc, margin + traceCol * 4, ty, 'Comptabilisé', data.comptabiliseBy);
  
  // ========== PIED DE PAGE COMPACT ==========
  addCompactFooter(doc);
  
  doc.save(`DA_${data.reference}.pdf`);
};

// Fonctions utilitaires pour le PDF DA - VERSION COMPACTE

function drawCompactInfo(doc: jsPDF, x: number, y: number, label: string, value: string, highlight: boolean = false): void {
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  
  doc.setFontSize(7);
  if (highlight) {
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
  } else {
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
  }
  
  let displayValue = value || '-';
  if (displayValue.length > 18) {
    displayValue = displayValue.substring(0, 15) + '...';
  }
  doc.text(displayValue, x, y + 4);
}

function drawMiniSectionTitle(doc: jsPDF, x: number, y: number, title: string): void {
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, y);
}

function drawMiniTrace(doc: jsPDF, x: number, y: number, label: string, value?: string): void {
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  
  doc.setFontSize(6);
  if (value) {
    doc.setTextColor(...COLORS.success);
    doc.setFont('helvetica', 'bold');
    doc.text('✓ ' + (value.length > 12 ? value.substring(0, 10) + '..' : value), x, y + 4);
  } else {
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'italic');
    doc.text('-', x, y + 4);
  }
}

function addCompactFooter(doc: jsPDF): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  const margin = 12;
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Ligne séparatrice
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    
    // Infos entreprise
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(`${COMPANY_INFO.name} | ${COMPANY_INFO.address} ${COMPANY_INFO.addressLine2} | ${COMPANY_INFO.phone1}`, margin, pageHeight - 13);
    
    // Mention légale
    doc.setFontSize(5);
    doc.setFont('helvetica', 'italic');
    doc.text('Document généré par KPM SYSTÈME – Toute modification invalide ce document', margin, pageHeight - 9);
    
    // Pagination
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i}/${pageCount}`, pageWidth - margin, pageHeight - 11, { align: 'right' });
    
    // Bande marron
    doc.setFillColor(...COLORS.marron);
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
  }
}

function drawSectionTitle(doc: jsPDF, y: number, margin: number, title: string): number {
  doc.setFillColor(...COLORS.orange);
  doc.roundedRect(margin, y, 3, 8, 0.5, 0.5, 'F');
  
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
    
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);
    
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(COMPANY_INFO.name, margin, pageHeight - 17);
    doc.text(`${COMPANY_INFO.address} ${COMPANY_INFO.addressLine2}`, margin, pageHeight - 13);
    doc.text(`${COMPANY_INFO.phone1} | ${COMPANY_INFO.email}`, margin, pageHeight - 9);
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Document généré automatiquement par KPM SYSTÈME – Toute modification manuelle invalide ce document',
      pageWidth / 2, pageHeight - 17,
      { align: 'center' }
    );
    
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 13, { align: 'right' });
    
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
  receiverName?: string;
  signatureDataUrl?: string;
  deliveryObservations?: string;
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
  
  // ========== EN-TÊTE ==========
  let y = 12;
  
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 3, 'F');
  
  // Logo KIMBO stylisé
  drawKimboLogo(doc, margin, y, 50);
  
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
  const sigY = doc.lastAutoTable.finalY + 10;
  
  // Delivery observations
  if (data.deliveryObservations) {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('Observations de livraison:', margin, sigY);
    doc.setTextColor(...COLORS.textPrimary);
    const splitObs = doc.splitTextToSize(data.deliveryObservations, contentWidth - 8);
    doc.text(splitObs.slice(0, 2), margin, sigY + 5);
  }
  
  const sigBoxY = data.deliveryObservations ? sigY + 15 : sigY;
  const boxWidth = 80;
  
  // Box "Livré par"
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, sigBoxY, boxWidth, 32, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Livré par:', margin + 4, sigBoxY + 8);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(data.deliveredBy || '________________________', margin + 4, sigBoxY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Date: ' + formatDateTime(data.deliveredAt), margin + 4, sigBoxY + 20);
  doc.text('Signature:', margin + 4, sigBoxY + 28);
  
  // Box "Reçu par" with actual signature
  doc.roundedRect(pageWidth - margin - boxWidth, sigBoxY, boxWidth, 32, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Reçu par:', pageWidth - margin - boxWidth + 4, sigBoxY + 8);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(data.receiverName || '________________________', pageWidth - margin - boxWidth + 4, sigBoxY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Signature:', pageWidth - margin - boxWidth + 4, sigBoxY + 20);
  
  // Embed actual signature image if available
  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, 'PNG', pageWidth - margin - boxWidth + 20, sigBoxY + 18, 40, 12);
    } catch (e) {
      console.warn('Could not embed signature image', e);
    }
  }
  
  // DÉCHARGE stamp for delivered BLs
  if (data.status === 'livre' || data.status === 'cloture') {
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.success);
    doc.setFont('helvetica', 'bold');
    const stampY = sigBoxY + 40;
    doc.setDrawColor(...COLORS.success);
    doc.setLineWidth(1.5);
    doc.roundedRect(pageWidth / 2 - 30, stampY, 60, 14, 3, 3, 'S');
    doc.text('DÉCHARGE', pageWidth / 2, stampY + 10, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Document valant preuve de réception', pageWidth / 2, stampY + 18, { align: 'center' });
  }
  
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
  classesSyscohada2?: number;
  compteComptable2?: string;
  natureCharge2?: string;
  centreCout2?: string;
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
  
  // EN-TÊTE
  let y = 12;
  
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 3, 'F');
  
  // Logo KIMBO stylisé
  drawKimboLogo(doc, margin, y, 50);
  
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
  
  // Montant principal - show both Débit and Crédit
  const amount = data.debit || data.credit;
  
  doc.setFillColor(...COLORS.orangeLight);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(1);
  doc.roundedRect(pageWidth - margin - 70, y, 70, 26, 2, 2, 'FD');
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉBIT', pageWidth - margin - 55, y + 6);
  doc.text('CRÉDIT', pageWidth - margin - 25, y + 6);
  
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMontant(data.debit, data.devise), pageWidth - margin - 55, y + 14, { align: 'left' });
  doc.text(formatMontant(data.credit, data.devise), pageWidth - margin - 25, y + 14, { align: 'left' });
  
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(`Solde: ${formatMontant(data.debit - data.credit, data.devise)}`, pageWidth - margin - 35, y + 22, { align: 'center' });
  
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
  
  // Show both classes side by side
  const hasSecondClass = data.classesSyscohada2 && data.compteComptable2;
  const classBoxWidth = hasSecondClass ? (contentWidth - 6) / 2 : contentWidth;
  
  // Class 6 - Charges (left)
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, classBoxWidth, 28, 2, 2, 'FD');
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
  if (!hasSecondClass) {
    doc.text(`Centre de coût: ${data.centreCout || 'Non spécifié'}`, margin + 8, cardY + 21);
  }
  
  // Class 5 - Trésorerie (right)
  if (hasSecondClass) {
    const rightBoxX = margin + classBoxWidth + 6;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.3);
    doc.roundedRect(rightBoxX, y, classBoxWidth, 28, 2, 2, 'FD');
    doc.setFillColor(...COLORS.orange);
    doc.rect(rightBoxX, y, 3, 28, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.orange);
    doc.setFont('helvetica', 'bold');
    doc.text(`Classe ${data.classesSyscohada2}`, rightBoxX + 8, cardY);
    
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    doc.text(`Compte: ${data.compteComptable2}`, rightBoxX + 8, cardY + 7);
    doc.text(`Nature: ${data.natureCharge2 || ''}`, rightBoxX + 8, cardY + 14);
  }
  
  // Centre de coût below both boxes
  y += 30;
  if (data.centreCout) {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text(`Centre de coût: ${data.centreCout}`, margin + 8, y);
    y += 4;
  }
  y += 4;
  
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
  
  // Tableau des écritures comptables (double entrée)
  if (hasSecondClass) {
    y = drawSectionTitle(doc, y, margin, 'ÉCRITURES COMPTABLES');
    
    autoTable(doc, {
      startY: y,
      head: [['N° Compte', 'Nature', 'Débit', 'Crédit', 'Solde']],
      body: [
        [
          data.compteComptable,
          `Classe ${data.classesSyscohada} - ${data.natureCharge}`,
          formatMontant(data.debit, data.devise),
          '',
          formatMontant(data.debit, data.devise),
        ],
        [
          data.compteComptable2 || '',
          `Classe ${data.classesSyscohada2} - ${data.natureCharge2 || ''}`,
          '',
          formatMontant(data.credit, data.devise),
          '',
        ],
      ],
      theme: 'grid',
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
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: COLORS.grisTresClair,
      },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold', font: 'courier' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });
    
    y = doc.lastAutoTable.finalY + 10;
  }
  
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

// ===================== DÉCHARGE COMPTABLE PDF - STYLE KIMBO =====================
interface DechargeArticle {
  designation: string;
  quantity?: number;
  unit?: string;
  montant?: number;
  date?: string;
}

interface DechargeComptableData {
  type: 'DA' | 'NOTE_FRAIS';
  reference: string;
  montant: number;
  currency: string;
  caisseName: string;
  caisseCode: string;
  comptableName: string;
  paidAt: string;
  beneficiaire?: string;
  description?: string;
  modePaiement?: string;
  referencePaiement?: string;
  articles?: DechargeArticle[];
}

// Convertir un montant en lettres (français)
const montantEnLettres = (n: number): string => {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  if (n === 0) return 'zéro';
  if (n < 0) return 'moins ' + montantEnLettres(-n);
  
  const convert = (num: number): string => {
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (t === 7 || t === 9) {
        return tens[t] + (u === 1 && t !== 9 ? '-et-' : '-') + (u < 10 ? teens[u] : units[u]);
      }
      if (u === 0) return tens[t] + (t === 8 ? 's' : '');
      if (u === 1 && t !== 8) return tens[t] + '-et-un';
      return tens[t] + '-' + units[u];
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      const prefix = h === 1 ? 'cent' : units[h] + ' cent';
      if (rest === 0) return prefix + (h > 1 ? 's' : '');
      return prefix + ' ' + convert(rest);
    }
    if (num < 1000000) {
      const k = Math.floor(num / 1000);
      const rest = num % 1000;
      const prefix = k === 1 ? 'mille' : convert(k) + ' mille';
      if (rest === 0) return prefix;
      return prefix + ' ' + convert(rest);
    }
    if (num < 1000000000) {
      const m = Math.floor(num / 1000000);
      const rest = num % 1000000;
      const prefix = m === 1 ? 'un million' : convert(m) + ' millions';
      if (rest === 0) return prefix;
      return prefix + ' ' + convert(rest);
    }
    return num.toString();
  };
  
  // ARRONDI COMPTABLE DAF: arrondi au supérieur avant conversion en lettres
  return convert(Math.ceil(n));
};

export const exportDechargeComptableToPDF = async (data: DechargeComptableData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // ========== EN-TÊTE KIMBO ==========
  let y = 15;
  
  // Logo KIMBO
  drawKimboLogo(doc, margin, y, 50);
  
  // Nom société et slogan à droite
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('KIMBO AFRICA S.A', pageWidth - margin, y + 5, { align: 'right' });
  
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('CONSTRUCTION BTP - AMÉNAGEMENT FONCIER - LOTISSEMENT', pageWidth - margin, y + 10, { align: 'right' });
  doc.text('PROMOTION IMMOBILIÈRE - FOURNITURE DE MATÉRIEL', pageWidth - margin, y + 14, { align: 'right' });
  
  y = 40;
  
  // ========== TITRE DÉCHARGE ==========
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉCHARGE', pageWidth / 2, y, { align: 'center' });
  
  // Sous-titre avec type
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  const typeLabel = data.type === 'DA' ? 'Demande d\'Achat' : 'Note de Frais';
  doc.text(`(${typeLabel} - ${data.reference})`, pageWidth / 2, y + 7, { align: 'center' });
  
  y = 60;
  
  // ========== CORPS DU DOCUMENT - STYLE FORMULAIRE ==========
  const lineHeight = 10;
  const dotLineEndX = pageWidth - margin;
  
  // Je soussigné(e)
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  doc.text('Je soussigné(e)', margin, y);
  
  // Ligne pointillée avec nom du bénéficiaire
  const benefText = data.beneficiaire || '_______________';
  doc.setFont('helvetica', 'bold');
  doc.text(benefText, margin + 32, y);
  drawDottedLine(doc, margin + 32 + doc.getTextWidth(benefText) + 2, y, dotLineEndX);
  
  y += lineHeight * 1.3;
  
  // Reconnais avoir reçu la somme de
  doc.setFont('helvetica', 'normal');
  doc.text('Reconnais avoir reçu la somme de :', margin, y);
  
  y += lineHeight;
  
  // Montant en chiffres
  const montantChiffres = formatMontant(data.montant, data.currency);
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text(montantChiffres, margin, y);
  
  y += lineHeight;
  
  // Montant en lettres
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textSecondary);
  doc.setFont('helvetica', 'italic');
  const lettres = montantEnLettres(data.montant) + ' francs CFA';
  const splitLettres = doc.splitTextToSize(`(${lettres})`, contentWidth);
  doc.text(splitLettres, margin, y);
  
  y += splitLettres.length * 5 + lineHeight * 0.8;
  
  // De la part de (avec nom complet du comptable) - ESPACE AJOUTÉ
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  doc.text('de la part de Monsieur, Madame :', margin, y);
  
  // Nom complet du comptable sur nouvelle ligne pour plus de clarté
  y += lineHeight * 0.8;
  doc.setFont('helvetica', 'bold');
  const comptableFullName = data.comptableName || 'Le Comptable';
  doc.text(comptableFullName, margin, y);
  drawDottedLine(doc, margin + doc.getTextWidth(comptableFullName) + 2, y, dotLineEndX);
  
  y += lineHeight * 1.3;
  
  // Source du paiement
  doc.setFont('helvetica', 'normal');
  doc.text('via la caisse :', margin, y);
  
  doc.setFont('helvetica', 'bold');
  const caisseText = `${data.caisseName} (${data.caisseCode})`;
  doc.text(caisseText, margin + 25, y);
  drawDottedLine(doc, margin + 25 + doc.getTextWidth(caisseText) + 2, y, dotLineEndX);
  
  y += lineHeight * 1.3;
  
  // Mode de paiement
  doc.setFont('helvetica', 'normal');
  doc.text('Mode de paiement :', margin, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text(data.modePaiement || 'Espèces', margin + 38, y);
  
  if (data.referencePaiement) {
    doc.setFont('helvetica', 'normal');
    doc.text(' - Réf:', margin + 38 + doc.getTextWidth(data.modePaiement || 'Espèces') + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.referencePaiement, margin + 52 + doc.getTextWidth(data.modePaiement || 'Espèces'), y);
  }
  
  y += lineHeight * 1.3;
  
  // Cette décharge a pour objet
  doc.setFont('helvetica', 'normal');
  doc.text('Cette décharge a pour objet :', margin, y);
  
  y += lineHeight * 0.7;
  
  // Description (limitée à 2 lignes max)
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.textSecondary);
  const descText = data.description || 'Paiement ' + (data.type === 'DA' ? 'demande d\'achat' : 'note de frais');
  const splitDesc = doc.splitTextToSize(descText, contentWidth).slice(0, 2);
  doc.text(splitDesc, margin, y);
  
  y += splitDesc.length * 5 + lineHeight * 0.8;
  
  // ========== TABLEAU DES ARTICLES (si fournis) ==========
  if (data.articles && data.articles.length > 0) {
    y += 5;
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('Détail des éléments :', margin, y);
    
    y += 5;
    
    // Préparer les données du tableau selon le type
    const isNoteFrais = data.type === 'NOTE_FRAIS';
    
    const tableHead = isNoteFrais
      ? [['Date', 'Désignation', 'Montant']]
      : [['Désignation', 'Qté', 'Unité']];
    
    const tableBody = data.articles.map(article => {
      if (isNoteFrais) {
        return [
          article.date ? formatDate(article.date) : '-',
          article.designation,
          article.montant ? formatMontant(article.montant, data.currency) : '-'
        ];
      } else {
        return [
          article.designation,
          article.quantity?.toString() || '-',
          article.unit || '-'
        ];
      }
    });
    
    autoTable(doc, {
      startY: y,
      head: tableHead,
      body: tableBody,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: COLORS.textPrimary,
        lineColor: COLORS.border,
      },
      headStyles: {
        fillColor: COLORS.marron,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [250, 250, 247],
      },
      columnStyles: isNoteFrais
        ? {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 35, halign: 'right' as const },
          }
        : {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 20, halign: 'center' as const },
            2: { cellWidth: 25, halign: 'center' as const },
          },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
    });
    
    y = (doc as any).lastAutoTable.finalY + 8;
  }
  
  // Ligne pointillée de fin
  drawDottedLine(doc, margin, y, dotLineEndX);
  
  y += lineHeight * 1.2;
  
  // Mention des exemplaires
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  doc.text('Et est établie en deux (2) exemplaires, dont un remis à chacune des parties.', margin, y);
  
  y += lineHeight;
  
  // Fait à Abidjan, le
  doc.text('Fait à Abidjan, le', margin, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(data.paidAt), margin + 32, y);
  
  // ========== SIGNATURES - POSITION FIXE EN BAS ==========
  // On place les signatures à une position fixe pour garantir qu'elles sont visibles
  const signaturesY = Math.max(y + lineHeight * 2, 200); // Minimum 200mm du haut
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', pageWidth / 2, signaturesY, { align: 'center' });
  
  const sigBoxY = signaturesY + 8;
  
  // Cadres signatures
  const sigWidth = (contentWidth - 30) / 2;
  const sigHeight = 25;
  
  // Receveur (bénéficiaire)
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text('Receveur', margin + sigWidth / 2, sigBoxY, { align: 'center' });
  
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, sigBoxY + 3, sigWidth, sigHeight, 2, 2, 'S');
  
  // Donneur (comptable)
  doc.setTextColor(...COLORS.orange);
  doc.text('Donneur', pageWidth - margin - sigWidth / 2, sigBoxY, { align: 'center' });
  
  doc.roundedRect(pageWidth - margin - sigWidth, sigBoxY + 3, sigWidth, sigHeight, 2, 2, 'S');
  
  // Noms sous les cadres
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(data.beneficiaire || '(Bénéficiaire)', margin + sigWidth / 2, sigBoxY + sigHeight + 8, { align: 'center' });
  doc.text(comptableFullName, pageWidth - margin - sigWidth / 2, sigBoxY + sigHeight + 8, { align: 'center' });
  
  const fileName = data.type === 'DA'
    ? `DECHARGE_DA_${data.reference}.pdf`
    : `DECHARGE_NDF_${data.reference}.pdf`;
  
  doc.save(fileName);
};

// Fonction utilitaire pour dessiner une ligne pointillée
function drawDottedLine(doc: jsPDF, startX: number, y: number, endX: number): void {
  doc.setDrawColor(...COLORS.textMuted);
  doc.setLineWidth(0.2);
  const dotSpacing = 2;
  for (let x = startX; x < endX; x += dotSpacing) {
    doc.line(x, y + 1, x + 0.5, y + 1);
  }
}

// ===================== FICHE APPROBATION DAF =====================
export interface DAFValidationExportData {
  reference: string;
  department: string;
  category: string;
  priority: string;
  priorityLabel: string;
  totalAmount: number;
  currency: string;
  fournisseur: string;
  justification?: string;
  createdBy: string;
  createdAt: string;
  articles: Array<{
    designation: string;
    quantity: number;
    unit: string;
    fournisseur: string;
    unitPrice: number;
    total: number;
    currency: string;
  }>;
  besoinTitle?: string;
  besoinId?: string;
}

export const exportDAFValidationToPDF = async (data: DAFValidationExportData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // ========== EN-TÊTE ==========
  let y = 10;

  // Bande supérieure orange
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Logo KIMBO
  drawKimboLogo(doc, margin, y, 50);

  // Titre du document
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHE D\'APPROBATION DAF', pageWidth - margin, y + 6, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textSecondary);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.reference}`, pageWidth - margin, y + 12, { align: 'right' });

  // Date d'impression
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Imprimé le ${format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}`, pageWidth - margin, y + 17, { align: 'right' });

  // Ligne séparatrice
  y = 32;
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  y = 38;

  // ========== RÉCAPITULATIF GÉNÉRAL ==========
  doc.setFillColor(...COLORS.grisTresClair);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');

  // Montant total en grand
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTANT TOTAL', margin + 5, y + 8);

  doc.setFontSize(18);
  doc.setTextColor(...COLORS.orange);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMontant(data.totalAmount, data.currency), margin + 5, y + 18);

  // Infos à droite
  const rightColX = margin + contentWidth * 0.55;
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Fournisseur principal', rightColX, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(data.fournisseur || 'Multiple', rightColX, y + 11);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Priorité', rightColX, y + 18);
  
  const isPriorityHigh = ['urgente', 'haute'].includes(data.priority?.toLowerCase() || '');
  doc.setFontSize(9);
  doc.setTextColor(...(isPriorityHigh ? COLORS.danger : COLORS.textPrimary));
  doc.setFont('helvetica', 'bold');
  doc.text(data.priorityLabel || data.priority, rightColX, y + 23);

  y = y + 34;

  // ========== INFORMATIONS GÉNÉRALES ==========
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS GÉNÉRALES', margin, y);

  y += 5;
  doc.setFillColor(...COLORS.grisAlternate);
  doc.roundedRect(margin, y, contentWidth, 20, 1.5, 1.5, 'F');

  const colWidth = contentWidth / 4;
  const labels = ['Département', 'Catégorie', 'Demandeur', 'Créée le'];
  const values = [data.department, data.category, data.createdBy, formatDate(data.createdAt)];

  for (let i = 0; i < 4; i++) {
    const x = margin + 4 + (i * colWidth);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(labels[i], x, y + 6);
    
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'bold');
    const value = values[i] || '-';
    // Tronquer si trop long
    const maxWidth = colWidth - 8;
    let displayValue = value;
    while (doc.getTextWidth(displayValue) > maxWidth && displayValue.length > 3) {
      displayValue = displayValue.slice(0, -1);
    }
    if (displayValue !== value) displayValue += '...';
    doc.text(displayValue, x, y + 12);
  }

  // Besoin source si présent
  if (data.besoinTitle) {
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('Besoin source', margin + 4, y + 17);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    doc.text(data.besoinTitle, margin + 4 + colWidth, y + 17);
  }

  y += 26;

  // ========== TABLEAU DES ARTICLES CHIFFRÉS ==========
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAIL DES ARTICLES CHIFFRÉS', margin, y);

  y += 3;

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Désignation', styles: { halign: 'left' } },
      { content: 'Qté', styles: { halign: 'center' } },
      { content: 'Fournisseur', styles: { halign: 'left' } },
      { content: 'Prix unitaire', styles: { halign: 'right' } },
      { content: 'Total', styles: { halign: 'right' } },
    ]],
    body: data.articles.map((art) => [
      art.designation,
      `${art.quantity} ${art.unit}`,
      art.fournisseur || '-',
      formatMontant(art.unitPrice, art.currency),
      formatMontant(art.total, art.currency),
    ]),
    foot: [[
      { content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: COLORS.orangeLight } },
      { content: formatMontant(data.totalAmount, data.currency), styles: { halign: 'right', fontStyle: 'bold', textColor: COLORS.marron, fillColor: COLORS.orangeLight } },
    ]],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: COLORS.textPrimary,
      lineColor: COLORS.borderLight,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: COLORS.marron,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: COLORS.grisAlternate,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 40 },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 33, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ========== JUSTIFICATION DU CHOIX ==========
  if (data.justification) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text('JUSTIFICATION DU CHOIX DE FOURNISSEUR', margin, y);

    y += 4;
    doc.setFillColor(...COLORS.orangeLight);
    doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'F');

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    const justifLines = doc.splitTextToSize(data.justification, contentWidth - 8);
    doc.text(justifLines.slice(0, 3), margin + 4, y + 6);

    y += 22;
  }

  // ========== ZONE DE DÉCISION ==========
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉCISION FINANCIÈRE', margin, y);

  y += 4;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 40, 2, 2, 'S');

  // Cases à cocher
  const checkboxSize = 4;
  const checkboxY = y + 10;

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');

  // Option Approuvée
  doc.rect(margin + 8, checkboxY, checkboxSize, checkboxSize, 'S');
  doc.text('APPROUVÉE', margin + 15, checkboxY + 3);

  // Option Refusée
  doc.rect(margin + 50, checkboxY, checkboxSize, checkboxSize, 'S');
  doc.text('REFUSÉE', margin + 57, checkboxY + 3);

  // Option Révision
  doc.rect(margin + 85, checkboxY, checkboxSize, checkboxSize, 'S');
  doc.text('RÉVISION DEMANDÉE', margin + 92, checkboxY + 3);

  // Ligne commentaire
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Commentaire:', margin + 8, y + 22);
  drawDottedLine(doc, margin + 30, y + 21, pageWidth - margin - 8);
  drawDottedLine(doc, margin + 8, y + 28, pageWidth - margin - 8);

  // Signature
  doc.text('Date et signature du DAF:', margin + 8, y + 37);
  drawDottedLine(doc, margin + 50, y + 36, pageWidth - margin - 8);

  // ========== PIED DE PAGE ==========
  const footerY = doc.internal.pageSize.getHeight() - 12;
  
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.name} - ${COMPANY_INFO.address} ${COMPANY_INFO.addressLine2}`, pageWidth / 2, footerY + 1, { align: 'center' });
  doc.text(`Tél: ${COMPANY_INFO.phone1} | Email: ${COMPANY_INFO.email}`, pageWidth / 2, footerY + 5, { align: 'center' });

  // Sauvegarde
  doc.save(`VALIDATION_DAF_${data.reference}.pdf`);
};

// ===================== BESOIN INTERNE - EXPORT PDF =====================
interface BesoinExportData {
  reference: string;
  title: string;
  status: string;
  statusLabel: string;
  besoinType?: string;
  urgency: string;
  department: string;
  createdBy: string;
  createdAt: string;
  desiredDate?: string;
  lieuLivraison?: string;
  siteProjet?: string;
  description?: string;
  takenBy?: string;
  takenAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  nextRecipient?: string;
  lignes: Array<{
    designation: string;
    category: string;
    quantity: number;
    unit: string;
    urgency: string;
    justification?: string;
  }>;
}

export const exportBesoinToPDF = async (data: BesoinExportData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Bande supérieure orange
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  let y = 8;
  drawKimboLogo(doc, margin, y, 50);

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  doc.text('BESOIN INTERNE', pageWidth - margin, y + 4, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(data.reference, pageWidth - margin, y + 10, { align: 'right' });

  // Statut
  const statusText = (data.statusLabel || data.status).toUpperCase();
  let statusBgColor = COLORS.grisClairFond;
  let statusTextColor = COLORS.textMuted;
  const s = data.status.toLowerCase();
  if (['accepte'].includes(s)) {
    statusBgColor = COLORS.successLight;
    statusTextColor = COLORS.success;
  } else if (['refuse', 'annulee'].includes(s)) {
    statusBgColor = COLORS.dangerLight;
    statusTextColor = COLORS.danger;
  } else if (['pris_en_charge', 'retourne', 'cree'].includes(s)) {
    statusBgColor = COLORS.warningLight;
    statusTextColor = COLORS.warning;
  }
  doc.setFontSize(6);
  const statusWidth = doc.getTextWidth(statusText) + 6;
  doc.setFillColor(...statusBgColor);
  doc.roundedRect(pageWidth - margin - statusWidth, y + 13, statusWidth, 5, 1, 1, 'F');
  doc.setTextColor(...statusTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 16.5, { align: 'center' });

  y = 24;
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y = 28;

  // Titre / objet
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.marron);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(data.title || '-', contentWidth);
  doc.text(titleLines.slice(0, 2), margin, y);
  y += titleLines.slice(0, 2).length * 5 + 2;

  // Bloc infos
  doc.setFillColor(...COLORS.grisTresClair);
  doc.setDrawColor(...COLORS.borderLight);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'FD');

  const c1 = margin + 4;
  const c2 = margin + contentWidth * 0.25;
  const c3 = margin + contentWidth * 0.5;
  const c4 = margin + contentWidth * 0.75;

  drawCompactInfo(doc, c1, y + 6, 'Département', data.department);
  drawCompactInfo(doc, c2, y + 6, 'Demandeur', data.createdBy);
  drawCompactInfo(doc, c3, y + 6, 'Type', data.besoinType || '-');
  drawCompactInfo(doc, c4, y + 6, 'Urgence', data.urgency, data.urgency.toLowerCase().includes('urgent') || data.urgency.toLowerCase().includes('critique'));

  drawCompactInfo(doc, c1, y + 14, 'Créé le', formatDate(data.createdAt));
  drawCompactInfo(doc, c2, y + 14, 'Date souhaitée', data.desiredDate ? formatDate(data.desiredDate) : '-');
  drawCompactInfo(doc, c3, y + 14, 'Site / Projet', data.siteProjet || '-');
  drawCompactInfo(doc, c4, y + 14, 'Lieu livraison', data.lieuLivraison || '-');

  y += 26;

  // Prochain destinataire
  if (data.nextRecipient) {
    doc.setFillColor(...COLORS.orangeLight);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('Prochain destinataire :', margin + 4, y + 4);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.marron);
    doc.setFont('helvetica', 'bold');
    doc.text(data.nextRecipient, margin + 4, y + 8.5);
    y += 14;
  }

  // Description
  if (data.description && data.description.trim()) {
    drawMiniSectionTitle(doc, margin, y, 'Description');
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    const splitDesc = doc.splitTextToSize(data.description, contentWidth - 8);
    const lineHeight = 4;
    const padding = 4;
    const maxBlockHeight = pageHeight - margin - 60; // garde de la place pour le tableau et le pied
    let descLinesArr: string[] = splitDesc;
    let descHeight = descLinesArr.length * lineHeight + padding * 2;

    // Si la description ne tient pas sur la page actuelle, on saute
    if (y + descHeight > pageHeight - 25) {
      // Cap la hauteur à l'espace dispo restant pour éviter un débordement
      if (descHeight > maxBlockHeight) {
        const maxLines = Math.max(1, Math.floor((maxBlockHeight - padding * 2) / lineHeight));
        descLinesArr = splitDesc.slice(0, maxLines);
        if (splitDesc.length > maxLines && descLinesArr.length > 0) {
          descLinesArr[descLinesArr.length - 1] = descLinesArr[descLinesArr.length - 1].replace(/.{0,3}$/, '...');
        }
        descHeight = descLinesArr.length * lineHeight + padding * 2;
      }
    }
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.orange);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, descHeight, 1.5, 1.5, 'FD');
    doc.text(descLinesArr, margin + padding, y + padding + 1);
    y += descHeight + 4;
  }

  // Lignes de besoin avec numérotation séquentielle
  drawMiniSectionTitle(doc, margin, y, `Lignes de besoin (${data.lignes.length})`);
  y += 4;

  const tableData = data.lignes.map((l, idx) => [
    String(idx + 1),
    l.designation,
    l.category,
    l.quantity.toString(),
    l.unit,
    l.urgency,
    l.justification || '-',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['N°', 'Désignation', 'Catégorie', 'Qté', 'Unité', 'Urgence', 'Justification']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.marron,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2,
      halign: 'left',
    },
    bodyStyles: { fontSize: 7, textColor: COLORS.textPrimary, cellPadding: 2 },
    alternateRowStyles: { fillColor: COLORS.grisAlternate },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 25, halign: 'left' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 'auto', halign: 'left' },
    },
    margin: { left: margin, right: margin },
    tableLineColor: COLORS.border,
    tableLineWidth: 0.1,
  });

  // Traçabilité — bloc avec saut de page si nécessaire
  const finalY = doc.lastAutoTable.finalY + 6;
  const traceBlockHeight = 22; // titre + cadre
  let traceY = finalY;

  // Si pas assez de place pour le bloc complet + pied de page, on passe à une nouvelle page
  if (traceY + traceBlockHeight > pageHeight - 18) {
    doc.addPage();
    traceY = margin + 4;
  }

  drawMiniSectionTitle(doc, margin, traceY, '🔒 Traçabilité');
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.orange);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, traceY + 4, contentWidth, 14, 1.5, 1.5, 'FD');
  doc.setFillColor(...COLORS.orange);
  doc.rect(margin, traceY + 4, 2.5, 14, 'F');

  const tCol = contentWidth / 3;
  const ty = traceY + 10;
  drawMiniTrace(doc, margin + 6, ty, 'Créé par', data.createdBy);
  drawMiniTrace(doc, margin + tCol, ty, 'Pris en charge', data.takenBy);
  drawMiniTrace(doc, margin + tCol * 2, ty, 'Décision', data.decidedBy);

  addCompactFooter(doc);
  doc.save(`BESOIN_${data.reference}.pdf`);
};
