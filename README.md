# AI-Driven Software Engineering Metrics and Project Health Intelligence Platform

A full-stack software engineering analytics platform designed to inspect **Java** source-code projects, extract AST-based software quality metrics, evaluate file-level risk and technical debt, rank files for refactoring, compare longitudinal analysis runs, and generate printable PDF reports — presented in a modern dark developer-tooling interface.

---

## 1. Key Capabilities

- **Modern Dark Developer-Tooling UI (`frontend/src/styles/tokens.css`, `frontend/src/components/ui/`)**:
  - Built on CSS design tokens and Tailwind CSS (`--bg-app: #0A0A0C`, `--bg-sidebar: #08080A`, `--bg-card: #111114`, `--bg-card-hover: #16161A`, `--bg-input: #0E0E11`, `--border: #1F1F25`, `--border-strong: #2A2A32`, `--text-primary: #F4F4F5`, `--text-secondary: #A1A1AA`, `--text-muted: #6B6B76`, `--accent-violet: #7C5CFF`, `--accent-blue: #4C8DFF`, `--success: #22C55E`, `--warning-yellow: #EAB308`, `--warning-orange: #F97316`, `--danger: #EF4444`).
  - Shared reusable UI component library (`Card`, `CardHeader`, `KpiCard`, `DeltaBadge`, `PeriodSelect`, `SegmentedBar`, `SegmentedBlockBar`, `StatusChip`, `DataTable`, `LoadingSkeleton`, `ErrorBanner`, `Toast`, `EmptyState`, `ChartTheme`).
  - 4-Row Analytics Dashboard (`GET /api/dashboard`):
    1. **Row 1**: 4 KPI cards with historical sparklines and semantic deltas (`Project Health Score`, `Total Lines of Code`, `Average Cyclomatic Complexity`, `Total Analyzed Files`).
    2. **Row 2**: `Code Stability Overview` (overall health score, segmented risk bar, legend, comparison summary line, and explainable factor breakdown) + `Top Refactoring Priorities` table.
    3. **Row 3**: `Quality Trend` violet area chart + `Recent Analysis Activity` list + `Complexity / Smell Breakdown` donut chart.
    4. **Row 4**: 4-tile Footer Metric Strip (`Average Maintainability`, `Average Comment Ratio`, `Average Coupling`, `Parse Failures / Files with Errors`) with 4-block level indicators and status chips (`Excellent / Good / Fair / Poor`).
- **Real Java Static AST Analysis (`backend/analyzer/`)**:
  - Recursively discovers `.java` files inside uploaded `.zip` archives with strict path-traversal, symlink, and zip-bomb protections.
  - Parses source code into Abstract Syntax Trees using `javalang` alongside lexical comment/token analysis.
  - Extracts Physical Lines of Code (`LOC`), Total/Comment/Blank lines, Comment Ratio (%), Class & Interface count, Method count, Field count, AST-based **McCabe Cyclomatic Complexity** (total, average, peak method), **Maximum Control-Flow Nesting Depth**, **Coupling Fan-Out**, **Halstead Volume**, **Maintainability Index (0–100)**, and 8 categories of configurable static **Code Smells**.
  - Gracefully records syntax errors on malformed `.java` files without aborting the project analysis run.
- **Explainable Project Health Score (`backend/scoring/health_scorer.py`)**:
  - Computes a transparent `0–100` score and letter grade (`A`–`F`) from normalized sub-scores across Maintainability, Complexity Control, Code Quality / Smell Density, and Defect Risk Exposure.
- **ML Defect Prediction Integration Interface (`backend/ml/predictor.py`)**:
  - Loads and validates a saved `scikit-learn` `.joblib` model and feature schema when configured.
  - Transparently falls back to deterministic, clearly labeled **Rule-Based Heuristic Risk Assessment** (`RULE_BASED_HEURISTIC`) when no external trained model file is present.
- **Transparent Refactoring Prioritization (`backend/recommendations/prioritizer.py`)**:
  - Ranks files using configurable multi-criteria weights, concrete AST findings, actionable refactoring recommendations, and defensible relative effort bands.
- **Interactive Analytics & Statistical Explorer (`frontend/src/pages/MetricsExplorerPage.jsx`)**:
  - Bar charts, NumPy-computed frequency histograms, quartile box plots with `1.5 × IQR` outlier detection, bivariate scatter plots, and diverging dark-themed Pearson correlation heatmaps.
- **Before-and-After Comparison & PDF Reporting (`backend/services/comparison_service.py`, `backend/reports/pdf_generator.py`)**:
  - Side-by-side run comparison with directional evaluation (`IMPROVED`, `WORSENED`, `UNCHANGED`, `CONTEXT_DEPENDENT`) and multi-page printable PDF report generation using `ReportLab`.

---

## 2. Repository Structure

```text
project-health-platform/
├── backend/
│   ├── app.py                      # Flask application factory & entry point
│   ├── config.py                   # Modular environment-based configuration
│   ├── requirements.txt            # Python dependencies
│   ├── analyzer/
│   │   ├── archive_handler.py      # Safe ZIP validation & path-traversal defense
│   │   └── java_analyzer.py        # javalang AST & lexical metric extractor
│   ├── database/
│   │   ├── models.py               # SQLAlchemy ORM models (SQLite / MySQL compatible)
│   │   └── repository.py           # Validated settings persistence repository
│   ├── ml/
│   │   ├── predictor.py            # scikit-learn saved-model integration service
│   │   └── README.md               # Guide for plugging in a trained .joblib model
│   ├── recommendations/
│   │   └── prioritizer.py          # Multi-criteria refactoring prioritization engine
│   ├── reports/
│   │   └── pdf_generator.py        # ReportLab printable PDF report builder
│   ├── routes/
│   │   └── api_routes.py           # REST API blueprint endpoints
│   ├── scoring/
│   │   ├── health_scorer.py        # Explainable 0-100 Project Health Score engine
│   │   └── risk_scorer.py          # Rule-based & ML-hybrid file risk evaluator
│   ├── services/
│   │   ├── analysis_service.py     # End-to-end analysis pipeline orchestration
│   │   ├── dashboard_service.py    # Unified dashboard summary & sparkline builder
│   │   ├── comparison_service.py   # Before-and-After run comparison engine
│   │   ├── sample_data_service.py  # Built-in sample Java archives generator
│   │   └── statistics_service.py   # pandas/NumPy descriptive stats & correlations
│   └── tests/
│       └── test_platform.py        # Comprehensive pytest suite
├── frontend/
│   ├── package.json                # React 18, Vite, Tailwind CSS, Recharts, Axios
│   ├── tailwind.config.js          # Custom dark design-token theme
│   ├── vite.config.js              # Vite config with /api proxy to Flask
│   ├── src/
│   │   ├── index.css               # Global dark theme & component utilities
│   │   ├── styles/tokens.css       # CSS custom property colour tokens
│   │   ├── components/
│   │   │   ├── ui/                 # Shared Card, KpiCard, DeltaBadge, DataTable, etc.
│   │   │   ├── Layout.jsx          # Collapsible dark sidebar & header
│   │   │   └── EmptyProjectState.jsx
│   │   ├── context/                # Global project & run state context
│   │   ├── hooks/                  # Custom data hooks (useDashboardData)
│   │   ├── pages/                  # All 9 functional dark-themed application views
│   │   ├── services/               # Axios REST API client
│   │   └── utils/                  # Metric formatters & semantic delta evaluators
│   └── tests/
│       └── frontend.test.mjs       # Frontend component & design system verification suite
├── data/                           # Sample Java project ZIP archives (v1 & v2)
├── docs/
│   ├── ARCHITECTURE.md             # System architecture & data flow
│   ├── API_REFERENCE.md            # Complete REST API specification
│   └── METRIC_DEFINITIONS.md       # Metric formulas, thresholds & scoring rules
├── .env.example                    # Environment variable template
├── .gitignore
└── README.md
```

---

## 3. Installation & Local Launch Instructions

### Prerequisites
- **Python 3.10+** (tested with Python 3.12)
- **Node.js 18+** and **npm** (tested with Node 24)

### Step 1: Start the Flask Backend
Open a terminal in `project-health-platform/backend`:

```powershell
cd backend
python -m pip install -r requirements.txt
python app.py
```
The Flask REST API server will start on **`http://localhost:5000`** (and automatically initialize the SQLite database at `backend/instance/project_health.db` and sample Java ZIP archives in `data/`).

### Step 2: Start the React + Vite Frontend
Open a second terminal in `project-health-platform/frontend`:

```powershell
cd frontend
npm install
npm run dev
```
The Vite development server will start on **`http://localhost:5173`** and proxy `/api/*` requests to `http://127.0.0.1:5000`.

### Step 3: Run Automated Tests
- **Backend (`pytest`)**:
  ```powershell
  cd backend
  python -m pytest -v
  ```
- **Frontend (`node --test` & production build)**:
  ```powershell
  cd frontend
  node --test tests/frontend.test.mjs
  npm run build
  ```

---

## 4. Configuration, REST API & Database Migration

Copy `.env.example` to `.env` to customize settings (loaded via `backend/config.py`):
- `PORT`: Backend port (default `5000`).
- `DATABASE_URL`: Defaults to local SQLite (`sqlite:///instance/project_health.db`). To migrate to MySQL without code changes, install `pymysql` and set:
  ```ini
  DATABASE_URL=mysql+pymysql://username:password@localhost:3306/project_health
  ```
- `MAX_UPLOAD_SIZE_MB`: Maximum allowed ZIP upload size (default `25` MB).
- `ML_MODEL_PATH`: Relative path to a saved `scikit-learn` `.joblib` defect model.

### REST API Endpoints (`backend/routes/api_routes.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend health check, DB status, and ML model availability |
| `GET` | `/api/dashboard` | Unified 4-row dashboard payload (`?project_id=&run_id=`) |
| `POST` | `/api/projects/upload` | Safe `.zip` archive upload, validation, and automatic Java AST analysis |
| `GET` | `/api/projects` | List all analyzed Java projects |
| `GET` | `/api/projects/<id>` | Get project details and stored analysis runs |
| `POST` | `/api/projects/<id>/analyze` | Re-run static analysis on an existing project using current settings |
| `GET` | `/api/analysis/<id>` | Detailed run summary, per-file metrics, and parse errors |
| `GET` | `/api/analysis/<id>/metrics` | Descriptive statistics, histograms, box-plot quartiles/outliers, defect/risk distribution |
| `GET` | `/api/analysis/<id>/correlations` | Pearson correlation matrix (constant columns dropped, `<3` files handled) |
| `GET` | `/api/analysis/<id>/risks` | File-level risk scores, contributing metrics, concerns, and suggested actions |
| `GET` | `/api/analysis/<id>/priorities` | Multi-criteria ranked refactoring priorities and supporting metrics |
| `GET` | `/api/projects/<id>/history` | Historical analysis runs for a project |
| `GET` | `/api/projects/<id>/compare?first=&second=` | Before-and-after comparison between two distinct runs (`400` if `first == second`) |
| `GET` | `/api/analysis/<id>/report` | Generate and download printable PDF report via ReportLab |
| `GET, PUT` | `/api/settings` | Read and update upload limits, health/priority weights, risk thresholds, and ML config |

---

## 5. Known Limitations & Academic Interpretation Notes

1. **Static Source Scope**: Analysis is performed strictly on `.java` source files without executing code or resolving external Maven/Gradle binary JAR dependencies. Dynamic test coverage and runtime profiling metrics are explicitly marked as unsupported.
2. **Rule-Based vs. ML Distinction**: When no external trained `scikit-learn` model is present at `ML_MODEL_PATH`, all risk scores are explicitly labeled as `RULE_BASED_HEURISTIC`. Static metrics highlight structural complexity and maintainability debt; they do not prove the presence or absence of runtime bugs.
3. **Context-Dependent Metrics in Run Comparisons**: Reducing Lines of Code (`LOC`) or File Count is not automatically treated as an improvement (`CONTEXT_DEPENDENT`), because decomposing a God Class or adding validation logic may legitimately increase file count or LOC while improving maintainability.
