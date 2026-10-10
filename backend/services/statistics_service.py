import math
import numpy as np
import pandas as pd

NUMERIC_METRICS_META = [
    {"key": "loc", "label": "Lines of Code (LOC)", "unit": "lines"},
    {"key": "cyclomatic_complexity", "label": "Cyclomatic Complexity", "unit": "CC"},
    {"key": "max_method_complexity", "label": "Max Method Complexity", "unit": "CC"},
    {"key": "method_count", "label": "Method Count", "unit": "methods"},
    {"key": "maintainability_index", "label": "Maintainability Index", "unit": "0-100"},
    {"key": "comment_ratio", "label": "Comment Ratio", "unit": "%"},
    {"key": "fan_out", "label": "Coupling Fan-Out", "unit": "types"},
    {"key": "code_smell_count", "label": "Code Smells", "unit": "smells"},
    {"key": "risk_score", "label": "Risk Score", "unit": "0-100"},
    {"key": "halstead_volume", "label": "Halstead Volume", "unit": "bits"},
]


def sanitize_for_json(obj):
    """
    Recursively convert NaN/Infinity to None (JSON null) and NumPy scalar/array
    types to native Python types prior to jsonify serialization.
    """
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(v) for v in obj.tolist()]
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    return obj


def compute_metrics_analytics(file_dicts: list[dict]) -> dict:
    """
    Compute real descriptive statistics, histograms, box-plot quartiles & outliers,
    scatter-ready records, and defect/risk distributions from extracted file metrics
    using pandas and NumPy.
    """
    parsed_files = [f for f in file_dicts if f.get("parse_status") == "SUCCESS"]
    small_project_warning = (
        f"This run contains {len(parsed_files)} parsed Java file(s). At least 3 parsed files are recommended for meaningful quartiles, histograms, and correlation analysis."
        if len(parsed_files) < 3
        else None
    )

    if not parsed_files:
        return sanitize_for_json(
            {
                "file_count": len(file_dicts),
                "parsed_file_count": 0,
                "sufficient_sample": False,
                "small_project_warning": "No Java files were successfully parsed in this run.",
                "metrics_metadata": NUMERIC_METRICS_META,
                "summary_statistics": {},
                "histograms": {},
                "box_plots": {},
                "files_data": file_dicts,
                "risk_distribution": [],
                "defect_distribution": {
                    "has_labelled_defect_data": False,
                    "ml_predicted_defect_count": None,
                    "non_defective_count": None,
                    "risk_tier_distribution": [],
                    "note": "No labelled defect dataset or compatible ML defect prediction model was active for this run.",
                },
            }
        )

    df = pd.DataFrame(parsed_files)

    summary_stats = {}
    histograms = {}
    box_plots = {}

    for meta in NUMERIC_METRICS_META:
        col = meta["key"]
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            continue

        vals = series.to_numpy(dtype=float)
        q1 = float(np.percentile(vals, 25))
        median = float(np.percentile(vals, 50))
        q3 = float(np.percentile(vals, 75))
        iqr = q3 - q1
        lower_fence = q1 - 1.5 * iqr
        upper_fence = q3 + 1.5 * iqr
        mean_val = float(np.mean(vals))
        std_val = float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0
        min_val = float(np.min(vals))
        max_val = float(np.max(vals))

        # Identify actual outlier files using 1.5 * IQR rule
        outliers = []
        non_outlier_vals = []
        for f in parsed_files:
            v = f.get(col)
            if v is None:
                continue
            fv = float(v)
            if math.isnan(fv) or math.isinf(fv):
                continue
            if fv < lower_fence or fv > upper_fence:
                outliers.append(
                    {
                        "file_name": f.get("file_name"),
                        "file_path": f.get("file_path"),
                        "value": round(fv, 2),
                        "direction": "HIGH_OUTLIER" if fv > upper_fence else "LOW_OUTLIER",
                    }
                )
            else:
                non_outlier_vals.append(fv)

        whisker_min = float(min(non_outlier_vals)) if non_outlier_vals else min_val
        whisker_max = float(max(non_outlier_vals)) if non_outlier_vals else max_val

        summary_stats[col] = {
            "key": col,
            "label": meta["label"],
            "unit": meta["unit"],
            "count": int(len(vals)),
            "mean": round(mean_val, 2),
            "std": round(std_val, 2),
            "min": round(min_val, 2),
            "q1": round(q1, 2),
            "median": round(median, 2),
            "q3": round(q3, 2),
            "max": round(max_val, 2),
            "iqr": round(iqr, 2),
            "outlier_count": len(outliers),
        }

        box_plots[col] = {
            "key": col,
            "label": meta["label"],
            "min": round(min_val, 2),
            "whisker_low": round(whisker_min, 2),
            "q1": round(q1, 2),
            "median": round(median, 2),
            "mean": round(mean_val, 2),
            "q3": round(q3, 2),
            "whisker_high": round(whisker_max, 2),
            "max": round(max_val, 2),
            "iqr": round(iqr, 2),
            "lower_fence": round(lower_fence, 2),
            "upper_fence": round(upper_fence, 2),
            "outliers": outliers,
        }

        # Compute histogram bins
        num_bins = min(8, max(4, int(np.ceil(np.sqrt(len(vals))))))
        if min_val == max_val:
            histograms[col] = [
                {
                    "bin_label": f"{min_val:.1f}",
                    "bin_start": round(min_val, 2),
                    "bin_end": round(max_val, 2),
                    "count": int(len(vals)),
                }
            ]
        else:
            counts, bin_edges = np.histogram(vals, bins=num_bins)
            bins_list = []
            for b_idx in range(len(counts)):
                b_start = float(bin_edges[b_idx])
                b_end = float(bin_edges[b_idx + 1])
                bins_list.append(
                    {
                        "bin_label": f"{b_start:.0f}–{b_end:.0f}"
                        if meta["key"] not in ("comment_ratio",)
                        else f"{b_start:.1f}–{b_end:.1f}",
                        "bin_start": round(b_start, 2),
                        "bin_end": round(b_end, 2),
                        "count": int(counts[b_idx]),
                    }
                )
            histograms[col] = bins_list

    # Risk / Defect category distribution
    risk_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    ml_predicted_defects = 0
    has_ml_predictions = False
    for f in parsed_files:
        rc = f.get("risk_category", "LOW")
        if rc in risk_counts:
            risk_counts[rc] += 1
        if f.get("assessment_mode") == "ML_MODEL_PREDICTION":
            has_ml_predictions = True
            if (f.get("ml_defect_probability") or 0) >= 0.5:
                ml_predicted_defects += 1

    risk_distribution = [
        {"category": "High Risk", "key": "HIGH", "count": risk_counts["HIGH"]},
        {"category": "Medium Risk", "key": "MEDIUM", "count": risk_counts["MEDIUM"]},
        {"category": "Low Risk", "key": "LOW", "count": risk_counts["LOW"]},
    ]

    defect_distribution = {
        "has_labelled_defect_data": has_ml_predictions,
        "ml_predicted_defect_count": ml_predicted_defects if has_ml_predictions else None,
        "non_defective_count": (len(parsed_files) - ml_predicted_defects) if has_ml_predictions else None,
        "risk_tier_distribution": {
            "HIGH": risk_counts["HIGH"],
            "MEDIUM": risk_counts["MEDIUM"],
            "LOW": risk_counts["LOW"],
        },
        "note": (
            "Defect predictions generated by the connected scikit-learn classification model."
            if has_ml_predictions
            else "No ground-truth defect labels or trained ML defect classifier were active for this run. Showing preliminary rule-based risk tier counts instead."
        ),
    }

    return sanitize_for_json(
        {
            "file_count": len(file_dicts),
            "parsed_file_count": len(parsed_files),
            "sufficient_sample": len(parsed_files) >= 3,
            "small_project_warning": small_project_warning,
            "metrics_metadata": NUMERIC_METRICS_META,
            "summary_statistics": summary_stats,
            "histograms": histograms,
            "box_plots": box_plots,
            "risk_distribution": risk_distribution,
            "defect_distribution": defect_distribution,
            "has_ml_predictions": has_ml_predictions,
            "ml_predicted_defect_count": ml_predicted_defects if has_ml_predictions else None,
            "files_data": parsed_files,
        }
    )


def compute_correlation_matrix(file_dicts: list[dict]) -> dict:
    """
    Compute the real Pearson correlation matrix across numerical software metrics
    using pandas. Drops constant columns before correlating and requires at least
    3 parsed files for meaningful correlation statistics.
    """
    parsed_files = [f for f in file_dicts if f.get("parse_status") == "SUCCESS"]
    corr_features = [
        ("loc", "LOC"),
        ("cyclomatic_complexity", "Complexity"),
        ("max_method_complexity", "Max Method CC"),
        ("method_count", "Methods"),
        ("maintainability_index", "Maintainability"),
        ("comment_ratio", "Comment %"),
        ("fan_out", "Fan-Out"),
        ("code_smell_count", "Code Smells"),
        ("risk_score", "Risk Score"),
    ]

    if len(parsed_files) < 3:
        return sanitize_for_json(
            {
                "sample_size": len(parsed_files),
                "sufficient_data": False,
                "message": (
                    f"Only {len(parsed_files)} parsed Java file(s) in this project. "
                    "At least 3 parsed Java files are required to compute meaningful Pearson correlations and distributions."
                ),
                "features": [{"key": k, "label": lbl} for k, lbl in corr_features],
                "dropped_constant_columns": [],
                "matrix": [],
                "notable_correlations": [],
                "notable_pairs": [],
            }
        )

    df = pd.DataFrame(parsed_files)
    available_cols = [k for k, _ in corr_features if k in df.columns]
    sub_df = df[available_cols].apply(pd.to_numeric, errors="coerce")

    # Drop constant columns (zero variance / <= 1 unique non-null value) before correlating
    dropped_constant_columns = [
        col for col in available_cols if sub_df[col].dropna().nunique() <= 1
    ]
    active_cols = [col for col in available_cols if col not in dropped_constant_columns]

    if len(active_cols) < 2:
        return sanitize_for_json(
            {
                "sample_size": len(parsed_files),
                "sufficient_data": False,
                "message": (
                    "Fewer than 2 metrics have non-zero variance across the analyzed files. "
                    "Constant columns were dropped prior to correlation analysis."
                ),
                "features": [{"key": k, "label": lbl} for k, lbl in corr_features if k in active_cols],
                "dropped_constant_columns": dropped_constant_columns,
                "matrix": [],
                "notable_correlations": [],
                "notable_pairs": [],
            }
        )

    corr_df = sub_df[active_cols].corr(method="pearson")

    matrix_rows = []
    notable_pairs = []
    label_map = dict(corr_features)
    active_corr_features = [(k, lbl) for k, lbl in corr_features if k in active_cols]

    for i, (r_key, r_label) in enumerate(active_corr_features):
        if r_key not in corr_df.index:
            continue
        row_cells = []
        row_values = {}
        for j, (c_key, c_label) in enumerate(active_corr_features):
            if c_key not in corr_df.columns:
                continue
            val = corr_df.loc[r_key, c_key]
            if pd.isna(val) or np.isinf(val):
                coeff = None
            else:
                coeff = round(float(val), 3)

            row_values[c_key] = coeff
            row_cells.append(
                {
                    "x_key": c_key,
                    "x_label": c_label,
                    "y_key": r_key,
                    "y_label": r_label,
                    "coefficient": coeff,
                }
            )

            if i < j and coeff is not None:
                abs_c = abs(coeff)
                if abs_c >= 0.7:
                    strength = "Strong"
                elif abs_c >= 0.4:
                    strength = "Moderate"
                elif abs_c >= 0.2:
                    strength = "Weak"
                else:
                    strength = "Negligible"
                direction = "Positive" if coeff > 0 else "Negative"
                notable_pairs.append(
                    {
                        "feature_a": r_label,
                        "feature_a_key": r_key,
                        "feature_b": c_label,
                        "feature_b_key": c_key,
                        "r": coeff,
                        "coefficient": coeff,
                        "abs_coefficient": round(abs_c, 3),
                        "strength": strength,
                        "direction": direction,
                        "interpretation": f"{strength} {direction.lower()} correlation (r = {coeff:+.2f}) between {r_label} and {c_label}",
                    }
                )
        matrix_rows.append(
            {
                "feature_key": r_key,
                "feature_label": label_map[r_key],
                "values": row_values,
                "correlations": row_cells,
            }
        )

    notable_pairs.sort(key=lambda x: x["abs_coefficient"], reverse=True)

    return sanitize_for_json(
        {
            "sample_size": len(parsed_files),
            "sufficient_data": True,
            "method": "Pearson Product-Moment Correlation Coefficient (r)",
            "features": [{"key": k, "label": lbl} for k, lbl in active_corr_features],
            "dropped_constant_columns": dropped_constant_columns,
            "matrix": matrix_rows,
            "notable_correlations": notable_pairs[:10],
            "notable_pairs": notable_pairs[:10],
        }
    )

