'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';

interface SubscriptionWarning {
  warning: string;
  daysRemaining?: number;
}

export default function SubscriptionBanner() {
  const router = useRouter();
  const [warning, setWarning] = useState<SubscriptionWarning | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleWarning = (event: CustomEvent<SubscriptionWarning>) => {
      setWarning(event.detail);
      setDismissed(false);
    };

    window.addEventListener('subscription-warning', handleWarning as EventListener);

    return () => {
      window.removeEventListener('subscription-warning', handleWarning as EventListener);
    };
  }, []);

  if (!warning || dismissed) {
    return null;
  }

  return (
    <Collapse in={!!warning && !dismissed}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1200 }}>
        <Alert
          severity="warning"
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                color="inherit"
                size="small"
                startIcon={<PaymentIcon />}
                onClick={() => router.push('/payment')}
              >
                Payer
              </Button>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setDismissed(true)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{
            borderRadius: 0,
            '& .MuiAlert-message': { flexGrow: 1 },
          }}
        >
          <AlertTitle>Attention - Abonnement</AlertTitle>
          {warning.warning}
          {warning.daysRemaining !== undefined && (
            <strong> ({warning.daysRemaining} jour(s) restant(s))</strong>
          )}
        </Alert>
      </Box>
    </Collapse>
  );
}
