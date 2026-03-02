'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  HourglassEmpty as PendingIcon,
  Error as ErrorIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { paymentAPI } from '@/lib/api';

function PaymentSuccessContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkPaymentStatus = async () => {
      const orderId = searchParams.get('order_id');
      const krAnswer = searchParams.get('kr-answer');

      // Si on a un kr-answer (ancien flow embedded), l'utiliser
      if (krAnswer) {
        try {
          const response = await paymentAPI.confirmSuccess(krAnswer);
          const data = response.data as { status: string; message: string };

          if (data.status === 'success') {
            setStatus('success');
            setMessage('Votre paiement a été confirmé avec succès !');
          } else if (data.status === 'pending') {
            setStatus('pending');
            setMessage('Votre paiement est en cours de traitement...');
          } else {
            setStatus('error');
            setMessage(data.message || 'Erreur lors de la confirmation du paiement');
          }
        } catch (err: any) {
          console.error('Payment confirmation error:', err);
          setStatus('error');
          setMessage(err.response?.data?.detail || 'Erreur lors de la confirmation du paiement');
        }
        return;
      }

      // Sinon, vérifier le statut via le polling
      // La page de paiement Payzen redirige ici après succès
      // L'IPN devrait avoir déjà mis à jour le statut
      if (orderId) {
        // Attendre un peu pour que l'IPN ait le temps d'être traité
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
          const statusRes = await paymentAPI.getStatus();
          if (statusRes.data.subscription_status === 'active') {
            setStatus('success');
            setMessage('Votre paiement a été confirmé avec succès !');
          } else if (statusRes.data.setup_fee_paid) {
            // Les frais de mise en place ont été payés
            setStatus('success');
            setMessage('Votre paiement a été confirmé avec succès !');
          } else {
            setStatus('pending');
            setMessage('Votre paiement est en cours de traitement...');
          }
        } catch (err) {
          console.error('Status check error:', err);
          setStatus('pending');
          setMessage('Votre paiement est en cours de traitement...');
        }
        return;
      }

      // Aucun paramètre - vérifier simplement le statut
      try {
        const statusRes = await paymentAPI.getStatus();
        if (statusRes.data.subscription_status === 'active') {
          setStatus('success');
          setMessage('Votre abonnement est actif !');
        } else {
          setStatus('pending');
          setMessage('Vérification du paiement en cours...');
        }
      } catch {
        setStatus('error');
        setMessage('Impossible de vérifier le statut du paiement');
      }
    };

    checkPaymentStatus();
  }, [searchParams]);

  // Polling pour vérifier le statut si pending
  useEffect(() => {
    if (status !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await paymentAPI.getStatus();
        if (statusRes.data.subscription_status === 'active' || statusRes.data.setup_fee_paid) {
          setStatus('success');
          setMessage('Votre paiement a été confirmé avec succès !');
          clearInterval(interval);
        }
      } catch {
        // Continue polling
      }
    }, 3000);

    // Arrêter le polling après 60 secondes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (status === 'pending') {
        setStatus('success');
        setMessage('Votre paiement a été enregistré. Vous pouvez accéder à votre tableau de bord.');
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status]);

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <CircularProgress size={64} />;
      case 'success':
        return <SuccessIcon sx={{ fontSize: 64, color: 'success.main' }} />;
      case 'pending':
        return <PendingIcon sx={{ fontSize: 64, color: 'warning.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Vérification du paiement...';
      case 'success':
        return 'Paiement réussi !';
      case 'pending':
        return 'Paiement en cours...';
      case 'error':
        return 'Erreur de paiement';
    }
  };

  const getBgColor = () => {
    switch (status) {
      case 'success':
        return alpha(theme.palette.success.main, 0.05);
      case 'pending':
        return alpha(theme.palette.warning.main, 0.05);
      case 'error':
        return alpha(theme.palette.error.main, 0.05);
      default:
        return 'transparent';
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card sx={{ bgcolor: getBgColor() }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Box sx={{ mb: 3 }}>
            {getIcon()}
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {getTitle()}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {message}
          </Typography>

          {(status === 'success' || status === 'pending') && (
            <Button
              variant="contained"
              size="large"
              startIcon={<DashboardIcon />}
              onClick={() => router.push('/dashboard')}
              sx={{ mt: 2 }}
            >
              Accéder au tableau de bord
            </Button>
          )}

          {status === 'pending' && (
            <Alert severity="info" sx={{ mt: 3 }}>
              La confirmation peut prendre quelques instants. Vous pouvez continuer vers le tableau de bord.
            </Alert>
          )}

          {status === 'error' && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/payment')}
                sx={{ mr: 2 }}
              >
                Réessayer
              </Button>
              <Button
                variant="text"
                onClick={() => router.push('/dashboard')}
              >
                Retour au dashboard
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
