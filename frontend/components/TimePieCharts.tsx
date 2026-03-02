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
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  LinearProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  AccessTime as TimeIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Weekend as WeekendIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
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
import { timeEntriesAPI, TimeSummary, TimeSummaryByCategory, TimeEntry } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { format as formatDate } from 'date-fns';
import { useCompanyStore } from '@/store/companyStore';

interface TimePieChartsProps {
  currentDate?: Date;
  renderMode?: 'full' | 'pie-only';
}

// Map icon names to components
const iconMap: Record<string, React.ReactNode> = {
  Work: <WorkIcon />,
  School: <SchoolIcon />,
  Weekend: <WeekendIcon />,
};

export default function TimePieCharts({
  currentDate: externalDate,
  renderMode = 'full',
}: TimePieChartsProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { currentCompany } = useCompanyStore();

  // Date management
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = externalDate || internalDate;
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  // Data
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Interaction state
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TimeSummaryByCategory | null>(null);

  // Dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Edit entry state
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editDate, setEditDate] = useState('');

  // État pour le positionnement dynamique du logo
  const [logoTop, setLogoTop] = useState(100);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  // Fetch entries when dialog opens
  useEffect(() => {
    if (detailDialogOpen && selectedCategory) {
      const fetchEntries = async () => {
        setEntriesLoading(true);
        try {
          const res = await timeEntriesAPI.getAll({
            month,
            year,
            category_id: selectedCategory.category_id,
            limit: 50,
          });
          setEntries(res.data || []);
        } catch (error) {
          console.error('Error fetching time entries:', error);
          setEntries([]);
        } finally {
          setEntriesLoading(false);
        }
      };
      fetchEntries();
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
      const res = await timeEntriesAPI.getSummary(month, year);
      setSummary(res.data);
    } catch (error) {
      console.error('Error fetching time data:', error);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Écouter l'événement de rafraîchissement
  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener('refresh-time-data', handleRefresh);
    return () => window.removeEventListener('refresh-time-data', handleRefresh);
  }, [fetchData]);

  // Handlers pour l'édition et suppression des entrées
  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditDescription(entry.description || '');
    const hours = Math.floor(entry.duration_minutes / 60);
    const mins = entry.duration_minutes % 60;
    setEditDuration(hours > 0 ? `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}` : `${mins}min`);
    setEditDate(entry.date);
    setEditEntryDialogOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;
    try {
      // Parser la durée (format: "2h30" ou "2h" ou "30min")
      let durationMinutes = 0;
      const durationStr = editDuration.toLowerCase().trim();
      const hoursMatch = durationStr.match(/(\d+)h/);
      const minsMatch = durationStr.match(/(\d+)(?:min|m(?!in))/);
      if (hoursMatch) durationMinutes += parseInt(hoursMatch[1]) * 60;
      if (minsMatch) durationMinutes += parseInt(minsMatch[1]);
      // Si juste un nombre, considérer comme minutes
      if (!hoursMatch && !minsMatch && /^\d+$/.test(durationStr)) {
        durationMinutes = parseInt(durationStr);
      }

      await timeEntriesAPI.update(editingEntry.id, {
        description: editDescription,
        duration_minutes: durationMinutes,
        date: editDate,
      });

      // Rafraîchir les données
      setEditEntryDialogOpen(false);
      setEditingEntry(null);
      fetchData();
      // Recharger les entrées du dialog
      if (selectedCategory) {
        const res = await timeEntriesAPI.getAll({
          month,
          year,
          category_id: selectedCategory.category_id,
          limit: 50,
        });
        setEntries(res.data || []);
      }
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm('Supprimer cette entrée de temps ?')) return;
    try {
      await timeEntriesAPI.delete(entryId);
      // Rafraîchir les données
      fetchData();
      setEntries(prev => prev.filter(e => e.id !== entryId));
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  // Écouter l'événement de désélection (quand on clique sur un autre camembert)
  useEffect(() => {
    const handleDeselect = () => {
      setSelectedCategoryId(null);
      setSelectedCategory(null);
    };
    window.addEventListener('deselect-time-slice', handleDeselect);
    return () => window.removeEventListener('deselect-time-slice', handleDeselect);
  }, []);

  // Color adaptation for dark mode
  const adaptColorForTheme = (hex: string): string => {
    if (!hex) return '#8B5CF6';
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

  // Prepare pie chart data - basé sur le BUDGET (temps restant à consommer)
  const totalTargetMinutes = summary?.total_target_minutes || 0;
  const totalConsumedMinutes = summary?.total_minutes || 0;
  const totalRemainingMinutes = summary?.total_remaining_minutes || 0;

  // Créer deux parts par catégorie :
  // 1. Part colorée = temps restant à consommer
  // 2. Part claire = temps déjà consommé (avec le nom de la catégorie)
  const pieData: any[] = [];

  summary?.by_category
    .filter(cat => cat.target_minutes > 0) // Seulement les catégories avec un budget
    .forEach(cat => {
      // Part temps RESTANT (colorée)
      const remainingForPie = Math.max(0, cat.remaining_minutes);
      if (remainingForPie > 0) {
        pieData.push({
          id: cat.category_id,
          name: cat.category_name,
          value: remainingForPie,
          color: adaptColorForTheme(cat.color),
          originalColor: cat.color,
          category: cat,
          totalMinutes: cat.total_minutes,
          targetMinutes: cat.target_minutes,
          remainingMinutes: cat.remaining_minutes,
          budgetPercentage: cat.percentage,
          icon: cat.icon,
          isConsumed: false,
        });
      }

      // Part temps CONSOMMÉ (même catégorie, couleur plus claire)
      if (cat.total_minutes > 0) {
        pieData.push({
          id: `${cat.category_id}-consumed`,
          name: `${cat.category_name} - Consommé`,
          value: cat.total_minutes,
          // Couleur plus claire/désaturée pour la partie consommée
          color: theme.palette.mode === 'dark'
            ? alpha(adaptColorForTheme(cat.color), 0.3)
            : alpha(cat.color, 0.25),
          originalColor: cat.color,
          category: cat,
          totalMinutes: cat.total_minutes,
          targetMinutes: cat.target_minutes,
          remainingMinutes: cat.remaining_minutes,
          budgetPercentage: cat.percentage,
          icon: cat.icon,
          isConsumed: true,
          categoryName: cat.category_name, // Pour le tooltip
        });
      }
    });

  // Handle slice click
  const handleSliceClick = useCallback((data: any) => {
    // Pour les parts consommées, on peut aussi ouvrir les détails de la catégorie
    const categoryId = data.isConsumed
      ? data.category?.category_id
      : data.id;

    if (!categoryId) return;

    // Désélectionner les autres camemberts
    window.dispatchEvent(new CustomEvent('deselect-budget-slice'));
    window.dispatchEvent(new CustomEvent('deselect-savings-slice'));

    if (selectedCategoryId === categoryId) {
      // Second click - open detail
      setSelectedCategory(data.category);
      setDetailDialogOpen(true);
    } else {
      // First click - select
      setSelectedCategoryId(categoryId);
      setSelectedCategory(data.category);
    }
  }, [selectedCategoryId]);

  // Deselect
  const handleDeselectSlice = useCallback(() => {
    setSelectedCategoryId(null);
    setSelectedCategory(null);
  }, []);

  // Click outside handler
  const handleChartBackgroundClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isSliceClick = target.closest('.recharts-pie-sector') ||
                         (target.closest('.recharts-layer') && target.tagName.toLowerCase() === 'path');
    if (!isSliceClick && selectedCategoryId) {
      handleDeselectSlice();
    }
  }, [selectedCategoryId, handleDeselectSlice]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;

    // Tooltip pour la part "Consommé" d'une catégorie
    if (data.isConsumed) {
      const consumedPercent = data.targetMinutes > 0
        ? ((data.totalMinutes / data.targetMinutes) * 100).toFixed(0)
        : '0';
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
            {data.categoryName} - Consommé
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: '#8B5CF6' }}>
            {formatDuration(data.totalMinutes)} / {formatDuration(data.targetMinutes)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {consumedPercent}% du budget {data.categoryName} utilisé
          </Typography>
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
          {data.name} - Restant
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Budget: {data.budgetPercentage?.toFixed(0)}%
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#8B5CF6' }}>
          Objectif: {formatDuration(data.targetMinutes)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#8B5CF6' }}>
          Consommé: {formatDuration(data.totalMinutes)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: data.remainingMinutes >= 0 ? '#10B981' : '#EF4444' }}>
          Restant: {formatDuration(data.remainingMinutes)}
        </Typography>
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

  // Selected category panel
  const SelectedCategoryPanel = () => {
    if (!selectedCategory) return null;
    const cat = selectedCategory;
    const consumedPercent = cat.target_minutes > 0
      ? ((cat.total_minutes / cat.target_minutes) * 100).toFixed(1)
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
                {cat.category_name}
              </Typography>
              <Chip
                label={`${cat.percentage.toFixed(1)}%`}
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
                  Objectif
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#8B5CF6', fontSize: '0.8rem' }}>
                  {formatDuration(cat.target_minutes)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: alpha('#8B5CF6', 0.1), borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Consommé
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#8B5CF6', fontSize: '0.8rem' }}>
                  {formatDuration(cat.total_minutes)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: cat.remaining_minutes >= 0 ? alpha('#10B981', 0.1) : alpha('#EF4444', 0.1),
                borderRadius: 1,
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Restant
                </Typography>
                <Typography variant="body2" sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: cat.remaining_minutes >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {formatDuration(cat.remaining_minutes)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {cat.target_minutes > 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(parseFloat(consumedPercent), 100)}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(cat.color, 0.2),
                  '& .MuiLinearProgress-bar': {
                    bgcolor: parseFloat(consumedPercent) > 100 ? '#EF4444' : cat.color,
                    borderRadius: 3,
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
                {consumedPercent}% consommé
              </Typography>
            </Box>
          )}
        </Box>
      </Fade>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress sx={{ color: '#8B5CF6' }} />
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
                Budget temps
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {totalTargetMinutes > 0
                    ? `${formatDuration(totalConsumedMinutes)} / ${formatDuration(totalTargetMinutes)}`
                    : 'Temps consommé'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                  {totalTargetMinutes > 0
                    ? `${((totalConsumedMinutes / totalTargetMinutes) * 100).toFixed(0)}%`
                    : formatDuration(summary?.total_minutes || 0)}
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
                        const catId = data.isConsumed ? data.category?.category_id : data.id;
                        setHoveredCategoryId(catId);
                      }}
                      onMouseLeave={() => setHoveredCategoryId(null)}
                      activeIndex={pieData.findIndex(d =>
                        d.isConsumed ? d.category?.category_id === selectedCategoryId : d.id === selectedCategoryId
                      )}
                      activeShape={renderActiveShape}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData.map((entry, index) => {
                        // Pour les parts consommées, extraire l'ID de catégorie
                        const entryCategoryId = entry.isConsumed
                          ? entry.category?.category_id
                          : entry.id;
                        const isSelected = selectedCategoryId === entryCategoryId;
                        const isHovered = hoveredCategoryId === entryCategoryId;

                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            opacity={
                              selectedCategoryId
                                ? (isSelected ? (entry.isConsumed ? 0.7 : 1) : 0.3)
                                : hoveredCategoryId
                                  ? (isHovered ? (entry.isConsumed ? 0.7 : 1) : 0.3)
                                  : (entry.isConsumed ? 0.7 : 0.9)
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
                      payload={pieData.filter(entry => !entry.isConsumed).map(entry => ({
                        value: entry.name,
                        type: 'square',
                        color: entry.color,
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

                {selectedCategoryId && <SelectedCategoryPanel />}
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
                bgcolor: alpha('#8B5CF6', 0.05),
                borderRadius: 2,
                border: `2px dashed ${alpha('#8B5CF6', 0.2)}`,
              }}>
                <TimeIcon sx={{ fontSize: 32, color: theme.palette.text.disabled }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Aucun temps enregistré
                </Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ fontSize: '0.7rem' }}>
                  Ajoutez des entrées de temps
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Dialog des entrées de temps (pie-only mode) */}
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
                  <Typography variant="h6">{selectedCategory.category_name}</Typography>
                  <Chip
                    label={formatDuration(selectedCategory.total_minutes)}
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
            {entriesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: '#8B5CF6' }} />
              </Box>
            ) : entries.length > 0 ? (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {entries.map((entry) => (
                  <Box
                    key={entry.id}
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
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {entry.description || 'Sans description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(new Date(entry.date), 'dd/MM/yyyy')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: '#8B5CF6',
                        }}
                      >
                        {formatDuration(entry.duration_minutes)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleEditEntry(entry)}
                        sx={{ color: 'text.secondary' }}
                      >
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteEntry(entry.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
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
                <TimeIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                <Typography color="text.secondary" textAlign="center">
                  Aucune entrée de temps pour cette catégorie ce mois-ci
                </Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 300 }}>
                  Ajoutez des entrées de temps depuis la page Temps
                </Typography>
                <Box
                  component="button"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    router.push('/dashboard/budget/temps');
                  }}
                  sx={{
                    mt: 1,
                    px: 3,
                    py: 1,
                    bgcolor: '#8B5CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#7C3AED' },
                  }}
                >
                  Gérer le temps
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
                  Budget temps
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      {totalTargetMinutes > 0
                        ? `Consommé: ${formatDuration(totalConsumedMinutes)} / ${formatDuration(totalTargetMinutes)}`
                        : 'Temps consommé'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                      {totalTargetMinutes > 0
                        ? `${((totalConsumedMinutes / totalTargetMinutes) * 100).toFixed(0)}%`
                        : formatDuration(summary?.total_minutes || 0)}
                    </Typography>
                  </Box>
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
                          const catId = data.isConsumed ? data.category?.category_id : data.id;
                          setHoveredCategoryId(catId);
                        }}
                        onMouseLeave={() => setHoveredCategoryId(null)}
                        activeIndex={pieData.findIndex(d =>
                          d.isConsumed ? d.category?.category_id === selectedCategoryId : d.id === selectedCategoryId
                        )}
                        activeShape={renderActiveShape}
                        style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry, index) => {
                          const entryCategoryId = entry.isConsumed
                            ? entry.category?.category_id
                            : entry.id;
                          const isSelected = selectedCategoryId === entryCategoryId;
                          const isHovered = hoveredCategoryId === entryCategoryId;

                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              opacity={
                                selectedCategoryId
                                  ? (isSelected ? (entry.isConsumed ? 0.7 : 1) : 0.3)
                                  : hoveredCategoryId
                                    ? (isHovered ? (entry.isConsumed ? 0.7 : 1) : 0.3)
                                    : (entry.isConsumed ? 0.7 : 0.9)
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
                        payload={pieData.filter(entry => !entry.isConsumed).map(entry => ({
                          value: entry.name,
                          type: 'square',
                          color: entry.color,
                        }))}
                        wrapperStyle={{ color: theme.palette.text.primary }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {selectedCategoryId && <SelectedCategoryPanel />}
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
                  bgcolor: alpha('#8B5CF6', 0.03),
                  borderRadius: 3,
                  border: `2px dashed ${alpha('#8B5CF6', 0.2)}`,
                }}>
                  <TimeIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                  <Typography color="text.secondary" textAlign="center" sx={{ fontWeight: 500 }}>
                    Aucun temps enregistré ce mois-ci
                  </Typography>
                  <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 250 }}>
                    Ajoutez des entrées de temps pour visualiser la répartition
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
                  <Box sx={{ p: 2, bgcolor: alpha('#8B5CF6', 0.1), borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Objectif du mois
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                      {formatDuration(summary.total_target_minutes)}
                    </Typography>
                  </Box>

                  <Box sx={{ p: 2, bgcolor: alpha('#8B5CF6', 0.1), borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Temps consommé
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                      {formatDuration(summary.total_minutes)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({summary.total_hours}h)
                    </Typography>
                  </Box>

                  <Box sx={{
                    p: 2,
                    bgcolor: summary.total_remaining_minutes >= 0 ? alpha('#10B981', 0.1) : alpha('#EF4444', 0.1),
                    borderRadius: 2,
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      Temps restant
                    </Typography>
                    <Typography variant="h5" sx={{
                      fontWeight: 700,
                      color: summary.total_remaining_minutes >= 0 ? '#10B981' : '#EF4444',
                    }}>
                      {formatDuration(summary.total_remaining_minutes)}
                    </Typography>
                  </Box>

                  {summary.total_target_minutes > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Utilisation
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {((summary.total_minutes / summary.total_target_minutes) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((summary.total_minutes / summary.total_target_minutes) * 100, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: alpha('#8B5CF6', 0.2),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: summary.total_minutes > summary.total_target_minutes ? '#EF4444' : '#8B5CF6',
                            borderRadius: 4,
                          },
                        }}
                      />
                    </Box>
                  )}

                  {/* Categories breakdown */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Par catégorie
                    </Typography>
                    {summary.by_category.filter(cat => cat.target_minutes > 0 || cat.total_minutes > 0).map((cat) => (
                      <Box key={cat.category_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat.color }} />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {cat.category_name}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: cat.color }}>
                          {formatDuration(cat.total_minutes)} / {formatDuration(cat.target_minutes)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary">Aucune donnée disponible</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog des entrées de temps */}
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
                <Typography variant="h6">{selectedCategory.category_name}</Typography>
                <Chip
                  label={formatDuration(selectedCategory.total_minutes)}
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
          {entriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#8B5CF6' }} />
            </Box>
          ) : entries.length > 0 ? (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {entries.map((entry) => (
                <Box
                  key={entry.id}
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
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {entry.description || 'Sans description'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(new Date(entry.date), 'dd/MM/yyyy')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: '#8B5CF6',
                      }}
                    >
                      {formatDuration(entry.duration_minutes)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleEditEntry(entry)}
                      sx={{ color: 'text.secondary' }}
                    >
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteEntry(entry.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
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
              <TimeIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
              <Typography color="text.secondary" textAlign="center">
                Aucune entrée de temps pour cette catégorie ce mois-ci
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 300 }}>
                Ajoutez des entrées de temps depuis la page Temps
              </Typography>
              <Box
                component="button"
                onClick={() => {
                  setDetailDialogOpen(false);
                  router.push('/dashboard/budget/temps');
                }}
                sx={{
                  mt: 1,
                  px: 3,
                  py: 1,
                  bgcolor: '#8B5CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#7C3AED' },
                }}
              >
                Gérer le temps
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition d'une entrée */}
      <Dialog
        open={editEntryDialogOpen}
        onClose={() => setEditEntryDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>Modifier l'entrée</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Durée (ex: 2h30, 45min)"
              value={editDuration}
              onChange={(e) => setEditDuration(e.target.value)}
              fullWidth
              size="small"
              placeholder="2h30"
            />
            <TextField
              label="Date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEntryDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveEntry} variant="contained" sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
