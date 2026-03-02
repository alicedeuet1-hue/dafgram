'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Collapse,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  EmojiEvents as TrophyIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  AddAPhoto as AddPhotoIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';

interface SalesData {
  paidInvoices: number;
  pendingPayments: number;
  pendingQuotes: number;
}

interface Milestone {
  id: number;
  target: number;
  label: string;
  bonus: number;
}

interface Seller {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  salesData: SalesData;
  milestones: Milestone[];
}

// Objectifs par défaut pour un nouveau vendeur
const defaultMilestones: Milestone[] = [
  { id: 1, target: 20000, label: '20K', bonus: 200 },
  { id: 2, target: 40000, label: '40K', bonus: 500 },
  { id: 3, target: 60000, label: '60K', bonus: 1000 },
  { id: 4, target: 80000, label: '80K', bonus: 1500 },
  { id: 5, target: 100000, label: '100K', bonus: 2500 },
];

interface SalesTrackerProps {
  adminMode?: boolean;
}

export default function SalesTracker({ adminMode = true }: SalesTrackerProps) {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';

  // Liste des vendeurs (persistée dans localStorage)
  const [sellers, setSellers] = useState<Seller[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('salesTracker_sellers');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Si erreur de parsing, utiliser les données par défaut
        }
      }
    }
    // Données par défaut
    return [
      {
        id: 1,
        firstName: 'Jean',
        lastName: 'Dupont',
        photoUrl: undefined,
        email: undefined,
        phone: undefined,
        salesData: {
          paidInvoices: 45000,
          pendingPayments: 12000,
          pendingQuotes: 8000,
        },
        milestones: [...defaultMilestones],
      },
    ];
  });

  // Sauvegarder les vendeurs dans localStorage à chaque modification
  useEffect(() => {
    localStorage.setItem('salesTracker_sellers', JSON.stringify(sellers));
  }, [sellers]);

  const [expandedSellerId, setExpandedSellerId] = useState<number | null>(() => {
    // Initialiser avec le premier vendeur s'il existe
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('salesTracker_sellers');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed[0]?.id || null;
        } catch {
          // Ignorer
        }
      }
    }
    return 1;
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [objectivesDialogOpen, setObjectivesDialogOpen] = useState(false);
  const [editSeller, setEditSeller] = useState<Seller | null>(null);
  const [editMilestones, setEditMilestones] = useState<Milestone[]>([]);
  const [currentEditSellerId, setCurrentEditSellerId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatAmount = (amount: number) => formatCurrency(amount, currency);

  // Gérer l'upload de photo
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && editSeller) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditSeller({ ...editSeller, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    if (editSeller) {
      setEditSeller({ ...editSeller, photoUrl: undefined });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sauvegarder le profil vendeur
  const handleSaveProfile = () => {
    if (editSeller) {
      setSellers(prev => prev.map(s => s.id === editSeller.id ? editSeller : s));
      setEditDialogOpen(false);
      setEditSeller(null);
    }
  };

  // Sauvegarder les objectifs
  const handleSaveObjectives = () => {
    if (currentEditSellerId) {
      setSellers(prev => prev.map(s =>
        s.id === currentEditSellerId
          ? { ...s, milestones: editMilestones.sort((a, b) => a.target - b.target) }
          : s
      ));
    }
    setObjectivesDialogOpen(false);
    setCurrentEditSellerId(null);
  };

  // Ajouter un nouveau vendeur
  const handleAddSeller = () => {
    const newId = sellers.length > 0 ? Math.max(...sellers.map(s => s.id)) + 1 : 1;
    const newSeller: Seller = {
      id: newId,
      firstName: 'Nouveau',
      lastName: 'Vendeur',
      salesData: { paidInvoices: 0, pendingPayments: 0, pendingQuotes: 0 },
      milestones: [...defaultMilestones],
    };
    setSellers(prev => [...prev, newSeller]);
    setExpandedSellerId(newId);
    setEditSeller(newSeller);
    setEditDialogOpen(true);
  };

  // Supprimer un vendeur
  const handleDeleteSeller = (sellerId: number) => {
    if (sellers.length <= 1) return;
    setSellers(prev => prev.filter(s => s.id !== sellerId));
    if (expandedSellerId === sellerId) {
      setExpandedSellerId(sellers.find(s => s.id !== sellerId)?.id || null);
    }
  };

  // Ajouter un objectif
  const handleAddMilestone = () => {
    const newId = editMilestones.length > 0 ? Math.max(...editMilestones.map(m => m.id)) + 1 : 1;
    const lastTarget = editMilestones.length > 0 ? Math.max(...editMilestones.map(m => m.target)) : 0;
    setEditMilestones(prev => [...prev, {
      id: newId,
      target: lastTarget + 20000,
      label: `${Math.round((lastTarget + 20000) / 1000)}K`,
      bonus: 500,
    }]);
  };

  // Supprimer un objectif
  const handleDeleteMilestone = (milestoneId: number) => {
    setEditMilestones(prev => prev.filter(m => m.id !== milestoneId));
  };

  // Calculer le total des primes de tous les vendeurs
  const totalEarnedBonuses = sellers.reduce((total, seller) => {
    return total + seller.milestones
      .filter(m => seller.salesData.paidInvoices >= m.target)
      .reduce((sum, m) => sum + m.bonus, 0);
  }, 0);

  // Composant pour un vendeur individuel
  const SellerCard = ({ seller }: { seller: Seller }) => {
    const salesData = seller.salesData;
    const milestones = seller.milestones;
    const totalSales = salesData.paidInvoices + salesData.pendingPayments + salesData.pendingQuotes;
    const efficiency = totalSales > 0 ? (salesData.paidInvoices / totalSales) * 100 : 0;
    const maxTarget = milestones.length > 0 ? Math.max(...milestones.map(m => m.target)) : 100000;
    const progressPercentage = Math.min((salesData.paidInvoices / maxTarget) * 100, 100);

    const isMilestoneReached = (milestone: Milestone) => salesData.paidInvoices >= milestone.target;
    const earnedBonuses = milestones
      .filter(m => isMilestoneReached(m))
      .reduce((sum, m) => sum + m.bonus, 0);

    const chartData = [
      { name: 'Factures payées', value: salesData.paidInvoices, color: '#10B981' },
      { name: 'En attente de paiement', value: salesData.pendingPayments, color: '#F59E0B' },
      { name: 'Devis en attente', value: salesData.pendingQuotes, color: '#6B7280' },
    ].filter(d => d.value > 0);

    const isExpanded = expandedSellerId === seller.id;

    const CustomTooltip = ({ active, payload }: any) => {
      if (!active || !payload?.[0]) return null;
      const data = payload[0].payload;
      return (
        <Box sx={{
          bgcolor: theme.palette.background.paper,
          p: 1.5,
          borderRadius: 1,
          boxShadow: theme.shadows[4],
          border: `1px solid ${theme.palette.divider}`,
        }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: data.color }}>
            {data.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatAmount(data.value)}
          </Typography>
        </Box>
      );
    };

    return (
      <Box
        sx={{
          borderRadius: 2,
          border: `1px solid ${isExpanded ? theme.palette.primary.main : theme.palette.divider}`,
          bgcolor: isExpanded ? alpha(theme.palette.primary.main, 0.02) : 'transparent',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Header du vendeur - toujours visible */}
        <Box
          onClick={() => setExpandedSellerId(isExpanded ? null : seller.id)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 1.5,
            cursor: 'pointer',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
          }}
        >
          <Avatar
            src={seller.photoUrl}
            sx={{
              width: 40,
              height: 40,
              bgcolor: theme.palette.primary.main,
              fontSize: '0.9rem',
            }}
          >
            {seller.firstName[0]}{seller.lastName[0]}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {seller.firstName} {seller.lastName}
              </Typography>
              {seller.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {seller.email}
                  </Typography>
                </Box>
              )}
              {seller.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {seller.phone}
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatAmount(salesData.paidInvoices)} facturé
            </Typography>
          </Box>

          {/* Barre de progression mini */}
          <Box sx={{ width: 100, display: { xs: 'none', sm: 'block' } }}>
            <Box sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.text.disabled, 0.1),
              overflow: 'hidden',
            }}>
              <Box sx={{
                height: '100%',
                width: `${progressPercentage}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, #10B981 0%, #3B82F6 100%)`,
              }} />
            </Box>
          </Box>

          {/* Primes gagnées */}
          <Chip
            icon={<TrophyIcon sx={{ fontSize: 14 }} />}
            label={formatAmount(earnedBonuses)}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.7rem',
              bgcolor: alpha('#F59E0B', 0.1),
              color: '#F59E0B',
              '& .MuiChip-icon': { color: '#F59E0B' },
            }}
          />

          {/* Actions (seulement en mode admin) */}
          {adminMode && (
            <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
              <IconButton
                size="small"
                onClick={() => {
                  setEditSeller(seller);
                  setEditDialogOpen(true);
                }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => {
                  setCurrentEditSellerId(seller.id);
                  setEditMilestones([...seller.milestones]);
                  setObjectivesDialogOpen(true);
                }}
              >
                <SettingsIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}

          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>

        {/* Contenu détaillé */}
        <Collapse in={isExpanded}>
          <Box sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {/* Graphique donut + Légende */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
                <Box sx={{ position: 'relative', width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={50}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981', lineHeight: 1 }}>
                      {efficiency.toFixed(0)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem' }}>
                      Efficacité
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {chartData.map((item) => (
                    <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100, fontSize: '0.7rem' }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                        {formatAmount(item.value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Barre de progression avec objectifs */}
              <Box sx={{ flex: 1, minWidth: 250 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Objectifs de vente
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    CA facturé: <strong>{formatAmount(salesData.paidInvoices)}</strong>
                  </Typography>
                </Box>

                <Box sx={{ position: 'relative', pt: 0.5, pb: 3.5 }}>
                  <Box sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha(theme.palette.text.disabled, 0.1),
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <Box sx={{
                      height: '100%',
                      width: `${progressPercentage}%`,
                      borderRadius: 4,
                      background: `linear-gradient(90deg, #10B981 0%, #3B82F6 100%)`,
                      transition: 'width 0.5s ease',
                    }} />
                  </Box>

                  {milestones.map((milestone) => {
                    const position = (milestone.target / maxTarget) * 100;
                    const reached = isMilestoneReached(milestone);
                    return (
                      <Tooltip
                        key={milestone.id}
                        title={
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ display: 'block' }}>
                              Prime: {formatAmount(milestone.bonus)}
                            </Typography>
                            {reached && (
                              <Typography variant="caption" sx={{ color: '#10B981' }}>
                                ✓ Atteint
                              </Typography>
                            )}
                          </Box>
                        }
                        arrow
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            left: `${position}%`,
                            top: -2,
                            transform: 'translateX(-50%)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          {reached ? (
                            <CheckIcon sx={{
                              fontSize: 16,
                              color: '#10B981',
                              bgcolor: theme.palette.background.paper,
                              borderRadius: '50%',
                            }} />
                          ) : (
                            <FlagIcon sx={{
                              fontSize: 16,
                              color: salesData.paidInvoices >= milestone.target * 0.8
                                ? '#F59E0B'
                                : theme.palette.text.disabled,
                            }} />
                          )}
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.55rem',
                              fontWeight: reached ? 600 : 400,
                              color: reached ? '#10B981' : 'text.secondary',
                              mt: 0.25,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {milestone.label}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Card sx={{ mt: 2, borderRadius: 2, bgcolor: theme.palette.background.paper }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Suivi Vendeurs
            </Typography>
            <Chip
              label={`${sellers.length} vendeur${sellers.length > 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrophyIcon sx={{ fontSize: 18, color: '#F59E0B' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#F59E0B' }}>
                {formatAmount(totalEarnedBonuses)} de primes
              </Typography>
            </Box>

            {adminMode && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSeller}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.75,
                  px: 2,
                }}
              >
                Ajouter un vendeur
              </Button>
            )}
          </Box>
        </Box>

        {/* Liste des vendeurs */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {sellers.map((seller) => (
            <SellerCard key={seller.id} seller={seller} />
          ))}
        </Box>

        {/* Dialog modifier le profil */}
        <Dialog
          open={editDialogOpen}
          onClose={() => { setEditDialogOpen(false); setEditSeller(null); }}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Modifier le profil</span>
            {sellers.length > 1 && editSeller && (
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  handleDeleteSeller(editSeller.id);
                  setEditDialogOpen(false);
                  setEditSeller(null);
                }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </DialogTitle>
          <DialogContent>
            {editSeller && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                  label="Prénom"
                  value={editSeller.firstName}
                  onChange={(e) => setEditSeller({ ...editSeller, firstName: e.target.value })}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Nom"
                  value={editSeller.lastName}
                  onChange={(e) => setEditSeller({ ...editSeller, lastName: e.target.value })}
                  fullWidth
                  size="small"
                />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Photo (optionnel)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={editSeller.photoUrl}
                      sx={{ width: 64, height: 64, bgcolor: theme.palette.primary.main, fontSize: '1.2rem' }}
                    >
                      {editSeller.firstName?.[0]}{editSeller.lastName?.[0]}
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddPhotoIcon />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {editSeller.photoUrl ? 'Changer' : 'Ajouter'}
                      </Button>
                      {editSeller.photoUrl && (
                        <Button
                          variant="text"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={handleRemovePhoto}
                        >
                          Supprimer
                        </Button>
                      )}
                    </Box>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </Box>
                </Box>

                <TextField
                  label="Email"
                  type="email"
                  value={editSeller.email || ''}
                  onChange={(e) => setEditSeller({ ...editSeller, email: e.target.value || undefined })}
                  fullWidth
                  size="small"
                  placeholder="jean.dupont@email.com"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Téléphone"
                  type="tel"
                  value={editSeller.phone || ''}
                  onChange={(e) => setEditSeller({ ...editSeller, phone: e.target.value || undefined })}
                  fullWidth
                  size="small"
                  placeholder="06 12 34 56 78"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setEditDialogOpen(false); setEditSeller(null); }}>Annuler</Button>
            <Button onClick={handleSaveProfile} variant="contained">Enregistrer</Button>
          </DialogActions>
        </Dialog>

        {/* Dialog objectifs */}
        <Dialog
          open={objectivesDialogOpen}
          onClose={() => { setObjectivesDialogOpen(false); setCurrentEditSellerId(null); }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle>
            Objectifs de {sellers.find(s => s.id === currentEditSellerId)?.firstName} {sellers.find(s => s.id === currentEditSellerId)?.lastName}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {editMilestones.map((milestone) => (
                <Box
                  key={milestone.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                  }}
                >
                  <FlagIcon sx={{ color: theme.palette.primary.main }} />
                  <TextField
                    label="Objectif (€)"
                    type="number"
                    value={milestone.target}
                    onChange={(e) => {
                      const newTarget = parseInt(e.target.value) || 0;
                      setEditMilestones(prev => prev.map(m =>
                        m.id === milestone.id
                          ? { ...m, target: newTarget, label: `${Math.round(newTarget / 1000)}K` }
                          : m
                      ));
                    }}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Prime (€)"
                    type="number"
                    value={milestone.bonus}
                    onChange={(e) => {
                      setEditMilestones(prev => prev.map(m =>
                        m.id === milestone.id ? { ...m, bonus: parseInt(e.target.value) || 0 } : m
                      ));
                    }}
                    size="small"
                    sx={{ width: 120 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteMilestone(milestone.id)}
                    disabled={editMilestones.length <= 1}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddMilestone}
                sx={{ alignSelf: 'flex-start' }}
              >
                Ajouter un objectif
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setObjectivesDialogOpen(false); setCurrentEditSellerId(null); }}>Annuler</Button>
            <Button onClick={handleSaveObjectives} variant="contained">Enregistrer</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
