'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Divider,
  IconButton,
  Slide,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  timestamp: string;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const saveConsent = (preferences: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    setVisible(false);
    setSettingsOpen(false);
  };

  const handleAccept = () => {
    saveConsent({
      essential: true,
      analytics: false,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSaveSettings = () => {
    saveConsent({
      essential: true,
      analytics: analyticsEnabled,
      timestamp: new Date().toISOString(),
    });
  };

  if (!visible) return null;

  return (
    <>
      <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            maxWidth: 600,
            mx: 'auto',
            zIndex: 9999,
            backgroundColor: '#1A1A1A',
            color: '#FFFFFF',
            borderRadius: 3,
            p: 2.5,
          }}
        >
          <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.6, color: '#E0E0E0' }}>
            Ce site utilise des cookies essentiels pour son fonctionnement. En continuant
            {' '}à utiliser ce site, vous acceptez notre utilisation des cookies.{' '}
            <Link
              href="/confidentialite"
              style={{ color: '#F5C518', textDecoration: 'underline' }}
            >
              Politique de confidentialité
            </Link>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSettingsOpen(true)}
              sx={{
                color: '#FFFFFF',
                borderColor: '#555',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': {
                  borderColor: '#F5C518',
                  color: '#F5C518',
                },
              }}
            >
              Paramètres
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleAccept}
              sx={{
                backgroundColor: '#F5C518',
                color: '#1A1A1A',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': {
                  backgroundColor: '#E0B400',
                },
              }}
            >
              Accepter
            </Button>
          </Box>
        </Paper>
      </Slide>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundColor: '#1A1A1A',
            color: '#FFFFFF',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Paramètres des cookies
          </Typography>
          <IconButton onClick={() => setSettingsOpen(false)} sx={{ color: '#999' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: '#333' }} />
        <DialogContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Cookies essentiels
              </Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>
                Authentification, session utilisateur. Nécessaires au fonctionnement du site.
              </Typography>
            </Box>
            <Switch checked disabled sx={{ '& .MuiSwitch-thumb': { backgroundColor: '#F5C518' }, '& .MuiSwitch-track': { backgroundColor: '#F5C518 !important', opacity: '0.5 !important' } }} />
          </Box>
          <Divider sx={{ borderColor: '#333' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Cookies analytiques
              </Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>
                Nous aident à comprendre comment vous utilisez le site pour améliorer votre expérience.
              </Typography>
            </Box>
            <Switch
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#F5C518' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F5C518' },
              }}
            />
          </Box>
        </DialogContent>
        <Divider sx={{ borderColor: '#333' }} />
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setSettingsOpen(false)}
            sx={{
              color: '#FFFFFF',
              borderColor: '#555',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { borderColor: '#F5C518', color: '#F5C518' },
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            sx={{
              backgroundColor: '#F5C518',
              color: '#1A1A1A',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { backgroundColor: '#E0B400' },
            }}
          >
            Enregistrer mes préférences
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
