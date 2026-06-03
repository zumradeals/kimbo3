import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloadAttempted: boolean;
}

/**
 * Détecte les erreurs de chargement de chunks (souvent après un déploiement
 * ou un changement de version) qui provoquent les pages blanches dans
 * Chrome / Edge. On recharge automatiquement la page (une seule fois) pour
 * récupérer les nouveaux assets.
 */
function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = (error as Error)?.message ?? String(error);
  const name = (error as Error)?.name ?? "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

function tryReloadOnce(key = "kpm:chunk-reload-at", cooldownMs = 30_000): boolean {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(key) ?? "0");
    // Évite la boucle infinie de rechargements
    if (now - last < cooldownMs) return false;
    sessionStorage.setItem(key, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, reloadAttempted: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, reloadAttempted: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    const reloaded = isChunkLoadError(error)
      ? tryReloadOnce()
      : // Erreur runtime inattendue : on tente un rechargement silencieux
        // une seule fois (cooldown 2 min) pour éviter une page d'erreur
        // pénible pour les utilisateurs métier. Si l'erreur persiste après
        // reload, on affiche le fallback manuel.
        tryReloadOnce("kpm:runtime-reload-at", 120_000);
    this.setState({ reloadAttempted: reloaded });
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem("kpm:chunk-reload-at");
      sessionStorage.removeItem("kpm:runtime-reload-at");
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Mise à jour de l'application…</p>
            </div>
          </div>
        );
      }

      // Si un rechargement automatique vient d'être déclenché, on affiche
      // juste un spinner le temps que la page se recharge. Le fallback
      // manuel n'apparaît que si l'erreur se répète (cooldown bloque le
      // reload automatique) — preuve qu'un simple reload ne suffit pas.
      if (this.state.reloadAttempted) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Récupération en cours…</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md w-full rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
            <p className="text-sm text-muted-foreground">
              L'application a rencontré un problème. Rechargez la page pour continuer.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Installe des écouteurs globaux pour détecter les erreurs de chargement
 * de chunks au runtime (en dehors du cycle de rendu React), par exemple
 * lors d'un import dynamique de route après un déploiement.
 */
export function installChunkErrorHandler() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
      tryReloadOnce();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      tryReloadOnce();
    }
  });
}