/**
 * Calcul d'amortissement linéaire et dégressif
 * Conforme aux règles SYSCOHADA
 */

export interface AmortissementLigne {
  annee: number;
  vncDebut: number;
  annuite: number;
  cumulAmortissements: number;
  vncFin: number;
  tauxLineaire?: number;
  anneesRestantes?: number;
}

export interface AmortissementParams {
  valeurAcquisition: number;
  dureeVieAnnees: number;
  dateAcquisition: string; // ISO date
  dateDebutExercice?: string; // ISO date
  moisAcquisition?: string; // Janvier, Février, etc.
  mode: 'lineaire' | 'degressif' | 'non_amortissable';
}

const MOIS_MAP: Record<string, number> = {
  'Janvier': 12, 'Février': 11, 'Mars': 10, 'Avril': 9,
  'Mai': 8, 'Juin': 7, 'Juillet': 6, 'Août': 5,
  'Septembre': 4, 'Octobre': 3, 'Novembre': 2, 'Décembre': 1,
};

/**
 * Coefficient dégressif selon durée SYSCOHADA
 */
function getCoefficient(duree: number): number {
  if (duree < 5) return 1.25;
  if (duree < 7) return 1.75;
  return 2.25;
}

/**
 * Calcul prorata temporis pour amortissement linéaire
 * Basé sur 360 jours
 */
function calculerProrata(dateAcquisition: string, dateDebutExercice?: string): { prorata1: number; prorataFin: number } {
  if (!dateDebutExercice) {
    // Si pas de date d'exercice, on prend le 1er janvier de l'année d'acquisition
    const year = new Date(dateAcquisition).getFullYear();
    dateDebutExercice = `${year}-01-01`;
  }

  const dAcq = new Date(dateAcquisition);
  const dExo = new Date(dateDebutExercice);

  // Calcul en jours/360 (convention comptable)
  const diffMs = dAcq.getTime() - dExo.getTime();
  const diffJours = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const joursUtilises1 = 360 - diffJours;
  const joursUtilisesFin = 360 - joursUtilises1;

  return {
    prorata1: Math.max(0, Math.min(360, joursUtilises1)) / 360,
    prorataFin: Math.max(0, Math.min(360, joursUtilisesFin)) / 360,
  };
}

/**
 * Tableau d'amortissement LINÉAIRE
 */
export function calculerAmortissementLineaire(params: AmortissementParams): AmortissementLigne[] {
  const { valeurAcquisition, dureeVieAnnees, dateAcquisition, dateDebutExercice } = params;
  if (valeurAcquisition <= 0 || dureeVieAnnees <= 0) return [];

  const { prorata1, prorataFin } = calculerProrata(dateAcquisition, dateDebutExercice);
  const annuiteComplete = valeurAcquisition / dureeVieAnnees;

  const lignes: AmortissementLigne[] = [];
  let cumul = 0;
  const nbLignes = prorata1 < 1 ? dureeVieAnnees + 1 : dureeVieAnnees;

  for (let i = 1; i <= nbLignes; i++) {
    const vncDebut = i === 1 ? valeurAcquisition : lignes[i - 2].vncFin;
    
    let annuite: number;
    if (i === 1) {
      annuite = annuiteComplete * prorata1;
    } else if (i === nbLignes && prorata1 < 1) {
      annuite = annuiteComplete * prorataFin;
    } else {
      annuite = annuiteComplete;
    }

    // Arrondir à 2 décimales
    annuite = Math.round(annuite * 100) / 100;
    
    // S'assurer que la VNC ne devienne pas négative
    if (annuite > vncDebut) annuite = vncDebut;

    cumul += annuite;
    const vncFin = Math.round((vncDebut - annuite) * 100) / 100;

    lignes.push({
      annee: i,
      vncDebut: Math.round(vncDebut * 100) / 100,
      annuite,
      cumulAmortissements: Math.round(cumul * 100) / 100,
      vncFin: Math.max(0, vncFin),
    });
  }

  return lignes;
}

/**
 * Tableau d'amortissement DÉGRESSIF
 */
export function calculerAmortissementDegressif(params: AmortissementParams): AmortissementLigne[] {
  const { valeurAcquisition, dureeVieAnnees, moisAcquisition } = params;
  if (valeurAcquisition <= 0 || dureeVieAnnees <= 0) return [];

  const coefficient = getCoefficient(dureeVieAnnees);
  const tauxDegressif = (1 / dureeVieAnnees) * coefficient;
  const nbMois1 = moisAcquisition ? (MOIS_MAP[moisAcquisition] || 12) : 12;

  const lignes: AmortissementLigne[] = [];
  let cumul = 0;

  for (let i = 1; i <= dureeVieAnnees; i++) {
    const vncDebut = i === 1 ? valeurAcquisition : lignes[i - 2].vncFin;
    if (vncDebut <= 0) break;

    const anneesRestantes = dureeVieAnnees - i + 1;
    const tauxLineaire = 1 / anneesRestantes;

    // On utilise le taux le plus élevé entre dégressif et linéaire
    const tauxApplique = Math.max(tauxDegressif, tauxLineaire);

    let annuite = vncDebut * tauxApplique;

    // Prorata 1ère année
    if (i === 1) {
      annuite = annuite * nbMois1 / 12;
    }

    annuite = Math.round(annuite * 100) / 100;
    if (annuite > vncDebut) annuite = vncDebut;

    cumul += annuite;
    const vncFin = Math.round((vncDebut - annuite) * 100) / 100;

    lignes.push({
      annee: i,
      vncDebut: Math.round(vncDebut * 100) / 100,
      annuite,
      cumulAmortissements: Math.round(cumul * 100) / 100,
      vncFin: Math.max(0, vncFin),
      tauxLineaire: Math.round(tauxLineaire * 10000) / 100,
      anneesRestantes,
    });
  }

  return lignes;
}

/**
 * Calcul principal - dispatch selon le mode
 */
export function calculerAmortissement(params: AmortissementParams): AmortissementLigne[] {
  if (params.mode === 'non_amortissable') return [];
  if (params.mode === 'degressif') return calculerAmortissementDegressif(params);
  return calculerAmortissementLineaire(params);
}

/**
 * Retourne les infos de coefficient pour affichage
 */
export function getInfosDegressif(duree: number) {
  const coefficient = getCoefficient(duree);
  const taux = (1 / duree) * coefficient;
  return {
    coefficient,
    tauxDegressif: Math.round(taux * 10000) / 100,
  };
}
