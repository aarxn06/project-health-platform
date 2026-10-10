import json
import os
import joblib
import numpy as np
import pandas as pd

SUPPORTED_EXTRACTED_FEATURES = [
    "loc",
    "total_lines",
    "comment_lines",
    "blank_lines",
    "comment_ratio",
    "class_count",
    "interface_count",
    "method_count",
    "field_count",
    "cyclomatic_complexity",
    "avg_method_complexity",
    "max_method_complexity",
    "max_nesting_depth",
    "import_count",
    "fan_out",
    "coupling_score",
    "long_method_count",
    "max_method_loc",
    "max_parameters",
    "maintainability_index",
    "halstead_volume",
    "code_smell_count",
]


class MLModelIntegrationError(Exception):
    """Raised when a configured ML model is missing, corrupted, or feature-incompatible."""

    def __init__(self, message: str, code: str = "ML_MODEL_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class MLDefectPredictionService:
    """
    Service interface for loading, validating, and running a saved scikit-learn
    defect-prediction model and preprocessing pipeline.

    When no compatible model is present, this service explicitly reports its unavailability
    so the platform transparently uses deterministic rule-based risk assessment.
    """

    def __init__(self, base_dir: str, model_rel_path: str = None, metadata_rel_path: str = None):
        self.base_dir = base_dir
        self.model_rel_path = model_rel_path or os.environ.get(
            "ML_MODEL_PATH", "ml/models/defect_predictor.joblib"
        )
        self.metadata_rel_path = metadata_rel_path or os.environ.get(
            "ML_METADATA_PATH", "ml/models/model_metadata.json"
        )
        self.model_abs_path = (
            self.model_rel_path
            if os.path.isabs(self.model_rel_path)
            else os.path.join(self.base_dir, self.model_rel_path)
        )
        self.metadata_abs_path = (
            self.metadata_rel_path
            if os.path.isabs(self.metadata_rel_path)
            else os.path.join(self.base_dir, self.metadata_rel_path)
        )

        self.estimator = None
        self.preprocessor = None
        self.feature_names = []
        self.model_name = None
        self.model_version = None
        self.supports_proba = False
        self.is_available = False
        self.status_code = "NOT_FOUND"
        self.status_message = "No trained ML model artifact found at configured path."

        self._load_and_validate()

    def _load_and_validate(self):
        if not os.path.exists(self.model_abs_path):
            self.is_available = False
            self.status_code = "MODEL_NOT_FOUND"
            self.status_message = (
                f"No trained scikit-learn model file found at '{self.model_rel_path}'. "
                "Operating in deterministic Rule-Based Heuristic mode."
            )
            return

        try:
            loaded = joblib.load(self.model_abs_path)
        except Exception as exc:
            self.is_available = False
            self.status_code = "MODEL_LOAD_ERROR"
            self.status_message = f"Failed to load saved model file: {str(exc)}"
            return

        metadata = {}
        if os.path.exists(self.metadata_abs_path):
            try:
                with open(self.metadata_abs_path, "r", encoding="utf-8") as mf:
                    metadata = json.load(mf)
            except Exception as exc:
                self.is_available = False
                self.status_code = "METADATA_LOAD_ERROR"
                self.status_message = f"Failed to parse model metadata JSON: {str(exc)}"
                return

        if isinstance(loaded, dict):
            self.estimator = loaded.get("model") or loaded.get("pipeline")
            self.preprocessor = loaded.get("preprocessor")
            self.feature_names = loaded.get("feature_names") or metadata.get("feature_names") or []
            self.model_name = loaded.get("model_name") or metadata.get("model_name") or "Custom Defect Classifier"
            self.model_version = loaded.get("version") or metadata.get("version") or "1.0.0"
        else:
            self.estimator = loaded
            self.preprocessor = None
            if hasattr(loaded, "feature_names_in_"):
                self.feature_names = [str(f) for f in loaded.feature_names_in_]
            else:
                self.feature_names = metadata.get("feature_names", [])
            self.model_name = metadata.get("model_name") or loaded.__class__.__name__
            self.model_version = metadata.get("version") or "1.0.0"

        if self.estimator is None or not callable(getattr(self.estimator, "predict", None)):
            self.is_available = False
            self.status_code = "INVALID_ESTIMATOR"
            self.status_message = (
                "Loaded artifact does not expose a valid scikit-learn 'predict' interface."
            )
            return

        if not self.feature_names or not isinstance(self.feature_names, list):
            self.is_available = False
            self.status_code = "MISSING_FEATURE_SCHEMA"
            self.status_message = (
                "Model artifact does not specify required input feature names ('feature_names' or 'feature_names_in_')."
            )
            return

        unsupported_features = [
            f for f in self.feature_names if f not in SUPPORTED_EXTRACTED_FEATURES
        ]
        if unsupported_features:
            self.is_available = False
            self.status_code = "INCOMPATIBLE_FEATURES"
            self.status_message = (
                f"Model requires features not produced by the Java static analyzer: {unsupported_features}. "
                f"Supported features: {SUPPORTED_EXTRACTED_FEATURES}"
            )
            return

        self.supports_proba = callable(getattr(self.estimator, "predict_proba", None))
        self.is_available = True
        self.status_code = "READY"
        self.status_message = (
            f"Loaded compatible model '{self.model_name}' (v{self.model_version}) "
            f"with {len(self.feature_names)} validated features."
        )

    def get_status(self) -> dict:
        return {
            "is_available": self.is_available,
            "status_code": self.status_code,
            "status_message": self.status_message,
            "active_assessment_mode": (
                "ML_MODEL_PREDICTION" if self.is_available else "RULE_BASED_HEURISTIC"
            ),
            "configured_model_path": self.model_rel_path,
            "configured_metadata_path": self.metadata_rel_path,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "required_features": self.feature_names,
            "supports_probability": self.supports_proba,
            "supported_analyzer_features": SUPPORTED_EXTRACTED_FEATURES,
            "supported_java_features": SUPPORTED_EXTRACTED_FEATURES,
        }

    def validate_and_extract_feature_vector(self, file_metric: dict) -> pd.DataFrame:
        """
        Validate input feature presence, ordering, and numerical types for a single file's metrics.
        Raises MLModelIntegrationError if any required feature is missing or non-numeric.
        """
        if not self.is_available:
            raise MLModelIntegrationError(
                self.status_message, code=self.status_code
            )

        if file_metric.get("parse_status") != "SUCCESS":
            raise MLModelIntegrationError(
                "Cannot run ML prediction on a file that failed Java AST parsing.",
                code="UNPARSED_FILE",
            )

        row = {}
        for feat in self.feature_names:
            if feat not in file_metric:
                raise MLModelIntegrationError(
                    f"Required feature '{feat}' is missing from extracted file metrics.",
                    code="MISSING_INPUT_FEATURE",
                )
            val = file_metric[feat]
            if val is None or not isinstance(val, (int, float, np.number)):
                raise MLModelIntegrationError(
                    f"Feature '{feat}' has invalid or non-numeric value: {val!r}.",
                    code="INVALID_FEATURE_TYPE",
                )
            if np.isnan(float(val)) or np.isinf(float(val)):
                raise MLModelIntegrationError(
                    f"Feature '{feat}' contains NaN or infinite value.",
                    code="NON_FINITE_FEATURE",
                )
            row[feat] = float(val)

        # Preserve exact training feature ordering
        df = pd.DataFrame([row], columns=self.feature_names)
        return df

    def predict_for_file(self, file_metric: dict) -> dict:
        """
        Run defect prediction for a single file's extracted metrics dictionary.
        Returns prediction label (0 or 1) and defect probability (if supported by model).
        """
        X = self.validate_and_extract_feature_vector(file_metric)
        try:
            if self.preprocessor is not None:
                X_proc = self.preprocessor.transform(X)
            else:
                X_proc = X

            pred_raw = self.estimator.predict(X_proc)
            pred_label = int(pred_raw[0])

            proba = None
            if self.supports_proba:
                proba_arr = self.estimator.predict_proba(X_proc)
                if proba_arr.shape[1] >= 2:
                    proba = float(proba_arr[0][1])
                else:
                    proba = float(proba_arr[0][0])

            return {
                "prediction_label": pred_label,
                "defect_probability": round(proba, 4) if proba is not None else None,
                "model_name": f"{self.model_name} v{self.model_version}",
                "assessment_mode": "ML_MODEL_PREDICTION",
            }
        except Exception as exc:
            raise MLModelIntegrationError(
                f"Model inference failed: {str(exc)}", code="INFERENCE_ERROR"
            )
