'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  alpha,
  useTheme,
  Skeleton,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingDown as ExpenseIcon,
  Savings as SavingsIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import {
  budgetCategoriesAPI,
  savingsCategoriesAPI,
  timeEntriesAPI,
  BudgetSummary,
  SavingsCategorySummary,
  TimeSummary,
} from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';

interface BudgetAlertsProps {
  currentDate: Date;
}

interface Alert {
  id: string;
  type: 'warning' | 'danger';
  category: 'expense' | 'savings' | 'time';
  name: string;
  color: string;
  percentage: number; // Pourcentage consommé
  details: string;
}

export default function BudgetAlerts({ currentDate }: BudgetAlertsProps) {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState(true);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.abs(minutes % 60);
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const newAlerts: Alert[] = [];

      // Helper pour formater les montants (défini dans le callback pour éviter les dépendances)
      const formatAmount = (amount: number) => formatCurrency(amount, currency);

      // Fetch all data in parallel
      const [budgetRes, savingsRes, timeRes] = await Promise.all([
        budgetCategoriesAPI.getSummary(month, year).catch(() => null),
        savingsCategoriesAPI.getSummary(month, year).catch(() => null),
        timeEntriesAPI.getSummary(month, year).catch(() => null),
      ]);

      // Process expense budgets
      if (budgetRes?.data?.categories) {
        const budgetSummary = budgetRes.data as BudgetSummary;
        budgetSummary.categories
          .filter(cat => !cat.is_savings && cat.total_available > 0)
          .forEach(cat => {
            const percentage = (cat.spent_amount / cat.total_available) * 100;
            if (percentage >= 80) {
              newAlerts.push({
                id: `expense-${cat.id}`,
                type: percentage >= 100 ? 'danger' : 'warning',
                category: 'expense',
                name: cat.category?.name || 'Budget',
                color: cat.category?.color || '#EF4444',
                percentage,
                details: percentage >= 100
                  ? `Dépassé de ${formatAmount(cat.spent_amount - cat.total_available)}`
                  : `Reste ${formatAmount(cat.remaining_amount)}`,
              });
            }
          });
      }

      // Process savings categories
      if (savingsRes?.data?.categories) {
        const savingsSummary = savingsRes.data as SavingsCategorySummary;
        savingsSummary.categories
          .filter(cat => cat.allocated_amount > 0)
          .forEach(cat => {
            const percentage = (cat.spent_amount / cat.allocated_amount) * 100;
            if (percentage >= 80) {
              newAlerts.push({
                id: `savings-${cat.id}`,
                type: percentage >= 100 ? 'danger' : 'warning',
                category: 'savings',
                name: cat.name,
                color: cat.color,
                percentage,
                details: percentage >= 100
                  ? `Dépassé de ${formatAmount(cat.spent_amount - cat.allocated_amount)}`
                  : `Reste ${formatAmount(cat.remaining_amount)}`,
              });
            }
          });
      }

      // Process time budgets
      if (timeRes?.data?.by_category) {
        const timeSummary = timeRes.data as TimeSummary;
        timeSummary.by_category
          .filter(cat => cat.target_minutes > 0)
          .forEach(cat => {
            const percentage = (cat.total_minutes / cat.target_minutes) * 100;
            if (percentage >= 80) {
              newAlerts.push({
                id: `time-${cat.category_id}`,
                type: percentage >= 100 ? 'danger' : 'warning',
                category: 'time',
                name: cat.category_name,
                color: cat.color,
                percentage,
                details: percentage >= 100
                  ? `Dépassé de ${formatDuration(cat.total_minutes - cat.target_minutes)}`
                  : `Reste ${formatDuration(cat.remaining_minutes)}`,
              });
            }
          });
      }

      // Sort: danger first, then by percentage descending
      newAlerts.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'danger' ? -1 : 1;
        return b.percentage - a.percentage;
      });

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error fetching budget alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [month, year, currency]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Écouter les événements de rafraîchissement
  useEffect(() => {
    const handleRefresh = () => fetchAlerts();
    window.addEventListener('refresh-budget-data', handleRefresh);
    window.addEventListener('refresh-savings-data', handleRefresh);
    window.addEventListener('refresh-time-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-budget-data', handleRefresh);
      window.removeEventListener('refresh-savings-data', handleRefresh);
      window.removeEventListener('refresh-time-data', handleRefresh);
    };
  }, [fetchAlerts]);

  const dangerCount = alerts.filter(a => a.type === 'danger').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  const getCategoryIcon = (category: Alert['category']) => {
    switch (category) {
      case 'expense':
        return <ExpenseIcon sx={{ fontSize: 14 }} />;
      case 'savings':
        return <SavingsIcon sx={{ fontSize: 14 }} />;
      case 'time':
        return <TimeIcon sx={{ fontSize: 14 }} />;
    }
  };

  const getCategoryLabel = (category: Alert['category']) => {
    switch (category) {
      case 'expense':
        return 'Charges';
      case 'savings':
        return 'Épargne';
      case 'time':
        return 'Temps';
    }
  };

  if (loading) {
    return (
      <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // Pas d'alertes - afficher un message positif
  if (alerts.length === 0) {
    return (
      <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: alpha('#10B981', 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckIcon sx={{ color: '#10B981', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981' }}>
                Tous les budgets sont sains
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Aucun budget n'a dépassé 80% de consommation
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderRadius: 2,
        bgcolor: theme.palette.background.paper,
        border: dangerCount > 0
          ? `1px solid ${alpha('#EF4444', 0.3)}`
          : `1px solid ${alpha('#F59E0B', 0.3)}`,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: dangerCount > 0 ? alpha('#EF4444', 0.1) : alpha('#F59E0B', 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {dangerCount > 0 ? (
                <ErrorIcon sx={{ color: '#EF4444', fontSize: 20 }} />
              ) : (
                <WarningIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
              )}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Alertes budgétaires
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
                {dangerCount > 0 && (
                  <Chip
                    label={`${dangerCount} dépassé${dangerCount > 1 ? 's' : ''}`}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      bgcolor: alpha('#EF4444', 0.1),
                      color: '#EF4444',
                      fontWeight: 600,
                    }}
                  />
                )}
                {warningCount > 0 && (
                  <Chip
                    label={`${warningCount} proche${warningCount > 1 ? 's' : ''} du seuil`}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      bgcolor: alpha('#F59E0B', 0.1),
                      color: '#F59E0B',
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* Alert list */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {alerts.map((alert) => (
              <Box
                key={alert.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: alpha(alert.type === 'danger' ? '#EF4444' : '#F59E0B', 0.05),
                  borderLeft: `3px solid ${alert.color}`,
                }}
              >
                {/* Category icon */}
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: alpha(alert.color, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: alert.color,
                    flexShrink: 0,
                  }}
                >
                  {getCategoryIcon(alert.category)}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alert.name}
                    </Typography>
                    <Chip
                      label={getCategoryLabel(alert.category)}
                      size="small"
                      sx={{
                        height: 14,
                        fontSize: '0.55rem',
                        bgcolor: alpha(alert.color, 0.1),
                        color: alert.color,
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {alert.details}
                  </Typography>
                </Box>

                {/* Percentage */}
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: alert.type === 'danger' ? '#EF4444' : '#F59E0B',
                    }}
                  >
                    {alert.percentage.toFixed(0)}%
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
