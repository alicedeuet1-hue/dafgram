'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import {
  GridView as DashboardIcon,
  PieChart as BudgetIcon,
  ArrowUpward,
  ArrowDownward,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Business as BusinessIcon,
  KeyboardArrowDown,
  Add as AddIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Star as StarIcon,
  CameraAlt as CameraIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  TrendingUp as SalesIcon,
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore } from '@/store/companyStore';
import { authAPI, companiesAPI } from '@/lib/api';
import {
  TextField,
  DialogActions,
} from '@mui/material';
import {
  Person as PersonIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import SubscriptionBanner from './SubscriptionBanner';

// Icône personnalisée pour Transactions (flèches haut + bas)
const TransactionsIcon = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
    <ArrowUpward sx={{ fontSize: 16, color: 'inherit' }} />
    <ArrowDownward sx={{ fontSize: 16, color: 'inherit' }} />
  </Box>
);

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, fetchUser, isAuthenticated } = useAuthStore();
  const { currentCompany, userCompanies, fetchCurrentCompany, fetchUserCompanies, switchCompany } = useCompanyStore();
  const { resolvedMode, toggleTheme } = useTheme();
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [createSpaceDialogOpen, setCreateSpaceDialogOpen] = useState(false);
  const [joinCompanyDialogOpen, setJoinCompanyDialogOpen] = useState(false);
  const [inviteCodeDialogOpen, setInviteCodeDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceType, setNewSpaceType] = useState<'personal' | 'business'>('business');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Refs pour l'upload d'images
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUser();
    fetchCurrentCompany();
    fetchUserCompanies();
  }, [fetchUser]);

  // Handler pour l'upload du logo entreprise
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await companiesAPI.uploadLogo(file);
      fetchCurrentCompany(); // Rafraîchir pour voir le nouveau logo
    } catch (error) {
      console.error('Error uploading logo:', error);
    }
  };

  // Handler pour l'upload de l'avatar utilisateur
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await authAPI.uploadAvatar(file);
      fetchUser(); // Rafraîchir pour voir le nouvel avatar
    } catch (error) {
      console.error('Error uploading avatar:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSwitchCompany = async (companyId: number) => {
    try {
      await switchCompany(companyId);
      await fetchUserCompanies();
      // Naviguer vers le dashboard pour rafraîchir le contexte sans déconnexion
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      console.error('Erreur lors du changement d\'entreprise:', error);
    }
  };

  const pricingPlans = [
    {
      name: 'Starter',
      price: '19',
      period: '/mois',
      description: 'Idéal pour les petites entreprises',
      features: [
        '1 entreprise supplémentaire',
        'Jusqu\'à 5 utilisateurs',
        'Support par email',
        'Rapports basiques',
      ],
      highlighted: false,
    },
    {
      name: 'Business',
      price: '49',
      period: '/mois',
      description: 'Pour les entreprises en croissance',
      features: [
        'Jusqu\'à 5 entreprises',
        'Utilisateurs illimités',
        'Support prioritaire',
        'Rapports avancés',
        'Export PDF & Excel',
        'API Access',
      ],
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: '99',
      period: '/mois',
      description: 'Pour les grandes organisations',
      features: [
        'Entreprises illimitées',
        'Utilisateurs illimités',
        'Support dédié 24/7',
        'Fonctionnalités personnalisées',
        'Intégrations avancées',
        'Formation incluse',
      ],
      highlighted: false,
    },
  ];

  // Déterminer le type de compte
  const isPersonalAccount = currentCompany?.account_type === 'personal';

  // Configuration centralisée des items de navigation (source of truth pour les icônes)
  const menuItems = isPersonalAccount
    ? [
        { text: 'Tableau de bord', icon: <DashboardIcon sx={{ fontSize: 20 }} />, path: '/dashboard' },
        { text: 'Transactions', icon: <TransactionsIcon />, path: '/dashboard/banque' },
        {
          text: 'Budget',
          icon: <BudgetIcon sx={{ fontSize: 20 }} />,
          path: '/dashboard/budget',
          hasSubmenu: true,
          submenu: [
            { text: 'Dépenses', path: '/dashboard/budget/charges' },
            { text: 'Épargne', path: '/dashboard/budget/epargne' },
          ]
        },
      ]
    : [
        { text: 'Tableau de bord', icon: <DashboardIcon sx={{ fontSize: 20 }} />, path: '/dashboard' },
        { text: 'Transactions', icon: <TransactionsIcon />, path: '/dashboard/banque' },
        {
          text: 'Budget',
          icon: <BudgetIcon sx={{ fontSize: 20 }} />,
          path: '/dashboard/budget',
          hasSubmenu: true,
          submenu: [
            { text: 'Charges', path: '/dashboard/budget/charges' },
            { text: 'Épargne', path: '/dashboard/budget/epargne' },
            { text: 'Temps', path: '/dashboard/budget/temps' },
          ]
        },
        { text: 'Ventes', icon: <SalesIcon sx={{ fontSize: 20 }} />, path: '/dashboard/ventes' },
      ];

  // Menu items cachés (pour référence future)
  // { text: 'Suivi', icon: <TimelineIcon />, path: '/dashboard/suivi' },
  // { text: 'Comptabilité', icon: <TransactionIcon />, path: '/dashboard/comptabilite' },
  // { text: 'Gestion Vendeurs', icon: <PeopleIcon />, path: '/dashboard/employees' },

  const isActive = (path: string) => pathname === path;
  const isActiveOrChild = (item: typeof menuItems[0]) => {
    if (pathname === item.path) return true;
    if (item.hasSubmenu && item.submenu) {
      return item.submenu.some(sub => pathname === sub.path);
    }
    return false;
  };

  // State pour le menu utilisateur
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const userMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State pour le menu déroulant Budget
  const [budgetMenuAnchor, setBudgetMenuAnchor] = useState<null | HTMLElement>(null);
  const budgetMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBudgetMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (budgetMenuTimeoutRef.current) {
      clearTimeout(budgetMenuTimeoutRef.current);
    }
    setBudgetMenuAnchor(event.currentTarget);
  };

  const handleBudgetMenuClose = () => {
    budgetMenuTimeoutRef.current = setTimeout(() => {
      setBudgetMenuAnchor(null);
    }, 150);
  };

  const handleBudgetMenuEnter = () => {
    if (budgetMenuTimeoutRef.current) {
      clearTimeout(budgetMenuTimeoutRef.current);
    }
  };

  // Handlers pour le menu utilisateur (survol + clic)
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
    }
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    userMenuTimeoutRef.current = setTimeout(() => {
      setUserMenuAnchor(null);
    }, 150);
  };

  const handleUserMenuEnter = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
    }
  };

  const handleUserMenuCloseImmediate = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
    }
    setUserMenuAnchor(null);
  };

  // State pour le menu entreprise dans la topbar
  const [companyMenuAnchor, setCompanyMenuAnchor] = useState<null | HTMLElement>(null);
  const companyMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCompanyMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (companyMenuTimeoutRef.current) {
      clearTimeout(companyMenuTimeoutRef.current);
    }
    setCompanyMenuAnchor(event.currentTarget);
  };

  const handleCompanyMenuClose = () => {
    companyMenuTimeoutRef.current = setTimeout(() => {
      setCompanyMenuAnchor(null);
    }, 150);
  };

  const handleCompanyMenuEnter = () => {
    if (companyMenuTimeoutRef.current) {
      clearTimeout(companyMenuTimeoutRef.current);
    }
  };

  const handleCompanyMenuCloseImmediate = () => {
    if (companyMenuTimeoutRef.current) {
      clearTimeout(companyMenuTimeoutRef.current);
    }
    setCompanyMenuAnchor(null);
  };

  // Hidden file inputs
  const fileInputs = (
    <>
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoUpload}
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarUpload}
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
      />
    </>
  );


  // User menu dropdown
  const userMenu = (
    <Menu
      anchorEl={userMenuAnchor}
      open={Boolean(userMenuAnchor)}
      onClose={handleUserMenuCloseImmediate}
      disablePortal
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      MenuListProps={{
        onMouseEnter: handleUserMenuEnter,
        onMouseLeave: handleUserMenuClose,
      }}
      PaperProps={{
        onMouseEnter: handleUserMenuEnter,
        onMouseLeave: handleUserMenuClose,
        sx: {
          mt: 1,
          borderRadius: 2,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
          minWidth: 220,
        },
      }}
    >
      {/* User info */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
          {user?.full_name || 'Utilisateur'}
        </Typography>
        <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
          {user?.email}
        </Typography>
      </Box>
      <Divider />

      {/* Company selector - liste directe */}
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 500 }}>
          MES ESPACES
        </Typography>
      </Box>
      {userCompanies.map((uc) => (
        <MenuItem
          key={uc.company.id}
          onClick={() => {
            if (currentCompany?.id !== uc.company.id) {
              handleUserMenuCloseImmediate();
              handleSwitchCompany(uc.company.id);
            }
          }}
          selected={currentCompany?.id === uc.company.id}
          sx={{
            py: 1,
            px: 2,
            '&.Mui-selected': {
              bgcolor: '#FEF9E7',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 1,
                bgcolor: uc.company.logo_url ? 'transparent' : '#F5C518',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {uc.company.logo_url ? (
                <img
                  src={`http://localhost:8000${uc.company.logo_url}`}
                  alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : uc.company.account_type === 'personal' ? (
                <PersonIcon sx={{ color: '#1A1A1A', fontSize: 14 }} />
              ) : (
                <BusinessIcon sx={{ color: '#1A1A1A', fontSize: 14 }} />
              )}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: currentCompany?.id === uc.company.id ? 600 : 400 }}>
                {uc.company.account_type === 'personal' ? 'Personnel' : uc.company.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '0.65rem' }}>
                {uc.role === 'owner' ? 'Propriétaire' : uc.role === 'admin' ? 'Admin' : 'Membre'}
              </Typography>
            </Box>
          </Box>
        </MenuItem>
      ))}
      {/* Ajouter une entreprise */}
      <MenuItem
        onClick={() => {
          handleUserMenuCloseImmediate();
          setPricingDialogOpen(true);
        }}
        sx={{
          py: 1,
          px: 2,
          color: '#F5C518',
          '&:hover': {
            bgcolor: '#FEF9E7',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AddIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Ajouter une entreprise
          </Typography>
        </Box>
      </MenuItem>

      <Divider sx={{ my: 1 }} />

      {/* Change avatar */}
      <MenuItem
        onClick={() => {
          handleUserMenuCloseImmediate();
          avatarInputRef.current?.click();
        }}
        sx={{ py: 1.5 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CameraIcon sx={{ color: '#9CA3AF', fontSize: 18 }} />
          <Typography variant="body2">Changer ma photo</Typography>
        </Box>
      </MenuItem>

      {/* Logout */}
      <MenuItem
        onClick={() => {
          handleUserMenuCloseImmediate();
          handleLogout();
        }}
        sx={{ py: 1.5, color: '#EF4444' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LogoutIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2">Déconnexion</Typography>
        </Box>
      </MenuItem>
    </Menu>
  );

  // Company menu dropdown (dans la topbar)
  const companyMenu = (
    <Menu
      anchorEl={companyMenuAnchor}
      open={Boolean(companyMenuAnchor)}
      onClose={handleCompanyMenuCloseImmediate}
      disablePortal
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
      MenuListProps={{
        onMouseEnter: handleCompanyMenuEnter,
        onMouseLeave: handleCompanyMenuClose,
      }}
      PaperProps={{
        onMouseEnter: handleCompanyMenuEnter,
        onMouseLeave: handleCompanyMenuClose,
        sx: {
          mt: 1,
          borderRadius: 2,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
          minWidth: 200,
        },
      }}
    >
      {userCompanies.map((uc) => (
        <MenuItem
          key={uc.company.id}
          onClick={() => {
            if (currentCompany?.id !== uc.company.id) {
              handleCompanyMenuCloseImmediate();
              handleSwitchCompany(uc.company.id);
            }
          }}
          selected={currentCompany?.id === uc.company.id}
          sx={{
            py: 1,
            px: 2,
            '&.Mui-selected': {
              bgcolor: resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.15)' : '#FEF9E7',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 1,
                bgcolor: uc.company.logo_url ? 'transparent' : '#F5C518',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {uc.company.logo_url ? (
                <img
                  src={`http://localhost:8000${uc.company.logo_url}`}
                  alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : uc.company.account_type === 'personal' ? (
                <PersonIcon sx={{ color: '#1A1A1A', fontSize: 14 }} />
              ) : (
                <BusinessIcon sx={{ color: '#1A1A1A', fontSize: 14 }} />
              )}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: currentCompany?.id === uc.company.id ? 600 : 400 }}>
                {uc.company.account_type === 'personal' ? 'Personnel' : uc.company.name}
              </Typography>
            </Box>
            {currentCompany?.id === uc.company.id && (
              <CheckIcon sx={{ fontSize: 16, color: '#F5C518', ml: 'auto' }} />
            )}
          </Box>
        </MenuItem>
      ))}
      <Divider sx={{ my: 0.5 }} />
      {/* Créer un espace */}
      <MenuItem
        onClick={() => {
          handleCompanyMenuCloseImmediate();
          setDialogError(null);
          setNewSpaceName('');
          setNewSpaceType(isPersonalAccount ? 'business' : 'personal');
          setCreateSpaceDialogOpen(true);
        }}
        sx={{
          py: 1,
          px: 2,
          color: '#F5C518',
          '&:hover': {
            bgcolor: resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.1)' : '#FEF9E7',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AddIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {isPersonalAccount ? 'Créer un espace pro' : 'Créer un espace perso'}
          </Typography>
        </Box>
      </MenuItem>
      {/* Rejoindre une entreprise */}
      <MenuItem
        onClick={() => {
          handleCompanyMenuCloseImmediate();
          setDialogError(null);
          setJoinCode('');
          setJoinCompanyDialogOpen(true);
        }}
        sx={{
          py: 1,
          px: 2,
          color: resolvedMode === 'dark' ? '#B0B0B0' : '#6B7280',
          '&:hover': {
            bgcolor: resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.1)' : '#FEF9E7',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <GroupIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Rejoindre une entreprise
          </Typography>
        </Box>
      </MenuItem>
      {/* Code d'invitation (pro seulement) */}
      {!isPersonalAccount && (
        <MenuItem
          onClick={async () => {
            handleCompanyMenuCloseImmediate();
            setDialogError(null);
            try {
              const res = await companiesAPI.getInviteCode();
              setInviteCode(res.data.invite_code);
            } catch {
              setInviteCode('');
            }
            setInviteCodeDialogOpen(true);
          }}
          sx={{
            py: 1,
            px: 2,
            color: resolvedMode === 'dark' ? '#B0B0B0' : '#6B7280',
            '&:hover': {
              bgcolor: resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.1)' : '#FEF9E7',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CopyIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Code d'invitation
            </Typography>
          </Box>
        </MenuItem>
      )}
    </Menu>
  );

  // Handler: Créer un nouvel espace
  const handleCreateSpace = async () => {
    if (newSpaceType === 'business' && !newSpaceName.trim()) {
      setDialogError("Le nom de l'entreprise est requis");
      return;
    }
    setDialogLoading(true);
    setDialogError(null);
    try {
      await companiesAPI.createSpace({
        account_type: newSpaceType,
        name: newSpaceType === 'personal' ? undefined : newSpaceName.trim(),
      });
      await fetchCurrentCompany();
      await fetchUserCompanies();
      setCreateSpaceDialogOpen(false);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setDialogError(err.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setDialogLoading(false);
    }
  };

  // Handler: Rejoindre une entreprise
  const handleJoinCompany = async () => {
    if (!joinCode.trim()) {
      setDialogError("Le code d'invitation est requis");
      return;
    }
    setDialogLoading(true);
    setDialogError(null);
    try {
      await companiesAPI.joinCompany(joinCode.trim());
      await fetchCurrentCompany();
      await fetchUserCompanies();
      setJoinCompanyDialogOpen(false);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setDialogError(err.response?.data?.detail || "Code d'invitation invalide");
    } finally {
      setDialogLoading(false);
    }
  };

  // Handler: Régénérer le code d'invitation
  const handleRegenerateCode = async () => {
    try {
      const res = await companiesAPI.regenerateInviteCode();
      setInviteCode(res.data.invite_code);
    } catch {
      setDialogError("Erreur lors de la régénération");
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box sx={{ bgcolor: resolvedMode === 'dark' ? '#0F0F0F' : '#F5F5F7', minHeight: '100vh' }}>
      {fileInputs}

      {/* Dialog: Créer un espace */}
      <Dialog
        open={createSpaceDialogOpen}
        onClose={() => setCreateSpaceDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {newSpaceType === 'personal' ? 'Créer un espace personnel' : 'Créer un espace professionnel'}
        </DialogTitle>
        <DialogContent>
          {dialogError && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>{dialogError}</Typography>
          )}
          {newSpaceType === 'business' ? (
            <TextField
              fullWidth
              label="Nom de l'entreprise"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              sx={{ mt: 1 }}
              autoFocus
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Un espace personnel sera créé avec vos catégories de budget par défaut (Logement, Alimentation, Transport, etc.)
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateSpaceDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleCreateSpace}
            disabled={dialogLoading}
            sx={{ bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
          >
            {dialogLoading ? 'Création...' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Rejoindre une entreprise */}
      <Dialog
        open={joinCompanyDialogOpen}
        onClose={() => setJoinCompanyDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Rejoindre une entreprise</DialogTitle>
        <DialogContent>
          {dialogError && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>{dialogError}</Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Entrez le code d'invitation fourni par l'administrateur de l'entreprise
          </Typography>
          <TextField
            fullWidth
            label="Code d'invitation"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            inputProps={{ maxLength: 8, style: { letterSpacing: 4, fontWeight: 600, textAlign: 'center', fontSize: '1.2rem' } }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setJoinCompanyDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleJoinCompany}
            disabled={dialogLoading || joinCode.length < 4}
            sx={{ bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
          >
            {dialogLoading ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Code d'invitation */}
      <Dialog
        open={inviteCodeDialogOpen}
        onClose={() => setInviteCodeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Code d'invitation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Partagez ce code avec les personnes que vous souhaitez inviter dans votre entreprise
          </Typography>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 2,
            bgcolor: resolvedMode === 'dark' ? '#1A1A1A' : '#F9FAFB',
            borderRadius: 2,
            border: '2px dashed',
            borderColor: '#F5C518',
            justifyContent: 'center',
          }}>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: 6, color: '#F5C518' }}>
              {inviteCode || '...'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'center' }}>
            <Button
              size="small"
              startIcon={<CopyIcon />}
              onClick={() => {
                navigator.clipboard.writeText(inviteCode);
              }}
              sx={{ color: '#6B7280' }}
            >
              Copier
            </Button>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRegenerateCode}
              sx={{ color: '#6B7280' }}
            >
              Régénérer
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInviteCodeDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Top Bar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: resolvedMode === 'dark' ? '#1A1A1A' : '#FFFFFF',
          borderBottom: resolvedMode === 'dark' ? '1px solid #2D2D2D' : '1px solid #E5E7EB',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
          {/* Left: Branding */}
          <Box
            onClick={() => router.push('/dashboard')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#F5C518',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1A1A' }}>
                D
              </Typography>
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                color: resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A',
                fontSize: '1.1rem',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              DafGram
            </Typography>
          </Box>

          {/* Center: Navigation Menu */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, sm: 1 },
            }}
          >
            {menuItems.map((item) => (
              <Box
                key={item.text}
                onMouseEnter={item.hasSubmenu ? handleBudgetMenuOpen : undefined}
                onMouseLeave={item.hasSubmenu ? handleBudgetMenuClose : undefined}
                sx={{ position: 'relative' }}
              >
                <Button
                  onClick={(e) => {
                    if (item.hasSubmenu) {
                      // Ouvrir le sous-menu au clic
                      if (budgetMenuAnchor) {
                        setBudgetMenuAnchor(null);
                      } else {
                        setBudgetMenuAnchor(e.currentTarget);
                      }
                    } else {
                      router.push(item.path);
                    }
                  }}
                  startIcon={item.icon}
                  endIcon={item.hasSubmenu ? <KeyboardArrowDown sx={{ fontSize: 16 }} /> : undefined}
                  sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 1,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: isActiveOrChild(item) ? 600 : 500,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    color: isActiveOrChild(item)
                      ? (resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A')
                      : '#6B7280',
                    bgcolor: isActiveOrChild(item)
                      ? (resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.15)' : '#FEF9E7')
                      : 'transparent',
                    '&:hover': {
                      bgcolor: isActiveOrChild(item)
                        ? (resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.25)' : '#FEF3C7')
                        : (resolvedMode === 'dark' ? '#252525' : '#F9FAFB'),
                    },
                    '& .MuiButton-startIcon': {
                      marginRight: { xs: 0, sm: 1 },
                      color: isActiveOrChild(item)
                        ? (resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A')
                        : '#9CA3AF',
                    },
                    '& .MuiButton-endIcon': {
                      marginLeft: 0.5,
                      color: isActiveOrChild(item)
                        ? (resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A')
                        : '#9CA3AF',
                      display: { xs: 'none', md: 'flex' },
                    },
                    // Hide text on very small screens
                    '& .MuiButton-startIcon + span': {
                      display: { xs: 'none', md: 'inline' },
                    },
                  }}
                >
                  <span>{item.text}</span>
                </Button>

                {/* Submenu dropdown */}
                {item.hasSubmenu && (
                  <Menu
                    anchorEl={budgetMenuAnchor}
                    open={Boolean(budgetMenuAnchor)}
                    onClose={() => setBudgetMenuAnchor(null)}
                    MenuListProps={{
                      onMouseEnter: handleBudgetMenuEnter,
                      onMouseLeave: handleBudgetMenuClose,
                    }}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                    PaperProps={{
                      sx: {
                        mt: 0.5,
                        borderRadius: 2,
                        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
                        minWidth: 160,
                        bgcolor: resolvedMode === 'dark' ? '#1A1A1A' : '#FFFFFF',
                        border: resolvedMode === 'dark' ? '1px solid #2D2D2D' : '1px solid #E5E7EB',
                      },
                    }}
                  >
                    {item.submenu?.map((subItem) => (
                      <MenuItem
                        key={subItem.text}
                        onClick={() => {
                          router.push(subItem.path);
                          setBudgetMenuAnchor(null);
                        }}
                        selected={pathname === subItem.path}
                        sx={{
                          py: 1.5,
                          px: 2,
                          color: resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A',
                          '&.Mui-selected': {
                            bgcolor: resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.15)' : '#FEF9E7',
                          },
                          '&:hover': {
                            bgcolor: resolvedMode === 'dark' ? '#252525' : '#F9FAFB',
                          },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: pathname === subItem.path ? 600 : 400 }}>
                          {subItem.text}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </Box>
            ))}
          </Box>

          {/* Right: Settings + User */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Settings button */}
            <Tooltip title="Paramètres">
              <IconButton
                onClick={() => router.push('/settings')}
                sx={{
                  color: isActive('/settings')
                    ? (resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A')
                    : '#9CA3AF',
                  bgcolor: isActive('/settings')
                    ? (resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.15)' : '#FEF9E7')
                    : 'transparent',
                  '&:hover': {
                    bgcolor: isActive('/settings')
                      ? (resolvedMode === 'dark' ? 'rgba(245, 197, 24, 0.25)' : '#FEF3C7')
                      : (resolvedMode === 'dark' ? '#252525' : '#F9FAFB'),
                  },
                }}
              >
                <SettingsIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>

            {/* Theme toggle button */}
            <Tooltip title={resolvedMode === 'dark' ? 'Mode clair' : 'Mode sombre'}>
              <IconButton
                onClick={toggleTheme}
                aria-label={resolvedMode === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
                sx={{
                  color: '#9CA3AF',
                  '&:hover': {
                    bgcolor: resolvedMode === 'dark' ? '#252525' : '#F9FAFB',
                    color: '#F5C518',
                  },
                }}
              >
                {resolvedMode === 'dark' ? (
                  <LightModeIcon sx={{ fontSize: 22 }} />
                ) : (
                  <DarkModeIcon sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </Tooltip>

            {/* Company selector */}
            <Box
              onMouseEnter={handleCompanyMenuOpen}
              onMouseLeave={handleCompanyMenuClose}
              sx={{ position: 'relative' }}
            >
              <Tooltip title={companyMenuAnchor ? '' : 'Changer d\'entreprise'}>
                <Box
                  onClick={handleCompanyMenuOpen}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: resolvedMode === 'dark' ? '#252525' : '#F9FAFB',
                    border: resolvedMode === 'dark' ? '1px solid #3D3D3D' : '1px solid #E5E7EB',
                    '&:hover': {
                      bgcolor: resolvedMode === 'dark' ? '#333333' : '#F3F4F6',
                      borderColor: '#F5C518',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: 1,
                      bgcolor: currentCompany?.logo_url ? 'transparent' : '#F5C518',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {currentCompany?.logo_url ? (
                      <img
                        src={`http://localhost:8000${currentCompany.logo_url}`}
                        alt="Logo"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : isPersonalAccount ? (
                      <PersonIcon sx={{ color: '#1A1A1A', fontSize: 14 }} />
                    ) : (
                      <BusinessIcon sx={{ color: '#1A1A1A', fontSize: 12 }} />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: resolvedMode === 'dark' ? '#F5F5F7' : '#1A1A1A',
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isPersonalAccount ? 'Personnel' : (currentCompany?.name || 'Entreprise')}
                  </Typography>
                  <KeyboardArrowDown
                    sx={{
                      fontSize: 16,
                      color: '#9CA3AF',
                      transition: 'transform 0.2s',
                      transform: companyMenuAnchor ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </Box>
              </Tooltip>
              {companyMenu}
            </Box>

            {/* User avatar */}
            <Box
              onMouseEnter={handleUserMenuOpen}
              onMouseLeave={handleUserMenuClose}
              sx={{ position: 'relative' }}
            >
              <Tooltip title={userMenuAnchor ? '' : 'Mon compte'}>
                <IconButton
                  onClick={handleUserMenuOpen}
                  sx={{ p: 0.5 }}
                >
                  <Avatar
                    src={user?.avatar_url ? `http://localhost:8000${user.avatar_url}` : undefined}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: '#F5C518',
                      color: '#1A1A1A',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}
                  >
                    {!user?.avatar_url && (user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U')}
                  </Avatar>
                </IconButton>
              </Tooltip>
              {userMenu}
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Subscription Warning Banner */}
      <SubscriptionBanner />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3 },
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {children}
      </Box>

      {/* Pricing Dialog */}
      <Dialog
        open={pricingDialogOpen}
        onClose={() => setPricingDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 2,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
              Ajouter une entreprise
            </Typography>
            <Typography variant="body2" sx={{ color: '#9CA3AF', mt: 0.5 }}>
              Choisissez le plan qui correspond à vos besoins
            </Typography>
          </Box>
          <IconButton onClick={() => setPricingDialogOpen(false)} sx={{ color: '#9CA3AF' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3,
              mt: 2,
            }}
          >
            {pricingPlans.map((plan) => (
              <Card
                key={plan.name}
                elevation={plan.highlighted ? 8 : 0}
                sx={{
                  borderRadius: 4,
                  border: plan.highlighted ? '2px solid #F5C518' : '1px solid #E5E7EB',
                  position: 'relative',
                  overflow: 'visible',
                  transform: plan.highlighted ? 'scale(1.05)' : 'none',
                }}
              >
                {plan.highlighted && (
                  <Chip
                    icon={<StarIcon sx={{ fontSize: 16, color: '#1A1A1A' }} />}
                    label="Populaire"
                    sx={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: '#F5C518',
                      color: '#1A1A1A',
                      fontWeight: 600,
                    }}
                  />
                )}
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 1 }}>
                    {plan.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 2, minHeight: 40 }}>
                    {plan.description}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 3 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#1A1A1A' }}>
                      {plan.price}€
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9CA3AF', ml: 1 }}>
                      {plan.period}
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ mb: 3 }}>
                    {plan.features.map((feature, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CheckIcon sx={{ fontSize: 18, color: '#10B981' }} />
                        <Typography variant="body2" sx={{ color: '#4B5563' }}>
                          {feature}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    fullWidth
                    variant={plan.highlighted ? 'contained' : 'outlined'}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 600,
                      ...(plan.highlighted
                        ? {
                            bgcolor: '#F5C518',
                            color: '#1A1A1A',
                            '&:hover': { bgcolor: '#E0B000' },
                          }
                        : {
                            borderColor: '#E5E7EB',
                            color: '#1A1A1A',
                            '&:hover': { borderColor: '#F5C518', bgcolor: '#FEF9E7' },
                          }),
                    }}
                  >
                    Choisir ce plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Typography variant="body2" sx={{ color: '#9CA3AF', textAlign: 'center', mt: 4 }}>
            Tous les plans incluent un essai gratuit de 14 jours. Annulation possible à tout moment.
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
