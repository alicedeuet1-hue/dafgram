'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useCompanyStore } from '@/store/companyStore';
import { companiesAPI, API_BASE_URL, getImageUrl } from '@/lib/api';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Business,
  Email,
  Phone,
  LocationOn,
  Receipt,
  Save,
  Language,
  Lock,
  AttachMoney,
  CameraAlt,
  Edit as EditIcon,
  Warning as WarningIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

export default function SettingsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { currentCompany, fetchCurrentCompany, updateCompany, isLoading } = useCompanyStore();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
  });

  const [companyName, setCompanyName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [language, setLanguage] = useState('fr');
  const [currency, setCurrency] = useState('EUR');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    fetchCurrentCompany();
  }, []);

  useEffect(() => {
    if (currentCompany) {
      setFormData({
        email: currentCompany.email || '',
        phone: currentCompany.phone || '',
        address: currentCompany.address || '',
        city: currentCompany.city || '',
        postal_code: currentCompany.postal_code || '',
        country: currentCompany.country || '',
      });
      setCompanyName(currentCompany.name || '');
      setCurrency(currentCompany.currency || 'EUR');
      setLanguage(currentCompany.language || 'fr');
    }
  }, [currentCompany]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
    setError(null);
    setSuccess(null);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setError(null);

    try {
      await companiesAPI.uploadLogo(file);
      await fetchCurrentCompany();
      setSuccess('Logo mis à jour avec succès');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors du téléchargement du logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveName = async () => {
    if (!companyName.trim() || companyName === currentCompany?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateCompany({ name: companyName });
      await fetchCurrentCompany();
      setSuccess('Nom mis à jour avec succès');
      setIsEditingName(false);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        setError(errorDetail);
      } else {
        setError('Erreur lors de la mise à jour du nom');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const dataToSend = {
      ...formData,
      currency,
      language,
    };

    try {
      await updateCompany(dataToSend);
      await fetchCurrentCompany();
      setSuccess('Informations mises à jour avec succès');
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        setError(errorDetail);
      } else if (Array.isArray(errorDetail)) {
        setError(errorDetail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', '));
      } else {
        setError('Erreur lors de la mise à jour');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSpace = async () => {
    if (!currentCompany) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await companiesAPI.deleteSpace(currentCompany.id);
      setDeleteDialogOpen(false);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setDeleteError(typeof detail === 'string' ? detail : 'Erreur lors de la suppression de l\'espace');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !currentCompany) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress sx={{ color: '#F5C518' }} />
        </Box>
      </DashboardLayout>
    );
  }

  const canEditName = !currentCompany?.name_changed;
  const isPersonalAccount = currentCompany?.account_type === 'personal';

  return (
    <DashboardLayout>
      {/* Hidden file input for logo */}
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoUpload}
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
      />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
          Paramètres
        </Typography>
        <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
          {isPersonalAccount ? 'Gérez vos préférences personnelles' : 'Gérez les informations de votre entreprise et vos préférences'}
        </Typography>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Identité de l'entreprise (Logo + Nom) */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Business sx={{ color: '#F5C518', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {isPersonalAccount ? 'Mon profil' : 'Identité de l\'entreprise'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: { xs: 'center', md: 'flex-start' } }}>
              {/* Logo */}
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: currentCompany?.logo_url ? 'transparent' : alpha('#F5C518', 0.1),
                    border: `2px dashed ${alpha('#F5C518', 0.3)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#F5C518',
                      bgcolor: alpha('#F5C518', 0.15),
                    },
                  }}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {isUploadingLogo ? (
                    <CircularProgress size={40} sx={{ color: '#F5C518' }} />
                  ) : currentCompany?.logo_url ? (
                    <img
                      src={getImageUrl(currentCompany.logo_url) || ''}
                      alt="Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center' }}>
                      <CameraAlt sx={{ fontSize: 32, color: '#F5C518', mb: 0.5 }} />
                      <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block' }}>
                        Ajouter un logo
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', mt: 1 }}>
                  Cliquez pour {currentCompany?.logo_url ? 'modifier' : 'ajouter'}
                </Typography>
              </Box>

              {/* Nom de l'entreprise */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ color: '#9CA3AF', mb: 1 }}>
                  {isPersonalAccount ? 'Nom de l\'espace' : 'Nom de l\'entreprise'}
                </Typography>

                {isEditingName ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      fullWidth
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      size="small"
                      autoFocus
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Business sx={{ color: '#9CA3AF' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleSaveName}
                      disabled={isSaving}
                      size="small"
                      sx={{
                        bgcolor: '#F5C518',
                        color: '#1A1A1A',
                        minWidth: 100,
                        '&:hover': { bgcolor: '#E0B000' },
                      }}
                    >
                      {isSaving ? <CircularProgress size={20} sx={{ color: '#1A1A1A' }} /> : 'Enregistrer'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCompanyName(currentCompany?.name || '');
                        setIsEditingName(false);
                      }}
                      size="small"
                      sx={{ borderColor: '#9CA3AF', color: '#9CA3AF' }}
                    >
                      Annuler
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {currentCompany?.name || (isPersonalAccount ? 'Mon espace' : 'Mon entreprise')}
                    </Typography>
                    {canEditName ? (
                      <IconButton
                        onClick={() => setIsEditingName(true)}
                        size="small"
                        sx={{
                          bgcolor: alpha('#F5C518', 0.1),
                          color: '#F5C518',
                          '&:hover': { bgcolor: alpha('#F5C518', 0.2) },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    ) : (
                      <Chip
                        icon={<Lock sx={{ fontSize: 14 }} />}
                        label="Nom déjà modifié"
                        size="small"
                        sx={{ bgcolor: alpha('#9CA3AF', 0.1), color: '#9CA3AF', fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                )}

                {canEditName && !isEditingName && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <WarningIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
                    <Typography variant="caption" sx={{ color: '#F59E0B' }}>
                      Attention : le nom ne peut être modifié qu'une seule fois
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Informations légales (lecture seule) - pro seulement */}
        {!isPersonalAccount && (
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Lock sx={{ color: '#9CA3AF', fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Informations légales
                </Typography>
                <Chip
                  label="Non modifiable"
                  size="small"
                  sx={{ ml: 'auto', bgcolor: '#F3F4F6', color: '#6B7280', fontSize: '0.7rem' }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
                Ces informations ne peuvent pas être modifiées directement. Contactez le support si nécessaire.
              </Typography>

              <TextField
                fullWidth
                label="Numéro de TVA"
                value={currentCompany?.vat_number || 'Non renseigné'}
                disabled
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Receipt sx={{ color: '#9CA3AF' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: '#6B7280',
                  },
                }}
              />
            </Paper>
          </Grid>
        )}

        {/* Préférences */}
        <Grid item xs={12} md={isPersonalAccount ? 12 : 6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Language sx={{ color: '#F5C518', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Préférences
              </Typography>
            </Box>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Langue</InputLabel>
              <Select
                value={language}
                label="Langue"
                onChange={(e) => setLanguage(e.target.value)}
              >
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="es">Español</MenuItem>
                <MenuItem value="de">Deutsch</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AttachMoney sx={{ color: '#F5C518', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Devise
              </Typography>
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Devise</InputLabel>
              <Select
                value={currency}
                label="Devise"
                onChange={(e) => setCurrency(e.target.value)}
              >
                <MenuItem value="EUR">€ Euro (EUR)</MenuItem>
                <MenuItem value="USD">$ Dollar américain (USD)</MenuItem>
                <MenuItem value="GBP">£ Livre sterling (GBP)</MenuItem>
                <MenuItem value="CHF">CHF Franc suisse (CHF)</MenuItem>
                <MenuItem value="CAD">$ Dollar canadien (CAD)</MenuItem>
                <MenuItem value="JPY">¥ Yen japonais (JPY)</MenuItem>
                <MenuItem value="CNY">¥ Yuan chinois (CNY)</MenuItem>
                <MenuItem value="MAD">MAD Dirham marocain (MAD)</MenuItem>
                <MenuItem value="XOF">XOF Franc CFA (XOF)</MenuItem>
                <MenuItem value="XPF">XPF Franc Pacifique (XPF)</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isSaving}
                size="small"
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#E0B000' },
                }}
              >
                Enregistrer les préférences
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Informations de contact (modifiable) */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              {isPersonalAccount ? 'Mes coordonnées' : 'Informations de contact'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
              Ces informations peuvent être mises à jour à tout moment.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email de contact"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  placeholder={isPersonalAccount ? 'mon@email.fr' : 'contact@entreprise.fr'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: '#9CA3AF' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Téléphone"
                  value={formData.phone}
                  onChange={handleInputChange('phone')}
                  placeholder="+33 1 23 45 67 89"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone sx={{ color: '#9CA3AF' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={formData.address}
                  onChange={handleInputChange('address')}
                  placeholder="123 Rue de Paris"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOn sx={{ color: '#9CA3AF' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Code postal"
                  value={formData.postal_code}
                  onChange={handleInputChange('postal_code')}
                  placeholder="75001"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Ville"
                  value={formData.city}
                  onChange={handleInputChange('city')}
                  placeholder="Paris"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Pays"
                  value={formData.country}
                  onChange={handleInputChange('country')}
                  placeholder="France"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={20} sx={{ color: '#1A1A1A' }} /> : <Save />}
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  fontWeight: 600,
                  px: 4,
                  '&:hover': { bgcolor: '#E0B000' },
                }}
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </Box>
          </Paper>
        </Grid>
        {/* Zone de danger */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha('#EF4444', 0.3),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <WarningIcon sx={{ color: '#EF4444', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#EF4444' }}>
                Zone de danger
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
              {isPersonalAccount
                ? 'La suppression de votre espace personnel est irréversible. Toutes vos données (transactions, budgets, épargne) seront définitivement supprimées.'
                : 'La suppression de cet espace est irréversible. Toutes les données associées (transactions, budgets, documents, employés) seront définitivement supprimées.'}
            </Typography>

            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={() => { setDeleteError(null); setDeleteDialogOpen(true); }}
              sx={{
                borderColor: '#EF4444',
                color: '#EF4444',
                fontWeight: 600,
                '&:hover': {
                  borderColor: '#DC2626',
                  bgcolor: alpha('#EF4444', 0.08),
                },
              }}
            >
              Supprimer cet espace
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#EF4444' }}>
          Supprimer l'espace "{currentCompany?.name}"
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Cette action est irréversible. Toutes les données de cet espace seront définitivement supprimées :
          </Typography>
          <Box component="ul" sx={{ color: 'text.secondary', pl: 2, '& li': { mb: 0.5 } }}>
            <li>Transactions et imports bancaires</li>
            <li>Budgets et catégories</li>
            <li>Documents et factures</li>
            <li>Employés et objectifs de vente</li>
            <li>Catégories d'épargne</li>
          </Box>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
            sx={{ color: 'text.secondary' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteSpace}
            disabled={isDeleting}
            sx={{
              bgcolor: '#EF4444',
              fontWeight: 600,
              '&:hover': { bgcolor: '#DC2626' },
            }}
          >
            {isDeleting ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : (
              'Confirmer la suppression'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
