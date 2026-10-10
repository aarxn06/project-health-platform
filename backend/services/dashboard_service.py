import json
from database import db
from database.models import Project, AnalysisRun
from database.repository import SettingsRepository


def _compute_delta_obj(curr_val, prev_val, direction="higher_is_better"):
    if curr_val is None or prev_val is None:
        return None
    delta = round(float(curr_val) - float(prev_val), 2)
    if abs(float(prev_val)) > 1e-6:
        pct = round((delta / abs(float(prev_val))) * 100.0, 1)
    else:
        pct = 0.0 if abs(delta) < 1e-6 else 100.0

    if abs(delta) < 1e-4:
        improved = None
    elif direction == "higher_is_better":
        improved = delta > 0
    elif direction == "lower_is_better":
        improved = delta < 0
    else:
        improved = None

    return {
        "current": curr_val,
        "previous": prev_val,
        "delta": delta,
        "pct_change": pct,
        "direction": direction,
        "improved": improved,
    }


def _status_level_for_maintainability(mi):
    if mi is None:
        return {"supported": False, "status_chip": "Not available", "variant": "muted", "level_blocks": 0}
    val = float(mi)
    if val >= 80.0:
        return {"supported": True, "status_chip": "Excellent", "variant": "success", "level_blocks": 4}
    if val >= 65.0:
        return {"supported": True, "status_chip": "Good", "variant": "blue", "level_blocks": 3}
    if val >= 45.0:
        return {"supported": True, "status_chip": "Fair", "variant": "yellow", "level_blocks": 2}
    return {"supported": True, "status_chip": "Poor", "variant": "danger", "level_blocks": 1}


def _status_level_for_comment_ratio(ratio):
    if ratio is None:
        return {"supported": False, "status_chip": "Not available", "variant": "muted", "level_blocks": 0}
    val = float(ratio)
    if val >= 15.0:
        return {"supported": True, "status_chip": "Excellent", "variant": "success", "level_blocks": 4}
    if val >= 10.0:
        return {"supported": True, "status_chip": "Good", "variant": "blue", "level_blocks": 3}
    if val >= 5.0:
        return {"supported": True, "status_chip": "Fair", "variant": "yellow", "level_blocks": 2}
    return {"supported": True, "status_chip": "Poor", "variant": "danger", "level_blocks": 1}


def _status_level_for_coupling(coupling):
    if coupling is None:
        return {"supported": False, "status_chip": "Not available", "variant": "muted", "level_blocks": 0}
    val = float(coupling)
    if val <= 4.0:
        return {"supported": True, "status_chip": "Excellent", "variant": "success", "level_blocks": 4}
    if val <= 7.5:
        return {"supported": True, "status_chip": "Good", "variant": "blue", "level_blocks": 3}
    if val <= 11.0:
        return {"supported": True, "status_chip": "Fair", "variant": "yellow", "level_blocks": 2}
    return {"supported": True, "status_chip": "Poor", "variant": "danger", "level_blocks": 1}


def _status_level_for_parse_failures(failed_files, total_files):
    if total_files <= 0:
        return {"supported": False, "status_chip": "Not available", "variant": "muted", "level_blocks": 0}
    if failed_files == 0:
        return {"supported": True, "status_chip": "Excellent", "variant": "success", "level_blocks": 4}
    ratio = failed_files / max(total_files, 1)
    if ratio <= 0.05:
        return {"supported": True, "status_chip": "Good", "variant": "blue", "level_blocks": 3}
    if ratio <= 0.15:
        return {"supported": True, "status_chip": "Fair", "variant": "yellow", "level_blocks": 2}
    return {"supported": True, "status_chip": "Poor", "variant": "danger", "level_blocks": 1}


def build_dashboard_payload(project_id: int = None, run_id: int = None) -> dict:
    """
    Assemble the complete dashboard summary response for Section 2.4 & Section 4.
    All values come directly from stored SQLite analysis runs and AST file metrics.
    """
    projects = Project.query.order_by(Project.updated_at.desc()).all()
    if not projects:
        return {
            "has_project": False,
            "project": None,
            "active_run": None,
        }

    # Resolve target project
    target_project = None
    if project_id is not None:
        target_project = db.session.get(Project, project_id)
    if target_project is None:
        target_project = projects[0]

    # Chronological runs for this project
    project_runs = (
        AnalysisRun.query.filter_by(project_id=target_project.id)
        .order_by(AnalysisRun.run_number.asc())
        .all()
    )
    if not project_runs:
        return {
            "has_project": False,
            "project": target_project.to_dict(include_latest_run=False),
            "active_run": None,
        }

    # Resolve active run (default to latest run)
    active_run = None
    if run_id is not None:
        candidate = db.session.get(AnalysisRun, run_id)
        if candidate and candidate.project_id == target_project.id:
            active_run = candidate
    if active_run is None:
        active_run = project_runs[-1]

    # Identify immediately preceding run for delta calculations
    active_idx = next((i for i, r in enumerate(project_runs) if r.id == active_run.id), len(project_runs) - 1)
    previous_run = project_runs[active_idx - 1] if active_idx > 0 else None
    has_history = len(project_runs) >= 2 and previous_run is not None

    # Build chronological history series for sparklines and Quality Trend area chart
    history_series = []
    for r in project_runs:
        history_series.append(
            {
                "id": r.id,
                "run_number": r.run_number,
                "name": f"Run #{r.run_number}",
                "version_label": r.version_label or f"Run #{r.run_number}",
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "health_score": round(r.health_score, 1),
                "total_loc": r.total_loc,
                "avg_complexity": round(r.avg_complexity, 2),
                "total_files": r.total_files,
                "parsed_files": r.parsed_files,
                "failed_files": r.failed_files,
                "high_risk_count": r.high_risk_count,
                "medium_risk_count": r.medium_risk_count,
                "low_risk_count": r.low_risk_count,
                "avg_maintainability": round(r.avg_maintainability, 2) if r.parsed_files > 0 else None,
                "avg_comment_ratio": round(r.avg_comment_ratio, 2),
                "avg_coupling": round(r.avg_coupling, 2),
                "total_code_smells": r.total_code_smells,
            }
        )

    # Compute KPI and footer deltas vs previous_run
    curr_mi = round(active_run.avg_maintainability, 2) if active_run.parsed_files > 0 else None
    prev_mi = (
        round(previous_run.avg_maintainability, 2)
        if (previous_run and previous_run.parsed_files > 0)
        else None
    )

    kpi_deltas = {
        "health_score": _compute_delta_obj(
            round(active_run.health_score, 1),
            round(previous_run.health_score, 1) if previous_run else None,
            "higher_is_better",
        ),
        "total_loc": _compute_delta_obj(
            active_run.total_loc,
            previous_run.total_loc if previous_run else None,
            "neutral",
        ),
        "avg_complexity": _compute_delta_obj(
            round(active_run.avg_complexity, 2),
            round(previous_run.avg_complexity, 2) if previous_run else None,
            "lower_is_better",
        ),
        "total_files": _compute_delta_obj(
            active_run.total_files,
            previous_run.total_files if previous_run else None,
            "neutral",
        ),
        "avg_maintainability": _compute_delta_obj(curr_mi, prev_mi, "higher_is_better"),
        "avg_comment_ratio": _compute_delta_obj(
            round(active_run.avg_comment_ratio, 2),
            round(previous_run.avg_comment_ratio, 2) if previous_run else None,
            "higher_is_better",
        ),
        "avg_coupling": _compute_delta_obj(
            round(active_run.avg_coupling, 2),
            round(previous_run.avg_coupling, 2) if previous_run else None,
            "lower_is_better",
        ),
        "failed_files": _compute_delta_obj(
            active_run.failed_files,
            previous_run.failed_files if previous_run else None,
            "lower_is_better",
        ),
    }

    # Code Stability Overview (Row 2 Left)
    # Only show "Critical" if the configured risk_thresholds define critical_risk_threshold
    risk_thresholds = SettingsRepository.get_setting_value("risk_thresholds") or {}
    high_t = float(risk_thresholds.get("high_risk_threshold", 65.0))
    med_t = float(risk_thresholds.get("medium_risk_threshold", 35.0))
    crit_raw = risk_thresholds.get("critical_risk_threshold")
    critical_defined = (
        crit_raw is not None
        and isinstance(crit_raw, (int, float))
        and float(crit_raw) > high_t
    )
    crit_t = float(crit_raw) if critical_defined else None

    total_files = max(active_run.total_files, 1)
    risks = active_run.risk_assessments or []

    stability_categories = []
    if critical_defined:
        crit_count = sum(1 for r in risks if r.risk_score >= crit_t)
        high_only_count = sum(1 for r in risks if r.risk_category == "HIGH" and r.risk_score < crit_t)
        stability_categories.append(
            {
                "key": "CRITICAL",
                "label": "Critical Risk",
                "count": crit_count,
                "percentage": round((crit_count / total_files) * 100.0, 1) if active_run.total_files > 0 else 0.0,
                "color": "#EF4444",
                "thresholdHint": f"≥ {crit_t:.0f}",
            }
        )
        stability_categories.append(
            {
                "key": "HIGH",
                "label": "High Risk",
                "count": high_only_count,
                "percentage": round((high_only_count / total_files) * 100.0, 1) if active_run.total_files > 0 else 0.0,
                "color": "#F97316",
                "thresholdHint": f"{high_t:.0f}–{crit_t - 0.1:.1f}",
            }
        )
    else:
        stability_categories.append(
            {
                "key": "HIGH",
                "label": "High Risk",
                "count": active_run.high_risk_count,
                "percentage": round((active_run.high_risk_count / total_files) * 100.0, 1)
                if active_run.total_files > 0
                else 0.0,
                "color": "#F97316",
                "thresholdHint": f"≥ {high_t:.0f}",
            }
        )

    stability_categories.append(
        {
            "key": "MEDIUM",
            "label": "Medium Risk",
            "count": active_run.medium_risk_count,
            "percentage": round((active_run.medium_risk_count / total_files) * 100.0, 1)
            if active_run.total_files > 0
            else 0.0,
            "color": "#EAB308",
            "thresholdHint": f"{med_t:.0f}–{high_t - 0.1:.1f}",
        }
    )
    stability_categories.append(
        {
            "key": "LOW",
            "label": "Low Risk",
            "count": active_run.low_risk_count,
            "percentage": round((active_run.low_risk_count / total_files) * 100.0, 1)
            if active_run.total_files > 0
            else 0.0,
            "color": "#A1A1AA",
            "thresholdHint": f"< {med_t:.0f}",
        }
    )

    # One-line summary vs previous run when history exists
    comparison_summary_line = None
    if previous_run is not None:
        curr_high_pct = (active_run.high_risk_count / max(active_run.total_files, 1)) * 100.0
        prev_high_pct = (previous_run.high_risk_count / max(previous_run.total_files, 1)) * 100.0
        pct_diff = round(curr_high_pct - prev_high_pct, 1)
        count_diff = active_run.high_risk_count - previous_run.high_risk_count
        if count_diff < 0:
            comparison_summary_line = (
                f"{abs(pct_diff):.1f}% fewer high-risk files than previous run "
                f"({active_run.high_risk_count} vs {previous_run.high_risk_count} files)"
            )
        elif count_diff > 0:
            comparison_summary_line = (
                f"{abs(pct_diff):.1f}% more high-risk files than previous run "
                f"({active_run.high_risk_count} vs {previous_run.high_risk_count} files)"
            )
        else:
            comparison_summary_line = (
                f"High-risk file count unchanged from previous run ({active_run.high_risk_count} files)"
            )

    # Top Refactoring Priorities (Row 2 Right)
    recs = sorted(active_run.recommendations or [], key=lambda x: x.priority_rank)
    top_priorities = []
    for rec in recs[:10]:
        fm = rec.file_metric
        risk_obj = fm.risk_assessment if fm else None
        top_priorities.append(
            {
                "id": rec.id,
                "priority_rank": rec.priority_rank,
                "file_name": fm.file_name if fm else "Unknown",
                "file_path": fm.file_path if fm else "",
                "priority_score": round(rec.priority_score, 1),
                "priority_level": rec.priority_level,
                "cyclomatic_complexity": fm.cyclomatic_complexity if fm else 0,
                "loc": fm.loc if fm else 0,
                "risk_score": round(risk_obj.risk_score, 1) if risk_obj else 0.0,
                "risk_category": risk_obj.risk_category if risk_obj else "LOW",
                "primary_reasons": json.loads(rec.primary_reasons_json or "[]"),
                "suggested_actions": json.loads(rec.suggested_actions_json or "[]"),
            }
        )

    # Complexity Bands & Code-Smell Breakdown (Row 3 Right)
    smell_list = json.loads(active_run.code_smell_summary_json or "[]")
    total_smells = sum(s.get("count", 0) for s in smell_list)
    smell_chart_data = []
    for s in smell_list:
        cnt = s.get("count", 0)
        if cnt > 0:
            smell_chart_data.append(
                {
                    "name": s.get("label", s.get("type", "Smell")),
                    "type": s.get("type"),
                    "severity": s.get("severity", "MEDIUM"),
                    "count": cnt,
                    "percentage": round((cnt / total_smells) * 100.0, 1) if total_smells > 0 else 0.0,
                }
            )
    smell_chart_data.sort(key=lambda x: x["count"], reverse=True)

    # Method-level cyclomatic complexity bands (1-5 Low, 6-10 Moderate, 11+ High)
    band_counts = {"1-5": 0, "6-10": 0, "11+": 0}
    for fm in active_run.file_metrics or []:
        if fm.parse_status == "SUCCESS":
            methods = json.loads(fm.methods_detail_json or "[]")
            for m in methods:
                mcc = int(m.get("cyclomatic_complexity", 1))
                if mcc <= 5:
                    band_counts["1-5"] += 1
                elif mcc <= 10:
                    band_counts["6-10"] += 1
                else:
                    band_counts["11+"] += 1

    total_m = max(sum(band_counts.values()), 1)
    complexity_bands_data = [
        {
            "name": "CC 1–5 (Simple)",
            "band": "1-5",
            "count": band_counts["1-5"],
            "percentage": round((band_counts["1-5"] / total_m) * 100.0, 1)
            if sum(band_counts.values()) > 0
            else 0.0,
            "color": "#22C55E",
        },
        {
            "name": "CC 6–10 (Moderate)",
            "band": "6-10",
            "count": band_counts["6-10"],
            "percentage": round((band_counts["6-10"] / total_m) * 100.0, 1)
            if sum(band_counts.values()) > 0
            else 0.0,
            "color": "#EAB308",
        },
        {
            "name": "CC 11+ (Complex)",
            "band": "11+",
            "count": band_counts["11+"],
            "percentage": round((band_counts["11+"] / total_m) * 100.0, 1)
            if sum(band_counts.values()) > 0
            else 0.0,
            "color": "#EF4444",
        },
    ]

    # Recent Analysis Activity across all projects (Row 3 Centre)
    recent_runs = AnalysisRun.query.order_by(AnalysisRun.created_at.desc()).limit(10).all()
    recent_activity = [r.to_summary_dict() for r in recent_runs]

    # Footer Metric Strip (Row 4 - 4 compact tiles)
    mi_status = _status_level_for_maintainability(curr_mi)
    cr_status = _status_level_for_comment_ratio(
        round(active_run.avg_comment_ratio, 2) if active_run.total_files > 0 else None
    )
    cp_status = _status_level_for_coupling(
        round(active_run.avg_coupling, 2) if active_run.parsed_files > 0 else None
    )
    pf_status = _status_level_for_parse_failures(active_run.failed_files, active_run.total_files)

    footer_metrics = {
        "maintainability": {
            "label": "Average Maintainability",
            "value": curr_mi,
            "unit": "/ 100",
            "tooltip": (
                "Normalized SEI Maintainability Index (0–100) derived from Halstead Volume, "
                "Cyclomatic Complexity, LOC, and Comment Ratio across parsed Java files."
            ),
            **mi_status,
            "delta": kpi_deltas["avg_maintainability"],
        },
        "comment_ratio": {
            "label": "Average Comment Ratio",
            "value": round(active_run.avg_comment_ratio, 2) if active_run.total_files > 0 else None,
            "unit": "%",
            "tooltip": "Percentage of comment lines (single-line, block, and Javadoc) relative to total physical lines.",
            **cr_status,
            "delta": kpi_deltas["avg_comment_ratio"],
        },
        "coupling": {
            "label": "Average Coupling",
            "value": round(active_run.avg_coupling, 2) if active_run.parsed_files > 0 else None,
            "unit": "fan-out",
            "tooltip": "Mean structural coupling score combining distinct referenced AST types and external package imports.",
            **cp_status,
            "delta": kpi_deltas["avg_coupling"],
        },
        "parse_failures": {
            "label": "Parse Failures / Errors",
            "value": active_run.failed_files,
            "total_files": active_run.total_files,
            "unit": f"of {active_run.total_files} files",
            "tooltip": "Count of uploaded Java files that failed AST syntax verification.",
            **pf_status,
            "delta": kpi_deltas["failed_files"],
        },
    }

    return {
        "has_project": True,
        "project": target_project.to_dict(include_latest_run=False),
        "active_run": active_run.to_summary_dict(),
        "previous_run": previous_run.to_summary_dict() if previous_run else None,
        "has_history": has_history,
        "history_series": history_series,
        "kpi_deltas": kpi_deltas,
        "stability_overview": {
            "overall_health": round(active_run.health_score, 1),
            "health_grade": active_run.health_grade,
            "critical_threshold_defined": critical_defined,
            "thresholds": risk_thresholds,
            "categories": stability_categories,
            "comparison_summary_line": comparison_summary_line,
            "health_breakdown": active_run._normalized_health_breakdown(),
        },
        "top_refactoring_priorities": top_priorities,
        "recent_activity": recent_activity,
        "breakdown_charts": {
            "code_smells": smell_chart_data,
            "total_code_smells": active_run.total_code_smells,
            "complexity_bands": complexity_bands_data,
            "total_methods": active_run.total_methods,
        },
        "footer_metrics": footer_metrics,
    }

