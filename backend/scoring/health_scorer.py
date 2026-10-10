def compute_project_health_score(
    file_metrics: list[dict],
    risk_assessments: list[dict],
    weights: dict = None,
) -> dict:
    """
    Compute an explainable 0-100 Project Health Score from normalized software quality indicators:
    1. Maintainability Component (higher MI -> higher health score)
    2. Complexity Control Component (lower average/hotspot complexity -> higher health score)
    3. Code Quality & Smell Density Component (fewer weighted smells per 100 LOC -> higher health score)
    4. Defect & Technical Debt Risk Component (lower file risk scores -> higher health score)

    Explicitly handles missing metrics by re-normalizing active weights and documenting adjustments.
    """
    weights = weights or {
        "maintainability_weight": 0.30,
        "complexity_weight": 0.30,
        "code_quality_weight": 0.20,
        "defect_risk_weight": 0.20,
    }

    total_files = len(file_metrics)
    parsed_files = [f for f in file_metrics if f.get("parse_status") == "SUCCESS"]
    parsed_count = len(parsed_files)

    if total_files == 0 or parsed_count == 0:
        return {
            "health_score": 0.0,
            "health_grade": "F",
            "components": {},
            "methodology_note": (
                "No valid Java source files could be parsed into an AST. Health score defaults to 0."
            ),
        }

    total_loc = sum(max(f.get("loc", 0), 1) for f in parsed_files)

    # 1. Maintainability Sub-score (0-100)
    mi_files = [f for f in parsed_files if f.get("maintainability_index") is not None]
    if mi_files:
        mi_loc_sum = sum(max(f.get("loc", 1), 1) for f in mi_files)
        weighted_mi = (
            sum(float(f["maintainability_index"]) * max(f.get("loc", 1), 1) for f in mi_files)
            / mi_loc_sum
        )
        # Scale gently so MI >= 78 approaches 95-100
        maintainability_subscore = max(0.0, min(100.0, weighted_mi * 1.12))
        mi_available = True
    else:
        weighted_mi = None
        maintainability_subscore = None
        mi_available = False

    # 2. Complexity Control Sub-score (0-100)
    avg_method_ccs = [float(f.get("avg_method_complexity", 1.0)) for f in parsed_files]
    mean_method_cc = sum(avg_method_ccs) / parsed_count
    high_cc_files = sum(
        1
        for f in parsed_files
        if f.get("max_method_complexity", 0) >= 10 or f.get("cyclomatic_complexity", 0) >= 25
    )
    high_cc_ratio = high_cc_files / parsed_count
    complexity_penalty = max(0.0, (mean_method_cc - 1.2) * 8.5) + (high_cc_ratio * 42.0)
    complexity_subscore = max(0.0, min(100.0, 100.0 - complexity_penalty))

    # 3. Code Quality & Smell Density Sub-score (0-100)
    weighted_smell_points = 0.0
    for f in parsed_files:
        for s in f.get("code_smells", []):
            sev = s.get("severity", "LOW")
            if sev == "HIGH":
                weighted_smell_points += 3.0
            elif sev == "MEDIUM":
                weighted_smell_points += 1.75
            else:
                weighted_smell_points += 0.75

    smell_density_per_100_loc = (weighted_smell_points / max(total_loc, 1)) * 100.0
    failed_ratio = (total_files - parsed_count) / total_files
    quality_penalty = (smell_density_per_100_loc * 11.5) + (failed_ratio * 35.0)
    code_quality_subscore = max(0.0, min(100.0, 100.0 - quality_penalty))

    # 4. Defect & Technical Debt Risk Sub-score (0-100)
    if risk_assessments:
        avg_risk = sum(r.get("risk_score", 0.0) for r in risk_assessments) / len(risk_assessments)
        high_risk_ratio = (
            sum(1 for r in risk_assessments if r.get("risk_category") == "HIGH")
            / len(risk_assessments)
        )
        risk_penalty = (avg_risk * 0.65) + (high_risk_ratio * 35.0)
        defect_risk_subscore = max(0.0, min(100.0, 100.0 - risk_penalty))
    else:
        avg_risk = 0.0
        high_risk_ratio = 0.0
        defect_risk_subscore = 100.0

    raw_components = [
        {
            "key": "maintainability",
            "label": "Maintainability Index",
            "available": mi_available,
            "subscore": round(maintainability_subscore, 2) if mi_available else None,
            "configured_weight": float(weights.get("maintainability_weight", 0.30)),
            "direction": "HIGHER_IS_BETTER",
            "raw_indicator": (
                f"LOC-weighted Maintainability Index: {weighted_mi:.1f}/100"
                if mi_available
                else "Unavailable"
            ),
            "explanation": "Measures structural readability and ease of modification using Halstead Volume, Cyclomatic Complexity, LOC, and Comment Ratio.",
        },
        {
            "key": "complexity",
            "label": "Complexity Control",
            "available": True,
            "subscore": round(complexity_subscore, 2),
            "configured_weight": float(weights.get("complexity_weight", 0.30)),
            "direction": "LOWER_COMPLEXITY_IS_BETTER",
            "raw_indicator": f"Mean Method CC: {mean_method_cc:.2f}, Hotspot Files: {high_cc_files}/{parsed_count}",
            "explanation": "Penalizes excessive branching complexity per method and concentration of high-complexity classes.",
        },
        {
            "key": "code_quality",
            "label": "Code Quality & Smell Density",
            "available": True,
            "subscore": round(code_quality_subscore, 2),
            "configured_weight": float(weights.get("code_quality_weight", 0.20)),
            "direction": "LOWER_SMELL_DENSITY_IS_BETTER",
            "raw_indicator": f"Weighted Smell Density: {smell_density_per_100_loc:.2f} pts / 100 LOC",
            "explanation": "Evaluates density and severity of static code smells (God Class, Long Method, Deep Nesting, High Coupling) and AST parse health.",
        },
        {
            "key": "defect_risk",
            "label": "Risk & Technical Debt Exposure",
            "available": True,
            "subscore": round(defect_risk_subscore, 2),
            "configured_weight": float(weights.get("defect_risk_weight", 0.20)),
            "direction": "LOWER_RISK_IS_BETTER",
            "raw_indicator": f"Mean Risk Score: {avg_risk:.1f}/100, High-Risk Files: {high_risk_ratio * 100:.1f}%",
            "explanation": "Reflects aggregate file-level risk exposure from rule-based heuristics or connected ML defect model.",
        },
    ]

    active_weight_sum = sum(
        c["configured_weight"] for c in raw_components if c["available"] and c["subscore"] is not None
    )
    if active_weight_sum <= 0:
        active_weight_sum = 1.0

    final_score = 0.0
    components_dict = {}
    for comp in raw_components:
        if comp["available"] and comp["subscore"] is not None:
            effective_weight = comp["configured_weight"] / active_weight_sum
            contribution = comp["subscore"] * effective_weight
            final_score += contribution
        else:
            effective_weight = 0.0
            contribution = 0.0

        comp_entry = {
            **comp,
            "normalized_score": round(comp["subscore"], 2) if comp["subscore"] is not None else 0.0,
            "weight": round(effective_weight, 4),
            "effective_weight": round(effective_weight, 4),
            "raw_value": comp["raw_indicator"],
            "weighted_contribution": round(contribution, 2),
            "weighted_points": round(contribution, 2),
        }
        components_dict[comp["key"]] = comp_entry

    final_score = round(max(0.0, min(100.0, final_score)), 1)

    if final_score >= 85.0:
        grade = "A"
    elif final_score >= 72.0:
        grade = "B"
    elif final_score >= 58.0:
        grade = "C"
    elif final_score >= 45.0:
        grade = "D"
    else:
        grade = "F"

    return {
        "health_score": final_score,
        "health_grade": grade,
        "components": components_dict,
        "weights_used": weights,
        "methodology_note": (
            "The Project Health Score (0-100) is an explainable multi-factor heuristic combining "
            "normalized Maintainability Index, Cyclomatic Complexity control, Code Smell density, "
            "and Risk exposure. Thresholds and weights are configurable project heuristics for "
            "engineering prioritization and are not claimed as universal industry standards."
        ),
    }
