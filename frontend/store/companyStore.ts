import { create } from 'zustand';
import { companiesAPI, CompanyInfo, UserCompanyInfo } from '@/lib/api';

interface CompanyState {
  currentCompany: CompanyInfo | null;
  userCompanies: UserCompanyInfo[];
  isLoading: boolean;
  error: string | null;

  fetchCurrentCompany: () => Promise<void>;
  fetchUserCompanies: () => Promise<void>;
  switchCompany: (companyId: number) => Promise<void>;
  updateCompany: (data: Partial<CompanyInfo>) => Promise<void>;
  setCurrentCompany: (company: CompanyInfo) => void;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  currentCompany: null,
  userCompanies: [],
  isLoading: false,
  error: null,

  fetchCurrentCompany: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await companiesAPI.getCurrentCompany();
      set({ currentCompany: response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Erreur lors du chargement de l\'entreprise',
        isLoading: false,
      });
    }
  },

  fetchUserCompanies: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await companiesAPI.getMyCompanies();
      set({ userCompanies: response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Erreur lors du chargement des entreprises',
        isLoading: false,
      });
    }
  },

  switchCompany: async (companyId: number) => {
    set({ isLoading: true, error: null });
    try {
      await companiesAPI.switchCompany(companyId);
      // Recharger l'entreprise courante
      const response = await companiesAPI.getCurrentCompany();
      set({ currentCompany: response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Erreur lors du changement d\'entreprise',
        isLoading: false,
      });
      throw error;
    }
  },

  updateCompany: async (data: Partial<CompanyInfo>) => {
    set({ isLoading: true, error: null });
    console.log('DEBUG Store: updateCompany called with:', data);
    try {
      const response = await companiesAPI.updateCompany(data as any);
      set({ currentCompany: response.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Erreur lors de la mise à jour',
        isLoading: false,
      });
      throw error;
    }
  },

  setCurrentCompany: (company: CompanyInfo) => {
    set({ currentCompany: company });
  },
}));
