'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Button,
  Link as MuiLink,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: '#1A1A1A', mb: 1.5 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body1" sx={{ color: '#444', lineHeight: 1.8, mb: 1 }}>
      {children}
    </Typography>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ pl: 3, mt: 0.5, mb: 1 }}>
      {items.map((item) => (
        <Box component="li" key={item} sx={{ mb: 0.5 }}>
          <Typography variant="body1" sx={{ color: '#444', lineHeight: 1.8 }}>
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function ConfidentialitePage() {
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FAFAFA' }}>
      {/* Header */}
      <Box
        sx={{
          backgroundColor: '#1A1A1A',
          py: 3,
          px: 2,
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: '#F5C518',
                letterSpacing: '-0.5px',
              }}
            >
              DafGram
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{
            mb: 3,
            textTransform: 'none',
            color: '#1A1A1A',
            fontWeight: 500,
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
          }}
        >
          Retour
        </Button>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 3,
            border: '1px solid #E0E0E0',
            backgroundColor: '#FFFFFF',
          }}
        >
          {/* Title */}
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: '#1A1A1A',
              mb: 1,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Politique de Confidentialité
          </Typography>
          <Typography variant="body2" sx={{ color: '#999', mb: 4 }}>
            Dernière mise à jour : mars 2026
          </Typography>

          <Divider sx={{ mb: 4 }} />

          {/* Données collectées */}
          <Section title="Données collectées">
            <Paragraph>
              Dans le cadre de l&apos;utilisation de DafGram, nous collectons les données suivantes :
            </Paragraph>
            <BulletList
              items={[
                'Adresse e-mail',
                'Nom complet',
                'Données financières : transactions, budgets, objectifs d\u2019épargne',
                'Données bancaires : IBAN (si renseigné par l\u2019utilisateur)',
              ]}
            />
            <Paragraph>
              Ces données sont collectées uniquement lorsque vous les fournissez directement
              via l&apos;application.
            </Paragraph>
          </Section>

          {/* Utilisation des données */}
          <Section title="Utilisation des données">
            <Paragraph>
              Vos données sont utilisées exclusivement pour :
            </Paragraph>
            <BulletList
              items={[
                'La gestion budgétaire personnelle et professionnelle',
                'L\u2019analyse financière et la génération de statistiques',
                'L\u2019amélioration de votre expérience utilisateur',
              ]}
            />
            <Paragraph>
              Nous ne revendons jamais vos données à des tiers. Aucune donnée personnelle
              n&apos;est partagée avec des entreprises tierces à des fins commerciales.
            </Paragraph>
          </Section>

          {/* Sécurité des données */}
          <Section title="Sécurité des données">
            <Paragraph>
              La sécurité de vos données est notre priorité. Nous mettons en place les mesures
              suivantes :
            </Paragraph>
            <BulletList
              items={[
                'Chiffrement des données sensibles (mots de passe hashés avec bcrypt)',
                'Communication sécurisée via HTTPS sur l\u2019ensemble de la plateforme',
                'Authentification par tokens JWT avec expiration automatique',
                'Accès aux données restreint et contrôlé par rôle utilisateur',
              ]}
            />
          </Section>

          {/* Vos droits (RGPD) */}
          <Section title="Vos droits (RGPD)">
            <Paragraph>
              Conformément au Règlement Général sur la Protection des Données (RGPD),
              vous disposez des droits suivants :
            </Paragraph>
            <BulletList
              items={[
                'Droit d\u2019accès : obtenir une copie de vos données personnelles',
                'Droit de rectification : corriger vos données inexactes ou incomplètes',
                'Droit à l\u2019effacement : demander la suppression de vos données personnelles',
                'Droit à la portabilité : recevoir vos données dans un format structuré et lisible',
              ]}
            />
          </Section>

          {/* Exercer vos droits */}
          <Section title="Exercer vos droits">
            <Paragraph>
              Pour exercer l&apos;un de ces droits, vous pouvez :
            </Paragraph>
            <BulletList
              items={[
                'Nous contacter par e-mail à security@dafgram.com',
                'Utiliser les paramètres de votre compte directement depuis l\u2019application',
              ]}
            />
            <Paragraph>
              Nous nous engageons à traiter votre demande dans un délai de 30 jours.
            </Paragraph>
          </Section>

          {/* Cookies */}
          <Section title="Cookies">
            <Paragraph>
              DafGram utilise uniquement des cookies essentiels nécessaires au bon
              fonctionnement de l&apos;application :
            </Paragraph>
            <BulletList
              items={[
                'Cookies d\u2019authentification : maintien de votre session utilisateur',
                'Cookies de préférences : mémorisation de vos paramètres (thème, langue)',
              ]}
            />
            <Paragraph>
              Aucun cookie de suivi publicitaire ou de profilage n&apos;est utilisé.
            </Paragraph>
          </Section>

          {/* Hébergement */}
          <Section title="Hébergement">
            <Paragraph>
              L&apos;application DafGram est hébergée sur Railway, avec des serveurs situés
              en Europe. Vos données sont stockées et traitées conformément aux réglementations
              européennes en matière de protection des données.
            </Paragraph>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <Paragraph>
              Pour toute question relative à la protection de vos données personnelles,
              vous pouvez nous contacter à :
            </Paragraph>
            <Box sx={{ mt: 1.5, p: 2, backgroundColor: '#F5F5F5', borderRadius: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                DafGram - Protection des données
              </Typography>
              <MuiLink
                href="mailto:security@dafgram.com"
                sx={{
                  color: '#F5C518',
                  fontWeight: 500,
                  textDecorationColor: '#F5C518',
                }}
              >
                security@dafgram.com
              </MuiLink>
            </Box>
          </Section>
        </Paper>
      </Container>
    </Box>
  );
}
