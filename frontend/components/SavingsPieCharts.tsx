'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Savings as SavingsIcon,
  TrendingUp as GrowthIcon,
  Build as InvestIcon,
  School as FormationIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  Sector,
} from 'recharts';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';
import { savingsCategoriesAPI, transactionsAPI, SavingsCategory, SavingsCategorySummary, Transaction } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { format as formatDate } from 'date-fns';

interface SavingsPieChartsProps {
  currentDate?: Date;
  renderMode?: 'full' | 'pie-only';
}

export default function SavingsPieCharts({
  currentDate: externalDate,
  renderMode = 'full',
}: SavingsPieChartsProps) {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const isPersonalAccount = currentCompany?.account_type === 'personal';
  const containerRef = useRef<HTMLDivElement>(null);

  // Date management
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = externalDate || internalDate;
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  // Data
  const [categories, setCategories] = useState<SavingsCategory[]>([]);
  const [summary, setSummary] = useState<SavingsCategorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Interaction state
  const [selectedSliceId, setSelectedSliceId] = useState<number | null>(null);
  const [hoveredSliceId, setHoveredSliceId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SavingsCategory | null>(null);

  // Dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const router = useRouter();

  // État pour le positionnement dynamique du logo
  const [logoTop, setLogoTop] = useState(92);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const formatAmount = (amount: number) => formatCurrency(amount, currency);

  // Fetch transactions when dialog opens - filtré par mois sélectionné
  useEffect(() => {
    if (detailDialogOpen && selectedCategory) {
      const fetchTransactions = async () => {
        setTransactionsLoading(true);
        try {
          // Filtrer par le mois sélectionné
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59); // Dernier jour du mois à 23:59:59
          const res = await transactionsAPI.getAll({
            savings_category_id: selectedCategory.id,
            start_date: startDate.toISOString().split('T')[0], // Format YYYY-MM-DD
            end_date: endDate.toISOString().split('T')[0],
            limit: 100,
          });
          setTransactions(res.data.items || []);
        } catch (error) {
          console.error('Error fetching transactions:', error);
          setTransactions([]);
        } finally {
          setTransactionsLoading(false);
        }
      };
      fetchTransactions();
    }
  }, [detailDialogOpen, selectedCategory, month, year]);

  // Calcul dynamique de la position du logo basé sur la hauteur de la légende
  useEffect(() => {
    const calculateLogoPosition = () => {
      if (chartContainerRef.current) {
        const legend = chartContainerRef.current.querySelector('.recharts-legend-wrapper');
        if (legend) {
          const containerHeight = 220; // Hauteur du ResponsiveContainer
          const legendHeight = legend.getBoundingClientRect().height;
          // Le centre du camembert est au milieu de (containerHeight - legendHeight)
          const pieCenter = (containerHeight - legendHeight) / 2;
          setLogoTop(pieCenter);
        }
      }
    };

    // Calculer après le rendu initial
    const timer = setTimeout(calculateLogoPosition, 100);

    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(calculateLogoPosition);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [summary]); // Recalculer quand les données changent

  // Month navigation
  const handlePrevMonth = () => setInternalDate(subMonths(internalDate, 1));
  const handleNextMonth = () => {
    const nextMonth = addMonths(internalDate, 1);
    if (nextMonth <= new Date()) setInternalDate(nextMonth);
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, summaryRes] = await Promise.all([
        savingsCategoriesAPI.getAll(month, year),
        savingsCategoriesAPI.getSummary(month, year),
      ]);
      setCategories(catRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching savings data:', error);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Écouter l'événement de rafraîchissement des données d'épargne
  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-savings-data', handleRefresh);
    return () => window.removeEventListener('refresh-savings-data', handleRefresh);
  }, [fetchData]);

  // Écouter l'événement de désélection (quand on clique sur un autre camembert)
  useEffect(() => {
    const handleDeselect = () => {
      setSelectedSliceId(null);
      setSelectedCategory(null);
    };
    window.addEventListener('deselect-savings-slice', handleDeselect);
    return () => window.removeEventListener('deselect-savings-slice', handleDeselect);
  }, []);

  // Color adaptation for dark mode
  const adaptColorForTheme = (hex: string): string => {
    if (!hex) return '#10B981';
    const isDarkMode = theme.palette.mode === 'dark';
    if (!isDarkMode) return hex;

    const num = parseInt(hex.replace('#', ''), 16);
    const R = (num >> 16) & 0xFF;
    const G = (num >> 8) & 0xFF;
    const B = num & 0xFF;
    const luminance = (0.299 * R + 0.587 * G + 0.114 * B);

    if (luminance < 30) return '#F5F5F5';
    if (luminance < 128) {
      const brightenAmount = 80;
      const newR = Math.min(255, R + brightenAmount);
      const newG = Math.min(255, G + brightenAmount);
      const newB = Math.min(255, B + brightenAmount);
      return '#' + (0x1000000 + newR * 0x10000 + newG * 0x100 + newB).toString(16).slice(1);
    }
    return hex;
  };

  // Prepare pie chart data - utilise les données MENSUELLES
  // - allocated = current_month_allocated (alloué ce mois)
  // - spent = current_month_spent (dépensé ce mois)
  // - remaining = remaining_amount (solde cumulatif, peut être négatif si dépassement passé)
  const pieData: any[] = [];

  categories.forEach(cat => {
    // Données MENSUELLES
    const monthAllocated = cat.current_month_allocated || 0;
    const monthSpent = cat.current_month_spent || 0;
    // Solde CUMULATIF (peut être négatif si on a trop dépensé les mois précédents)
    const cumulativeRemaining = cat.remaining_amount || 0;

    // Le restant pour le camembert : si le solde cumulatif est négatif,
    // on considère qu'il n'y a plus rien à dépenser
    const pieRemaining = Math.max(0, cumulativeRemaining);

    // Si le solde cumulatif est négatif ou nul (tout consommé/dépassé des mois passés)
    if (cumulativeRemaining <= 0) {
      // Tout le budget est consommé - afficher le pourcentage complet comme dépensé
      // On garde la couleur de la catégorie (version plus claire)
      pieData.push({
        id: `${cat.id}-spent`,
        name: `${cat.name} - Consommé`,
        value: cat.percentage, // Tout le pourcentage alloué
        color: theme.palette.mode === 'dark'
          ? alpha(adaptColorForTheme(cat.color), 0.3)
          : alpha(cat.color, 0.25),
        originalColor: cat.color,
        category: cat,
        allocated: monthAllocated,
        spent: monthSpent,
        remaining: cumulativeRemaining,
        isSpent: true,
        isOverspent: cumulativeRemaining < 0,
        categoryName: cat.name,
      });
    } else {
      // Calculer les proportions basées sur le budget total disponible (alloué + report)
      const totalAvailable = monthAllocated + Math.max(0, cumulativeRemaining - monthAllocated + monthSpent);

      // Part RESTANTE (colorée) - ce qui reste à dépenser
      pieData.push({
        id: cat.id,
        name: cat.name,
        value: totalAvailable > 0 ? (pieRemaining / totalAvailable) * cat.percentage : cat.percentage,
        color: adaptColorForTheme(cat.color),
        originalColor: cat.color,
        category: cat,
        allocated: monthAllocated,
        spent: monthSpent,
        remaining: cumulativeRemaining,
        isSpent: false,
      });

      // Part DÉPENSÉE CE MOIS (couleur plus claire) - seulement si des dépenses ce mois
      if (monthSpent > 0) {
        pieData.push({
          id: `${cat.id}-spent`,
          name: `${cat.name} - Dépensé`,
          value: totalAvailable > 0 ? (monthSpent / totalAvailable) * cat.percentage : 0,
          color: theme.palette.mode === 'dark'
            ? alpha(adaptColorForTheme(cat.color), 0.3)
            : alpha(cat.color, 0.25),
          originalColor: cat.color,
          category: cat,
          allocated: monthAllocated,
          spent: monthSpent,
          remaining: cumulativeRemaining,
          isSpent: true,
          categoryName: cat.name,
        });
      }
    }
  });

  // Add "Non alloué" if total < 100%
  const totalPercentage = categories.reduce((sum, cat) => sum + cat.percentage, 0);
  if (totalPercentage < 100) {
    pieData.push({
      id: -1,
      name: 'Non alloué',
      value: 100 - totalPercentage,
      color: theme.palette.mode === 'dark' ? '#374151' : '#E5E7EB',
      originalColor: '#9CA3AF',
      category: null as any,
      allocated: 0,
      spent: 0,
      remaining: 0,
      isSpent: false,
    });
  }

  // Handle slice click
  const handleSliceClick = useCallback((data: any) => {
    if (data.id === -1) return; // Ignore "Non alloué"

    // Pour les parts dépensées, extraire l'ID de catégorie
    const categoryId = data.isSpent ? data.category?.id : data.id;
    if (!categoryId) return;

    // Désélectionner les autres camemberts quand on clique ici
    window.dispatchEvent(new CustomEvent('deselect-budget-slice'));
    window.dispatchEvent(new CustomEvent('deselect-time-slice'));

    if (selectedSliceId === categoryId) {
      // Second click - open detail
      setSelectedCategory(data.category);
      setDetailDialogOpen(true);
    } else {
      // First click - select
      setSelectedSliceId(categoryId);
      setSelectedCategory(data.category);
    }
  }, [selectedSliceId]);

  // Deselect
  const handleDeselectSlice = useCallback(() => {
    setSelectedSliceId(null);
    setSelectedCategory(null);
  }, []);

  // Click outside handler
  const handleChartBackgroundClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isSliceClick = target.closest('.recharts-pie-sector') ||
                         (target.closest('.recharts-layer') && target.tagName.toLowerCase() === 'path');
    if (!isSliceClick && selectedSliceId) {
      handleDeselectSlice();
    }
  }, [selectedSliceId, handleDeselectSlice]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;

    // Tooltip pour la part "Dépensé" ou "Consommé" d'une catégorie
    if (data.isSpent && data.category) {
      const spentPercent = data.allocated > 0
        ? ((data.spent / data.allocated) * 100).toFixed(0)
        : '0';
      const isOverspent = data.isOverspent || data.remaining < 0;
      return (
        <Box sx={{
          bgcolor: theme.palette.background.paper,
          p: 1.5,
          borderRadius: 1,
          boxShadow: theme.shadows[4],
          border: `1px solid ${isOverspent ? '#EF4444' : theme.palette.divider}`,
          zIndex: 9999,
          position: 'relative',
        }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: isOverspent ? '#EF4444' : data.originalColor }}>
            {data.categoryName} - {isOverspent ? 'Dépassement' : 'Dépensé ce mois'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: '#EF4444' }}>
            Dépensé: {formatAmount(data.spent)} / Alloué: {formatAmount(data.allocated)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {spentPercent}% du budget mensuel
          </Typography>
          {isOverspent && (
            <Typography variant="caption" sx={{ display: 'block', color: '#EF4444', fontWeight: 600 }}>
              Solde négatif: {formatAmount(data.remaining)}
            </Typography>
          )}
        </Box>
      );
    }

    return (
      <Box sx={{
        bgcolor: theme.palette.background.paper,
        p: 1.5,
        borderRadius: 1,
        boxShadow: theme.shadows[4],
        border: `1px solid ${theme.palette.divider}`,
        zIndex: 9999,
        position: 'relative',
      }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: data.originalColor }}>
          {data.name}{data.category ? ' - Restant' : ''}
        </Typography>
        {data.category ? (
          <>
            <Typography variant="caption" color="text.secondary">
              Budget: {data.category.percentage?.toFixed(0)}%
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: '#10B981' }}>
              Alloué (mois): {formatAmount(data.allocated)}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: '#EF4444' }}>
              Dépensé (mois): {formatAmount(data.spent)}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: data.remaining >= 0 ? '#10B981' : '#EF4444' }}>
              Solde: {formatAmount(data.remaining)}
            </Typography>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {data.value.toFixed(1)}% non alloué
          </Typography>
        )}
      </Box>
    );
  };

  // Active shape for selected slice
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    );
  };

  // Selected category panel - affiche données MENSUELLES
  const SelectedCategoryPanel = () => {
    if (!selectedCategory) return null;
    const cat = selectedCategory;
    // Données mensuelles
    const monthAllocated = cat.current_month_allocated || 0;
    const monthSpent = cat.current_month_spent || 0;
    // Solde cumulatif (peut être négatif)
    const cumulativeRemaining = cat.remaining_amount || 0;

    // Pourcentage basé sur les données mensuelles
    const spentPercent = monthAllocated > 0
      ? ((monthSpent / monthAllocated) * 100).toFixed(1)
      : '0';

    return (
      <Fade in={!!selectedCategory}>
        <Box sx={{
          mt: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: alpha(cat.color, 0.1),
          border: `1px solid ${cat.color}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: cat.color,
              }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {cat.name}
              </Typography>
              <Chip
                label={`${cat.percentage}%`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: alpha(cat.color, 0.2),
                  color: cat.color,
                  fontWeight: 700,
                }}
              />
            </Box>
            <IconButton size="small" onClick={handleDeselectSlice} sx={{ p: 0.5 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Grid container spacing={1}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: theme.palette.background.paper, borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Alloué (mois)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981', fontSize: '0.8rem' }}>
                  {formatAmount(monthAllocated)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: alpha('#EF4444', 0.1), borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Dépensé (mois)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#EF4444', fontSize: '0.8rem' }}>
                  {formatAmount(monthSpent)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: cumulativeRemaining >= 0 ? alpha('#10B981', 0.1) : alpha('#EF4444', 0.1),
                borderRadius: 1,
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Solde
                </Typography>
                <Typography variant="body2" sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: cumulativeRemaining >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {formatAmount(cumulativeRemaining)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(parseFloat(spentPercent), 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(cat.color, 0.2),
                '& .MuiLinearProgress-bar': {
                  bgcolor: parseFloat(spentPercent) > 100 ? '#EF4444' : cat.color,
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
              {spentPercent}% du budget mensuel utilisé
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress sx={{ color: '#10B981' }} />
      </Box>
    );
  }

  // Render mode: pie-only (for dashboard)
  if (renderMode === 'pie-only') {
    return (
      <Box ref={containerRef}>
        <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Épargne
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {summary?.total_savings_percentage || 0}% {isPersonalAccount ? 'des revenus' : 'du CA'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981' }}>
                  {formatAmount(summary?.current_month_allocated || 0)}
                </Typography>
              </Box>
            </Box>

            {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
              <Box ref={chartContainerRef} sx={{ position: 'relative' }} onClick={handleChartBackgroundClick}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={handleSliceClick}
                      onMouseEnter={(data) => {
                        const catId = data.isSpent ? data.category?.id : data.id;
                        if (catId !== -1) setHoveredSliceId(catId);
                      }}
                      onMouseLeave={() => setHoveredSliceId(null)}
                      activeIndex={pieData.findIndex(d =>
                        d.isSpent ? d.category?.id === selectedSliceId : d.id === selectedSliceId
                      )}
                      activeShape={renderActiveShape}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData.map((entry, index) => {
                        const entryCategoryId = entry.isSpent ? entry.category?.id : entry.id;
                        const isSelected = selectedSliceId === entryCategoryId;
                        const isHovered = hoveredSliceId === entryCategoryId;

                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            opacity={
                              selectedSliceId
                                ? (isSelected ? (entry.isSpent ? 0.7 : 1) : 0.3)
                                : hoveredSliceId
                                  ? (isHovered ? (entry.isSpent ? 0.7 : 1) : 0.3)
                                  : (entry.isSpent ? 0.7 : 0.9)
                            }
                            style={{
                              transition: 'opacity 0.3s ease',
                              cursor: 'pointer',
                            }}
                          />
                        );
                      })}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                    <Legend
                      payload={pieData.filter(d => !d.isSpent && d.id !== -1).map(entry => ({
                        value: entry.name,
                        type: 'square',
                        color: entry.originalColor,
                      }))}
                      wrapperStyle={{ color: theme.palette.text.primary, fontSize: '0.75rem' }}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Logo de l'entreprise au centre du camembert */}
                {currentCompany?.logo_url && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: logoTop,
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      bgcolor: theme.palette.background.paper,
                      boxShadow: theme.shadows[2],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  >
                    <img
                      src={`http://localhost:8000${currentCompany.logo_url}`}
                      alt="Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                )}

                {selectedSliceId && <SelectedCategoryPanel />}
              </Box>
            ) : (
              <Box sx={{
                height: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                p: 2,
                bgcolor: alpha('#10B981', 0.05),
                borderRadius: 2,
                border: `2px dashed ${alpha('#10B981', 0.2)}`,
              }}>
                <SavingsIcon sx={{ fontSize: 32, color: theme.palette.text.disabled }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Aucune épargne configurée
                </Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ fontSize: '0.7rem' }}>
                  Configurez vos catégories d'épargne
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Dialog des transactions (pie-only mode) */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              bgcolor: theme.palette.background.paper,
            },
          }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedCategory && (
                <>
                  <Box sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: selectedCategory.color,
                  }} />
                  <Typography variant="h6">{selectedCategory.name}</Typography>
                  <Chip
                    label={`${selectedCategory.percentage}%`}
                    size="small"
                    sx={{
                      bgcolor: alpha(selectedCategory.color, 0.2),
                      color: selectedCategory.color,
                      fontWeight: 600,
                    }}
                  />
                </>
              )}
            </Box>
            <IconButton onClick={() => setDetailDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            {transactionsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: '#10B981' }} />
              </Box>
            ) : transactions.length > 0 ? (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {transactions.map((tx) => (
                  <Box
                    key={tx.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 2,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {tx.description || 'Sans description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: tx.type === 'expense' ? '#EF4444' : '#10B981',
                      }}
                    >
                      {tx.type === 'expense' ? '-' : '+'}{formatAmount(tx.amount)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                px: 3,
                gap: 2,
              }}>
                <SavingsIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                <Typography color="text.secondary" textAlign="center">
                  Aucune transaction ce mois-ci
                </Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 300 }}>
                  Pour assigner des transactions à cette épargne, allez dans Banque et cliquez sur l'icône tirelire
                </Typography>
                <Box
                  component="button"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    router.push('/dashboard/banque');
                  }}
                  sx={{
                    mt: 1,
                    px: 3,
                    py: 1,
                    bgcolor: '#10B981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  Importer des transactions
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  // Render mode: full
  return (
    <Box ref={containerRef}>
      {/* Month navigation */}
      {!externalDate && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          mb: 3,
          p: 2,
          bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#F9FAFB',
          borderRadius: 3,
        }}>
          <IconButton onClick={handlePrevMonth} size="small" sx={{ bgcolor: theme.palette.background.paper }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6" sx={{
            fontWeight: 600,
            minWidth: 180,
            textAlign: 'center',
            textTransform: 'capitalize',
            color: theme.palette.text.primary,
          }}>
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </Typography>
          <IconButton onClick={handleNextMonth} size="small" sx={{ bgcolor: theme.palette.background.paper }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Left: Overview pie chart */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, bgcolor: theme.palette.background.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                  Répartition de l'épargne
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      Épargne du mois ({summary?.total_savings_percentage || 0}% {isPersonalAccount ? 'des revenus' : 'du CA'})
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#10B981' }}>
                      {formatAmount(summary?.current_month_allocated || 0)}
                    </Typography>
                  </Box>
                  <Tooltip title="Paramètres d'épargne">
                    <IconButton
                      onClick={() => window.dispatchEvent(new CustomEvent('open-savings-settings'))}
                      sx={{
                        bgcolor: alpha(theme.palette.grey[500], 0.1),
                        '&:hover': { bgcolor: alpha('#10B981', 0.2) },
                      }}
                    >
                      <SettingsIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
                <Box sx={{ position: 'relative' }} onClick={handleChartBackgroundClick}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={0}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={handleSliceClick}
                        onMouseEnter={(data) => {
                          const catId = data.isSpent ? data.category?.id : data.id;
                          if (catId !== -1) setHoveredSliceId(catId);
                        }}
                        onMouseLeave={() => setHoveredSliceId(null)}
                        activeIndex={pieData.findIndex(d =>
                          d.isSpent ? d.category?.id === selectedSliceId : d.id === selectedSliceId
                        )}
                        activeShape={renderActiveShape}
                        style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry, index) => {
                          const entryCategoryId = entry.isSpent ? entry.category?.id : entry.id;
                          const isSelected = selectedSliceId === entryCategoryId;
                          const isHovered = hoveredSliceId === entryCategoryId;

                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              opacity={
                                selectedSliceId
                                  ? (isSelected ? (entry.isSpent ? 0.7 : 1) : 0.3)
                                  : hoveredSliceId
                                    ? (isHovered ? (entry.isSpent ? 0.7 : 1) : 0.3)
                                    : (entry.isSpent ? 0.7 : 0.9)
                              }
                              style={{
                                transition: 'opacity 0.3s ease',
                                cursor: 'pointer',
                              }}
                            />
                          );
                        })}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                      <Legend
                        payload={pieData.filter(d => !d.isSpent && d.id !== -1).map(entry => ({
                          value: entry.name,
                          type: 'square',
                          color: entry.originalColor,
                        }))}
                        wrapperStyle={{ color: theme.palette.text.primary }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {selectedSliceId && <SelectedCategoryPanel />}
                </Box>
              ) : (
                <Box sx={{
                  height: 280,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  p: 3,
                  bgcolor: alpha('#10B981', 0.03),
                  borderRadius: 3,
                  border: `2px dashed ${alpha('#10B981', 0.2)}`,
                }}>
                  <SavingsIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                  <Typography color="text.secondary" textAlign="center" sx={{ fontWeight: 500 }}>
                    Aucune catégorie d'épargne configurée
                  </Typography>
                  <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 250 }}>
                    Configurez vos catégories d'épargne pour visualiser la répartition
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, height: '100%', bgcolor: theme.palette.background.paper }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.palette.text.primary }}>
                Résumé
              </Typography>

              {summary ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: alpha('#10B981', 0.1), borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Total alloué (cumul)
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#10B981' }}>
                      {formatAmount(summary.total_allocated)}
                    </Typography>
                  </Box>

                  <Box sx={{ p: 2, bgcolor: alpha('#EF4444', 0.1), borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Total dépensé
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#EF4444' }}>
                      {formatAmount(summary.total_spent)}
                    </Typography>
                  </Box>

                  <Box sx={{
                    p: 2,
                    bgcolor: summary.total_remaining >= 0 ? alpha('#10B981', 0.1) : alpha('#EF4444', 0.1),
                    borderRadius: 2,
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      Solde disponible
                    </Typography>
                    <Typography variant="h5" sx={{
                      fontWeight: 700,
                      color: summary.total_remaining >= 0 ? '#10B981' : '#EF4444',
                    }}>
                      {formatAmount(summary.total_remaining)}
                    </Typography>
                  </Box>

                  {summary.total_allocated > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Utilisation
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {((summary.total_spent / summary.total_allocated) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((summary.total_spent / summary.total_allocated) * 100, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: alpha('#10B981', 0.2),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: summary.total_spent > summary.total_allocated ? '#EF4444' : '#10B981',
                            borderRadius: 4,
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography color="text.secondary">Aucune donnée disponible</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog des transactions */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedCategory && (
              <>
                <Box sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: selectedCategory.color,
                }} />
                <Typography variant="h6">{selectedCategory.name}</Typography>
                <Chip
                  label={`${selectedCategory.percentage}%`}
                  size="small"
                  sx={{
                    bgcolor: alpha(selectedCategory.color, 0.2),
                    color: selectedCategory.color,
                    fontWeight: 600,
                  }}
                />
              </>
            )}
          </Box>
          <IconButton onClick={() => setDetailDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {transactionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#10B981' }} />
            </Box>
          ) : transactions.length > 0 ? (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {transactions.map((tx) => (
                <Box
                  key={tx.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {tx.description || 'Sans description'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: tx.type === 'expense' ? '#EF4444' : '#10B981',
                    }}
                  >
                    {tx.type === 'expense' ? '-' : '+'}{formatAmount(tx.amount)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              px: 3,
              gap: 2,
            }}>
              <SavingsIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
              <Typography color="text.secondary" textAlign="center">
                Aucune transaction ce mois-ci
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 300 }}>
                Pour assigner des transactions à cette épargne, allez dans Banque et cliquez sur l'icône tirelire
              </Typography>
              <Box
                component="button"
                onClick={() => {
                  setDetailDialogOpen(false);
                  router.push('/dashboard/banque');
                }}
                sx={{
                  mt: 1,
                  px: 3,
                  py: 1,
                  bgcolor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#059669' },
                }}
              >
                Importer des transactions
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
