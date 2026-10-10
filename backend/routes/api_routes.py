import io
import os
import shutil
import uuid
from datetime import datetime, timezone
from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename

from database import db
from database.models import Project, AnalysisRun, FileMetric, RiskAssessment, Recommendation
from database.repository import SettingsRepository
from analyzer.archive_handler import ArchiveValidationError, validate_and_extract_zip, cleanup_extracted_dir
from services.analysis_service import execute_project_analysis
from services.dashboard_service import build_dashboard_payload
from services.statistics_service import compute_metrics_analytics, compute_correlation_matrix
from services.comparison_service import compare_analysis_runs
from services.sample_data_service import ensure_sample_archives
from reports.pdf_generator import generate_analysis_pdf_report
from ml.predictor import MLDefectPredictionService

api_bp = Blueprint("api", __name__, url_prefix="/api")


def api_success(data=None, message: str = "OK", status_code: int = 200):
    return jsonify({"success": True, "message": message, "data": data}), status_code


def api_error(message: str, code: str = "BAD_REQUEST", status_code: int = 400):
    return (
        jsonify(
            {
                "success": False,
                "error": {
                    "code": code,
                    "message": message,
                },
            }
        ),
        status_code,
    )


@api_bp.route("/health", methods=["GET"])
def health_check():
    """Application health and subsystem status check."""
    ml_config = SettingsRepository.get_setting_value("ml_configuration")
    ml_service = MLDefectPredictionService(
        base_dir=current_app.config["BASE_DIR"],
        model_rel_path=ml_config.get("model_path"),
        metadata_rel_path=ml_config.get("metadata_path"),
    )
    project_count = Project.query.count()
    run_count = AnalysisRun.query.count()
    return api_success(
        {
            "status": "healthy",
            "service": "AI-Driven Software Engineering Metrics & Project Health Intelligence Platform",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "connected",
            "projects_count": project_count,
            "analysis_runs_count": run_count,
            "ml_status": ml_service.get_status(),
        },
        message="Backend service is healthy.",
    )


@api_bp.route("/dashboard", methods=["GET"])
def get_dashboard_summary():
    """
    Retrieve all values needed by the Section 2.4 Dashboard in one response:
    KPI cards, sparkline history series, Code Stability Overview (with risk distribution),
    Top Refactoring Priorities, Quality Trend, Recent Analysis Activity,
    Complexity / Code-Smell Breakdown, and Footer Metric Strip.
    """
    project_id = request.args.get("project_id", type=int)
    run_id = request.args.get("run_id", type=int)
    if project_id is not None:
        proj = db.session.get(Project, project_id)
        if not proj:
            return api_error(f"Project with ID {project_id} was not found.", "PROJECT_NOT_FOUND", 404)
    payload = build_dashboard_payload(project_id=project_id, run_id=run_id)
    return api_success(payload)


@api_bp.route("/projects", methods=["GET"])
def list_projects():
    """List all stored projects ordered by most recently updated."""
    projects = Project.query.order_by(Project.updated_at.desc()).all()
    return api_success([p.to_dict(include_latest_run=True) for p in projects])


@api_bp.route("/projects/<int:project_id>", methods=["GET"])
def get_project(project_id: int):
    """Retrieve a single project's details and all its analysis run summaries."""
    project = db.session.get(Project, project_id)
    if not project:
        return api_error(f"Project with ID {project_id} was not found.", "PROJECT_NOT_FOUND", 404)

    data = project.to_dict(include_latest_run=True)
    data["runs"] = [r.to_summary_dict() for r in project.analysis_runs]
    return api_success(data)


@api_bp.route("/projects/<int:project_id>", methods=["DELETE"])
def delete_project(project_id: int):
    """Delete a project and its associated analysis runs."""
    project = db.session.get(Project, project_id)
    if not project:
        return api_error(f"Project with ID {project_id} was not found.", "PROJECT_NOT_FOUND", 404)

    if project.archive_path and os.path.exists(project.archive_path):
        try:
            os.remove(project.archive_path)
        except OSError:
            pass

    db.session.delete(project)
    db.session.commit()
    return api_success({"deleted_project_id": project_id}, message="Project deleted successfully.")


@api_bp.route("/projects/upload", methods=["POST"])
def upload_project():
    """
    Upload and validate a Java ZIP archive.
    Supports:
    - Creating a new project or attaching a new archive to an existing project (via form field 'project_id')
    - Optional immediate analysis execution (default: auto_analyze='true')
    """
    if "file" not in request.files:
        return api_error(
            "No file part in the request. Please attach a .zip archive under the 'file' field.",
            "MISSING_FILE",
            400,
        )

    uploaded_file = request.files["file"]
    if not uploaded_file or not uploaded_file.filename:
        return api_error("No file selected for upload.", "EMPTY_FILENAME", 400)

    raw_filename = uploaded_file.filename
    if not raw_filename.lower().endswith(".zip"):
        return api_error(
            "Unsupported file type. Only .zip archives containing Java source code (.java) are accepted.",
            "INVALID_EXTENSION",
            400,
        )

    safe_name = secure_filename(raw_filename) or "project.zip"
    unique_filename = f"{uuid.uuid4().hex[:10]}_{safe_name}"
    uploads_dir = current_app.config["UPLOADS_DIR"]
    os.makedirs(uploads_dir, exist_ok=True)
    saved_zip_path = os.path.join(uploads_dir, unique_filename)

    try:
        uploaded_file.save(saved_zip_path)
    except Exception as exc:
        return api_error(f"Failed to save uploaded archive: {str(exc)}", "UPLOAD_SAVE_ERROR", 500)

    upload_limits = SettingsRepository.get_setting_value("upload_limits")
    temp_extract_root = current_app.config["TEMP_EXTRACT_DIR"]
    os.makedirs(temp_extract_root, exist_ok=True)

    # Pre-validate the ZIP archive (size, path traversal, Java file existence)
    extract_dir = None
    try:
        extract_dir, java_files = validate_and_extract_zip(
            zip_path=saved_zip_path,
            max_upload_size_mb=float(upload_limits.get("max_upload_size_mb", 25.0)),
            max_extracted_files=int(upload_limits.get("max_extracted_files", 2000)),
            max_extracted_size_mb=float(upload_limits.get("max_extracted_size_mb", 100.0)),
            base_temp_dir=temp_extract_root,
        )
    except ArchiveValidationError as ave:
        if os.path.exists(saved_zip_path):
            os.remove(saved_zip_path)
        return api_error(ave.message, ave.code, ave.status_code)
    finally:
        if extract_dir:
            cleanup_extracted_dir(extract_dir)

    archive_size = os.path.getsize(saved_zip_path)
    existing_project_id = request.form.get("project_id")
    project_name = (request.form.get("project_name") or "").strip()
    description = (request.form.get("description") or "").strip()
    version_label = (request.form.get("version_label") or "").strip()
    auto_analyze = request.form.get("auto_analyze", "true").lower() != "false"

    if existing_project_id:
        try:
            pid = int(existing_project_id)
        except ValueError:
            if os.path.exists(saved_zip_path):
                os.remove(saved_zip_path)
            return api_error("Invalid project_id parameter.", "INVALID_PROJECT_ID", 400)

        project = db.session.get(Project, pid)
        if not project:
            if os.path.exists(saved_zip_path):
                os.remove(saved_zip_path)
            return api_error(f"Project with ID {pid} was not found.", "PROJECT_NOT_FOUND", 404)

        project.archive_filename = safe_name
        project.archive_path = saved_zip_path
        project.archive_size_bytes = archive_size
        if description:
            project.description = description
        db.session.commit()
    else:
        if not project_name:
            project_name = os.path.splitext(safe_name)[0].replace("-", " ").replace("_", " ").title()
        project = Project(
            name=project_name,
            description=description or f"Uploaded from {safe_name} ({len(java_files)} Java files)",
            language="Java",
            archive_filename=safe_name,
            archive_path=saved_zip_path,
            archive_size_bytes=archive_size,
        )
        db.session.add(project)
        db.session.commit()

    analysis_run = None
    if auto_analyze:
        try:
            analysis_run = execute_project_analysis(
                project=project,
                zip_path=saved_zip_path,
                version_label=version_label or f"Run #{len(project.analysis_runs) + 1} ({safe_name})",
                archive_filename=safe_name,
                base_dir=current_app.config["BASE_DIR"],
                temp_extract_root=temp_extract_root,
            )
        except ArchiveValidationError as ave:
            return api_error(ave.message, ave.code, ave.status_code)
        except Exception as exc:
            return api_error(f"Analysis failed: {str(exc)}", "ANALYSIS_FAILED", 500)

    return api_success(
        {
            "project": project.to_dict(include_latest_run=True),
            "analysis_run": analysis_run.to_summary_dict() if analysis_run else None,
            "discovered_java_files_count": len(java_files),
        },
        message="Java project archive uploaded and analyzed successfully."
        if analysis_run
        else "Java project archive uploaded and validated.",
        status_code=201,
    )


@api_bp.route("/projects/<int:project_id>/analyze", methods=["POST"])
def analyze_project_endpoint(project_id: int):
    """
    Initiate a new analysis run on an existing project using its stored archive
    and the current scoring/threshold settings.
    """
    project = db.session.get(Project, project_id)
    if not project:
        return api_error(f"Project with ID {project_id} was not found.", "PROJECT_NOT_FOUND", 404)

    if not project.archive_path or not os.path.exists(project.archive_path):
        return api_error(
            "Stored archive file for this project is no longer available on disk. Please upload a new ZIP archive.",
            "ARCHIVE_MISSING",
            400,
        )

    payload = request.get_json(silent=True) or {}
    version_label = payload.get("version_label") or f"Run #{len(project.analysis_runs) + 1} (Re-Analysis)"

    try:
        run = execute_project_analysis(
            project=project,
            zip_path=project.archive_path,
            version_label=version_label,
            archive_filename=project.archive_filename,
            base_dir=current_app.config["BASE_DIR"],
            temp_extract_root=current_app.config["TEMP_EXTRACT_DIR"],
        )
        return api_success(
            {
                "project": project.to_dict(include_latest_run=True),
                "analysis_run": run.to_summary_dict(),
            },
            message="Project analysis completed successfully.",
            status_code=201,
        )
    except ArchiveValidationError as ave:
        return api_error(ave.message, ave.code, ave.status_code)
    except Exception as exc:
        return api_error(f"Failed to analyze project: {str(exc)}", "ANALYSIS_ERROR", 500)


@api_bp.route("/analysis/<int:run_id>", methods=["GET"])
def get_analysis_run(run_id: int):
    """Retrieve complete analysis status, summary, and file-level metrics for a run."""
    run = db.session.get(AnalysisRun, run_id)
    if not run:
        return api_error(f"Analysis run with ID {run_id} was not found.", "ANALYSIS_NOT_FOUND", 404)

    files = [fm.to_dict(include_details=True) for fm in run.file_metrics]
    data = run.to_summary_dict()
    data["files"] = files
    return api_success(data)


@api_bp.route("/analysis/<int:run_id>/metrics", methods=["GET"])
def get_analysis_metrics(run_id: int):
    """Retrieve statistical summaries, histograms, box plots, and scatter data for an analysis run."""
    run = db.session.get(AnalysisRun, run_id)
    if not run:
        return api_error(f"Analysis run with ID {run_id} was not found.", "ANALYSIS_NOT_FOUND", 404)

    file_dicts = [fm.to_dict(include_details=False) for fm in run.file_metrics]
    analytics = compute_metrics_analytics(file_dicts)
    analytics["analysis_run"] = run.to_summary_dict()
    return api_success(analytics)


@api_bp.route("/analysis/<int:run_id>/correlations", methods=["GET"])
def get_analysis_correlations(run_id: int):
    """Retrieve the Pearson correlation matrix and notable feature relationships for an analysis run."""
    run = db.session.get(AnalysisRun, run_id)
    if not run:
        return api_error(f"Analysis run with ID {run_id} was not found.", "ANALYSIS_NOT_FOUND", 404)

    file_dicts = [fm.to_dict(include_details=False) for fm in run.file_metrics]
    corr_data = compute_correlation_matrix(file_dicts)
    corr_data["analysis_run_id"] = run.id
    return api_success(corr_data)


@api_bp.route("/analysis/<int:run_id>/risks", methods=["GET"])
def get_analysis_risks(run_id: int):
    """Retrieve file-level risk and technical debt assessments for an analysis run."""
    run = db.session.get(AnalysisRun, run_id)
    if not run:
        return api_error(f"Analysis run with ID {run_id} was not found.", "ANALYSIS_NOT_FOUND", 404)

    risks = [r.to_dict() for r in run.risk_assessments]
    # Sort descending by risk_score
    risks.sort(key=lambda x: x["risk_score"], reverse=True)

    return api_success(
        {
            "analysis_run": run.to_summary_dict(),
            "scoring_mode": run.scoring_mode,
            "ml_model_used": run.ml_model_used,
            "risk_counts": {
                "HIGH": run.high_risk_count,
                "MEDIUM": run.medium_risk_count,
                "LOW": run.low_risk_count,
            },
            "risks": risks,
            "methodology_disclaimer": (
                "When no external trained scikit-learn model is connected, assessments are generated via "
                "deterministic Rule-Based Heuristics. Static code metrics identify structural complexity and "
                "maintainability concerns; they do not prove the presence of runtime software defects."
            ),
        }
    )


@api_bp.route("/analysis/<int:run_id>/priorities", methods=["GET"])
def get_analysis_priorities(run_id: int):
    """Retrieve ranked refactoring priority recommendations and scoring weights for an analysis run."""
    run = db.session.get(AnalysisRun, run_id)
    if not run:
        return api_error(f"Analysis run with ID {run_id} was not found.", "ANALYSIS_NOT_FOUND", 404)

    priorities = [rec.to_dict() for rec in run.recommendations]
    priorities.sort(key=lambda x: x["priority_rank"])
    priority_weights = SettingsRepository.get_setting_value("priority_weights")

    return api_success(
        {
            "analysis_run": run.to_summary_dict(),
            "priority_weights": priority_weights,
            "priorities": priorities,
            "methodology_explanation": {
                "summary": (
                    "Files are ranked using a transparent weighted linear combination of normalized Risk Score, "
                    "Cyclomatic Complexity & Nesting intensity, Maintainability Index deficit, and Code Smell severity."
                ),
                "limitations": (
                    "This prioritization mechanism is a transparent engineering triage heuristic. "
                    "It does not account for business criticality, runtime execution frequency, or existing unit test coverage."
                ),
            },
        }
    )


@api_bp.route("/projects/<int:project_id>/history", methods=["GET"])
def get_project_history(project_id: int):
    """Retrieve all historical analysis runs for a specific project."""
    project = db.session.get(Project, project_id)
    if not project:
        return api_error(f"Project with ID {project_id} was not found.", "PROJECT_NOT_FOUND", 404)

    runs = (
        AnalysisRun.query.filter_by(project_id=project_id)
        .order_by(AnalysisRun.created_at.desc())
        .all()
    )
    return api_success(
        {
            "project": project.to_dict(include_latest_run=False),
            "runs": [r.to_summary_dict() for r in runs],
        }
    )


@api_bp.route("/history", methods=["GET"])
def get_all_history():
    """Retrieve all analysis runs across all projects for the global Project History view."""
    runs = AnalysisRun.query.order_by(AnalysisRun.created_at.desc()).all()
    return api_success([r.to_summary_dict() for r in runs])


@api_bp.route("/projects/<int:project_id>/compare", methods=["GET"])
def compare_project_runs(project_id: int):
    """Compare two analysis runs (?first=<run_id>&second=<run_id>) for a project."""
    project = db.session.get(Project, project_id)
    if not project:
        return api_error(f"Project with ID {project_id} was not found.", "PROJECT_NOT_FOUND", 404)

    first_id = request.args.get("first", type=int)
    second_id = request.args.get("second", type=int)

    if not first_id or not second_id:
        return api_error(
            "Both 'first' and 'second' analysis run IDs are required as query parameters.",
            "MISSING_COMPARISON_PARAMS",
            400,
        )

    if first_id == second_id:
        return api_error(
            "Cannot compare an analysis run with itself. Please select two distinct analysis runs.",
            "SAME_RUN_COMPARISON",
            400,
        )

    first_run = db.session.get(AnalysisRun, first_id)
    second_run = db.session.get(AnalysisRun, second_id)

    if not first_run or not second_run:
        return api_error("One or both specified analysis runs were not found.", "RUN_NOT_FOUND", 404)

    if first_run.project_id != project_id or second_run.project_id != project_id:
        return api_error(
            "Both analysis runs must belong to the specified project.",
            "PROJECT_MISMATCH",
            400,
        )

    comparison = compare_analysis_runs(first_run, second_run)
    return api_success(comparison)


@api_bp.route("/analysis/<int:run_id>/report", methods=["GET"])
def download_analysis_report(run_id: int):
    """Generate and download a printable ReportLab PDF report for an analysis run."""
    run = db.session.get(AnalysisRun, run_id)
    if not run:
        return api_error(f"Analysis run with ID {run_id} was not found.", "ANALYSIS_NOT_FOUND", 404)

    try:
        pdf_bytes = generate_analysis_pdf_report(run)
        proj_slug = secure_filename(run.project.name if run.project else "java_project") or "project"
        filename = f"{proj_slug}_run_{run.run_number}_health_report.pdf"
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as exc:
        return api_error(f"Failed to generate PDF report: {str(exc)}", "REPORT_ERROR", 500)


@api_bp.route("/settings", methods=["GET"])
def get_settings():
    """Retrieve all configurable application settings and current ML model integration status."""
    settings = SettingsRepository.get_all_settings()
    ml_config = settings.get("ml_configuration", {}).get("value", {})
    ml_service = MLDefectPredictionService(
        base_dir=current_app.config["BASE_DIR"],
        model_rel_path=ml_config.get("model_path"),
        metadata_rel_path=ml_config.get("metadata_path"),
    )
    return api_success(
        {
            "settings": settings,
            "ml_status": ml_service.get_status(),
            "application_info": {
                "title": "AI-Driven Software Engineering Metrics and Project Health Intelligence Platform",
                "version": "1.0.0",
                "java_parser": "javalang AST & Lexical Analyzer",
                "pdf_engine": "ReportLab PDF Engine",
                "database_engine": current_app.config["SQLALCHEMY_DATABASE_URI"].split(":")[0],
            },
        }
    )


@api_bp.route("/settings", methods=["PUT"])
def update_settings():
    """Validate and persist updated application settings."""
    payload = request.get_json(silent=True)
    if not payload:
        return api_error("Request body must contain valid JSON settings.", "INVALID_JSON", 400)

    updated, err_msg = SettingsRepository.validate_and_update_settings(payload)
    if err_msg:
        return api_error(err_msg, "SETTINGS_VALIDATION_ERROR", 400)

    ml_config = updated.get("ml_configuration", {}).get("value", {})
    ml_service = MLDefectPredictionService(
        base_dir=current_app.config["BASE_DIR"],
        model_rel_path=ml_config.get("model_path"),
        metadata_rel_path=ml_config.get("metadata_path"),
    )
    return api_success(
        {
            "settings": updated,
            "ml_status": ml_service.get_status(),
        },
        message="Settings validated and saved successfully.",
    )


@api_bp.route("/settings/reset", methods=["POST"])
def reset_settings():
    """Reset all application settings to their documented default values."""
    updated = SettingsRepository.reset_to_defaults()
    ml_config = updated.get("ml_configuration", {}).get("value", {})
    ml_service = MLDefectPredictionService(
        base_dir=current_app.config["BASE_DIR"],
        model_rel_path=ml_config.get("model_path"),
        metadata_rel_path=ml_config.get("metadata_path"),
    )
    return api_success(
        {
            "settings": updated,
            "ml_status": ml_service.get_status(),
        },
        message="Settings restored to defaults.",
    )


@api_bp.route("/samples", methods=["GET"])
def list_sample_archives():
    """List the built-in real Java sample archives in data/ for quick academic demonstration."""
    samples = ensure_sample_archives(current_app.config["DATA_DIR"])
    return api_success(list(samples.values()))


@api_bp.route("/samples/<sample_id>/download", methods=["GET"])
def download_sample_archive(sample_id: str):
    """Download one of the sample Java ZIP archives from data/."""
    samples = ensure_sample_archives(current_app.config["DATA_DIR"])
    if sample_id not in samples:
        return api_error(f"Sample '{sample_id}' not found.", "SAMPLE_NOT_FOUND", 404)
    sample = samples[sample_id]
    return send_file(
        sample["path"],
        mimetype="application/zip",
        as_attachment=True,
        download_name=sample["filename"],
    )


@api_bp.route("/samples/<sample_id>/analyze", methods=["POST"])
def analyze_sample_archive(sample_id: str):
    """
    Run the real Java AST analysis pipeline on a sample archive in data/
    (either creating the sample project or appending a new run to an existing project for Before/After comparison).
    """
    samples = ensure_sample_archives(current_app.config["DATA_DIR"])
    if sample_id not in samples:
        return api_error(f"Sample '{sample_id}' not found.", "SAMPLE_NOT_FOUND", 404)

    sample = samples[sample_id]
    payload = request.get_json(silent=True) or {}
    target_project_id = payload.get("project_id")

    uploads_dir = current_app.config["UPLOADS_DIR"]
    os.makedirs(uploads_dir, exist_ok=True)
    copied_name = f"sample_{sample_id}_{uuid.uuid4().hex[:8]}_{sample['filename']}"
    copied_path = os.path.join(uploads_dir, copied_name)
    shutil.copyfile(sample["path"], copied_path)

    if target_project_id:
        project = db.session.get(Project, int(target_project_id))
        if not project:
            return api_error("Specified target project not found.", "PROJECT_NOT_FOUND", 404)
        project.archive_filename = sample["filename"]
        project.archive_path = copied_path
        project.archive_size_bytes = os.path.getsize(copied_path)
    else:
        # Check if a project with the sample's name already exists so v1 and v2 naturally group under the same project!
        project = Project.query.filter_by(name=sample["project_name"]).first()
        if not project:
            project = Project(
                name=sample["project_name"],
                description=sample["description"],
                language="Java",
                archive_filename=sample["filename"],
                archive_path=copied_path,
                archive_size_bytes=os.path.getsize(copied_path),
            )
            db.session.add(project)
            db.session.commit()
        else:
            project.archive_filename = sample["filename"]
            project.archive_path = copied_path
            project.archive_size_bytes = os.path.getsize(copied_path)
            db.session.commit()

    run = execute_project_analysis(
        project=project,
        zip_path=copied_path,
        version_label=sample["version_label"],
        archive_filename=sample["filename"],
        base_dir=current_app.config["BASE_DIR"],
        temp_extract_root=current_app.config["TEMP_EXTRACT_DIR"],
    )

    return api_success(
        {
            "project": project.to_dict(include_latest_run=True),
            "analysis_run": run.to_summary_dict(),
        },
        message=f"Analyzed sample Java archive '{sample['filename']}' ({sample['version_label']}).",
        status_code=201,
    )
