'use client';

import DashboardLayout from '@/components/DashboardLayout';
import SalesTracker from '@/components/SalesTracker';
import { Box, Typography } from '@mui/material';

export default function VentesPage() {
  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Suivi des Ventes
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Suivez les performances commerciales et les objectifs de vente
        </Typography>
      </Box>

      <SalesTracker />
    </DashboardLayout>
  );
}
