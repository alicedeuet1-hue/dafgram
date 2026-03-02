'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Switch,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Star as StarIcon,
} from '@mui/icons-material';

interface PlanFeature {
  name: string;
  personal: boolean;
  business: boolean;
}

const features: PlanFeature[] = [
  { name: 'Import de relevés bancaires (CSV/PDF)', personal: true, business: true },
  { name: 'Catégorisation automatique', personal: true, business: true },
  { name: 'Budgets par catégorie', personal: true, business: true },
  { name: 'Graphiques et statistiques', personal: true, business: true },
  { name: 'Export des données', personal: true, business: true },
  { name: 'Jusqu\'à 3 catégories de budget', personal: true, business: true },
  { name: 'Catégories illimitées', personal: false, business: true },
  { name: 'Sous-catégories', personal: false, business: true },
  { name: 'Multi-utilisateurs', personal: false, business: true },
  { name: 'Gestion des employés', personal: false, business: true },
  { name: 'Objectifs de vente', personal: false, business: true },
  { name: 'Support prioritaire', personal: false, business: true },
  { name: 'API Access', personal: false, business: true },
];

export default function PricingPage() {
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);

  const personalMonthly = 9;
  const businessMonthly = 29;

  const personalYearly = personalMonthly * 12 * 0.85; // 15% de réduction
  const businessYearly = businessMonthly * 12 * 0.85;

  const personalPrice = isYearly ? personalYearly : personalMonthly;
  const businessPrice = isYearly ? businessYearly : businessMonthly;

  const handleSelectPlan = (plan: 'personal' | 'business') => {
    const billingCycle = isYearly ? 'yearly' : 'monthly';
    router.push(`/register?plan=${plan}&billing=${billingCycle}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F5F5F7', py: 8 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h3"
            sx={{ fontWeight: 700, color: '#1A1A1A', mb: 2 }}
          >
            Choisissez votre formule
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
            Des tarifs simples et transparents pour gérer vos finances
          </Typography>

          {/* Toggle mensuel/annuel */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
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
                label="-15%"
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
        </Box>

        {/* Pricing Cards */}
        <Grid container spacing={4} justifyContent="center">
          {/* Personal Plan */}
          <Grid item xs={12} md={5}>
            <Card
              sx={{
                borderRadius: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 4, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  Perso
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Pour gérer vos finances personnelles
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 700, display: 'inline' }}
                  >
                    {personalPrice.toFixed(0)}€
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ display: 'inline', ml: 1 }}
                  >
                    /{isYearly ? 'an' : 'mois'}
                  </Typography>
                  {isYearly && (
                    <Typography variant="body2" color="text.secondary">
                      soit {(personalPrice / 12).toFixed(2)}€/mois
                    </Typography>
                  )}
                </Box>

                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  onClick={() => handleSelectPlan('personal')}
                  sx={{
                    py: 1.5,
                    borderColor: '#1A1A1A',
                    color: '#1A1A1A',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: '#1A1A1A',
                      bgcolor: '#F9FAFB',
                    },
                  }}
                >
                  Commencer
                </Button>

                <List sx={{ mt: 3, flex: 1 }}>
                  {features.map((feature, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {feature.personal ? (
                          <CheckIcon sx={{ color: '#10B981', fontSize: 20 }} />
                        ) : (
                          <CloseIcon sx={{ color: '#D1D5DB', fontSize: 20 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={feature.name}
                        primaryTypographyProps={{
                          fontSize: '0.9rem',
                          color: feature.personal ? '#1A1A1A' : '#9CA3AF',
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Business Plan */}
          <Grid item xs={12} md={5}>
            <Card
              sx={{
                borderRadius: 4,
                boxShadow: '0 8px 30px rgba(245, 197, 24, 0.3)',
                border: '2px solid #F5C518',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <Chip
                icon={<StarIcon sx={{ fontSize: 16 }} />}
                label="Recommandé"
                sx={{
                  position: 'absolute',
                  top: -12,
                  right: 20,
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  fontWeight: 600,
                }}
              />
              <CardContent sx={{ p: 4, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  Pro
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Pour les entreprises et professionnels
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 700, display: 'inline' }}
                  >
                    {businessPrice.toFixed(0)}€
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ display: 'inline', ml: 1 }}
                  >
                    /{isYearly ? 'an' : 'mois'}
                  </Typography>
                  {isYearly && (
                    <Typography variant="body2" color="text.secondary">
                      soit {(businessPrice / 12).toFixed(2)}€/mois
                    </Typography>
                  )}
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={() => handleSelectPlan('business')}
                  sx={{
                    py: 1.5,
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: '#E0B000',
                    },
                  }}
                >
                  Commencer
                </Button>

                <List sx={{ mt: 3, flex: 1 }}>
                  {features.map((feature, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {feature.business ? (
                          <CheckIcon sx={{ color: '#10B981', fontSize: 20 }} />
                        ) : (
                          <CloseIcon sx={{ color: '#D1D5DB', fontSize: 20 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={feature.name}
                        primaryTypographyProps={{
                          fontSize: '0.9rem',
                          color: feature.business ? '#1A1A1A' : '#9CA3AF',
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* FAQ ou informations supplémentaires */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography variant="body1" color="text.secondary">
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
