import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Extract clean error message from backend envelope
export function extractApiError(err) {
  if (err?.response?.data?.error?.message) {
    return err.response.data.error.message;
  }
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  if (err?.message) {
    return err.message;
  }
  return 'An unexpected error occurred while communicating with the backend server.';
}

export const platformApi = {
  getHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data.data;
  },

  getDashboard: async (projectId = null, runId = null) => {
    const params = {};
    if (projectId) params.project_id = projectId;
    if (runId) params.run_id = runId;
    const res = await apiClient.get('/dashboard', { params });
    return res.data.data;
  },

  listProjects: async () => {
    const res = await apiClient.get('/projects');
    return res.data.data;
  },

  getProject: async (projectId) => {
    const res = await apiClient.get(`/projects/${projectId}`);
    return res.data.data;
  },

  deleteProject: async (projectId) => {
    const res = await apiClient.delete(`/projects/${projectId}`);
    return res.data.data;
  },

  uploadProject: async (formData, onUploadProgress) => {
    const res = await apiClient.post('/projects/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return res.data;
  },

  analyzeProject: async (projectId, versionLabel) => {
    const res = await apiClient.post(`/projects/${projectId}/analyze`, {
      version_label: versionLabel,
    });
    return res.data;
  },

  getAnalysisRun: async (runId) => {
    const res = await apiClient.get(`/analysis/${runId}`);
    return res.data.data;
  },

  getAnalysisMetrics: async (runId) => {
    const res = await apiClient.get(`/analysis/${runId}/metrics`);
    return res.data.data;
  },

  getAnalysisCorrelations: async (runId) => {
    const res = await apiClient.get(`/analysis/${runId}/correlations`);
    return res.data.data;
  },

  getAnalysisRisks: async (runId) => {
    const res = await apiClient.get(`/analysis/${runId}/risks`);
    return res.data.data;
  },

  getAnalysisPriorities: async (runId) => {
    const res = await apiClient.get(`/analysis/${runId}/priorities`);
    return res.data.data;
  },

  getProjectHistory: async (projectId) => {
    const res = await apiClient.get(`/projects/${projectId}/history`);
    return res.data.data;
  },

  getAllHistory: async () => {
    const res = await apiClient.get('/history');
    return res.data.data;
  },

  compareRuns: async (projectId, firstRunId, secondRunId) => {
    const res = await apiClient.get(`/projects/${projectId}/compare`, {
      params: { first: firstRunId, second: secondRunId },
    });
    return res.data.data;
  },

  getReportDownloadUrl: (runId) => `${API_BASE_URL}/analysis/${runId}/report`,

  downloadReportBlob: async (runId) => {
    const res = await apiClient.get(`/analysis/${runId}/report`, {
      responseType: 'blob',
    });
    return res;
  },

  getSettings: async () => {
    const res = await apiClient.get('/settings');
    return res.data.data;
  },

  updateSettings: async (settingsPayload) => {
    const res = await apiClient.put('/settings', settingsPayload);
    return res.data;
  },

  resetSettings: async () => {
    const res = await apiClient.post('/settings/reset');
    return res.data;
  },

  listSamples: async () => {
    const res = await apiClient.get('/samples');
    return res.data.data;
  },

  analyzeSample: async (sampleId, projectId = null) => {
    const res = await apiClient.post(`/samples/${sampleId}/analyze`, {
      project_id: projectId,
    });
    return res.data;
  },

  getSampleDownloadUrl: (sampleId) => `${API_BASE_URL}/samples/${sampleId}/download`,
};
