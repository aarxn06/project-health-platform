# System Architecture & Metric Methodology

## 1. Layered Backend Architecture

1. **Presentation / Routing Layer (`backend/routes/api_routes.py`)**:
   - Handles HTTP request parsing, input validation, consistent JSON response formatting, and HTTP status codes (`200`, `201`, `400`, `404`, `413`, `500`).
2. **Orchestration & Analytics Services (`backend/services/`)**:
   - `analysis_service.py`: Coordinates archive extraction, AST parsing, risk scoring, health scoring, refactoring prioritization, and atomic database persistence.
   - `statistics_service.py`: Uses `pandas` and `NumPy` to compute five-number quartiles, `1.5 × IQR` outlier fences, histograms, and Pearson correlation matrices.
   - `comparison_service.py`: Computes run-to-run metric deltas and directional quality evaluations.
3. **Static Java Analyzer (`backend/analyzer/`)**:
   - `archive_handler.py`: Enforces upload size quotas, zip-bomb limits, symlink rejection, and `os.path.realpath` containment.
   - `java_analyzer.py`: Uses `javalang` AST traversal and lexical tokenization to compute file and method metrics.
4. **Scoring, ML Interface & Recommendations (`backend/scoring/`, `backend/ml/`, `backend/recommendations/`)**:
   - Modular engines with configurable weights stored in the `application_settings` table.
5. **Persistence Layer (`backend/database/`)**:
   - SQLAlchemy ORM with 6 relational tables (`projects`, `analysis_runs`, `file_metrics`, `risk_assessments`, `recommendations`, `application_settings`).

---

## 2. Extracted Java Metric Definitions

- **Physical Lines of Code (`LOC`)**: Non-blank, non-comment source lines containing executable or declarative Java syntax.
- **Comment Ratio (%)**: Percentage of non-blank lines containing single-line (`//`) or block/Javadoc (`/* ... */`) comments.
- **McCabe Cyclomatic Complexity (`CC`)**:
  - Computed per method/constructor from the `javalang` AST:
  - $\text{CC} = 1 + \text{count}(\texttt{if}, \texttt{for}, \texttt{while}, \texttt{do}, \texttt{catch}, \texttt{?:}, \texttt{case}, \texttt{\&\&}, \texttt{||})$.
- **Halstead Volume ($V$)**:
  - $V = (N_1 + N_2) \log_2(n_1 + n_2)$ computed from Java lexical operator and operand tokens.
- **Maintainability Index (`MI`, 0–100)**:
  - Normalized SEI derivative:
  - $\text{MI} = \max\left(0, \min\left(100, \frac{100}{171}\left(171 - 5.2\ln V - 0.23 G - 16.2\ln\text{LOC} + 50\sin\sqrt{2.4\cdot\text{CM}}\right)\right)\right)$.
- **Coupling Fan-Out**: Count of distinct external non-primitive types referenced plus explicit imports.
