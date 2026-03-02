'use client';

import { Box, Paper, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend
}: MetricCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: '#9CA3AF',
            fontSize: '0.75rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </Typography>
        {icon && (
          <Box sx={{ color: '#9CA3AF' }}>
            {icon}
          </Box>
        )}
      </Box>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          fontSize: { xs: '1.5rem', sm: '1.75rem' },
          mb: 1,
        }}
      >
        {value}
      </Typography>

      {(subtitle || trend) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
          {trend && (
            <Typography
              component="span"
              sx={{
                color: trend.isPositive ? '#22C55E' : '#EF4444',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              {trend.isPositive ? '+' : '-'}{trend.value}
            </Typography>
          )}
          {subtitle && (
            <Typography
              variant="body2"
              sx={{ color: '#9CA3AF', fontSize: '0.8rem' }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}
