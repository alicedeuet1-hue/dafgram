'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Switch,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  Check as CheckIcon,
  AccountBalance as AccountBalanceIcon,
  Savings as SavingsIcon,
  TrendingUp as TrendingUpIcon,
  Home as HomeIcon,
  School as SchoolIcon,
  MoreHoriz as MoreHorizIcon,
  Construction as ConstructionIcon,
} from '@mui/icons-material';
import { authAPI } from '@/lib/api';

// Tarification en XPF (Francs Pacifique)
const PRICING = {
  setupFee: 100000,
  monthly: 5000,
  yearly: 48000,
  yearlySavings: 12000,
  yearlySavingsPercent: 20,
};

const formatXPF = (amount: number) => {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XPF';
};

interface PlanInfo {
  name: string;
  price: number;
  yearlyPrice: number;
  description: string;
  features: string[];
}

const plans: Record<string, PlanInfo> = {
  personal: {
    name: 'Personnel',
    price: PRICING.monthly,
    yearlyPrice: PRICING.yearly,
    description: 'Pour gérer vos finances personnelles',
    features: [
      'Import de relevés bancaires',
      'Catégorisation automatique',
      'Budgets par catégorie',
      'Graphiques et statistiques',
      'Jusqu\'à 3 catégories de budget',
    ],
  },
  business: {
    name: 'Professionnel',
    price: PRICING.monthly,
    yearlyPrice: PRICING.yearly,
    description: 'Pour les entreprises et professionnels',
    features: [
      'Gestion budgétaire complète',
      'Import bancaire CSV automatisé',
      'Catégorisation automatique',
      'Suivi des ventes par vendeur',
      'Gestion du temps de travail',
      'Devis et factures professionnels',
      'Multi-entreprises',
      'Support par email',
    ],
  },
};

const legalForms = [
  'Auto-entrepreneur',
  'SARL',
  'SAS',
  'SASU',
  'EURL',
  'SA',
  'SCI',
  'Association',
  'EIRL',
  'Autre',
];

const expertiseDomains = [
  'Commerce / Retail',
  'Services',
  'Restauration',
  'BTP / Construction',
  'Santé',
  'Transport / Logistique',
  'Informatique / Tech',
  'Conseil',
  'Artisanat',
  'Agriculture',
  'Tourisme / Hôtellerie',
  'Autre',
];

const personalNeeds = [
  { id: 'personal_finance', label: 'Finances personnelles', description: 'Suivi de vos revenus et dépenses quotidiennes', icon: AccountBalanceIcon },
  { id: 'savings', label: 'Épargne', description: 'Objectifs d\'épargne et suivi de progression', icon: SavingsIcon },
  { id: 'project', label: 'Développement d\'un projet', description: 'Budget et suivi financier pour un projet personnel', icon: TrendingUpIcon },
  { id: 'real_estate', label: 'Immobilier', description: 'Gestion de vos biens immobiliers et loyers', icon: HomeIcon },
  { id: 'education', label: 'Études / Formation', description: 'Budget études, formations, certifications', icon: SchoolIcon },
  { id: 'other', label: 'Autre', description: 'Autres besoins de suivi financier', icon: MoreHorizIcon },
];

export default function RegisterPage() {
  return (
    <Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: '#F5C518' }} /></Box>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // État du formulaire
  const [activeStep, setActiveStep] = useState(0);
  const [accountType, setAccountType] = useState<'personal' | 'business' | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données personnelles (Étape 1)
  const [personalData, setPersonalData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  // Données entreprise (Étape 3 - Pro uniquement)
  const [companyData, setCompanyData] = useState({
    name: '',
    legal_form: '',
    year_created: '',
    expertise_domain: '',
    // Contact en cas de besoin
    contact_first_name: '',
    contact_last_name: '',
    contact_phone: '',
    contact_email: '',
  });

  // Besoins personnels (Étape 3 - Personnel uniquement)
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);

  // Données utilisateur (mot de passe)
  const [userData, setUserData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Récupérer les paramètres URL
  useEffect(() => {
    const plan = searchParams.get('plan');
    const billing = searchParams.get('billing');

    if (plan === 'personal' || plan === 'business') {
      setAccountType(plan);
    }
    if (billing === 'yearly') {
      setIsYearly(true);
    }
  }, [searchParams]);

  // Déterminer les étapes selon le type de compte
  const getSteps = () => {
    if (accountType === 'personal') {
      return ['Informations personnelles', 'Type de compte', 'Vos besoins', 'Tarifs'];
    }
    if (accountType === 'business') {
      return ['Informations personnelles', 'Type de compte', 'Votre entreprise', 'Tarifs'];
    }
    return ['Informations personnelles', 'Type de compte', 'Détails', 'Tarifs'];
  };

  const steps = getSteps();

  const handleNeedToggle = (needId: string) => {
    setSelectedNeeds(prev =>
      prev.includes(needId)
        ? prev.filter(id => id !== needId)
        : [...prev, needId]
    );
  };

  const handleNext = () => {
    setError(null);

    if (activeStep === 0) {
      // Validation des informations personnelles
      if (!personalData.first_name || !personalData.last_name || !personalData.email || !personalData.phone) {
        setError('Tous les champs sont requis');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalData.email)) {
        setError('L\'adresse email n\'est pas valide');
        return;
      }
      setActiveStep(1);
    } else if (activeStep === 1) {
      // Choix du type de compte
      if (!accountType) {
        setError('Veuillez choisir un type de compte');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (accountType === 'business') {
        // Validation entreprise
        if (!companyData.name || !companyData.legal_form || !companyData.expertise_domain) {
          setError('Le nom de l\'entreprise, la forme juridique et le domaine d\'expertise sont requis');
          return;
        }
        if (!companyData.contact_first_name || !companyData.contact_last_name || !companyData.contact_phone || !companyData.contact_email) {
          setError('Les informations de la personne à contacter sont requises');
          return;
        }
      } else {
        // Validation besoins personnels
        if (selectedNeeds.length === 0) {
          setError('Veuillez sélectionner au moins un besoin');
          return;
        }
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      // Uniquement pour Pro, car Personnel est "en développement"
      if (accountType === 'business') {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    // Validation mot de passe
    if (!userData.password) {
      setError('Le mot de passe est requis');
      return;
    }
    if (userData.password !== userData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (userData.password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const companyPayload = {
        name: companyData.name,
        email: companyData.contact_email || personalData.email,
        phone: companyData.contact_phone || personalData.phone,
        legal_form: companyData.legal_form,
        year_created: companyData.year_created,
        expertise_domain: companyData.expertise_domain,
        contact_name: `${companyData.contact_first_name} ${companyData.contact_last_name}`,
        account_type: 'business',
      };

      const response = await authAPI.registerCompany({
        company: companyPayload,
        email: personalData.email,
        password: userData.password,
        full_name: `${personalData.first_name} ${personalData.last_name}`,
      });

      // Stocker le token et rediriger vers le paiement
      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
        // Stocker le cycle de facturation choisi
        localStorage.setItem('billing_cycle', isYearly ? 'yearly' : 'monthly');
        // Rediriger vers la page de paiement
        router.push('/payment');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const renderStepContent = (step: number) => {
    // Étape 0 : Informations personnelles
    if (step === 0) {
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Vos informations personnelles
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
            Ces informations nous permettent de mieux vous connaître
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nom"
                value={personalData.last_name}
                onChange={(e) => setPersonalData({ ...personalData, last_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Prénom"
                value={personalData.first_name}
                onChange={(e) => setPersonalData({ ...personalData, first_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Numéro de téléphone"
                value={personalData.phone}
                onChange={(e) => setPersonalData({ ...personalData, phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="email"
                label="Adresse email"
                value={personalData.email}
                onChange={(e) => setPersonalData({ ...personalData, email: e.target.value })}
                required
                helperText="Cet email servira pour vous connecter"
              />
            </Grid>
          </Grid>
        </Box>
      );
    }

    // Étape 1 : Choix Professionnel / Personnel
    if (step === 1) {
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
            Quel type d'utilisateur êtes-vous ?
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 4, textAlign: 'center' }}>
            Choisissez le profil qui correspond à votre utilisation
          </Typography>

          <Grid container spacing={3} justifyContent="center">
            {/* Professionnel */}
            <Grid item xs={12} sm={6}>
              <Card
                onClick={() => setAccountType('business')}
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  border: accountType === 'business' ? '2px solid #F5C518' : '2px solid transparent',
                  boxShadow: accountType === 'business' ? '0 4px 20px rgba(245, 197, 24, 0.3)' : '0 2px 10px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: accountType === 'business' ? '#F5C51820' : '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 40, color: accountType === 'business' ? '#F5C518' : '#6B7280' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Professionnel
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Je suis une entreprise, un indépendant ou une association
                  </Typography>
                  {accountType === 'business' && (
                    <Chip
                      icon={<CheckIcon sx={{ fontSize: 16 }} />}
                      label="Sélectionné"
                      size="small"
                      sx={{
                        mt: 2,
                        bgcolor: '#10B981',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Personnel */}
            <Grid item xs={12} sm={6}>
              <Card
                onClick={() => setAccountType('personal')}
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  border: accountType === 'personal' ? '2px solid #F5C518' : '2px solid transparent',
                  boxShadow: accountType === 'personal' ? '0 4px 20px rgba(245, 197, 24, 0.3)' : '0 2px 10px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: accountType === 'personal' ? '#F5C51820' : '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 40, color: accountType === 'personal' ? '#F5C518' : '#6B7280' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Personnel
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Je souhaite gérer mes finances personnelles
                  </Typography>
                  {accountType === 'personal' && (
                    <Chip
                      icon={<CheckIcon sx={{ fontSize: 16 }} />}
                      label="Sélectionné"
                      size="small"
                      sx={{
                        mt: 2,
                        bgcolor: '#10B981',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      );
    }

    // Étape 2 : Détails selon le type de compte
    if (step === 2) {
      if (accountType === 'business') {
        // Informations entreprise pour Professionnel
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Informations de votre entreprise
            </Typography>
            <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
              Ces informations nous aident à personnaliser votre expérience
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nom de l'entreprise"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Forme juridique</InputLabel>
                  <Select
                    value={companyData.legal_form}
                    label="Forme juridique"
                    onChange={(e) => setCompanyData({ ...companyData, legal_form: e.target.value })}
                  >
                    {legalForms.map((form) => (
                      <MenuItem key={form} value={form}>{form}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Année de création</InputLabel>
                  <Select
                    value={companyData.year_created}
                    label="Année de création"
                    onChange={(e) => setCompanyData({ ...companyData, year_created: e.target.value })}
                  >
                    {years.map((year) => (
                      <MenuItem key={year} value={year.toString()}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Domaine d'expertise</InputLabel>
                  <Select
                    value={companyData.expertise_domain}
                    label="Domaine d'expertise"
                    onChange={(e) => setCompanyData({ ...companyData, expertise_domain: e.target.value })}
                  >
                    {expertiseDomains.map((domain) => (
                      <MenuItem key={domain} value={domain}>{domain}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#374151' }}>
                  Personne à contacter en cas de besoin
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom du contact"
                  value={companyData.contact_last_name}
                  onChange={(e) => setCompanyData({ ...companyData, contact_last_name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prénom du contact"
                  value={companyData.contact_first_name}
                  onChange={(e) => setCompanyData({ ...companyData, contact_first_name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Téléphone du contact"
                  value={companyData.contact_phone}
                  onChange={(e) => setCompanyData({ ...companyData, contact_phone: e.target.value })}
                  placeholder="+33 6 12 34 56 78"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email du contact"
                  value={companyData.contact_email}
                  onChange={(e) => setCompanyData({ ...companyData, contact_email: e.target.value })}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        );
      }

      // Besoins personnels pour compte Personnel
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Que souhaitez-vous suivre avec DafGram ?
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
            Sélectionnez un ou plusieurs éléments qui correspondent à vos besoins
          </Typography>

          <Grid container spacing={2}>
            {personalNeeds.map((need) => {
              const IconComponent = need.icon;
              const isSelected = selectedNeeds.includes(need.id);

              return (
                <Grid item xs={12} sm={6} key={need.id}>
                  <Card
                    onClick={() => handleNeedToggle(need.id)}
                    sx={{
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #F5C518' : '2px solid #E5E7EB',
                      bgcolor: isSelected ? '#F5C51810' : 'white',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: '#F5C518',
                        bgcolor: '#F5C51808',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: isSelected ? '#F5C51830' : '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent sx={{ color: isSelected ? '#F5C518' : '#6B7280' }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {need.label}
                          </Typography>
                          <Checkbox
                            checked={isSelected}
                            sx={{
                              p: 0,
                              color: '#E5E7EB',
                              '&.Mui-checked': {
                                color: '#F5C518',
                              },
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {need.description}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      );
    }

    // Étape 3 : Tarifs
    if (step === 3) {
      if (accountType === 'personal') {
        // Page "En développement" pour Personnel
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <ConstructionIcon sx={{ fontSize: 60, color: '#F59E0B' }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Fonctionnalité en cours de développement
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              L'offre personnelle de DafGram est actuellement en développement.
              Nous travaillons dur pour vous offrir la meilleure expérience possible.
            </Typography>

            <Box sx={{ bgcolor: '#F9FAFB', borderRadius: 3, p: 3, maxWidth: 400, mx: 'auto', mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Vos besoins sélectionnés :
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {selectedNeeds.map(needId => {
                  const need = personalNeeds.find(n => n.id === needId);
                  return need ? (
                    <Chip
                      key={needId}
                      label={need.label}
                      size="small"
                      sx={{ bgcolor: '#F5C51820', color: '#92400E' }}
                    />
                  ) : null;
                })}
              </Box>
            </Box>

            <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto' }}>
              <Typography variant="body2">
                Laissez-nous vos coordonnées et nous vous contacterons dès que l'offre personnelle sera disponible !
              </Typography>
            </Alert>

            <Box sx={{ mt: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                En attendant, vous pouvez nous contacter à :
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#F5C518' }}>
                contact@dafgram.com
              </Typography>
            </Box>
          </Box>
        );
      }

      // Tarifs et création de compte pour Professionnel
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
            Choisissez votre formule
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 4, textAlign: 'center' }}>
            Finalisez votre inscription
          </Typography>

          {/* Toggle mensuel/annuel */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              mb: 4,
            }}
          >
            <Typography
              sx={{
                fontWeight: !isYearly ? 600 : 400,
                color: !isYearly ? '#1A1A1A' : '#9CA3AF',
              }}
            >
              Mensuel
            </Typography>
            <Switch
              checked={isYearly}
              onChange={(e) => setIsYearly(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#F5C518',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#F5C518',
                },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                sx={{
                  fontWeight: isYearly ? 600 : 400,
                  color: isYearly ? '#1A1A1A' : '#9CA3AF',
                }}
              >
                Annuel
              </Typography>
              <Chip
                label="-20%"
                size="small"
                sx={{
                  bgcolor: '#10B981',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }}
              />
            </Box>
          </Box>

          {/* Frais de mise en place */}
          <Card sx={{ borderRadius: 3, border: '1px solid #E5E7EB', mb: 3, bgcolor: '#F9FAFB' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Frais de mise en place
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Paiement unique - Configuration et formation incluses
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
                  {formatXPF(PRICING.setupFee)}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Plan Pro */}
          <Card sx={{ borderRadius: 3, border: '2px solid #F5C518', mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BusinessIcon sx={{ color: '#F5C518' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Abonnement Professionnel
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {formatXPF(isYearly ? PRICING.yearly : PRICING.monthly)}
                <Typography component="span" variant="body2" color="text.secondary">
                  /{isYearly ? 'an' : 'mois'}
                </Typography>
              </Typography>
              {isYearly && (
                <Typography variant="body2" sx={{ color: '#10B981', mb: 2 }}>
                  Économisez {formatXPF(PRICING.yearlySavings)} par an
                </Typography>
              )}
              <Grid container spacing={1} sx={{ mt: 2 }}>
                {plans.business.features.map((feature, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckIcon sx={{ color: '#10B981', fontSize: 18 }} />
                      <Typography variant="body2">{feature}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Mot de passe */}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Créez votre mot de passe
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="password"
                label="Mot de passe"
                value={userData.password}
                onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                required
                helperText="Minimum 6 caractères"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="password"
                label="Confirmer le mot de passe"
                value={userData.confirmPassword}
                onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                required
              />
            </Grid>
          </Grid>

          {/* Récapitulatif */}
          <Box sx={{ mt: 4, p: 3, bgcolor: '#F9FAFB', borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Récapitulatif
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Administrateur</Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {personalData.first_name} {personalData.last_name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Entreprise</Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {companyData.name} ({companyData.legal_form})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Domaine</Typography>
              <Typography>{companyData.expertise_domain}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Frais de mise en place</Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {formatXPF(PRICING.setupFee)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Abonnement {isYearly ? 'annuel' : 'mensuel'}</Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {formatXPF(isYearly ? PRICING.yearly : PRICING.monthly)}
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Total à payer aujourd'hui</Typography>
              <Typography sx={{ fontWeight: 700, color: '#F5C518', fontSize: '1.1rem' }}>
                {formatXPF(PRICING.setupFee + (isYearly ? PRICING.yearly : PRICING.monthly))}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Puis {formatXPF(isYearly ? PRICING.yearly : PRICING.monthly)}/{isYearly ? 'an' : 'mois'} au renouvellement
            </Typography>
          </Box>
        </Box>
      );
    }

    return null;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F5F5F7', py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: '#1A1A1A', mb: 1 }}
          >
            Créer votre compte
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Commencez à gérer vos finances en quelques minutes
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Contenu */}
        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p: 4 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {renderStepContent(activeStep)}

            <Divider sx={{ my: 4 }} />

            {/* Boutons de navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                sx={{ color: '#6B7280' }}
              >
                Retour
              </Button>

              {/* Bouton suivant/créer */}
              {!(activeStep === 3 && accountType === 'personal') && (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={isLoading}
                  sx={{
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    fontWeight: 600,
                    px: 4,
                    '&:hover': {
                      bgcolor: '#E0B000',
                    },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={24} sx={{ color: '#1A1A1A' }} />
                  ) : activeStep === 3 && accountType === 'business' ? (
                    'Créer mon compte'
                  ) : (
                    'Continuer'
                  )}
                </Button>
              )}

              {/* Bouton spécial pour Personnel à l'étape tarifs */}
              {activeStep === 3 && accountType === 'personal' && (
                <Button
                  variant="outlined"
                  onClick={() => router.push('/')}
                  sx={{
                    borderColor: '#F5C518',
                    color: '#F5C518',
                    fontWeight: 600,
                    px: 4,
                    '&:hover': {
                      borderColor: '#E0B000',
                      bgcolor: '#F5C51810',
                    },
                  }}
                >
                  Retour à l'accueil
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Lien vers connexion */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Vous avez déjà un compte ?{' '}
            <Button
              onClick={() => router.push('/login')}
              sx={{ color: '#F5C518', fontWeight: 600, textTransform: 'none' }}
            >
              Se connecter
            </Button>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
