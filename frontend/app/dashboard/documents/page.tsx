'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as UploadIcon, CheckCircle, Error } from '@mui/icons-material';
import { documentsAPI } from '@/lib/api';
import { format } from 'date-fns';

interface Document {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  processed: boolean;
  processing_error: string | null;
  created_at: string;
}

interface UploadResult {
  message: string;
  transactions_created: number;
  document: Document;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const fetchDocuments = async () => {
    try {
      const response = await documentsAPI.getAll();
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const response = await documentsAPI.upload(file, true);
      setUploadResult(response.data);
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Erreur lors de l\'upload: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Documents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Uploadez vos PDFs et fichiers CSV pour remplissage automatique
        </Typography>
      </Box>

      {/* Zone d'upload */}
      <Paper sx={{ p: 4, mb: 3, textAlign: 'center' }}>
        <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Upload de documents
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Formats acceptés: PDF, CSV, XLSX (max 10MB)
        </Typography>

        <Button
          variant="contained"
          component="label"
          disabled={uploading}
          startIcon={<UploadIcon />}
        >
          {uploading ? 'Upload en cours...' : 'Sélectionner un fichier'}
          <input
            type="file"
            hidden
            accept=".pdf,.csv,.xlsx"
            onChange={handleFileUpload}
          />
        </Button>

        {uploading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      {/* Résultat de l'upload */}
      {uploadResult && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setUploadResult(null)}>
          <Typography variant="subtitle2">{uploadResult.message}</Typography>
          <Typography variant="body2">
            {uploadResult.transactions_created} transaction(s) créée(s) automatiquement
          </Typography>
        </Alert>
      )}

      {/* Liste des documents */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom du fichier</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Taille</TableCell>
              <TableCell>Date d'upload</TableCell>
              <TableCell>Statut</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.filename}</TableCell>
                <TableCell>
                  <Chip label={doc.file_type.toUpperCase()} size="small" />
                </TableCell>
                <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                <TableCell>
                  {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {doc.processed ? (
                    doc.processing_error ? (
                      <Chip
                        icon={<Error />}
                        label="Erreur"
                        color="error"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<CheckCircle />}
                        label="Traité"
                        color="success"
                        size="small"
                      />
                    )
                  ) : (
                    <Chip label="En attente" size="small" />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary">
                    Aucun document uploadé
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Informations */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Comment ça marche ?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          1. Uploadez un fichier PDF ou CSV contenant vos transactions
          <br />
          2. Le système utilise l'OCR (Tesseract) pour extraire le texte des PDFs
          <br />
          3. Les transactions sont automatiquement détectées et créées
          <br />
          4. Vous pouvez ensuite les modifier ou les associer à un budget
        </Typography>
      </Paper>
    </DashboardLayout>
  );
}
