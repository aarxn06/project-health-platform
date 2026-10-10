import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlatformProvider } from './context/PlatformContext';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ProjectAnalysisPage from './pages/ProjectAnalysisPage';
import MetricsExplorerPage from './pages/MetricsExplorerPage';
import RiskDebtPage from './pages/RiskDebtPage';
import RefactoringPrioritiesPage from './pages/RefactoringPrioritiesPage';
import HistoryComparePage from './pages/HistoryComparePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <PlatformProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/analysis" element={<ProjectAnalysisPage />} />
            <Route path="/metrics" element={<MetricsExplorerPage />} />
            <Route path="/risks" element={<RiskDebtPage />} />
            <Route path="/priorities" element={<RefactoringPrioritiesPage />} />
            <Route path="/history" element={<HistoryComparePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </PlatformProvider>
  );
}
