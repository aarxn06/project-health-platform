# Machine Learning Model Integration Guide

The platform includes a clean integration interface (`backend/ml/predictor.py`) for connecting a trained `scikit-learn` software defect prediction model.

## How the Integration Works

1. By default, the platform inspects `ML_MODEL_PATH` (default: `ml/models/defect_predictor.joblib`) and `ML_METADATA_PATH` (default: `ml/models/model_metadata.json`).
2. When no model file is present, the platform operates in **Rule-Based Heuristic Mode (`RULE_BASED_HEURISTIC`)** and clearly labels all risk scores as deterministic static-analysis heuristics rather than ML predictions.
3. To integrate a trained `scikit-learn` model:
   - Train a classifier or `Pipeline` (e.g., `RandomForestClassifier`, `GradientBoostingClassifier`, `LogisticRegression`) on a subset of the supported Java metrics:
     - `loc`, `total_lines`, `comment_lines`, `blank_lines`, `comment_ratio`
     - `class_count`, `interface_count`, `method_count`, `field_count`
     - `cyclomatic_complexity`, `avg_method_complexity`, `max_method_complexity`, `max_nesting_depth`
     - `import_count`, `fan_out`, `coupling_score`
     - `long_method_count`, `max_method_loc`, `max_parameters`
     - `maintainability_index`, `halstead_volume`, `code_smell_count`
   - Save the bundle using `joblib.dump`:
     ```python
     import joblib

     artifact = {
         "model": trained_pipeline,
         "feature_names": ["loc", "cyclomatic_complexity", "max_method_complexity", "fan_out", "maintainability_index"],
         "model_name": "JavaDefectRandomForest",
         "version": "1.0.0"
     }
     joblib.dump(artifact, "backend/ml/models/defect_predictor.joblib")
     ```
4. On the next analysis run or status check, `MLDefectPredictionService` automatically verifies the model's `predict`/`predict_proba` methods and validates that all `feature_names` match the analyzer's output schema.
