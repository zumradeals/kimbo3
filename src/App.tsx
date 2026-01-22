import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AuditLogs from "./pages/AuditLogs";
import Reports from "./pages/Reports";
import AdminUsers from "./pages/admin/Users";
import AdminDepartments from "./pages/admin/Departments";
import AdminSettings from "./pages/admin/Settings";
import AdminRoles from "./pages/admin/Roles";
import AdminUnits from "./pages/admin/Units";
import AdminPaymentCategories from "./pages/admin/PaymentCategories";
import AdminComptesComptables from "./pages/admin/ComptesComptables";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

// Module Expressions de besoin
import ExpressionsList from "./pages/expressions-besoin/ExpressionsList";
import ExpressionCreate from "./pages/expressions-besoin/ExpressionCreate";
import ExpressionDetail from "./pages/expressions-besoin/ExpressionDetail";

// Module Besoins
import BesoinsList from "./pages/besoins/BesoinsList";
import BesoinCreate from "./pages/besoins/BesoinCreate";
import BesoinDetail from "./pages/besoins/BesoinDetail";
import DossierComplet from "./pages/besoins/DossierComplet";

// Module DA
import DAList from "./pages/demandes-achat/DAList";
import DACreate from "./pages/demandes-achat/DACreate";
import DADetail from "./pages/demandes-achat/DADetail";

// Module BL
import BLList from "./pages/bons-livraison/BLList";
import BLCreate from "./pages/bons-livraison/BLCreate";
import BLDetail from "./pages/bons-livraison/BLDetail";

// Module Fournisseurs
import Fournisseurs from "./pages/achats/Fournisseurs";

// Module Tiers
import TiersList from "./pages/tiers/TiersList";

// Module Comptabilité
import Comptabilite from "./pages/comptabilite/Comptabilite";
import ComptabiliteDetail from "./pages/comptabilite/ComptabiliteDetail";

// Module Stock
import StockList from "./pages/stock/StockList";
import StockMovements from "./pages/stock/StockMovements";
import StockDetail from "./pages/stock/StockDetail";
import StockCategories from "./pages/admin/StockCategories";

// Module Projets
import ProjetsList from "./pages/projets/ProjetsList";
import ProjetDetail from "./pages/projets/ProjetDetail";

// Module Notes de frais
import NotesFraisList from "./pages/notes-frais/NotesFraisList";
import NoteFraisCreate from "./pages/notes-frais/NoteFraisCreate";
import NoteFraisDetail from "./pages/notes-frais/NoteFraisDetail";
import NoteFraisEdit from "./pages/notes-frais/NoteFraisEdit";

// Notifications
import Notifications from "./pages/Notifications";

// Profil et Utilisateurs
import Profile from "./pages/Profile";
import UserProfile from "./pages/users/UserProfile";
import UsersList from "./pages/users/UsersList";

// Module Caisse
import CaisseList from "./pages/caisse/CaisseList";
import CaisseDetail from "./pages/caisse/CaisseDetail";

// Quick Actions (Mobile)
import QuickActions from "./pages/QuickActions";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-xl font-bold text-primary-foreground">K</span>
          </div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/departments" element={<ProtectedRoute><AdminDepartments /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/roles" element={<ProtectedRoute><AdminRoles /></ProtectedRoute>} />
      <Route path="/admin/units" element={<ProtectedRoute><AdminUnits /></ProtectedRoute>} />
      <Route path="/admin/payment-categories" element={<ProtectedRoute><AdminPaymentCategories /></ProtectedRoute>} />
      <Route path="/admin/comptes-comptables" element={<ProtectedRoute><AdminComptesComptables /></ProtectedRoute>} />
      <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
      
      {/* Module Expressions de besoin */}
      <Route path="/expressions-besoin" element={<ProtectedRoute><ExpressionsList /></ProtectedRoute>} />
      <Route path="/expressions-besoin/nouveau" element={<ProtectedRoute><ExpressionCreate /></ProtectedRoute>} />
      <Route path="/expressions-besoin/:id" element={<ProtectedRoute><ExpressionDetail /></ProtectedRoute>} />
      
      {/* Module Besoins */}
      <Route path="/besoins" element={<ProtectedRoute><BesoinsList /></ProtectedRoute>} />
      <Route path="/besoins/nouveau" element={<ProtectedRoute><BesoinCreate /></ProtectedRoute>} />
      <Route path="/besoins/:id" element={<ProtectedRoute><BesoinDetail /></ProtectedRoute>} />
      <Route path="/besoins/:id/dossier" element={<ProtectedRoute><DossierComplet /></ProtectedRoute>} />
      
      {/* Module DA */}
      <Route path="/demandes-achat" element={<ProtectedRoute><DAList /></ProtectedRoute>} />
      <Route path="/demandes-achat/nouveau" element={<ProtectedRoute><DACreate /></ProtectedRoute>} />
      <Route path="/demandes-achat/:id" element={<ProtectedRoute><DADetail /></ProtectedRoute>} />
      
      {/* Module BL */}
      <Route path="/bons-livraison" element={<ProtectedRoute><BLList /></ProtectedRoute>} />
      <Route path="/bons-livraison/nouveau" element={<ProtectedRoute><BLCreate /></ProtectedRoute>} />
      <Route path="/bons-livraison/:id" element={<ProtectedRoute><BLDetail /></ProtectedRoute>} />
      
      {/* Module Tiers */}
      <Route path="/tiers" element={<ProtectedRoute><TiersList /></ProtectedRoute>} />
      
      {/* Module Fournisseurs */}
      <Route path="/fournisseurs" element={<ProtectedRoute><Fournisseurs /></ProtectedRoute>} />
      
      {/* Module Comptabilité */}
      <Route path="/comptabilite" element={<ProtectedRoute><Comptabilite /></ProtectedRoute>} />
      <Route path="/comptabilite/:id" element={<ProtectedRoute><ComptabiliteDetail /></ProtectedRoute>} />
      
      {/* Module Stock */}
      <Route path="/stock" element={<ProtectedRoute><StockList /></ProtectedRoute>} />
      <Route path="/stock/mouvements" element={<ProtectedRoute><StockMovements /></ProtectedRoute>} />
      <Route path="/stock/categories" element={<ProtectedRoute><StockCategories /></ProtectedRoute>} />
      <Route path="/stock/:id" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
      
      {/* Module Projets */}
      <Route path="/projets" element={<ProtectedRoute><ProjetsList /></ProtectedRoute>} />
      <Route path="/projets/:id" element={<ProtectedRoute><ProjetDetail /></ProtectedRoute>} />
      
      {/* Module Notes de frais */}
      <Route path="/notes-frais" element={<ProtectedRoute><NotesFraisList /></ProtectedRoute>} />
      <Route path="/notes-frais/nouveau" element={<ProtectedRoute><NoteFraisCreate /></ProtectedRoute>} />
      <Route path="/notes-frais/:id" element={<ProtectedRoute><NoteFraisDetail /></ProtectedRoute>} />
      <Route path="/notes-frais/:id/modifier" element={<ProtectedRoute><NoteFraisEdit /></ProtectedRoute>} />
      
      {/* Notifications */}
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      
      {/* Module Caisse */}
      <Route path="/caisse" element={<ProtectedRoute><CaisseList /></ProtectedRoute>} />
      <Route path="/caisse/:id" element={<ProtectedRoute><CaisseDetail /></ProtectedRoute>} />
      
      {/* Quick Actions (Mobile) */}
      <Route path="/actions-rapides" element={<ProtectedRoute><QuickActions /></ProtectedRoute>} />
      
      {/* Profil et Utilisateurs */}
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/utilisateurs" element={<ProtectedRoute><UsersList /></ProtectedRoute>} />
      <Route path="/utilisateurs/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Use Vite's BASE_URL so routing works both at / and on subpaths */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <TooltipProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
