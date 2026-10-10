def generate_refactoring_priorities(
    file_metrics: list[dict],
    risk_assessments: list[dict],
    priority_weights: dict = None,
    thresholds: dict = None,
) -> list[dict]:
    """
    Rank analyzed Java files for refactoring using a transparent, configurable multi-criteria formula.

    Criteria & Default Weights:
    - Risk Score (ML defect probability or rule-based heuristic): 35%
    - Cyclomatic Complexity & Nesting Intensity: 25%
    - Maintainability Index Deficit: 20%
    - Code-Smell Severity Score: 20%

    Methodological Note:
    This ranking is a transparent multi-criteria decision heuristic intended to help developers
    triage technical debt inspection. It is not claimed as a novel or empirically validated algorithm.
    """
    priority_weights = priority_weights or {
        "risk_weight": 0.35,
        "complexity_weight": 0.25,
        "maintainability_weight": 0.20,
        "smell_severity_weight": 0.20,
    }
    thresholds = thresholds or {}

    w_risk = float(priority_weights.get("risk_weight", 0.35))
    w_cc = float(priority_weights.get("complexity_weight", 0.25))
    w_mi = float(priority_weights.get("maintainability_weight", 0.20))
    w_smell = float(priority_weights.get("smell_severity_weight", 0.20))

    items = []
    for fm, risk in zip(file_metrics, risk_assessments):
        if fm.get("parse_status") != "SUCCESS":
            priority_score = 85.0
            breakdown = {
                "risk_component": round(75.0 * w_risk, 2),
                "complexity_component": 0.0,
                "maintainability_component": 0.0,
                "smell_severity_component": 0.0,
                "note": "Syntax/AST parse failure prioritized for immediate compilation fix.",
            }
            reasons = [
                f"File failed Java syntax parsing: {fm.get('parse_error', 'Syntax error')}."
            ]
            actions = [
                "Fix Java syntax errors and verify compilation with javac/Maven/Gradle before re-running static analysis."
            ]
            effort_band = "Low (0.5–1.5 hrs)"
            effort_expl = "Syntax remediation effort based on single-file compilation error."
        else:
            risk_score = float(risk.get("risk_score", 0.0))
            cc = fm.get("cyclomatic_complexity", 1)
            max_m_cc = fm.get("max_method_complexity", 1)
            max_nesting = fm.get("max_nesting_depth", 0)
            mi = fm.get("maintainability_index")
            mi_val = float(mi) if mi is not None else 75.0
            smells = fm.get("code_smells", [])

            # Normalized 0-100 sub-scores
            cc_norm = min(
                100.0,
                (max(0, max_m_cc - 1) / 18.0) * 55.0
                + (max(0, cc - 2) / 35.0) * 30.0
                + (max_nesting / 6.0) * 15.0,
            )
            mi_deficit_norm = max(0.0, min(100.0, (85.0 - mi_val) * 1.45))

            high_s = sum(1 for s in smells if s.get("severity") == "HIGH")
            med_s = sum(1 for s in smells if s.get("severity") == "MEDIUM")
            low_s = sum(1 for s in smells if s.get("severity") == "LOW")
            smell_norm = min(100.0, high_s * 30.0 + med_s * 16.0 + low_s * 7.0)

            priority_score = round(
                w_risk * risk_score
                + w_cc * cc_norm
                + w_mi * mi_deficit_norm
                + w_smell * smell_norm,
                2,
            )

            breakdown = {
                "risk_score_raw": round(risk_score, 1),
                "risk_weighted": round(w_risk * risk_score, 2),
                "complexity_norm": round(cc_norm, 1),
                "complexity_weighted": round(w_cc * cc_norm, 2),
                "maintainability_deficit_norm": round(mi_deficit_norm, 1),
                "maintainability_weighted": round(w_mi * mi_deficit_norm, 2),
                "smell_severity_norm": round(smell_norm, 1),
                "smell_severity_weighted": round(w_smell * smell_norm, 2),
                "weights": priority_weights,
            }

            reasons, actions = _build_reasons_and_actions(fm, risk, thresholds)
            effort_band, effort_expl = _estimate_refactoring_effort(fm, smells)

        if priority_score >= 65.0:
            priority_level = "CRITICAL"
        elif priority_score >= 45.0:
            priority_level = "HIGH"
        elif priority_score >= 25.0:
            priority_level = "MEDIUM"
        else:
            priority_level = "LOW"

        items.append(
            {
                "file_index": fm.get("_index"),
                "file_name": fm.get("file_name"),
                "file_path": fm.get("file_path"),
                "priority_score": priority_score,
                "priority_level": priority_level,
                "priority_breakdown": breakdown,
                "primary_reasons": reasons,
                "suggested_actions": actions,
                "estimated_effort": effort_band,
                "effort_explanation": effort_expl,
            }
        )

    # Sort descending by priority_score, then by cyclomatic_complexity descending
    items.sort(
        key=lambda x: (
            x["priority_score"],
            file_metrics[x["file_index"]].get("cyclomatic_complexity", 0)
            if x.get("file_index") is not None
            else 0,
        ),
        reverse=True,
    )

    for rank_idx, item in enumerate(items, start=1):
        item["priority_rank"] = rank_idx

    return items


def _build_reasons_and_actions(fm: dict, risk: dict, thresholds: dict) -> tuple[list[str], list[str]]:
    reasons = []
    actions = []

    methods = fm.get("methods_detail", [])
    smells = fm.get("code_smells", [])
    smell_types = {s["type"] for s in smells}

    high_m_cc = thresholds.get("high_method_complexity", 10)
    long_m_loc = thresholds.get("long_method_loc", 40)
    deep_nest = thresholds.get("deep_nesting_threshold", 4)
    max_params = thresholds.get("max_parameters_threshold", 5)

    complex_methods = sorted(
        [m for m in methods if m["complexity"] >= high_m_cc],
        key=lambda m: m["complexity"],
        reverse=True,
    )
    long_methods = sorted(
        [m for m in methods if m["loc"] >= long_m_loc],
        key=lambda m: m["loc"],
        reverse=True,
    )

    if "GOD_CLASS" in smell_types:
        reasons.append(
            f"Large class scope ({fm['loc']} LOC across {fm['method_count']} methods and {fm['field_count']} fields)."
        )
        actions.append(
            "Apply Extract Class / Single Responsibility Principle (SRP) to separate cohesive responsibilities into smaller domain or helper classes."
        )

    if complex_methods:
        top_m = complex_methods[0]
        reasons.append(
            f"Method '{top_m['name']}' (line {top_m['line']}) has Cyclomatic Complexity {top_m['complexity']} (threshold: {high_m_cc})."
        )
        actions.append(
            f"Refactor '{top_m['name']}' using Extract Method, Guard Clauses, or Strategy/Polymorphism to reduce conditional branching."
        )
    elif fm.get("cyclomatic_complexity", 0) >= thresholds.get("high_file_complexity", 25):
        reasons.append(
            f"High cumulative file Cyclomatic Complexity ({fm['cyclomatic_complexity']})."
        )
        actions.append(
            "Decompose complex decision workflows into dedicated validator or handler methods with focused unit tests."
        )

    if long_methods:
        top_lm = long_methods[0]
        reasons.append(
            f"Method '{top_lm['name']}' spans {top_lm['loc']} lines (threshold: {long_m_loc} lines)."
        )
        actions.append(
            f"Break down '{top_lm['name']}' (line {top_lm['line']}) into smaller, well-named helper methods."
        )

    if fm.get("max_nesting_depth", 0) > deep_nest:
        reasons.append(
            f"Deep control-flow nesting reaches {fm['max_nesting_depth']} levels (threshold: {deep_nest})."
        )
        actions.append(
            "Replace nested if/else/loop blocks with early-return guard clauses or extracted predicate helpers."
        )

    if fm.get("max_parameters", 0) > max_params:
        reasons.append(
            f"Method parameter count reaches {fm['max_parameters']} (threshold: {max_params})."
        )
        actions.append(
            "Introduce Parameter Object or Builder pattern to encapsulate long method parameter lists."
        )

    if "HIGH_COUPLING" in smell_types:
        reasons.append(
            f"High efferent coupling with {fm['fan_out']} external type references."
        )
        actions.append(
            "Reduce direct dependencies via Dependency Inversion (interfaces) and facade/service boundaries."
        )

    if "LOW_DOCUMENTATION" in smell_types:
        reasons.append(
            f"Low comment density ({fm['comment_ratio']:.1f}% across {fm['loc']} LOC)."
        )
        actions.append(
            "Add Javadoc comments for public API contracts, non-obvious invariants, and edge-case behavior."
        )

    if not reasons:
        mi = fm.get("maintainability_index")
        reasons.append(
            f"Maintainability Index is {mi:.1f}/100 with Cyclomatic Complexity {fm.get('cyclomatic_complexity', 1)}."
            if mi is not None
            else f"Baseline structural complexity CC={fm.get('cyclomatic_complexity', 1)}."
        )
    if not actions:
        actions.append(
            "No urgent structural refactoring required; maintain unit test coverage and monitor complexity during future changes."
        )

    return reasons, actions


def _estimate_refactoring_effort(fm: dict, smells: list[dict]) -> tuple[str, str]:
    """
    Calculate a defensible relative refactoring effort band from observable AST scope:
    number of complex methods, long methods, severe code smells, and external coupling fan-out.
    """
    methods = fm.get("methods_detail", [])
    complex_m_count = sum(1 for m in methods if m["complexity"] >= 10)
    long_m_count = sum(1 for m in methods if m["loc"] >= 40)
    high_smells = sum(1 for s in smells if s.get("severity") == "HIGH")
    fan_out = fm.get("fan_out", 0)

    effort_points = (
        complex_m_count * 2.0
        + long_m_count * 1.5
        + high_smells * 2.0
        + (1.5 if fan_out >= 12 else 0.0)
        + (1.0 if fm.get("loc", 0) >= 250 else 0.0)
    )

    if effort_points <= 1.0:
        band = "Minimal (< 1 hr)"
    elif effort_points <= 3.5:
        band = "Low (1–2 hrs)"
    elif effort_points <= 7.0:
        band = "Moderate (2–4 hrs)"
    else:
        band = "High (4–8 hrs)"

    explanation = (
        f"Heuristic estimate derived from {complex_m_count} high-complexity method(s), "
        f"{long_m_count} long method(s), {high_smells} high-severity smell(s), and fan-out={fan_out} "
        f"(Effort Index={effort_points:.1f}). Actual effort depends on test suite coverage and domain familiarity."
    )
    return band, explanation
