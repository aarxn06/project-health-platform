import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { platformApi, extractApiError } from '../services/api';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [projectRuns, setProjectRuns] = useState([]);
  const [healthInfo, setHealthInfo] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  const loadProjectDetails = useCallback(async (projectId, preferredRunId = null) => {
    try {
      const detail = await platformApi.getProject(projectId);
      setActiveProject(detail);
      const runs = detail.runs || [];
      setProjectRuns(runs);
      if (runs.length > 0) {
        const chosen = preferredRunId
          ? runs.find((r) => r.id === Number(preferredRunId)) || runs[0]
          : runs[0];
        setActiveRun(chosen);
      } else {
        setActiveRun(null);
      }
      return detail;
    } catch (err) {
      setGlobalError(extractApiError(err));
      return null;
    }
  }, []);

  const refreshPlatformState = useCallback(
    async (selectProjectId = null, selectRunId = null) => {
      try {
        setGlobalError(null);
        const [health, projList] = await Promise.all([
          platformApi.getHealth(),
          platformApi.listProjects(),
        ]);
        setHealthInfo(health);
        setProjects(projList || []);

        if (projList && projList.length > 0) {
          const targetProjectId =
            selectProjectId ||
            (activeProject && projList.some((p) => p.id === activeProject.id)
              ? activeProject.id
              : projList[0].id);
          await loadProjectDetails(targetProjectId, selectRunId);
        } else {
          setActiveProject(null);
          setActiveRun(null);
          setProjectRuns([]);
        }
      } catch (err) {
        setGlobalError(extractApiError(err));
      } finally {
        setLoadingInitial(false);
      }
    },
    [activeProject, loadProjectDetails]
  );

  useEffect(() => {
    refreshPlatformState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProjectAndRun = async (projectId, runId = null) => {
    await loadProjectDetails(projectId, runId);
  };

  const selectRunOnly = (runId) => {
    const found = projectRuns.find((r) => r.id === Number(runId));
    if (found) {
      setActiveRun(found);
    }
  };

  return (
    <PlatformContext.Provider
      value={{
        projects,
        activeProject,
        activeRun,
        projectRuns,
        healthInfo,
        loadingInitial,
        globalError,
        setGlobalError,
        refreshPlatformState,
        selectProjectAndRun,
        selectRunOnly,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return ctx;
}
