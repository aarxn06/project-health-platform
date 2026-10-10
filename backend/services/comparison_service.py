from database.models import AnalysisRun

COMPARISON_METRIC_SPECS = [
    {
        "key": "health_score",
        "label": "Project Health Score",
        "unit": "/ 100",
        "direction_rule": "HIGHER_IS_BETTER",
        "interpretation_note": "Higher scores indicate healthier overall maintainability, lower complexity, and lower smell density.",
    },
    {
        "key": "total_loc",
        "label": "Total Lines of Code (LOC)",
        "unit": "lines",
        "direction_rule": "CONTEXT_DEPENDENT",
        "interpretation_note": "LOC changes depend on context: adding features or extracting classes may increase LOC, while removing duplication reduces LOC. Neither increase nor decrease is automatically an improvement.",
    },
    {
        "key": "avg_complexity",
        "label": "Average File Complexity",
        "unit": "CC",
        "direction_rule": "LOWER_IS_BETTER",
        "interpretation_note": "Lower average cyclomatic complexity indicates simpler branching logic and easier unit testing.",
    },
    {
        "key": "max_complexity",
        "label": "Peak File Complexity",
        "unit": "CC",
        "direction_rule": "LOWER_IS_BETTER",
        "interpretation_note": "Reducing the highest-complexity hotspot lowers defect exposure in critical classes.",
    },
    {
        "key": "avg_maintainability",
        "label": "Average Maintainability Index",
        "unit": "/ 100",
        "direction_rule": "HIGHER_IS_BETTER",
        "interpretation_note": "Higher Maintainability Index reflects cleaner method sizes, lower complexity, and better documentation.",
    },
    {
        "key": "total_code_smells",
        "label": "Total Code Smells",
        "unit": "smells",
        "direction_rule": "LOWER_IS_BETTER",
        "interpretation_note": "Fewer static code smells indicate reduced structural technical debt.",
    },
    {
        "key": "high_risk_count",
        "label": "High-Risk Files",
        "unit": "files",
        "direction_rule": "LOWER_IS_BETTER",
        "interpretation_note": "Fewer high-risk files reduces urgent refactoring hotspots.",
    },
    {
        "key": "medium_risk_count",
        "label": "Medium-Risk Files",
        "unit": "files",
        "direction_rule": "LOWER_IS_BETTER",
        "interpretation_note": "Fewer medium-risk files indicates healthier baseline code quality.",
    },
    {
        "key": "low_risk_count",
        "label": "Low-Risk Files",
        "unit": "files",
        "direction_rule": "CONTEXT_DEPENDENT",
        "interpretation_note": "More low-risk files is positive when files migrate down from High/Medium risk, though total file count may also change.",
    },
    {
        "key": "avg_comment_ratio",
        "label": "Average Comment Ratio",
        "unit": "%",
        "direction_rule": "HIGHER_IS_BETTER",
        "interpretation_note": "Higher documentation density generally improves maintainability unless caused by commented-out dead code.",
    },
    {
        "key": "avg_coupling",
        "label": "Average Coupling Score",
        "unit": "/ 100",
        "direction_rule": "LOWER_IS_BETTER",
        "interpretation_note": "Lower efferent coupling (fan-out) reduces ripple effects during architectural changes.",
    },
    {
        "key": "total_files",
        "label": "Analyzed Java Files",
        "unit": "files",
        "direction_rule": "CONTEXT_DEPENDENT",
        "interpretation_note": "Decomposing a God Class increases file count while improving modularity; file count alone is neutral.",
    },
]


def evaluate_metric_change(first_val: float, second_val: float, direction_rule: str) -> str:
    """
    Evaluate whether a metric delta between Run A and Run B is IMPROVED, WORSENED,
    UNCHANGED, or CONTEXT_DEPENDENT based on its documented software engineering rule.
    """
    delta = second_val - first_val
    if abs(delta) < 1e-4:
        return "UNCHANGED"
    if direction_rule == "CONTEXT_DEPENDENT":
        return "CONTEXT_DEPENDENT"
    if direction_rule == "HIGHER_IS_BETTER":
        return "IMPROVED" if delta > 0 else "WORSENED"
    if direction_rule == "LOWER_IS_BETTER":
        return "IMPROVED" if delta < 0 else "WORSENED"
    return "CONTEXT_DEPENDENT"


def compare_analysis_runs(first_run: AnalysisRun, second_run: AnalysisRun) -> dict:
    """
    Compare two AnalysisRun records for the same project and generate:
    - Project-level metric comparison cards with directional evaluation
    - Risk distribution comparison
    - File-level before-and-after deltas
    """
    first_summary = first_run.to_summary_dict()
    second_summary = second_run.to_summary_dict()

    metric_comparisons = []
    for spec in COMPARISON_METRIC_SPECS:
        key = spec["key"]
        v1 = float(first_summary.get(key, 0.0) or 0.0)
        v2 = float(second_summary.get(key, 0.0) or 0.0)
        delta = round(v2 - v1, 2)
        pct_change = round(((v2 - v1) / abs(v1)) * 100.0, 2) if abs(v1) > 1e-6 else (100.0 if v2 > 0 else 0.0)
        evaluation = evaluate_metric_change(v1, v2, spec["direction_rule"])

        direction_map = {
            "HIGHER_IS_BETTER": "higher_is_better",
            "LOWER_IS_BETTER": "lower_is_better",
            "CONTEXT_DEPENDENT": "neutral",
        }
        metric_comparisons.append(
            {
                "key": key,
                "label": spec["label"],
                "unit": spec["unit"],
                "first_value": round(v1, 2),
                "second_value": round(v2, 2),
                "delta": delta,
                "percent_change": pct_change,
                "pct_change": pct_change,
                "direction_rule": spec["direction_rule"],
                "direction": direction_map.get(spec["direction_rule"], "neutral"),
                "evaluation": evaluation,
                "interpretation_note": spec["interpretation_note"],
                "interpretation": spec["interpretation_note"],
            }
        )

    # Compare individual files by relative path (fallback to file_name)
    first_files = {fm.file_path: fm.to_dict(include_details=False) for fm in first_run.file_metrics}
    second_files = {fm.file_path: fm.to_dict(include_details=False) for fm in second_run.file_metrics}

    all_paths = sorted(set(first_files.keys()) | set(second_files.keys()))
    file_deltas = []
    improved_files = 0
    worsened_files = 0
    unchanged_files = 0
    added_files = 0
    removed_files = 0

    for path in all_paths:
        f1 = first_files.get(path)
        f2 = second_files.get(path)

        if f1 and not f2:
            removed_files += 1
            file_deltas.append(
                {
                    "file_path": path,
                    "file_name": f1["file_name"],
                    "change_type": "REMOVED",
                    "evaluation": "CONTEXT_DEPENDENT",
                    "first": f1,
                    "second": None,
                    "deltas": None,
                    "loc_delta": -int(f1.get("loc") or 0),
                    "complexity_delta": -int(f1.get("cyclomatic_complexity") or 0),
                    "maintainability_delta": None,
                    "smell_delta": -int(f1.get("code_smell_count") or 0),
                    "risk_score_delta": None,
                }
            )
        elif f2 and not f1:
            added_files += 1
            file_deltas.append(
                {
                    "file_path": path,
                    "file_name": f2["file_name"],
                    "change_type": "ADDED",
                    "evaluation": "CONTEXT_DEPENDENT",
                    "first": None,
                    "second": f2,
                    "deltas": None,
                    "loc_delta": int(f2.get("loc") or 0),
                    "complexity_delta": int(f2.get("cyclomatic_complexity") or 0),
                    "maintainability_delta": None,
                    "smell_delta": int(f2.get("code_smell_count") or 0),
                    "risk_score_delta": None,
                }
            )
        else:
            mi1 = f1.get("maintainability_index") or 0.0
            mi2 = f2.get("maintainability_index") or 0.0
            cc_delta = f2["cyclomatic_complexity"] - f1["cyclomatic_complexity"]
            loc_delta = f2["loc"] - f1["loc"]
            mi_delta = round(mi2 - mi1, 2)
            smell_delta = f2["code_smell_count"] - f1["code_smell_count"]
            risk_delta = round(f2["risk_score"] - f1["risk_score"], 2)

            # Determine overall file quality direction from risk, smell, and maintainability changes
            if abs(risk_delta) < 0.5 and cc_delta == 0 and smell_delta == 0 and abs(mi_delta) < 0.5:
                eval_status = "UNCHANGED"
                unchanged_files += 1
            elif risk_delta < -1.0 or smell_delta < 0 or (mi_delta > 1.0 and cc_delta <= 0):
                eval_status = "IMPROVED"
                improved_files += 1
            elif risk_delta > 1.0 or smell_delta > 0 or (mi_delta < -1.0 and cc_delta >= 0):
                eval_status = "WORSENED"
                worsened_files += 1
            else:
                eval_status = "CONTEXT_DEPENDENT"
                unchanged_files += 1

            file_deltas.append(
                {
                    "file_path": path,
                    "file_name": f2["file_name"],
                    "change_type": "MODIFIED",
                    "evaluation": eval_status,
                    "first": {
                        "loc": f1["loc"],
                        "cyclomatic_complexity": f1["cyclomatic_complexity"],
                        "maintainability_index": f1["maintainability_index"],
                        "code_smell_count": f1["code_smell_count"],
                        "risk_score": f1["risk_score"],
                        "risk_category": f1["risk_category"],
                    },
                    "second": {
                        "loc": f2["loc"],
                        "cyclomatic_complexity": f2["cyclomatic_complexity"],
                        "maintainability_index": f2["maintainability_index"],
                        "code_smell_count": f2["code_smell_count"],
                        "risk_score": f2["risk_score"],
                        "risk_category": f2["risk_category"],
                    },
                    "deltas": {
                        "loc_delta": loc_delta,
                        "complexity_delta": cc_delta,
                        "maintainability_delta": mi_delta,
                        "smell_delta": smell_delta,
                        "risk_score_delta": risk_delta,
                    },
                    "loc_delta": loc_delta,
                    "complexity_delta": cc_delta,
                    "maintainability_delta": mi_delta,
                    "smell_delta": smell_delta,
                    "risk_score_delta": risk_delta,
                }
            )

    risk_distribution_comparison = [
        {
            "category": "High Risk",
            "first_run": first_summary["high_risk_count"],
            "second_run": second_summary["high_risk_count"],
            "first_count": first_summary["high_risk_count"],
            "second_count": second_summary["high_risk_count"],
            "delta": second_summary["high_risk_count"] - first_summary["high_risk_count"],
        },
        {
            "category": "Medium Risk",
            "first_run": first_summary["medium_risk_count"],
            "second_run": second_summary["medium_risk_count"],
            "first_count": first_summary["medium_risk_count"],
            "second_count": second_summary["medium_risk_count"],
            "delta": second_summary["medium_risk_count"] - first_summary["medium_risk_count"],
        },
        {
            "category": "Low Risk",
            "first_run": first_summary["low_risk_count"],
            "second_run": second_summary["low_risk_count"],
            "first_count": first_summary["low_risk_count"],
            "second_count": second_summary["low_risk_count"],
            "delta": second_summary["low_risk_count"] - first_summary["low_risk_count"],
        },
    ]

    return {
        "project_id": first_run.project_id,
        "project_name": first_run.project.name if first_run.project else "",
        "first_run": first_summary,
        "second_run": second_summary,
        "metric_comparisons": metric_comparisons,
        "risk_distribution_comparison": risk_distribution_comparison,
        "file_comparison_summary": {
            "total_compared_paths": len(all_paths),
            "improved_files": improved_files,
            "worsened_files": worsened_files,
            "unchanged_files": unchanged_files,
            "added_files": added_files,
            "removed_files": removed_files,
        },
        "file_deltas": file_deltas,
        "file_changes": file_deltas,
    }
