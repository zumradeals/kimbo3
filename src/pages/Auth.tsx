import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Building2, ShieldCheck, TrendingUp, Users } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

const signupSchema = loginSchema.extend({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = loginSchema.safeParse({ email, password });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Échec de connexion',
              description: 'Email ou mot de passe incorrect.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Erreur',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        const result = signupSchema.safeParse({ email, password, confirmPassword, firstName, lastName });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, firstName, lastName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Compte existant',
              description: 'Un compte avec cet email existe déjà. Essayez de vous connecter.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Erreur',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Compte créé',
            description: 'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
          });
          setIsLogin(true);
        }
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Une erreur inattendue s\'est produite.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Building2,
      title: 'Gestion des besoins',
      description: 'Centralisez vos demandes internes',
    },
    {
      icon: TrendingUp,
      title: 'Suivi des achats',
      description: 'Pilotez vos processus d\'achat',
    },
    {
      icon: Users,
      title: 'Collaboration',
      description: 'Travaillez en équipe efficacement',
    },
    {
      icon: ShieldCheck,
      title: 'Sécurité',
      description: 'Vos données protégées',
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding & Illustration */}
      <div className="relative hidden w-1/2 lg:flex lg:flex-col lg:justify-between bg-secondary overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary to-primary/20" />
          <div className="absolute inset-0 opacity-10">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary-foreground" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo & Company */}
          <div className="flex items-center gap-4">
            <img 
              src="/logo-kimbo.png" 
              alt="KIMBO AFRICA" 
              className="h-14 w-auto"
            />
            <div>
              <h2 className="text-xl font-bold text-primary-foreground">KPM SYSTEME</h2>
              <p className="text-sm text-primary-foreground/70">KIMBO AFRICA SA</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="mb-4 font-serif text-4xl font-bold leading-tight text-primary-foreground">
              Votre plateforme de gestion{' '}
              <span className="text-primary">intelligente</span>
            </h1>
            <p className="mb-12 max-w-md text-lg text-primary-foreground/80">
              Simplifiez la gestion de vos besoins internes, demandes d'achat et bons de livraison avec KPM Système.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group flex items-start gap-4 rounded-xl bg-primary-foreground/5 p-4 backdrop-blur-sm transition-all hover:bg-primary-foreground/10"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-primary-foreground">{feature.title}</h3>
                    <p className="text-sm text-primary-foreground/60">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-primary-foreground/50">
            © {new Date().getFullYear()} KIMBO AFRICA SA. Tous droits réservés.
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="mb-8 text-center lg:hidden">
            <img 
              src="/logo-kimbo.png" 
              alt="KIMBO AFRICA" 
              className="mx-auto mb-4 h-16 w-auto"
            />
            <h1 className="font-serif text-2xl font-bold text-foreground">KPM SYSTEME</h1>
            <p className="text-sm text-muted-foreground">KIMBO AFRICA SA</p>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-bold text-foreground">
              {isLogin ? 'Bienvenue' : 'Créer un compte'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {isLogin
                ? 'Connectez-vous pour accéder à votre espace de travail'
                : 'Créez votre compte pour commencer'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
                    disabled={isLoading}
                    className="h-12"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom"
                    disabled={isLoading}
                    className="h-12"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                disabled={isLoading}
                className="h-12"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="h-12"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="h-12"
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="h-12 w-full text-base font-medium" 
              disabled={isLoading}
            >
              {isLoading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Créer le compte'}
            </Button>
          </form>

          {/* Contact Info */}
          <div className="mt-10 text-center text-sm text-muted-foreground">
            <p>Besoin d'aide ? Contactez-nous</p>
            <p className="mt-1 font-medium text-foreground">infos@kimboafricasa.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
