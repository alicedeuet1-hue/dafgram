'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { employeesAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
}

interface SalesGoal {
  id: number;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  period_type: string;
  description: string;
}

export default function EmployeesPage() {
  const { user } = useAuthStore();
  const { currentCompany, fetchCurrentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [openEmployeeDialog, setOpenEmployeeDialog] = useState(false);
  const [openGoalDialog, setOpenGoalDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    position: '',
  });

  const [newGoal, setNewGoal] = useState({
    target_amount: 0,
    period_type: 'weekly',
    description: '',
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const fetchEmployees = async () => {
    try {
      const response = await employeesAPI.getAll();
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async (employeeId: number) => {
    try {
      const response = await employeesAPI.getGoals(employeeId);
      setGoals(response.data);
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  useEffect(() => {
    fetchCurrentCompany();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchGoals(selectedEmployee.id);
    }
  }, [selectedEmployee]);

  const handleCreateEmployee = async () => {
    if (!user) return;

    try {
      await employeesAPI.create({
        ...newEmployee,
        company_id: user.company_id,
      });
      setOpenEmployeeDialog(false);
      setNewEmployee({ first_name: '', last_name: '', email: '', position: '' });
      fetchEmployees();
    } catch (error) {
      console.error('Error creating employee:', error);
    }
  };

  const handleCreateGoal = async () => {
    if (!selectedEmployee) return;

    try {
      await employeesAPI.createGoal(selectedEmployee.id, {
        ...newGoal,
        employee_id: selectedEmployee.id,
      });
      setOpenGoalDialog(false);
      setNewGoal({
        target_amount: 0,
        period_type: 'weekly',
        description: '',
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      fetchGoals(selectedEmployee.id);
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  const getProgressColor = (percentage: number): 'success' | 'primary' | 'warning' | 'error' => {
    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'primary';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  const getProgressGradient = (percentage: number) => {
    if (percentage >= 100) return 'linear-gradient(90deg, #10B981 0%, #34D399 100%)';
    if (percentage >= 75) return 'linear-gradient(90deg, #7C3AED 0%, #A78BFA 100%)';
    if (percentage >= 50) return 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)';
    return 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)';
  };

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Employés & Objectifs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Suivez les performances et objectifs de vente
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenEmployeeDialog(true)}
        >
          Nouvel Employé
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Liste des employés */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Employés
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {employees.map((emp) => (
                <Card
                  key={emp.id}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: selectedEmployee?.id === emp.id ? 'primary.light' : 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <CardContent>
                    <Typography variant="subtitle1">
                      {emp.first_name} {emp.last_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {emp.position}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
              {employees.length === 0 && (
                <Typography color="text.secondary" align="center">
                  Aucun employé
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Objectifs de l'employé sélectionné */}
        <Grid item xs={12} md={8}>
          {selectedEmployee ? (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Objectifs de {selectedEmployee.first_name} {selectedEmployee.last_name}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenGoalDialog(true)}
                >
                  Nouvel Objectif
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {goals.map((goal) => (
                  <Card key={goal.id} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {goal.description || `Objectif ${goal.period_type}`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Période: {goal.period_type} | Objectif: {formatCurrency(goal.target_amount, currency)}
                      </Typography>

                      <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {formatCurrency(goal.current_amount, currency)} / {formatCurrency(goal.target_amount, currency)}
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ color: getProgressColor(goal.progress_percentage) + '.main' }}
                          >
                            {goal.progress_percentage.toFixed(0)}%
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: '100%',
                            height: 10,
                            bgcolor: '#334155',
                            borderRadius: 5,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${Math.min(goal.progress_percentage, 100)}%`,
                              height: '100%',
                              background: getProgressGradient(goal.progress_percentage),
                              borderRadius: 5,
                              transition: 'width 0.3s ease-in-out',
                            }}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
                {goals.length === 0 && (
                  <Typography color="text.secondary" align="center">
                    Aucun objectif défini
                  </Typography>
                )}
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <Typography color="text.secondary">
                Sélectionnez un employé pour voir ses objectifs
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Dialog création employé */}
      <Dialog open={openEmployeeDialog} onClose={() => setOpenEmployeeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Créer un nouvel employé</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Prénom"
            fullWidth
            value={newEmployee.first_name}
            onChange={(e) => setNewEmployee({ ...newEmployee, first_name: e.target.value })}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Nom"
            fullWidth
            value={newEmployee.last_name}
            onChange={(e) => setNewEmployee({ ...newEmployee, last_name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            value={newEmployee.email}
            onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Poste"
            fullWidth
            value={newEmployee.position}
            onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEmployeeDialog(false)}>Annuler</Button>
          <Button onClick={handleCreateEmployee} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog création objectif */}
      <Dialog open={openGoalDialog} onClose={() => setOpenGoalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Créer un nouvel objectif</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            value={newGoal.description}
            onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
            sx={{ mt: 2 }}
          />
          <TextField
            select
            margin="dense"
            label="Période"
            fullWidth
            value={newGoal.period_type}
            onChange={(e) => setNewGoal({ ...newGoal, period_type: e.target.value })}
          >
            <MenuItem value="daily">Journalier</MenuItem>
            <MenuItem value="weekly">Hebdomadaire</MenuItem>
            <MenuItem value="monthly">Mensuel</MenuItem>
            <MenuItem value="quarterly">Trimestriel</MenuItem>
            <MenuItem value="yearly">Annuel</MenuItem>
          </TextField>
          <TextField
            margin="dense"
            label={`Objectif (${getCurrencySymbol(currency)})`}
            type="number"
            fullWidth
            value={newGoal.target_amount}
            onChange={(e) => setNewGoal({ ...newGoal, target_amount: parseFloat(e.target.value) })}
          />
          <TextField
            margin="dense"
            label="Date de début"
            type="date"
            fullWidth
            value={newGoal.period_start}
            onChange={(e) => setNewGoal({ ...newGoal, period_start: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Date de fin"
            type="date"
            fullWidth
            value={newGoal.period_end}
            onChange={(e) => setNewGoal({ ...newGoal, period_end: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGoalDialog(false)}>Annuler</Button>
          <Button onClick={handleCreateGoal} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
