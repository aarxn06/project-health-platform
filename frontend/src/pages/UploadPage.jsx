import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileArchive,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  X,
  Download,
  Sparkles,
  ArrowLeft,
  FolderPlus,
  RefreshCw,
} from 'lucide-react';
import { platformApi, extractApiError } from '../services/api';
import { usePlatform } from '../context/PlatformContext';
import { Card, CardHeader, StatusChip, ErrorBanner } from '../components/ui';

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { projects, activeProject, refreshPlatformState } = usePlatform();

  const [uploadMode, setUploadMode] = useState('new'); // 'new' or 'existing'
  const [selectedProjectId, setSelectedProjectId] = useState(activeProject?.id || '');
  const [projectName, setProjectName] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [maxUploadMb, setMaxUploadMb] = useState(25);
  const [samples, setSamples] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [uploadSuccessResult, setUploadSuccessResult] = useState(null);

  useEffect(() => {
    async function fetchUploadMeta() {
      try {
        const [settingsData, sampleList] = await Promise.all([
          platformApi.getSettings(),
          platformApi.listSamples(),
        ]);
        const maxMb = settingsData?.settings?.upload_limits?.value?.max_upload_size_mb;
        if (maxMb) setMaxUploadMb(maxMb);
        setSamples(sampleList || []);
      } catch {
        // Ignore non-critical metadata load error
      }
    }
    fetchUploadMeta();
  }, []);

  useEffect(() => {
    if (activeProject?.id && !selectedProjectId) {
      setSelectedProjectId(activeProject.id);
    }
  }, [activeProject, selectedProjectId]);

  const validateAndSelectFile = (file) => {
    setValidationError(null);
    setUploadSuccessResult(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setValidationError(
        `Invalid file type ("${file.name}"). Only .zip archives containing Java source code (.java) are supported.`
      );
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setValidationError('The selected ZIP archive is empty (0 bytes).');
      setSelectedFile(null);
      return;
    }

    const maxBytes = maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setValidationError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the configured limit of ${maxUploadMb} MB.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!projectName && uploadMode === 'new') {
      const inferred = file.name
        .replace(/\.zip$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      setProjectName(inferred);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setValidationError('Please select a Java .zip archive to upload.');
      return;
    }

    if (uploadMode === 'existing' && !selectedProjectId) {
      setValidationError('Please select an existing project to attach this new analysis run to.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(5);
      setValidationError(null);
      setUploadSuccessResult(null);
      setStatusMessage('Uploading ZIP archive and validating archive structure...');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('auto_analyze', 'true');

      if (uploadMode === 'existing') {
        formData.append('project_id', String(selectedProjectId));
      } else {
        formData.append('project_name', projectName.trim() || 'Java Project');
        formData.append('description', description.trim());
      }

      if (versionLabel.trim()) {
        formData.append('version_label', versionLabel.trim());
      }

      const response = await platformApi.uploadProject(formData, (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded * 70) / progressEvent.total);
          setUploadProgress(Math.max(10, pct));
          if (pct >= 65) {
            setStatusMessage(
              'Extracting Java ASTs, computing Cyclomatic Complexity & Health Score...'
            );
          }
        }
      });

      setUploadProgress(100);
      setStatusMessage('Analysis completed and persisted to SQLite!');
      const resData = response.data;
      setUploadSuccessResult(resData);
      await refreshPlatformState(resData.project?.id, resData.analysis_run?.id);
    } catch (err) {
      setValidationError(extractApiError(err));
      setUploadProgress(0);
      setStatusMessage('');
    } finally {
      setUploading(false);
    }
  };

  const handleRunBuiltInSample = async (sampleId) => {
    try {
      setUploading(true);
      setValidationError(null);
      setUploadSuccessResult(null);
      setUploadProgress(40);
      setStatusMessage(`Analyzing built-in Java sample archive (${sampleId})...`);

      const targetProjId =
        uploadMode === 'existing' && selectedProjectId ? Number(selectedProjectId) : null;
      const response = await platformApi.analyzeSample(sampleId, targetProjId);
      setUploadProgress(100);
      const resData = response.data;
      setUploadSuccessResult(resData);
      await refreshPlatformState(resData.project?.id, resData.analysis_run?.id);
    } catch (err) {
      setValidationError(extractApiError(err));
    } finally {
      setUploading(false);
      setStatusMessage('');
    }
  };

  const handleResetForm = () => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadSuccessResult(null);
    setUploadProgress(0);
    setStatusMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="ui-btn-secondary px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#A1A1AA]" />
          <span>Back to Dashboard</span>
        </button>

        <span className="text-[11px] font-mono text-[#6B6B76] bg-[#0E0E11] px-2.5 py-1 rounded-md border border-[#1F1F25]">
          Max Upload Limit: {maxUploadMb} MB (.zip)
        </span>
      </div>

      {/* Main Upload Form Card */}
      <Card padding="p-5 sm:p-6">
        <CardHeader
          title="Java Project ZIP Archive Ingestion"
          icon={UploadCloud}
          tooltip="Uploads and safely extracts a .zip archive containing Java (.java) source files. Includes automatic zip-slip path traversal rejection and zip-bomb size limits."
        />

        {/* Mode Selector: New Project vs Append Run to Existing Project */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setUploadMode('new')}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
              uploadMode === 'new'
                ? 'border-[#7C5CFF] bg-[rgba(124,92,255,0.12)]'
                : 'border-[#1F1F25] bg-[#0E0E11] hover:border-[#2A2A32]'
            }`}
          >
            <FolderPlus
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                uploadMode === 'new' ? 'text-[#7C5CFF]' : 'text-[#6B6B76]'
              }`}
            />
            <div>
              <div className="text-xs font-semibold text-[#F4F4F5]">Create New Project</div>
              <div className="text-[11px] text-[#A1A1AA] mt-0.5">
                Upload a Java ZIP archive to initialize a new project and execute Run #1
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setUploadMode('existing')}
            disabled={projects.length === 0}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
              projects.length === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            } ${
              uploadMode === 'existing'
                ? 'border-[#7C5CFF] bg-[rgba(124,92,255,0.12)]'
                : 'border-[#1F1F25] bg-[#0E0E11] hover:border-[#2A2A32]'
            }`}
          >
            <RefreshCw
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                uploadMode === 'existing' ? 'text-[#7C5CFF]' : 'text-[#6B6B76]'
              }`}
            />
            <div>
              <div className="text-xs font-semibold text-[#F4F4F5]">
                Append Run to Existing Project (Before / After)
              </div>
              <div className="text-[11px] text-[#A1A1AA] mt-0.5">
                Upload a refactored ZIP version to compare improvements against a previous run
              </div>
            </div>
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {uploadMode === 'new' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., E-Commerce Order Engine"
                  className="w-full px-3 py-2 ui-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Version / Run Label (Optional)
                </label>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="e.g., v1.0 Baseline Snapshot"
                  className="w-full px-3 py-2 ui-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Project Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief architectural context or evaluation notes..."
                  className="w-full px-3 py-2 ui-input"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Target Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 ui-input"
                >
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.run_count} existing runs)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  New Run Version Label
                </label>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="e.g., v2.0 Post-Refactoring"
                  className="w-full px-3 py-2 ui-input"
                />
              </div>
            </div>
          )}

          {/* Drag-and-Drop Zone (Section 2.6: dashed --border-strong border on --bg-card, violet border & glow on drag-over) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive
                ? 'border-[#7C5CFF] bg-[rgba(124,92,255,0.08)] shadow-[0_0_28px_rgba(124,92,255,0.22)]'
                : selectedFile
                ? 'border-[#22C55E]/60 bg-[#22C55E]/5'
                : 'border-[#2A2A32] bg-[#111114] hover:border-[#7C5CFF]/60 hover:bg-[#16161A]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => validateAndSelectFile(e.target.files?.[0])}
              className="hidden"
              data-testid="zip-file-input"
            />

            {!selectedFile ? (
              <div className="space-y-2">
                <div className="w-11 h-11 rounded-xl bg-[#0E0E11] border border-[#2A2A32] flex items-center justify-center mx-auto text-[#7C5CFF]">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold text-[#F4F4F5]">
                  Drag and drop your Java project <span className="font-mono text-[#7C5CFF]">.zip</span> archive here
                </div>
                <div className="text-xs text-[#A1A1AA]">
                  or{' '}
                  <span className="text-[#7C5CFF] font-semibold underline">
                    browse files from your computer
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#6B6B76] pt-1">
                  Supported format: .zip containing .java source files · Max size: {maxUploadMb} MB
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-between max-w-md mx-auto bg-[#0E0E11] p-3.5 rounded-xl border border-[#22C55E]/40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <FileArchive className="w-6 h-6 text-[#22C55E] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold font-mono text-[#F4F4F5] truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[11px] font-mono text-[#A1A1AA]">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Ready for AST extraction
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={uploading}
                  className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#EF4444] hover:bg-[#16161A] cursor-pointer"
                  title="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Progress Bar in Violet (Section 2.6) */}
          {uploading && (
            <div className="p-4 rounded-xl bg-[#0E0E11] border border-[#7C5CFF]/35 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-[#F4F4F5]">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7C5CFF]" />
                  <span>{statusMessage || 'Analyzing Java source files...'}</span>
                </span>
                <span className="font-mono text-[#7C5CFF]">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#111114] rounded-full overflow-hidden border border-[#1F1F25]">
                <div
                  className="h-full bg-[#7C5CFF] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Validation Error Alert */}
          {validationError && (
            <ErrorBanner
              title="Archive Validation or Upload Error"
              message={validationError}
              onDismiss={() => setValidationError(null)}
            />
          )}

          {/* Upload & Analysis Success Result Card */}
          {uploadSuccessResult && (
            <div className="p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/35 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-[#F4F4F5]">
                      Analysis Completed — {uploadSuccessResult.project?.name} (
                      {uploadSuccessResult.analysis_run?.version_label})
                    </div>
                    <div className="text-xs text-[#A1A1AA] mt-0.5">
                      Extracted metrics for {uploadSuccessResult.analysis_run?.parsed_files} of{' '}
                      {uploadSuccessResult.analysis_run?.total_files} Java files · Overall Health
                      Score:{' '}
                      <span className="font-mono font-semibold text-[#22C55E]">
                        {uploadSuccessResult.analysis_run?.health_score}/100 (Grade{' '}
                        {uploadSuccessResult.analysis_run?.health_grade})
                      </span>
                    </div>
                  </div>
                </div>
                <StatusChip status="Completed" variant="success" size="xs" />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="ui-btn-primary px-3.5 py-1.5 text-xs cursor-pointer"
                >
                  Open Interactive Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/analysis')}
                  className="ui-btn-secondary px-3.5 py-1.5 text-xs cursor-pointer"
                >
                  Inspect File Metrics
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/priorities')}
                  className="ui-btn-secondary px-3.5 py-1.5 text-xs cursor-pointer"
                >
                  View Refactoring Priorities
                </button>
              </div>
            </div>
          )}

          {/* Submit & Cancel Controls */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              disabled={uploading}
              className="ui-btn-secondary px-4 py-2 text-xs cursor-pointer disabled:opacity-50"
            >
              Clear / Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="ui-btn-primary px-5 py-2 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Archive...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Analyze Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      {/* Built-in Sample Java Archives in data/ for Live Demonstration */}
      {samples.length > 0 && (
        <Card padding="p-5">
          <CardHeader
            title="Built-In Real Java Sample Archives (data/ Directory)"
            icon={Sparkles}
            tooltip="Pre-packaged real Java source archives in data/ for immediate live demonstration and Before-and-After refactoring comparison."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {samples.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#F4F4F5]">{s.version_label}</span>
                    <span className="ui-code-pill text-[10px] text-[#7C5CFF]">{s.filename}</span>
                  </div>
                  <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed">{s.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1F1F25]">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => handleRunBuiltInSample(s.id)}
                    className="ui-btn-primary px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                  >
                    Analyze {s.id.toUpperCase()} Archive Now
                  </button>
                  <a
                    href={platformApi.getSampleDownloadUrl(s.id)}
                    className="ui-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span>Download .zip</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Security Safeguards Note */}
      <Card padding="p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
          <div className="text-xs text-[#A1A1AA] leading-relaxed">
            <span className="font-semibold text-[#F4F4F5]">
              Archive Extraction & Security Safeguards:
            </span>{' '}
            Uploaded archives are inspected prior to extraction. Path traversal sequences (
            <code className="ui-code-pill">../</code>), absolute paths, non-ZIP payloads, and
            archives without <code className="ui-code-pill">.java</code> files are rejected.
            Uploaded Java code is parsed statically via AST and is never compiled or executed.
          </div>
        </div>
      </Card>
    </div>
  );
}
