import { useState, useEffect, useCallback } from 'react';
import { platformApi, extractApiError } from '../services/api';

/**
 * Custom React hook to fetch and manage the unified dashboard payload
 * from GET /api/dashboard?project_id=<id>&run_id=<id>.
 */
export function useDashboardData(projectId, runId) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!projectId) {
      setDashboard(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await platformApi.getDashboard(projectId, runId);
      setDashboard(data);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, runId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    reloadDashboard: fetchDashboard,
  };
}

