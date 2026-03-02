'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Payment as PaymentIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';

export default function PaymentCancelPage() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Box sx={{ mb: 3 }}>
            <CancelIcon sx={{ fontSize: 64, color: 'warning.main' }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Paiement annulé
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Vous avez annulé le paiement. Aucun montant n'a été débité de votre compte.
          </Typography>

          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PaymentIcon />}
              onClick={() => router.push('/payment')}
            >
              Réessayer le paiement
            </Button>

            <Button
              variant="text"
              startIcon={<DashboardIcon />}
              onClick={() => router.push('/dashboard')}
            >
              Retour au tableau de bord
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
