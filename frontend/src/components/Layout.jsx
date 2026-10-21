import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  FileCode2,
  BarChart3,
  ShieldAlert,
  ListOrdered,
  History,
  FileText,
  Settings,
  Cpu,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { formatTimestamp } from '../utils/formatters';
import { ErrorBoundary } from './ui';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upload', label: 'Upload Project', icon: UploadCloud },
  { path: '/analysis', label: 'Project Analysis', icon: FileCode2 },
  { path: '/metrics', label: 'Metrics Explorer', icon: BarChart3 },
  { path: '/risks', label: 'Risk & Technical Debt', icon: ShieldAlert },
  { path: '/priorities', label: 'Refactoring Priorities', icon: ListOrdered },
  { path: '/history', label: 'Project History', icon: History },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const PAGE_META = {
  '/': {
    title: 'Dashboard',
    breadcrumb: 'Dashboard',
    subtitle: 'Java AST static analysis overview, risk distribution, and longitudinal health telemetry',
  },
  '/upload': {
    title: 'Upload Project',
    breadcrumb: 'Upload Project',
    subtitle: 'Safe ZIP archive ingestion, path-traversal protection, and AST metric extraction',
  },
  '/analysis': {
    title: 'Project Analysis',
    breadcrumb: 'Project Analysis',
    subtitle: 'Project-level and file-level Java AST metrics, complexity profiles, and code-smell diagnostics',
  },
  '/metrics': {
    title: 'Metrics Explorer',
    breadcrumb: 'Metrics Explorer',
    subtitle: 'Empirical distributions, quartile box plots, scatter relationships, and Pearson correlations',
  },
  '/risks': {
    title: 'Risk & Technical Debt',
    breadcrumb: 'Risk & Technical Debt',
    subtitle: 'File-level risk categories, contributing software metrics, and remediation guidance',
  },
  '/priorities': {
    title: 'Refactoring Priorities',
    breadcrumb: 'Refactoring Priorities',
    subtitle: 'Transparent multi-criteria file ranking, supporting metrics, and improvement effort bands',
  },
  '/history': {
    title: 'Project History',
    breadcrumb: 'Project History',
    subtitle: 'Persistent analysis run audit trail and before-and-after run comparison',
  },
  '/reports': {
    title: 'Reports',
    breadcrumb: 'Reports',
    subtitle: 'Printable academic and engineering PDF quality evaluation reports via ReportLab',
  },
  '/settings': {
    title: 'Settings',
    breadcrumb: 'Settings',
    subtitle: 'Configure upload limits, health-score weights, risk thresholds, and ML model integration',
  },
};

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const {
    projects,
    activeProject,
    activeRun,
    projectRuns,
    healthInfo,
    globalError,
    refreshPlatformState,
    selectProjectAndRun,
    selectRunOnly,
  } = usePlatform();

  const currentMeta = PAGE_META[location.pathname] || PAGE_META['/'];
  const backendHealthy = healthInfo?.status === 'healthy' && !globalError;
  const mlAvailable = healthInfo?.ml_status?.is_available;

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshPlatformState(activeProject?.id, activeRun?.id);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0A0A0C] text-[#F4F4F5] selection:bg-[#7C5CFF]/25 selection:text-[#F4F4F5]">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Fixed Left Sidebar (Section 2.2: ~240px, collapsible to icons, #08080A bg, 1px #1F1F25 right border) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#08080A] text-[#F4F4F5] flex flex-col border-r border-[#1F1F25] transition-all duration-150 lg:static lg:translate-x-0 shrink-0 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } ${mobileOpen ? 'translate-x-0 w-60' : '-translate-x-full'}`}
      >
        {/* Brand Header with soft violet glow behind logo */}
        <div className="h-14 px-3.5 border-b border-[#1F1F25] flex items-center justify-between shrink-0">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group min-w-0"
            title="AI-Driven Software Engineering Metrics & Project Health Intelligence Platform"
          >
            <div className="relative w-7 h-7 rounded-lg bg-[#111114] border border-[#7C5CFF]/45 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(124,92,255,0.35)]">
              <Cpu className="w-4 h-4 text-[#7C5CFF]" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-tight text-[#F4F4F5] leading-tight group-hover:text-[#7C5CFF] transition-colors truncate">
                  HealthIntel AI
                </div>
                <div className="text-[10px] text-[#6B6B76] font-medium truncate">
                  SE Metrics & Quality Platform
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex p-1 rounded-md text-[#6B6B76] hover:text-[#F4F4F5] hover:bg-[#16161A] transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-[#A1A1AA] hover:text-[#F4F4F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
          <div>
            {!sidebarCollapsed && (
              <div className="px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B6B76]">
                Analytics & Workspace
              </div>
            )}
            <nav className="space-y-0.5" aria-label="Primary Navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-[rgba(124,92,255,0.12)] text-[#F4F4F5]'
                          : 'text-[#A1A1AA] hover:bg-[#16161A] hover:text-[#F4F4F5]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#7C5CFF]"
                            aria-hidden="true"
                          />
                        )}
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#7C5CFF]' : 'text-[#6B6B76]'
                          }`}
                        />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: Current Project & Backend Connection Status (Section 3A) */}
        <div className="p-2.5 border-t border-[#1F1F25] bg-[#08080A] space-y-2 shrink-0">
          {!sidebarCollapsed ? (
            <div className="p-2.5 rounded-lg bg-[#111114] border border-[#1F1F25] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A1A1AA] font-medium">Active Project</span>
                <span className="font-mono text-[10px] text-[#7C5CFF] truncate max-w-[110px]">
                  {activeProject ? activeProject.name : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A1A1AA] font-medium">Backend API</span>
                <span
                  className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold ${
                    backendHealthy ? 'text-[#22C55E]' : 'text-[#EF4444]'
                  }`}
                >
                  {backendHealthy ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      <span>Offline</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A1A1AA] font-medium">Scoring Mode</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                    mlAvailable
                      ? 'bg-[#4C8DFF]/12 text-[#4C8DFF] border-[#4C8DFF]/30'
                      : 'bg-[#EAB308]/12 text-[#EAB308] border-[#EAB308]/30'
                  }`}
                >
                  {mlAvailable ? 'ML Active' : 'Rule-Based'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <span
                title={backendHealthy ? 'Backend API: Connected' : 'Backend API: Offline'}
                className={`w-2.5 h-2.5 rounded-full ${
                  backendHealthy ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                }`}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0C]">
        {/* Slim Top Header (Section 2.2) */}
        <header className="sticky top-0 z-30 bg-[#0A0A0C]/90 backdrop-blur-md border-b border-[#1F1F25] px-4 lg:px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Title, Breadcrumbs, and Status Line */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')}
                aria-label="Go back to previous page"
                title="Back"
                className="p-1.5 rounded-lg bg-[#111114] border border-[#1F1F25] text-[#A1A1AA] hover:text-[#F4F4F5] hover:border-[#7C5CFF]/50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-1.5 rounded-lg bg-[#111114] border border-[#1F1F25] text-[#A1A1AA] hover:text-[#F4F4F5]"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                {/* Breadcrumb trail */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B6B76]">
                  <span>Platform</span>
                  <ChevronRight className="w-3 h-3 text-[#6B6B76]" />
                  <span className="text-[#A1A1AA] font-medium">{currentMeta.breadcrumb}</span>
                </div>

                {/* Page Title */}
                <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                  <h1 className="text-base sm:text-lg font-semibold text-[#F4F4F5] tracking-tight truncate">
                    {currentMeta.title}
                  </h1>
                </div>

                {/* Status line under the title (Section 2.2 & 2.4) */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      backendHealthy ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        backendHealthy ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                      }`}
                    />
                    <span>
                      Analysis Status: {backendHealthy ? 'Healthy' : 'Backend Unavailable'}
                    </span>
                  </span>

                  {activeProject && activeRun && (
                    <>
                      <span className="text-[#6B6B76]">|</span>
                      <span className="text-[#A1A1AA]">
                        Project: <strong className="text-[#F4F4F5] font-medium">{activeProject.name}</strong>
                        {' | '}
                        <strong className="text-[#F4F4F5] font-medium">{activeProject.language || 'Java'}</strong>
                        {' | '}Last analyzed:{' '}
                        <span className="font-mono text-[#A1A1AA]">
                          {formatTimestamp(activeRun.created_at)}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Project Selector, Run Selector, Refresh, and "New Analysis" Primary Button */}
            <div className="flex flex-wrap items-center gap-2">
              {projects.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#0E0E11] border border-[#1F1F25] hover:border-[#2A2A32] rounded-lg px-2.5 py-1.5 transition-colors">
                  <FolderGit2 className="w-3.5 h-3.5 text-[#7C5CFF] shrink-0" />
                  <select
                    aria-label="Active Project Selector"
                    value={activeProject?.id || ''}
                    onChange={(e) => selectProjectAndRun(Number(e.target.value))}
                    className="bg-transparent text-xs font-medium text-[#F4F4F5] focus:outline-none cursor-pointer max-w-[170px] truncate"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#111114] text-[#F4F4F5]">
                        {p.name} ({p.run_count} {p.run_count === 1 ? 'run' : 'runs'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {projectRuns.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#0E0E11] border border-[#1F1F25] hover:border-[#2A2A32] rounded-lg px-2.5 py-1.5 transition-colors">
                  <History className="w-3.5 h-3.5 text-[#4C8DFF] shrink-0" />
                  <select
                    aria-label="Active Analysis Run Selector"
                    value={activeRun?.id || ''}
                    onChange={(e) => selectRunOnly(Number(e.target.value))}
                    className="bg-transparent text-xs font-mono text-[#F4F4F5] focus:outline-none cursor-pointer max-w-[190px] truncate"
                  >
                    {projectRuns.map((r) => (
                      <option key={r.id} value={r.id} className="bg-[#111114] text-[#F4F4F5]">
                        Run #{r.run_number} — {r.version_label} ({r.health_score}/100)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                title="Refresh project & telemetry state"
                className="ui-btn-secondary p-1.5 text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#7C5CFF]' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="ui-btn-primary px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Analysis</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Body wrapped in ErrorBoundary */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <ErrorBoundary resetKey={location.pathname} onRetry={handleManualRefresh}>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
