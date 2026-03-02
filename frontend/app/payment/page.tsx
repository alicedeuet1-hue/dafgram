'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  useTheme,
  alpha,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  CheckCircle as CheckIcon,
  CalendarMonth as MonthlyIcon,
  CalendarToday as YearlyIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { paymentAPI, PricingInfo, SubscriptionStatusResponse, BillingCycle, PaymentType } from '@/lib/api';

export default function PaymentPage() {
  const theme = useTheme();
  const router = useRouter();

  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [status, setStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');

  // Charger les infos
  useEffect(() => {
    const loadData = async () => {
      try {
        // Récupérer le cycle de facturation choisi lors de l'inscription
        const savedBillingCycle = localStorage.getItem('billing_cycle');
        if (savedBillingCycle === 'monthly' || savedBillingCycle === 'yearly') {
          setBillingCycle(savedBillingCycle);
          localStorage.removeItem('billing_cycle');
        }

        const [pricingRes, statusRes] = await Promise.all([
          paymentAPI.getPricing(),
          paymentAPI.getStatus(),
        ]);
        setPricing(pricingRes.data);
        setStatus(statusRes.data);
      } catch (err) {
        console.error('Error loading payment data:', err);
        setError('Erreur lors du chargement des informations de paiement');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Vérifier l'erreur d'abonnement stockée
  useEffect(() => {
    const subscriptionError = localStorage.getItem('subscription_error');
    if (subscriptionError) {
      try {
        const errorData = JSON.parse(subscriptionError);
        setError(errorData.error || 'Votre abonnement nécessite une mise à jour');
      } catch {
        // Ignore parsing errors
      }
      localStorage.removeItem('subscription_error');
    }
  }, []);

  const formatXPF = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XPF';
  };

  const handlePayment = async (paymentType: PaymentType) => {
    setPaymentLoading(true);
    setError(null);

    try {
      const response = await paymentAPI.createPayment({
        payment_type: paymentType,
        billing_cycle: billingCycle,
      });

      // Rediriger vers la page de paiement Payzen
      const { payment_url } = response.data;
      if (payment_url) {
        window.location.href = payment_url;
      } else {
        setError('URL de paiement non reçue');
        setPaymentLoading(false);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.response?.data?.detail || 'Erreur lors de la création du paiement');
      setPaymentLoading(false);
    }
  };

  const getPaymentType = (): PaymentType => {
    if (!status?.setup_fee_paid) {
      return 'combined';
    }
    return 'subscription';
  };

  const getTotalAmount = () => {
    if (!pricing) return 0;
    let total = billingCycle === 'yearly' ? pricing.yearly_subscription : pricing.monthly_subscription;
    if (!status?.setup_fee_paid) {
      total += pricing.setup_fee;
    }
    return total;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <PaymentIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Abonnement DafGram
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gérez votre abonnement et vos paiements
        </Typography>
      </Box>

      {/* Erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statut actuel */}
      {status && (
        <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Statut actuel
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={
                  status.subscription_status === 'active' ? 'Actif' :
                  status.subscription_status === 'trial' ? 'Essai' :
                  status.subscription_status === 'grace_period' ? 'Période de grâce' :
                  status.subscription_status === 'suspended' ? 'Suspendu' :
                  'Expiré'
                }
                color={
                  status.subscription_status === 'active' ? 'success' :
                  status.subscription_status === 'trial' ? 'info' :
                  status.subscription_status === 'grace_period' ? 'warning' :
                  'error'
                }
                size="small"
              />
              {status.setup_fee_paid && (
                <Chip
                  icon={<CheckIcon sx={{ fontSize: 16 }} />}
                  label="Mise en place payée"
                  size="small"
                  variant="outlined"
                  color="success"
                />
              )}
              {status.is_in_grace_period && status.days_until_suspension !== undefined && (
                <Typography variant="caption" color="warning.main">
                  {status.days_until_suspension} jour(s) avant suspension
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Choix de la facturation */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Cycle de facturation
        </Typography>
        <ToggleButtonGroup
          value={billingCycle}
          exclusive
          onChange={(_, value) => value && setBillingCycle(value)}
          size="small"
        >
          <ToggleButton value="monthly">
            <MonthlyIcon sx={{ mr: 1 }} />
            Mensuel
          </ToggleButton>
          <ToggleButton value="yearly">
            <YearlyIcon sx={{ mr: 1 }} />
            Annuel (-20%)
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Récapitulatif */}
      {pricing && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Récapitulatif</Typography>

            <Stack spacing={1}>
              {!status?.setup_fee_paid && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Frais de mise en place (unique)</Typography>
                  <Typography fontWeight={600}>{formatXPF(pricing.setup_fee)}</Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>
                  Abonnement {billingCycle === 'yearly' ? 'annuel' : 'mensuel'}
                </Typography>
                <Typography fontWeight={600}>
                  {formatXPF(billingCycle === 'yearly' ? pricing.yearly_subscription : pricing.monthly_subscription)}
                </Typography>
              </Box>

              {billingCycle === 'yearly' && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'success.main' }}>
                  <Typography variant="body2">Économie annuelle</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    -{formatXPF(pricing.yearly_savings)}
                  </Typography>
                </Box>
              )}

              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1, mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6" color="primary">
                  {formatXPF(getTotalAmount())}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Bouton de paiement */}
      <Card sx={{ mb: 3, border: `2px solid ${theme.palette.primary.main}` }}>
        <CardContent sx={{ textAlign: 'center', py: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <LockIcon sx={{ color: theme.palette.success.main }} />
            <Typography variant="body2" color="text.secondary">
              Paiement sécurisé par Payzen by OSB
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => handlePayment(getPaymentType())}
            disabled={paymentLoading}
            startIcon={paymentLoading ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
            sx={{ py: 1.5, fontSize: '1.1rem' }}
          >
            {paymentLoading ? 'Redirection en cours...' : `Payer ${formatXPF(getTotalAmount())}`}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Vous allez être redirigé vers la page de paiement sécurisée
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
