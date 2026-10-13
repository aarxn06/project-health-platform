# Apache Ant 1.7 defect prediction — version-007

The project uses the PROMISE/Jureczko Apache Ant 1.7 dataset, comprising **745 Java classes** (166 marked defective). The included `data/ant-1.7-model-features.csv` is a **derived subset** of the dataset, created from a publicly available mirror: https://github.com/pravaliManchala/SDP/blob/main/ant-1.7.csv. The canonical source is https://zenodo.org/records/268440 (`ant-1.7.csv`).

## Train and evaluate
From `backend/`:

```powershell
py -m pip install -r requirements.txt
py -m pip install matplotlib
py ml/train_model.py
py -m pytest ml/test_trained_model.py -q
py app.py
```

You can optionally download the complete canonical CSV with `py ml/download_dataset.py`, which checks its checksum, then run `py ml/train_model.py --dataset ml/data/ant-1.7.csv`. The repository's GitHub Actions workflow also trains and commits the model **to version-007 only**.

## Method and outputs
- Inputs: `loc` and `wmc` (mapped to backend `loc` and `cyclomatic_complexity`).
- Target: `bug > 0` (defective class) vs `bug == 0`.
- Split: reproducible stratified 80/20 train/test, 5-fold training-only parameter selection.
- Models: Random Forest primary, Logistic Regression comparison, trivial majority baseline.
- Reports: accuracy, balanced accuracy, precision, recall, F1, ROC-AUC, average precision, confusion matrix.
- Generated: `models/defect_predictor.joblib`, `model_metadata.json`, `evaluation_results.json`, `evaluation_results.csv`, `confusion_matrix.png`.
- Backend already loads `models/defect_predictor.joblib` through `MLDefectPredictionService`.

## Scientific limitations
**Class vs file mismatch:** Training observations are Java *classes* while runtime inputs are *Java files*. A file containing multiple classes and a class split across methods are not equivalent observations.

**Metric mismatch:** Jureczko WMC and aggregate file cyclomatic complexity aren't necessarily equal. Line-count conventions for LOC may also differ. We use a two-feature approximation rather than pretending the analyzer extracts all 20 CK metrics.

**Validation:** Split scores measure Ant 1.7 within-dataset behavior only, not cross-project generalization. Treat output as an experimental defect-risk ranking, **not a calibrated probability or production-quality defect claim**.
