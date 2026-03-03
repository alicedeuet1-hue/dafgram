'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalanceWallet as WalletIcon,
  Savings as SavingsIcon,
} from '@mui/icons-material';
import { budgetCategoriesAPI, BudgetSummary, savingsCategoriesAPI, SavingsCategorySummary } from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';

interface Props {
  currentDate: Date;
}

export default function PersonalExpenseSummary({ currentDate }: Props) {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';

  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [savingsSummary, setSavingsSummary] = useState<SavingsCategorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const formatAmount = useCallback(
    (value: number) => formatCurrency(value, currency),
    [currency]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [budgetRes, savingsRes] = await Promise.all([
          budgetCategoriesAPI.getSummary(month, year),
          savingsCategoriesAPI.getSummary(month, year),
        ]);
        setSummary(budgetRes.data);
        setSavingsSummary(savingsRes.data);
      } catch (err) {
        console.error('Error fetching personal summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month, year]);

  if (loading) {
    return (
      <Box sx={{ mt: 3 }}>
        <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
          <CardContent sx={{ p: 2.5 }}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  const totalRevenue = summary?.total_revenue || 0;
  const totalSpent = summary?.total_spent || 0;
  const remaining = totalRevenue - totalSpent;
  const savingsPercentage = savingsSummary?.total_savings_percentage || 0;
  const savingsAllocated = (savingsPercentage / 100) * totalRevenue;
  const savingsSpent = savingsSummary?.current_month_spent || 0;

  // Build category rows from budget categories (non-savings)
  const expenseCategories = (summary?.categories || []).filter(c => !c.is_savings && c.category);
  // Savings row
  const savingsRow = {
    name: 'Épargne',
    color: '#10B981',
    allocated: savingsAllocated,
    spent: savingsSpent,
    percentage: savingsPercentage,
  };

  const rows = [
    ...expenseCategories.map(c => ({
      name: c.category?.name || 'Catégorie',
      color: c.category?.color || '#6B7280',
      allocated: c.allocated_amount,
      spent: c.spent_amount,
      percentage: c.percentage,
    })),
    savingsRow,
  ];

  return (
    <Box sx={{ mt: 3 }}>
      <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 2.5 }}>
            Suivi des dépenses
          </Typography>

          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {/* Revenus */}
            <Box
              sx={{
                flex: 1,
                minWidth: 140,
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#10B981', 0.08),
                border: `1px solid ${alpha('#10B981', 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 16, color: '#10B981' }} />
                <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600 }}>
                  Revenus
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(totalRevenue)}
              </Typography>
            </Box>

            {/* Dépenses */}
            <Box
              sx={{
                flex: 1,
                minWidth: 140,
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#EF4444', 0.08),
                border: `1px solid ${alpha('#EF4444', 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TrendingDownIcon sx={{ fontSize: 16, color: '#EF4444' }} />
                <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 600 }}>
                  Dépenses
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(totalSpent)}
              </Typography>
            </Box>

            {/* Reste disponible */}
            <Box
              sx={{
                flex: 1,
                minWidth: 140,
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(remaining >= 0 ? '#F5C518' : '#EF4444', 0.08),
                border: `1px solid ${alpha(remaining >= 0 ? '#F5C518' : '#EF4444', 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <WalletIcon sx={{ fontSize: 16, color: remaining >= 0 ? '#F5C518' : '#EF4444' }} />
                <Typography variant="caption" sx={{ color: remaining >= 0 ? '#F5C518' : '#EF4444', fontWeight: 600 }}>
                  Reste disponible
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(remaining)}
              </Typography>
            </Box>
          </Box>

          {/* Category breakdown */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.secondary, mb: 1.5 }}>
            Répartition du budget (règle 50/30/20)
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rows.map((row) => {
              const usedPercent = row.allocated > 0
                ? Math.min(100, (row.spent / row.allocated) * 100)
                : 0;
              const isOver = row.spent > row.allocated && row.allocated > 0;

              return (
                <Box key={row.name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {row.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        ({row.percentage}%)
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: isOver ? '#EF4444' : theme.palette.text.primary,
                      }}
                    >
                      {formatAmount(row.spent)} / {formatAmount(row.allocated)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={usedPercent}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(row.color, 0.15),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: isOver ? '#EF4444' : row.color,
                      },
                    }}
                  />
                </Box>
              );
            })}
          </Box>

          {/* No revenue hint */}
          {totalRevenue === 0 && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha('#F5C518', 0.08),
                border: `1px solid ${alpha('#F5C518', 0.2)}`,
              }}
            >
              <Typography variant="caption" sx={{ color: '#F5C518' }}>
                Ajoutez vos revenus du mois dans les transactions pour voir la répartition de votre budget.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
