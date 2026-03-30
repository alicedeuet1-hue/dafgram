'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
  Alert,
  Grid,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  Switch,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Email,
  Phone,
  Person as PersonIcon,
  Lock,
  Close as CloseIcon,
  Check as CheckIcon,
  AccountBalance as AccountBalanceIcon,
  Savings as SavingsIcon,
  TrendingUp as TrendingUpIcon,
  Home as HomeIcon,
  School as SchoolIcon,
  MoreHoriz as MoreHorizIcon,
  Construction as ConstructionIcon,
} from '@mui/icons-material';

// Configuration des plans
const plans = {
  personal: {
    name: 'Personnel',
    price: 9,
    yearlyPrice: Math.round(9 * 12 * 0.85),
    features: [
      'Import de relevés bancaires',
      'Catégorisation automatique',
      'Budgets par catégorie',
      'Graphiques et statistiques',
    ],
  },
  business: {
    name: 'Professionnel',
    price: 29,
    yearlyPrice: Math.round(29 * 12 * 0.85),
    features: [
      'Toutes les fonctionnalités Perso',
      'Catégories illimitées',
      'Sous-catégories',
      'Multi-utilisateurs',
      'Gestion des employés',
      'Facturation et devis',
      'Support prioritaire',
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
  { id: 'personal_finance', label: 'Finances personnelles', description: 'Suivi de vos revenus et dépenses', icon: AccountBalanceIcon },
  { id: 'savings', label: 'Épargne', description: 'Objectifs d\'épargne et suivi', icon: SavingsIcon },
  { id: 'project', label: 'Développement d\'un projet', description: 'Budget pour un projet personnel', icon: TrendingUpIcon },
  { id: 'real_estate', label: 'Immobilier', description: 'Gestion de biens immobiliers', icon: HomeIcon },
  { id: 'education', label: 'Études / Formation', description: 'Budget études et formations', icon: SchoolIcon },
  { id: 'other', label: 'Autre', description: 'Autres besoins de suivi', icon: MoreHorizIcon },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, setToken, fetchUser } = useAuthStore();

  // Si un token existe, vérifier s'il est valide et rediriger
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUser().then(() => {
        if (useAuthStore.getState().isAuthenticated) {
          router.push('/dashboard');
        }
      });
    }
  }, []);

  // Login state - state local pour ne pas dépendre du store global
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register dialog state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [accountType, setAccountType] = useState<'personal' | 'business' | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Données personnelles (Étape 1)
  const [personalData, setPersonalData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  // Données entreprise (Étape 3 - Pro)
  const [companyData, setCompanyData] = useState({
    name: '',
    legal_form: '',
    year_created: '',
    expertise_domain: '',
    contact_first_name: '',
    contact_last_name: '',
    contact_phone: '',
    contact_email: '',
  });

  // Besoins personnels (Étape 3 - Personnel)
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);

  // Mot de passe
  const [userData, setUserData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      await login(loginEmail, loginPassword);
      router.push('/dashboard');
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || 'Email ou mot de passe incorrect');
    } finally {
      setLoginLoading(false);
    }
  };

  const openRegisterDialog = () => {
    setRegisterOpen(true);
    setActiveStep(0);
    setAccountType(null);
    setRegisterError(null);
    setPersonalData({ first_name: '', last_name: '', email: '', phone: '' });
    setCompanyData({
      name: '', legal_form: '', year_created: '', expertise_domain: '',
      contact_first_name: '', contact_last_name: '', contact_phone: '', contact_email: '',
    });
    setSelectedNeeds([]);
    setUserData({ password: '', confirmPassword: '' });
  };

  const closeRegisterDialog = () => {
    setRegisterOpen(false);
  };

  const getSteps = () => {
    if (accountType === 'personal') {
      return ['Vos informations', 'Type de compte', 'Vos besoins', 'Tarifs'];
    }
    if (accountType === 'business') {
      return ['Vos informations', 'Type de compte', 'Votre entreprise', 'Tarifs'];
    }
    return ['Vos informations', 'Type de compte', 'Détails', 'Tarifs'];
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
    setRegisterError(null);

    if (activeStep === 0) {
      if (!personalData.first_name || !personalData.last_name || !personalData.email || !personalData.phone) {
        setRegisterError('Tous les champs sont requis');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalData.email)) {
        setRegisterError('L\'adresse email n\'est pas valide');
        return;
      }
      setActiveStep(1);
    } else if (activeStep === 1) {
      if (!accountType) {
        setRegisterError('Veuillez choisir un type de compte');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (accountType === 'business') {
        if (!companyData.name || !companyData.legal_form || !companyData.expertise_domain) {
          setRegisterError('Le nom, la forme juridique et le domaine sont requis');
          return;
        }
        if (!companyData.contact_first_name || !companyData.contact_last_name || !companyData.contact_phone || !companyData.contact_email) {
          setRegisterError('Les informations du contact sont requises');
          return;
        }
      } else {
        if (selectedNeeds.length === 0) {
          setRegisterError('Veuillez sélectionner au moins un besoin');
          return;
        }
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      handleRegister();
    }
  };

  const handleBack = () => {
    setRegisterError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleRegister = async () => {
    if (!userData.password) {
      setRegisterError('Le mot de passe est requis');
      return;
    }
    if (userData.password !== userData.confirmPassword) {
      setRegisterError('Les mots de passe ne correspondent pas');
      return;
    }
    if (userData.password.length < 6) {
      setRegisterError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }

    setIsLoading(true);
    setRegisterError(null);

    try {
      let companyPayload;

      if (accountType === 'personal') {
        companyPayload = {
          name: `${personalData.first_name} ${personalData.last_name}`,
          email: personalData.email,
          phone: personalData.phone,
          account_type: 'personal',
        };
      } else {
        companyPayload = {
          name: companyData.name,
          email: companyData.contact_email || personalData.email,
          phone: companyData.contact_phone || personalData.phone,
          legal_form: companyData.legal_form,
          year_created: companyData.year_created,
          expertise_domain: companyData.expertise_domain,
          contact_name: `${companyData.contact_first_name} ${companyData.contact_last_name}`,
          account_type: 'business',
        };
      }

      const response = await authAPI.registerCompany({
        company: companyPayload,
        email: personalData.email,
        password: userData.password,
        full_name: `${personalData.first_name} ${personalData.last_name}`,
      });

      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
        setToken(response.data.access_token);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setRegisterError(err.response?.data?.detail || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const renderRegisterStep = () => {
    // Étape 0 : Informations personnelles
    if (activeStep === 0) {
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
    if (activeStep === 1) {
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
            Quel type d'utilisateur êtes-vous ?
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3, textAlign: 'center' }}>
            Choisissez le profil qui correspond à votre utilisation
          </Typography>

          <Grid container spacing={2}>
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
                  '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      bgcolor: accountType === 'personal' ? '#F5C51820' : '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 30, color: accountType === 'personal' ? '#F5C518' : '#6B7280' }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Personnel
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Gestion de finances personnelles
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Professionnel - désactivé */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  borderRadius: 3,
                  cursor: 'not-allowed',
                  border: '2px solid transparent',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  opacity: 0.5,
                  position: 'relative',
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      bgcolor: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 30, color: '#9CA3AF' }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, color: '#9CA3AF' }}>
                    Professionnel
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Entreprise, indépendant ou association
                  </Typography>
                </CardContent>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 3,
                  }}
                >
                  <Chip
                    label="Bientôt disponible"
                    sx={{
                      bgcolor: '#6B7280',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Box>
      );
    }

    // Étape 2 : Détails selon le type
    if (activeStep === 2) {
      if (accountType === 'business') {
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Informations de votre entreprise
            </Typography>
            <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 2 }}>
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
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth required size="small">
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
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Année de création</InputLabel>
                  <Select
                    value={companyData.year_created}
                    label="Année de création"
                    onChange={(e) => setCompanyData({ ...companyData, year_created: e.target.value })}
                  >
                    {years.slice(0, 50).map((year) => (
                      <MenuItem key={year} value={year.toString()}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required size="small">
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
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mt: 1 }}>
                  Personne à contacter
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Nom"
                  value={companyData.contact_last_name}
                  onChange={(e) => setCompanyData({ ...companyData, contact_last_name: e.target.value })}
                  required
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Prénom"
                  value={companyData.contact_first_name}
                  onChange={(e) => setCompanyData({ ...companyData, contact_first_name: e.target.value })}
                  required
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Téléphone"
                  value={companyData.contact_phone}
                  onChange={(e) => setCompanyData({ ...companyData, contact_phone: e.target.value })}
                  required
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email"
                  value={companyData.contact_email}
                  onChange={(e) => setCompanyData({ ...companyData, contact_email: e.target.value })}
                  required
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        );
      }

      // Besoins personnels
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Que souhaitez-vous suivre avec DafGram ?
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 2 }}>
            Sélectionnez un ou plusieurs besoins
          </Typography>

          <Grid container spacing={1.5}>
            {personalNeeds.map((need) => {
              const IconComponent = need.icon;
              const isSelected = selectedNeeds.includes(need.id);

              return (
                <Grid item xs={6} key={need.id}>
                  <Card
                    onClick={() => handleNeedToggle(need.id)}
                    sx={{
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #F5C518' : '2px solid #E5E7EB',
                      bgcolor: isSelected ? '#F5C51810' : 'white',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: '#F5C518' },
                    }}
                  >
                    <CardContent sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1.5,
                          bgcolor: isSelected ? '#F5C51830' : '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent sx={{ fontSize: 20, color: isSelected ? '#F5C518' : '#6B7280' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {need.label}
                        </Typography>
                      </Box>
                      <Checkbox
                        checked={isSelected}
                        size="small"
                        sx={{
                          p: 0,
                          color: '#E5E7EB',
                          '&.Mui-checked': { color: '#F5C518' },
                        }}
                      />
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
    if (activeStep === 3) {
      if (accountType === 'personal') {
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
              Finalisez votre inscription
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              Créez votre mot de passe pour accéder à votre espace personnel
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Mot de passe"
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                  required
                  size="small"
                  helperText="Min. 6 caractères"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Confirmer"
                  value={userData.confirmPassword}
                  onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                  required
                  size="small"
                />
              </Grid>
            </Grid>

            <Box sx={{ bgcolor: '#F9FAFB', borderRadius: 2, p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Récapitulatif
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Compte</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Personnel</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Utilisateur</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {personalData.first_name} {personalData.last_name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {personalData.email}
                </Typography>
              </Box>
              {selectedNeeds.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Besoins :</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {selectedNeeds.map(needId => {
                      const need = personalNeeds.find(n => n.id === needId);
                      return need ? (
                        <Chip key={needId} label={need.label} size="small" sx={{ bgcolor: '#F5C51820', fontSize: '0.7rem' }} />
                      ) : null;
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        );
      }

      // Tarifs Pro
      return (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
            Finalisez votre inscription
          </Typography>

          {/* Toggle mensuel/annuel */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: !isYearly ? 600 : 400, color: !isYearly ? '#1A1A1A' : '#9CA3AF' }}>
              Mensuel
            </Typography>
            <Switch
              checked={isYearly}
              onChange={(e) => setIsYearly(e.target.checked)}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#F5C518' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F5C518' },
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: isYearly ? 600 : 400, color: isYearly ? '#1A1A1A' : '#9CA3AF' }}>
              Annuel
            </Typography>
            <Chip label="-15%" size="small" sx={{ bgcolor: '#10B981', color: 'white', fontWeight: 600, fontSize: '0.65rem', height: 20 }} />
          </Box>

          {/* Prix */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {isYearly ? plans.business.yearlyPrice : plans.business.price}€
              <Typography component="span" variant="body2" color="text.secondary">
                /{isYearly ? 'an' : 'mois'}
              </Typography>
            </Typography>
          </Box>

          {/* Mot de passe */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="password"
                label="Mot de passe"
                value={userData.password}
                onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                required
                size="small"
                helperText="Min. 6 caractères"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="password"
                label="Confirmer"
                value={userData.confirmPassword}
                onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                required
                size="small"
              />
            </Grid>
          </Grid>

          {/* Récap */}
          <Box sx={{ bgcolor: '#F9FAFB', borderRadius: 2, p: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Récapitulatif</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption">Entreprise</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{companyData.name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption">Admin</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{personalData.first_name} {personalData.last_name}</Typography>
            </Box>
          </Box>
        </Box>
      );
    }

    return null;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F5F5F7',
        py: 4,
      }}
    >
      <Container component="main" maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            bgcolor: '#FFFFFF',
            borderRadius: 4,
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              component="img"
              src="/logo.svg"
              alt="DafGram"
              sx={{
                width: 64,
                height: 64,
                mx: 'auto',
                mb: 2,
                display: 'block',
              }}
            />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
              DafGram
            </Typography>
            <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
              Financial Control Platform
            </Typography>
          </Box>

          {/* Login Form */}
          <Box component="form" onSubmit={handleLogin}>
            {loginError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {loginError}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="votre@email.com"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: '#9CA3AF' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFFFFF',
                  '& fieldset': { borderColor: '#E5E7EB' },
                  '&:hover fieldset': { borderColor: '#D1D5DB' },
                  '&.Mui-focused fieldset': { borderColor: '#F5C518' },
                },
                '& .MuiInputBase-input': { color: '#1A1A1A' },
                '& .MuiInputLabel-root': { color: '#6B7280' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#F5C518' },
              }}
            />

            <TextField
              fullWidth
              label="Mot de passe"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Votre mot de passe"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#9CA3AF' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFFFFF',
                  '& fieldset': { borderColor: '#E5E7EB' },
                  '&:hover fieldset': { borderColor: '#D1D5DB' },
                  '&.Mui-focused fieldset': { borderColor: '#F5C518' },
                },
                '& .MuiInputBase-input': { color: '#1A1A1A' },
                '& .MuiInputLabel-root': { color: '#6B7280' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#F5C518' },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loginLoading}
              sx={{
                py: 1.5,
                bgcolor: '#F5C518',
                color: '#1A1A1A',
                fontWeight: 600,
                borderRadius: 2.5,
                '&:hover': { bgcolor: '#E0B000' },
              }}
            >
              {loginLoading ? <CircularProgress size={24} sx={{ color: '#1A1A1A' }} /> : 'Se connecter'}
            </Button>
          </Box>

          {/* Divider */}
          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">ou</Typography>
          </Divider>

          {/* Create Account Button */}
          <Button
            fullWidth
            variant="outlined"
            onClick={openRegisterDialog}
            sx={{
              py: 1.5,
              borderColor: '#F5C518',
              color: '#F5C518',
              fontWeight: 600,
              borderRadius: 2.5,
              '&:hover': {
                borderColor: '#E0B000',
                bgcolor: '#F5C51810',
              },
            }}
          >
            Créer un compte
          </Button>

        </Paper>
      </Container>

      {/* Register Dialog */}
      <Dialog
        open={registerOpen}
        onClose={closeRegisterDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, maxHeight: '90vh' }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Créer un compte
          </Typography>
          <IconButton onClick={closeRegisterDialog} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent>
          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 3 }} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel
                  StepIconProps={{
                    sx: {
                      '&.Mui-active': { color: '#F5C518' },
                      '&.Mui-completed': { color: '#22C55E' },
                    },
                  }}
                >
                  <Typography variant="caption">{label}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {registerError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {registerError}
            </Alert>
          )}

          {renderRegisterStep()}

          {/* Navigation */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                variant="outlined"
                sx={{ flex: 1, borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                Retour
              </Button>
            )}

            <Button
              onClick={handleNext}
              variant="contained"
              disabled={isLoading}
              sx={{
                flex: 1,
                bgcolor: '#F5C518',
                color: '#1A1A1A',
                fontWeight: 600,
                '&:hover': { bgcolor: '#E0B000' },
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} sx={{ color: '#1A1A1A' }} />
              ) : activeStep === 3 ? (
                'Créer mon compte'
              ) : (
                'Continuer'
              )}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
