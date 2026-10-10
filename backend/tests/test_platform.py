import io
import os
import tempfile
import zipfile
import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression

from app import create_app
from database import db
from analyzer.java_analyzer import analyze_java_file
from ml.predictor import MLDefectPredictionService, MLModelIntegrationError


@pytest.fixture
def client():
    temp_dir = tempfile.mkdtemp(prefix="test_health_platform_")
    db_path = os.path.join(temp_dir, "test.db")
    uploads_dir = os.path.join(temp_dir, "uploads")
    extract_dir = os.path.join(temp_dir, "extract")
    data_dir = os.path.join(temp_dir, "data")

    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            "UPLOADS_DIR": uploads_dir,
            "TEMP_EXTRACT_DIR": extract_dir,
            "DATA_DIR": data_dir,
        }
    )

    with app.test_client() as test_client:
        yield test_client


def make_zip_bytes(files_dict: dict) -> io.BytesIO:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files_dict.items():
            zf.writestr(path, content)
    buf.seek(0)
    return buf


def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    assert body["data"]["status"] == "healthy"
    assert body["data"]["ml_status"]["active_assessment_mode"] == "RULE_BASED_HEURISTIC"


def test_invalid_upload_missing_and_non_zip(client):
    # Missing file field
    res1 = client.post("/api/projects/upload", data={})
    assert res1.status_code == 400
    assert res1.get_json()["error"]["code"] == "MISSING_FILE"

    # Non-zip extension
    res2 = client.post(
        "/api/projects/upload",
        data={"file": (io.BytesIO(b"hello world"), "notes.txt")},
        content_type="multipart/form-data",
    )
    assert res2.status_code == 400
    assert res2.get_json()["error"]["code"] == "INVALID_EXTENSION"

    # Fake zip content with .zip extension
    res3 = client.post(
        "/api/projects/upload",
        data={"file": (io.BytesIO(b"not a real zip archive"), "corrupt.zip")},
        content_type="multipart/form-data",
    )
    assert res3.status_code == 400
    assert res3.get_json()["error"]["code"] == "INVALID_ZIP_FORMAT"


def test_empty_project_and_no_java_files(client):
    # Empty zip
    empty_buf = make_zip_bytes({})
    res1 = client.post(
        "/api/projects/upload",
        data={"file": (empty_buf, "empty.zip")},
        content_type="multipart/form-data",
    )
    assert res1.status_code == 400
    assert res1.get_json()["error"]["code"] == "EMPTY_ARCHIVE"

    # Zip without .java files
    readme_buf = make_zip_bytes({"README.md": "# Only markdown", "config.json": "{}"})
    res2 = client.post(
        "/api/projects/upload",
        data={"file": (readme_buf, "no_java.zip")},
        content_type="multipart/form-data",
    )
    assert res2.status_code == 400
    assert res2.get_json()["error"]["code"] == "NO_JAVA_FILES"


def test_unsafe_archive_path_traversal_rejected(client):
    traversal_buf = make_zip_bytes(
        {
            "../../evil/Exploit.java": "public class Exploit {}",
        }
    )
    res = client.post(
        "/api/projects/upload",
        data={"file": (traversal_buf, "traversal.zip")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "UNSAFE_ARCHIVE_PATH"


def test_upload_size_and_file_count_limits_enforced(client):
    # Lower max_extracted_files limit via settings and verify TOO_MANY_FILES rejection
    res_set = client.put(
        "/api/settings",
        json={
            "upload_limits": {
                "max_upload_size_mb": 2,
                "max_extracted_size_mb": 5,
                "max_extracted_files": 5,
            }
        },
    )
    assert res_set.status_code == 200

    too_many_buf = make_zip_bytes(
        {
            "src/A.java": "public class A {}",
            "src/B.java": "public class B {}",
            "src/C.java": "public class C {}",
            "src/D.java": "public class D {}",
            "src/E.java": "public class E {}",
            "src/F.java": "public class F {}",
        }
    )
    res_upload = client.post(
        "/api/projects/upload",
        data={"file": (too_many_buf, "six_files.zip")},
        content_type="multipart/form-data",
    )
    assert res_upload.status_code == 400
    assert res_upload.get_json()["error"]["code"] == "TOO_MANY_FILES"


def test_java_metric_extraction_and_malformed_file_handling(client):
    valid_java = """package com.demo;
import java.util.List;

/**
 * Calculator service class with branching logic.
 */
public class Calculator {
    // Compute weighted value
    public int compute(int a, int b, boolean flag) {
        if (a > 10 && b > 5) {
            for (int i = 0; i < a; i++) {
                if (flag) {
                    b += i;
                }
            }
            return b;
        } else if (b < 0) {
            return 0;
        }
        return a + b;
    }
}
"""
    malformed_java = """package com.demo;
public class BrokenSyntax {
    public void brokenMethod( {
        int x = ;
    }
"""
    zip_buf = make_zip_bytes(
        {
            "src/com/demo/Calculator.java": valid_java,
            "src/com/demo/BrokenSyntax.java": malformed_java,
        }
    )
    res = client.post(
        "/api/projects/upload",
        data={"file": (zip_buf, "mixed_project.zip"), "project_name": "Mixed Java Project"},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    run_summary = data["analysis_run"]

    assert run_summary["total_files"] == 2
    assert run_summary["parsed_files"] == 1
    assert run_summary["failed_files"] == 1
    assert run_summary["analysis_success_rate"] == 50.0
    assert len(run_summary["parse_errors"]) == 1
    assert 0.0 <= run_summary["health_score"] <= 100.0
    assert "risk_tiers" in run_summary
    assert set(run_summary["risk_tiers"].keys()) == {"critical", "high", "medium", "low"}

    # Check detailed analysis endpoint
    run_id = run_summary["id"]
    detail_res = client.get(f"/api/analysis/{run_id}")
    assert detail_res.status_code == 200
    files = detail_res.get_json()["data"]["files"]
    calc_file = next(f for f in files if f["file_name"] == "Calculator.java")
    broken_file = next(f for f in files if f["file_name"] == "BrokenSyntax.java")

    assert calc_file["parse_status"] == "SUCCESS"
    assert calc_file["method_count"] == 1
    # Base 1 + if(1) + &&(1) + for(1) + if(1) + else if(1) = 6
    assert calc_file["cyclomatic_complexity"] == 6
    assert calc_file["maintainability_index"] is not None

    assert broken_file["parse_status"] == "PARSE_ERROR"
    assert broken_file["maintainability_index"] is None
    assert broken_file["supported_metrics"]["cyclomatic_complexity"] is False


def test_metrics_correlations_risks_priorities_and_pdf_report(client):
    # Use sample v1 analysis endpoint
    res = client.post("/api/samples/v1/analyze")
    assert res.status_code == 201
    payload = res.get_json()["data"]
    run_id = payload["analysis_run"]["id"]
    project_id = payload["project"]["id"]

    # Metrics explorer endpoint
    m_res = client.get(f"/api/analysis/{run_id}/metrics")
    assert m_res.status_code == 200
    m_data = m_res.get_json()["data"]
    assert "loc" in m_data["summary_statistics"]
    assert "cyclomatic_complexity" in m_data["histograms"]
    assert "maintainability_index" in m_data["box_plots"]

    # Correlations endpoint
    c_res = client.get(f"/api/analysis/{run_id}/correlations")
    assert c_res.status_code == 200
    c_data = c_res.get_json()["data"]
    assert c_data["sufficient_data"] is True
    assert len(c_data["matrix"]) > 0

    # Risks endpoint
    r_res = client.get(f"/api/analysis/{run_id}/risks")
    assert r_res.status_code == 200
    r_data = r_res.get_json()["data"]
    assert r_data["scoring_mode"] == "RULE_BASED_HEURISTIC"
    assert len(r_data["risks"]) == 7

    # Priorities endpoint
    p_res = client.get(f"/api/analysis/{run_id}/priorities")
    assert p_res.status_code == 200
    p_data = p_res.get_json()["data"]
    priorities = p_data["priorities"]
    assert len(priorities) == 7
    assert priorities[0]["priority_rank"] == 1
    assert priorities[0]["file_name"] == "OrderProcessor.java"

    # PDF Report generation
    pdf_res = client.get(f"/api/analysis/{run_id}/report")
    assert pdf_res.status_code == 200
    assert pdf_res.mimetype == "application/pdf"
    assert pdf_res.data.startswith(b"%PDF-")
    assert len(pdf_res.data) > 1500

    # Run v2 sample analysis on same project and compare Before vs After
    res_v2 = client.post("/api/samples/v2/analyze", json={"project_id": project_id})
    assert res_v2.status_code == 201
    run2_id = res_v2.get_json()["data"]["analysis_run"]["id"]

    comp_res = client.get(f"/api/projects/{project_id}/compare?first={run_id}&second={run2_id}")
    assert comp_res.status_code == 200
    comp_data = comp_res.get_json()["data"]
    health_cmp = next(m for m in comp_data["metric_comparisons"] if m["key"] == "health_score")
    assert health_cmp["evaluation"] == "IMPROVED"
    assert health_cmp["second_value"] > health_cmp["first_value"]

    loc_cmp = next(m for m in comp_data["metric_comparisons"] if m["key"] == "total_loc")
    assert loc_cmp["direction_rule"] == "CONTEXT_DEPENDENT"
    assert loc_cmp["evaluation"] == "CONTEXT_DEPENDENT"


def test_settings_validation_and_persistence(client):
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200

    # Invalid weights (do not sum to 1.0)
    bad_res = client.put(
        "/api/settings",
        json={
            "health_score_weights": {
                "maintainability_weight": 0.5,
                "complexity_weight": 0.5,
                "code_quality_weight": 0.5,
                "defect_risk_weight": 0.5,
            }
        },
    )
    assert bad_res.status_code == 400
    assert bad_res.get_json()["error"]["code"] == "SETTINGS_VALIDATION_ERROR"

    # Valid update
    good_res = client.put(
        "/api/settings",
        json={
            "health_score_weights": {
                "maintainability_weight": 0.25,
                "complexity_weight": 0.35,
                "code_quality_weight": 0.20,
                "defect_risk_weight": 0.20,
            }
        },
    )
    assert good_res.status_code == 200
    saved = good_res.get_json()["data"]["settings"]["health_score_weights"]["value"]
    assert saved["complexity_weight"] == 0.35


def test_ml_model_integration_service():
    temp_dir = tempfile.mkdtemp(prefix="test_ml_")
    model_path = os.path.join(temp_dir, "defect_model.joblib")

    # 1. Test missing model
    svc_missing = MLDefectPredictionService(base_dir=temp_dir, model_rel_path="nonexistent.joblib")
    assert svc_missing.is_available is False
    assert svc_missing.get_status()["active_assessment_mode"] == "RULE_BASED_HEURISTIC"

    # 2. Train a real tiny scikit-learn LogisticRegression model and verify compatibility check
    features = ["loc", "cyclomatic_complexity", "max_method_complexity", "fan_out", "maintainability_index"]
    X_train = pd.DataFrame(
        [
            [20, 2, 2, 1, 82.0],
            [35, 4, 3, 2, 76.0],
            [260, 38, 18, 14, 38.0],
            [310, 45, 22, 16, 32.0],
        ],
        columns=features,
    )
    y_train = np.array([0, 0, 1, 1])
    clf = LogisticRegression()
    clf.fit(X_train, y_train)

    joblib.dump(
        {
            "model": clf,
            "feature_names": features,
            "model_name": "TestJavaDefectLR",
            "version": "1.2.0",
        },
        model_path,
    )

    svc_ready = MLDefectPredictionService(base_dir=temp_dir, model_rel_path=model_path)
    assert svc_ready.is_available is True
    assert svc_ready.get_status()["active_assessment_mode"] == "ML_MODEL_PREDICTION"

    sample_file_metric = {
        "parse_status": "SUCCESS",
        "loc": 280,
        "cyclomatic_complexity": 40,
        "max_method_complexity": 19,
        "fan_out": 15,
        "maintainability_index": 35.0,
    }
    pred = svc_ready.predict_for_file(sample_file_metric)
    assert pred["assessment_mode"] == "ML_MODEL_PREDICTION"
    assert pred["prediction_label"] in (0, 1)
    assert 0.0 <= pred["defect_probability"] <= 1.0


def test_dashboard_endpoint_and_critical_threshold(client):
    # 1. Empty state when no project has been analyzed
    empty_res = client.get("/api/dashboard")
    assert empty_res.status_code == 200
    empty_data = empty_res.get_json()["data"]
    assert empty_data["has_project"] is False

    # 2. Analyze sample v1 and verify single-run dashboard payload
    res_v1 = client.post("/api/samples/v1/analyze")
    assert res_v1.status_code == 201
    proj_id = res_v1.get_json()["data"]["project"]["id"]

    d1_res = client.get(f"/api/dashboard?project_id={proj_id}")
    assert d1_res.status_code == 200
    d1 = d1_res.get_json()["data"]
    assert d1["has_project"] is True
    assert d1["has_history"] is False
    assert len(d1["history_series"]) == 1
    assert len(d1["top_refactoring_priorities"]) > 0
    assert "maintainability" in d1["footer_metrics"]
    assert "comment_ratio" in d1["footer_metrics"]
    assert "coupling" in d1["footer_metrics"]
    assert "parse_failures" in d1["footer_metrics"]

    # By default critical_risk_threshold is None, so only HIGH, MEDIUM, LOW are in categories
    cat_keys_default = [c["key"] for c in d1["stability_overview"]["categories"]]
    assert cat_keys_default == ["HIGH", "MEDIUM", "LOW"]

    # 3. Enable critical_risk_threshold in settings and verify CRITICAL category appears
    set_crit = client.put(
        "/api/settings",
        json={
            "risk_thresholds": {
                "critical_risk_threshold": 75.0,
                "high_risk_threshold": 65.0,
                "medium_risk_threshold": 35.0,
            }
        },
    )
    assert set_crit.status_code == 200

    d1_crit = client.get(f"/api/dashboard?project_id={proj_id}").get_json()["data"]
    assert d1_crit["stability_overview"]["critical_threshold_defined"] is True
    cat_keys_crit = [c["key"] for c in d1_crit["stability_overview"]["categories"]]
    assert cat_keys_crit == ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

    # 4. Analyze sample v2 on same project and verify multi-run history series & deltas
    res_v2 = client.post("/api/samples/v2/analyze", json={"project_id": proj_id})
    assert res_v2.status_code == 201

    d2 = client.get(f"/api/dashboard?project_id={proj_id}").get_json()["data"]
    assert d2["has_history"] is True
    assert len(d2["history_series"]) == 2
    assert d2["kpi_deltas"]["health_score"]["improved"] is True
    assert d2["kpi_deltas"]["avg_complexity"]["improved"] is True
    assert d2["stability_overview"]["comparison_summary_line"] is not None


def test_single_file_and_constant_column_correlations_and_same_run_compare(client):
    # 1. Single-file project: /metrics should work with small_project_warning and /correlations should report <3 files
    single_zip = make_zip_bytes(
        {
            "src/OnlyOne.java": """package demo;
public class OnlyOne {
    public int add(int a, int b) {
        return a + b;
    }
}
"""
        }
    )
    up_single = client.post(
        "/api/projects/upload",
        data={"file": (single_zip, "single.zip"), "project_name": "Single File Project"},
        content_type="multipart/form-data",
    )
    assert up_single.status_code == 201
    single_run_id = up_single.get_json()["data"]["analysis_run"]["id"]
    single_proj_id = up_single.get_json()["data"]["project"]["id"]

    m_single = client.get(f"/api/analysis/{single_run_id}/metrics").get_json()["data"]
    assert m_single["parsed_file_count"] == 1
    assert m_single["sufficient_sample"] is False
    assert m_single["small_project_warning"] is not None
    assert "defect_distribution" in m_single

    c_single = client.get(f"/api/analysis/{single_run_id}/correlations").get_json()["data"]
    assert c_single["sufficient_data"] is False
    assert "At least 3 parsed Java files" in c_single["message"]
    assert c_single["matrix"] == []

    # 2. Same-run comparison must be blocked with 400 SAME_RUN_COMPARISON
    same_cmp = client.get(
        f"/api/projects/{single_proj_id}/compare?first={single_run_id}&second={single_run_id}"
    )
    assert same_cmp.status_code == 400
    assert same_cmp.get_json()["error"]["code"] == "SAME_RUN_COMPARISON"

    # 3. 3-file project where method_count and fan_out are constant across all 3 files, while LOC and complexity vary
    const_zip = make_zip_bytes(
        {
            "src/FileOne.java": """package demo;
public class FileOne {
    public int calc(int x) {
        return x + 1;
    }
}
""",
            "src/FileTwo.java": """package demo;
public class FileTwo {
    public int calc(int x) {
        if (x > 0) {
            return x + 2;
        }
        return 0;
    }
}
""",
            "src/FileThree.java": """package demo;
public class FileThree {
    public int calc(int x) {
        if (x > 10) {
            for (int i = 0; i < x; i++) {
                if (i % 2 == 0) {
                    x += i;
                }
            }
        }
        return x;
    }
}
""",
        }
    )
    up_const = client.post(
        "/api/projects/upload",
        data={"file": (const_zip, "const_cols.zip"), "project_name": "Constant Column Project"},
        content_type="multipart/form-data",
    )
    assert up_const.status_code == 201
    const_run_id = up_const.get_json()["data"]["analysis_run"]["id"]

    c_const = client.get(f"/api/analysis/{const_run_id}/correlations").get_json()["data"]
    assert c_const["sufficient_data"] is True
    assert "method_count" in c_const["dropped_constant_columns"]
    assert "fan_out" in c_const["dropped_constant_columns"]
    for row in c_const["matrix"]:
        assert "values" in row
        assert "method_count" not in row["values"]
        for val in row["values"].values():
            assert val is not None


