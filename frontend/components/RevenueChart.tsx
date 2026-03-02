'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  alpha,
  useTheme,
  Skeleton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Flag as FlagIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ChevronLeft,
  ChevronRight,
  Event as EventIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { transactionsAPI, HistoryDataPoint } from '@/lib/api';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';

// Types pour les événements
interface RevenueEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  color: string;
}

interface Props {
  currentDate: Date;
  adminMode?: boolean;
}

const EVENT_COLORS = [
  '#F5C518', // Jaune
  '#10B981', // Vert
  '#3B82F6', // Bleu
  '#EF4444', // Rouge
  '#8B5CF6', // Violet
  '#F97316', // Orange
];

export default function RevenueChart({ currentDate, adminMode = true }: Props) {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<RevenueEvent[]>([]);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<RevenueEvent>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    color: EVENT_COLORS[0],
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Load events from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('revenue_events');
      if (saved) {
        try {
          setEvents(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading events:', e);
        }
      }
    }
  }, []);

  // Save events to localStorage
  const saveEvents = (newEvents: RevenueEvent[]) => {
    setEvents(newEvents);
    if (typeof window !== 'undefined') {
      localStorage.setItem('revenue_events', JSON.stringify(newEvents));
    }
  };

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const count = period === 'month' ? 12 : 12; // 12 mois ou 12 semaines
      const res = await transactionsAPI.getStatsHistory(period, count, 0);
      // Les données sont retournées du plus récent au plus ancien, on les garde dans cet ordre
      // puis on les affiche de gauche (ancien) à droite (récent)
      setHistoryData([...res.data.data]);
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Format currency
  const formatAmount = (amount: number) => formatCurrency(amount, currency);

  // Add event
  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) return;

    const event: RevenueEvent = {
      id: Date.now().toString(),
      date: newEvent.date,
      title: newEvent.title,
      description: newEvent.description,
      color: newEvent.color || EVENT_COLORS[0],
    };

    saveEvents([...events, event]);
    setEventDialogOpen(false);
    setNewEvent({
      date: format(new Date(), 'yyyy-MM-dd'),
      title: '',
      description: '',
      color: EVENT_COLORS[0],
    });
  };

  // Delete event
  const handleDeleteEvent = (eventId: string) => {
    saveEvents(events.filter(e => e.id !== eventId));
  };

  // Get events for a specific data point
  const getEventsForDataPoint = (dataPoint: HistoryDataPoint): RevenueEvent[] => {
    if (!dataPoint.date && !dataPoint.month) return [];

    return events.filter(event => {
      const eventDate = parseISO(event.date);

      if (period === 'month' && dataPoint.month && dataPoint.year) {
        return eventDate.getMonth() + 1 === dataPoint.month && eventDate.getFullYear() === dataPoint.year;
      }

      if (dataPoint.date) {
        // Pour les semaines, vérifier si l'événement est dans la semaine
        const pointDate = parseISO(dataPoint.date);
        const weekStart = startOfWeek(pointDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(pointDate, { weekStartsOn: 1 });
        return eventDate >= weekStart && eventDate <= weekEnd;
      }

      return false;
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const dataEvents = getEventsForDataPoint(data);

    return (
      <Box sx={{
        bgcolor: theme.palette.background.paper,
        p: 1.5,
        borderRadius: 1,
        boxShadow: theme.shadows[4],
        border: `1px solid ${theme.palette.divider}`,
        maxWidth: 250,
      }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981' }} />
          <Typography variant="caption">
            Revenus: {formatAmount(data.revenue)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444' }} />
          <Typography variant="caption">
            Dépenses: {formatAmount(data.expenses)}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 600, color: data.revenue - data.expenses >= 0 ? '#10B981' : '#EF4444' }}>
          Résultat: {formatAmount(data.revenue - data.expenses)}
        </Typography>

        {dataEvents.length > 0 && (
          <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
            {dataEvents.map(event => (
              <Box key={event.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <FlagIcon sx={{ fontSize: 12, color: event.color }} />
                <Typography variant="caption" sx={{ color: event.color }}>
                  {event.title}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  // Prepare chart data with events
  const chartData = historyData.map(point => ({
    ...point,
    hasEvent: getEventsForDataPoint(point).length > 0,
    events: getEventsForDataPoint(point),
  }));

  // Calculate totals
  const totalRevenue = historyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = historyData.reduce((sum, d) => sum + d.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  // Sorted events for the list (most recent first)
  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Box sx={{ mt: 3 }}>
      <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
            {/* Left: Chart */}
            <Box sx={{ flex: 2, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    Suivi du chiffre d'affaires
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#10B981' }}>
                      Total revenus: {formatAmount(totalRevenue)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#EF4444' }}>
                      Total dépenses: {formatAmount(totalExpenses)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: totalProfit >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                      Résultat: {formatAmount(totalProfit)}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ToggleButtonGroup
                    value={period}
                    exclusive
                    onChange={(_, v) => v && setPeriod(v)}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        borderColor: theme.palette.divider,
                        '&.Mui-selected': {
                          bgcolor: '#F5C518',
                          color: '#1A1A1A',
                          '&:hover': {
                            bgcolor: '#E5B516',
                          },
                        },
                      },
                    }}
                  >
                    <ToggleButton value="week">Semaine</ToggleButton>
                    <ToggleButton value="month">Mois</ToggleButton>
                  </ToggleButtonGroup>

                  {adminMode && (
                    <Tooltip title="Ajouter un événement">
                      <IconButton
                        onClick={() => setEventDialogOpen(true)}
                        size="small"
                        sx={{
                          bgcolor: alpha('#F5C518', 0.1),
                          color: '#F5C518',
                          '&:hover': { bgcolor: alpha('#F5C518', 0.2) },
                        }}
                      >
                        <AddIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {loading ? (
                <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme.palette.divider}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                      axisLine={{ stroke: theme.palette.divider }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />

                    {/* Event reference lines */}
                    {chartData.map((point, index) =>
                      point.events.map((event: RevenueEvent) => (
                        <ReferenceLine
                          key={event.id}
                          x={point.label}
                          stroke={event.color}
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          label={{
                            value: '',
                            position: 'top',
                          }}
                        />
                      ))
                    )}

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      strokeWidth={2}
                      fill="url(#colorRevenue)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#10B981' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#EF4444"
                      strokeWidth={2}
                      fill="url(#colorExpenses)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#EF4444' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* Legend */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 3, bgcolor: '#10B981', borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary">Revenus</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 3, bgcolor: '#EF4444', borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary">Dépenses</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FlagIcon sx={{ fontSize: 14, color: '#F5C518' }} />
                  <Typography variant="caption" color="text.secondary">Événement</Typography>
                </Box>
              </Box>
            </Box>

            {/* Right: Events list */}
            <Box sx={{ flex: 1, minWidth: 250 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                  Événements
                </Typography>
                <Chip
                  label={events.length}
                  size="small"
                  sx={{
                    bgcolor: alpha('#F5C518', 0.1),
                    color: '#F5C518',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 20,
                  }}
                />
              </Box>

              <Box
                sx={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  pr: 1,
                  '&::-webkit-scrollbar': {
                    width: 4,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: theme.palette.divider,
                    borderRadius: 2,
                  },
                }}
              >
                {sortedEvents.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 4,
                      px: 2,
                      bgcolor: alpha(theme.palette.text.disabled, 0.05),
                      borderRadius: 1.5,
                      border: `1px dashed ${alpha(theme.palette.text.disabled, 0.2)}`,
                    }}
                  >
                    <EventIcon sx={{ fontSize: 32, color: theme.palette.text.disabled, mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Aucun événement
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Ajoutez des événements pour marquer des moments importants
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {sortedEvents.map((event) => (
                      <Box
                        key={event.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: alpha(event.color, 0.08),
                          borderLeft: `3px solid ${event.color}`,
                          position: 'relative',
                          '&:hover .delete-btn': {
                            opacity: 1,
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <FlagIcon sx={{ fontSize: 16, color: event.color, mt: 0.25 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: theme.palette.text.primary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {event.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(parseISO(event.date), 'dd MMMM yyyy', { locale: fr })}
                            </Typography>
                            {event.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                {event.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        {adminMode && (
                          <IconButton
                            className="delete-btn"
                            size="small"
                            onClick={() => handleDeleteEvent(event.id)}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              color: theme.palette.text.secondary,
                              '&:hover': {
                                color: '#EF4444',
                                bgcolor: alpha('#EF4444', 0.1),
                              },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Add Event Dialog */}
      <Dialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon sx={{ color: newEvent.color }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Nouvel événement
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Date"
            type="date"
            value={newEvent.date}
            onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
            fullWidth
            size="small"
            sx={{ mt: 1, mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Titre"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            placeholder="Ex: Lancement produit, Nouveau client..."
          />
          <TextField
            label="Description (optionnel)"
            value={newEvent.description}
            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            fullWidth
            size="small"
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Couleur
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {EVENT_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setNewEvent({ ...newEvent, color })}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: color,
                  cursor: 'pointer',
                  border: newEvent.color === color ? '3px solid' : '2px solid transparent',
                  borderColor: newEvent.color === color ? theme.palette.text.primary : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scale(1.1)',
                  },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setEventDialogOpen(false)}
            sx={{ color: theme.palette.text.secondary }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAddEvent}
            variant="contained"
            disabled={!newEvent.title || !newEvent.date}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E5B516' },
              '&.Mui-disabled': {
                bgcolor: alpha('#F5C518', 0.3),
                color: alpha('#1A1A1A', 0.5),
              },
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
