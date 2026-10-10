import json
from datetime import datetime, timezone
from database import db
from database.models import ApplicationSetting


DEFAULT_SETTINGS = {
    "upload_limits": {
        "category": "upload",
        "description": "ZIP upload and safe extraction boundaries to prevent resource exhaustion and zip-bomb attacks.",
        "value": {
            "max_upload_size_mb": 25,
            "max_extracted_files": 2000,
            "max_extracted_size_mb": 100,
            "allowed_extensions": [".zip"],
        },
    },
    "analysis_thresholds": {
        "category": "analysis",
        "description": "Configurable heuristic thresholds used for static Java code-smell detection.",
        "value": {
            "god_class_loc": 250,
            "god_class_methods": 15,
            "long_method_loc": 40,
            "high_method_complexity": 10,
            "high_file_complexity": 25,
            "max_parameters_threshold": 5,
            "deep_nesting_threshold": 4,
            "min_comment_ratio_pct": 8.0,
            "high_fan_out_threshold": 12,
        },
    },
    "health_score_weights": {
        "category": "scoring",
        "description": "Relative weights (must sum to 1.0) for calculating the 0-100 Project Health Score.",
        "value": {
            "maintainability_weight": 0.30,
            "complexity_weight": 0.30,
            "code_quality_weight": 0.20,
            "defect_risk_weight": 0.20,
        },
    },
    "priority_weights": {
        "category": "prioritization",
        "description": "Relative weights (must sum to 1.0) for ranking files in Refactoring Priorities.",
        "value": {
            "risk_weight": 0.35,
            "complexity_weight": 0.25,
            "maintainability_weight": 0.20,
            "smell_severity_weight": 0.20,
        },
    },
    "risk_thresholds": {
        "category": "risk",
        "description": "Score boundaries (0-100) for categorizing file risk into High, Medium, and Low tiers (plus optional Critical tier).",
        "value": {
            "critical_risk_threshold": None,
            "high_risk_threshold": 65.0,
            "medium_risk_threshold": 35.0,
        },
    },
    "ml_configuration": {
        "category": "ml",
        "description": "Configuration for external scikit-learn defect prediction model integration.",
        "value": {
            "prefer_ml_when_available": True,
            "model_path": "ml/models/defect_predictor.joblib",
            "metadata_path": "ml/models/model_metadata.json",
            "fallback_mode": "RULE_BASED_HEURISTIC",
        },
    },
}


class SettingsRepository:
    @staticmethod
    def ensure_defaults():
        """Ensure all default settings exist in the database."""
        existing = {s.key: s for s in ApplicationSetting.query.all()}
        changed = False
        for key, meta in DEFAULT_SETTINGS.items():
            if key not in existing:
                setting = ApplicationSetting(
                    key=key,
                    value_json=json.dumps(meta["value"]),
                    category=meta["category"],
                    description=meta["description"],
                )
                db.session.add(setting)
                changed = True
        if changed:
            db.session.commit()

    @staticmethod
    def get_all_settings():
        SettingsRepository.ensure_defaults()
        rows = ApplicationSetting.query.all()
        result = {}
        for row in rows:
            result[row.key] = {
                "value": json.loads(row.value_json),
                "category": row.category,
                "description": row.description,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        return result

    @staticmethod
    def get_setting_value(key: str):
        SettingsRepository.ensure_defaults()
        row = ApplicationSetting.query.filter_by(key=key).first()
        if row:
            return json.loads(row.value_json)
        return DEFAULT_SETTINGS.get(key, {}).get("value", {})

    @staticmethod
    def validate_and_update_settings(payload: dict):
        """
        Validate incoming settings dictionary and persist changes.
        Returns (updated_settings_dict, error_message_or_None).
        """
        SettingsRepository.ensure_defaults()
        if not isinstance(payload, dict) or not payload:
            return None, "Request payload must be a non-empty JSON object."

        # Validate known setting groups
        for key, new_val in payload.items():
            if key not in DEFAULT_SETTINGS:
                return None, f"Unknown setting key: '{key}'."
            if not isinstance(new_val, dict):
                return None, f"Setting '{key}' value must be a JSON object."

            if key == "upload_limits":
                max_mb = new_val.get("max_upload_size_mb", 25)
                max_files = new_val.get("max_extracted_files", 2000)
                max_ext_mb = new_val.get("max_extracted_size_mb", 100)
                if not isinstance(max_mb, (int, float)) or max_mb < 1 or max_mb > 500:
                    return None, "max_upload_size_mb must be between 1 and 500 MB."
                if not isinstance(max_files, int) or max_files < 5 or max_files > 20000:
                    return None, "max_extracted_files must be an integer between 5 and 20000."
                if not isinstance(max_ext_mb, (int, float)) or max_ext_mb < 1 or max_ext_mb > 2000:
                    return None, "max_extracted_size_mb must be between 1 and 2000 MB."

            elif key == "health_score_weights":
                required_keys = [
                    "maintainability_weight",
                    "complexity_weight",
                    "code_quality_weight",
                    "defect_risk_weight",
                ]
                for rk in required_keys:
                    if rk not in new_val or not isinstance(new_val[rk], (int, float)) or new_val[rk] < 0:
                        return None, f"Health score weight '{rk}' must be a non-negative number."
                total = sum(float(new_val[rk]) for rk in required_keys)
                if abs(total - 1.0) > 0.01:
                    return None, f"Health score weights must sum to 1.0 (currently {total:.3f})."

            elif key == "priority_weights":
                required_keys = [
                    "risk_weight",
                    "complexity_weight",
                    "maintainability_weight",
                    "smell_severity_weight",
                ]
                for rk in required_keys:
                    if rk not in new_val or not isinstance(new_val[rk], (int, float)) or new_val[rk] < 0:
                        return None, f"Priority weight '{rk}' must be a non-negative number."
                total = sum(float(new_val[rk]) for rk in required_keys)
                if abs(total - 1.0) > 0.01:
                    return None, f"Refactoring priority weights must sum to 1.0 (currently {total:.3f})."

            elif key == "risk_thresholds":
                high_t = new_val.get("high_risk_threshold")
                med_t = new_val.get("medium_risk_threshold")
                crit_t = new_val.get("critical_risk_threshold")
                if (
                    high_t is None
                    or med_t is None
                    or not isinstance(high_t, (int, float))
                    or not isinstance(med_t, (int, float))
                ):
                    return None, "high_risk_threshold and medium_risk_threshold must be numbers."
                if not (5 <= med_t < high_t <= 95):
                    return (
                        None,
                        "Risk thresholds must satisfy: 5 <= medium_risk_threshold < high_risk_threshold <= 95.",
                    )
                if crit_t is not None and crit_t != "":
                    if not isinstance(crit_t, (int, float)) or not (high_t < float(crit_t) <= 99):
                        return (
                            None,
                            "critical_risk_threshold, when defined, must be greater than high_risk_threshold and <= 99.",
                        )

            elif key == "analysis_thresholds":
                for tk, tv in new_val.items():
                    if not isinstance(tv, (int, float)) or tv <= 0:
                        return None, f"Analysis threshold '{tk}' must be a positive number."

        # Persist changes
        for key, new_val in payload.items():
            row = ApplicationSetting.query.filter_by(key=key).first()
            current_val = json.loads(row.value_json) if row else {}
            merged_val = {**current_val, **new_val}
            if row:
                row.value_json = json.dumps(merged_val)
                row.updated_at = datetime.now(timezone.utc)
            else:
                meta = DEFAULT_SETTINGS[key]
                row = ApplicationSetting(
                    key=key,
                    value_json=json.dumps(merged_val),
                    category=meta["category"],
                    description=meta["description"],
                )
                db.session.add(row)

        db.session.commit()
        return SettingsRepository.get_all_settings(), None

    @staticmethod
    def reset_to_defaults():
        for key, meta in DEFAULT_SETTINGS.items():
            row = ApplicationSetting.query.filter_by(key=key).first()
            if row:
                row.value_json = json.dumps(meta["value"])
                row.updated_at = datetime.now(timezone.utc)
            else:
                db.session.add(
                    ApplicationSetting(
                        key=key,
                        value_json=json.dumps(meta["value"]),
                        category=meta["category"],
                        description=meta["description"],
                    )
                )
        db.session.commit()
        return SettingsRepository.get_all_settings()
