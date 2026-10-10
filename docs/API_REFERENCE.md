# REST API Reference

All API endpoints are prefixed with `/api` and return a consistent JSON envelope:

### Success Envelope
```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable validation or diagnostic message."
  }
}
```

---

## Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Application health check, database connectivity, and ML model status |
| `GET` | `/api/dashboard?project_id=<id>&run_id=<id>` | Unified dashboard payload: KPI cards, sparkline history series, Code Stability Overview, Top Refactoring Priorities, Quality Trend, Recent Activity, Donut Breakdown, and Footer Metric Strip |
| `GET` | `/api/projects` | List all stored Java projects with their latest run summary |
| `GET` | `/api/projects/<id>` | Retrieve project details and all historical analysis run summaries |
| `DELETE` | `/api/projects/<id>` | Delete a stored project and all associated runs |
| `POST` | `/api/projects/upload` | Upload & validate a Java `.zip` archive (`multipart/form-data`) and initiate analysis |
| `POST` | `/api/projects/<id>/analyze` | Re-run static analysis on a stored project using current settings |
| `GET` | `/api/analysis/<run_id>` | Retrieve full analysis run summary and file-level metrics |
| `GET` | `/api/analysis/<run_id>/metrics` | Retrieve descriptive statistics, histograms, box plots, and scatter records |
| `GET` | `/api/analysis/<run_id>/correlations` | Retrieve the Pearson correlation matrix (`r`) across numerical metrics |
| `GET` | `/api/analysis/<run_id>/risks` | Retrieve file-level risk & technical debt assessments |
| `GET` | `/api/analysis/<run_id>/priorities` | Retrieve ranked refactoring priorities, reasons, actions, and effort estimates |
| `GET` | `/api/projects/<id>/history` | Retrieve all historical analysis runs for a project |
| `GET` | `/api/history` | Retrieve all analysis runs across all projects |
| `GET` | `/api/projects/<id>/compare?first=<id1>&second=<id2>` | Compare two analysis runs before and after changes |
| `GET` | `/api/analysis/<run_id>/report` | Generate and download a printable ReportLab PDF report |
| `GET` | `/api/settings` | Retrieve configurable application settings and ML integration status |
| `PUT` | `/api/settings` | Validate and update application settings |
| `POST` | `/api/settings/reset` | Reset all application settings to documented defaults |
| `GET` | `/api/samples` | List built-in sample Java archives (`v1` and `v2`) |
| `GET` | `/api/samples/<sample_id>/download` | Download a built-in sample Java `.zip` archive |
| `POST` | `/api/samples/<sample_id>/analyze` | Run real Java AST analysis on a built-in sample archive |
