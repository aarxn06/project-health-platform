# Software Engineering Metric Definitions & Scoring Methodology

This reference document details how every static software engineering metric, health score factor, risk classification tier, and refactoring priority score is computed in the **AI-Driven Software Engineering Metrics and Project Health Intelligence Platform**.

---

## 1. Extracted Java Source Metrics (`backend/analyzer/java_analyzer.py`)

Each `.java` source file is analyzed via lexical line/token scanning and Abstract Syntax Tree (AST) parsing using `javalang`.

| Metric | Key | Unit / Range | Calculation Definition |
| :--- | :--- | :--- | :--- |
| **Source Lines of Code** | `loc` | Integer ($\ge 0$) | Count of physical lines containing executable or declarative Java source code (excluding blank lines and pure single-line or block comment lines). |
| **Total Lines** | `total_lines` | Integer ($\ge 0$) | Total physical newline-delimited lines in the `.java` file. |
| **Comment Lines** | `comment_lines` | Integer ($\ge 0$) | Count of lines containing `//` single-line comments or `/* ... */` / `/** ... */` block/Javadoc comments. |
| **Blank Lines** | `blank_lines` | Integer ($\ge 0$) | Count of whitespace-only lines. |
| **Comment Ratio** | `comment_ratio` | Percentage ($0\text{--}100\%$) | $\text{Comment Ratio} = \frac{\text{comment\_lines}}{\max(1, \text{total\_lines})} \times 100$. |
| **Class & Interface Count** | `class_count` | Integer ($\ge 0$) | Sum of AST `ClassDeclaration`, `InterfaceDeclaration`, and `EnumDeclaration` nodes. |
| **Method Count** | `method_count` | Integer ($\ge 0$) | Sum of AST `MethodDeclaration` and `ConstructorDeclaration` nodes. |
| **Field Count** | `field_count` | Integer ($\ge 0$) | Sum of declared variables inside AST `FieldDeclaration` nodes. |
| **Cyclomatic Complexity (McCabe)** | `cyclomatic_complexity` | Integer ($\ge 1$) | Sum of method-level McCabe complexities across the file (minimum `1` for class/interface without methods). Each method starts at base `1` plus `1` for each decision point: `IfStatement`, `ForStatement`, `WhileStatement`, `DoStatement`, `CatchClause`, `TernaryExpression`, non-default `SwitchStatementCase`, and short-circuit boolean operators (`&&`, `||`). |
| **Average Method Complexity** | `avg_method_complexity` | Float ($\ge 0$) | Arithmetic mean of McCabe complexity across all methods/constructors in the file. |
| **Max Method Complexity** | `max_method_complexity` | Integer ($\ge 0$) | Highest McCabe Cyclomatic Complexity observed in any single method or constructor within the file (`max_complexity_method` stores its name). |
| **Max Control-Flow Nesting Depth** | `max_nesting_depth` | Integer ($\ge 0$) | Deepest nesting level of control structures (`if`, `for`, `while`, `do`, `switch`, `try`) inside any method body. |
| **Coupling Fan-Out** | `fan_out` | Integer ($\ge 0$) | Count of distinct external packages/types imported (`import` statements) plus distinct referenced `ReferenceType` AST identifiers outside standard `java.lang` primitives. |
| **Halstead Volume** | `halstead_volume` | Float ($\ge 0$) | Computed from lexical Java tokens: $V = N \times \log_2(\eta)$, where $N = N_1 + N_2$ (total operators + operands) and $\eta = \eta_1 + \eta_2$ (distinct operators + operands). |
| **Maintainability Index (MI)** | `maintainability_index` | Float ($0\text{--}100$) | Normalized SEI/Visual Studio derivative: $\text{MI} = \text{clamp}_{[0, 100]}\left(\frac{171 - 5.2 \ln(V) - 0.23 G - 16.2 \ln(\text{LOC})}{171} \times 100\right)$, where $V$ is Halstead Volume and $G$ is total Cyclomatic Complexity. Returns `null` when AST parsing fails. |

### Unsupported / Out-of-Scope Metrics
- **Dynamic Test Coverage**: Marked `false` in `supported_metrics` because analysis operates strictly on static `.java` source code without executing Maven/Gradle test runners.
- **CBO / LCOM Cross-Jar Resolution**: Full bytecode symbol resolution across external binary `.jar` dependencies is out of scope; `fan_out` provides AST-level structural import and type-reference coupling.

---

## 2. Static Code Smell Rules (`backend/analyzer/java_analyzer.py`)

Configurable thresholds are stored in the `settings` table (`code_smell_thresholds`):

1. **`LONG_FILE`**: `loc > max_file_loc` (default `350` LOC)
2. **`HIGH_FILE_COMPLEXITY`**: `cyclomatic_complexity > max_file_complexity` (default `35`)
3. **`COMPLEX_METHOD`**: `max_method_complexity > max_method_complexity` (default `12`)
4. **`DEEP_NESTING`**: `max_nesting_depth > max_nesting_depth` (default `4`)
5. **`GOD_CLASS_CANDIDATE`**: `method_count > max_methods_per_class` (default `20`)
6. **`LONG_PARAMETER_LIST`**: Any method with parameter count $> \text{max\_parameters}$ (default `5`)
7. **`HIGH_COUPLING_FAN_OUT`**: `fan_out > max_fan_out` (default `15`)
8. **`LOW_COMMENT_DENSITY`**: `loc >= 50` and `comment_ratio < min_comment_ratio_pct` (default `5.0%`)

---

## 3. File-Level Risk & Technical Debt Scoring (`backend/scoring/risk_scorer.py`)

For each successfully parsed Java file, four normalized risk sub-indicators in $[0, 100]$ are computed:

1. **Complexity Risk ($R_{\text{cc}}$)**: Combines total file Cyclomatic Complexity ($45\%$), peak method complexity ($40\%$), and nesting depth ($15\%$).
2. **Maintainability Deficit ($R_{\text{mi}}$)**: $R_{\text{mi}} = \text{clamp}_{[0, 100]}\left(\frac{85 - \text{MI}}{65} \times 100\right)$.
3. **Size & Smell Density ($R_{\text{smell}}$)**: Combines physical LOC ($45\%$) and detected code smell count ($55\%$).
4. **Coupling Fan-Out Risk ($R_{\text{fan}}$)**: Normalized against $1.5 \times \text{max\_fan\_out}$.

### Composite Rule-Based Risk Score
$$R_{\text{heuristic}} = 0.35 R_{\text{cc}} + 0.30 R_{\text{mi}} + 0.20 R_{\text{smell}} + 0.15 R_{\text{fan}}$$

When a valid `scikit-learn` defect model is loaded (`ML_MODEL_PREDICTION`), the final risk score blends $60\%$ ML defect probability ($P_{\text{defect}} \times 100$) with $40\%$ structural heuristic score. Otherwise, the system transparently labels the assessment as `RULE_BASED_HEURISTIC`.

### Risk Classification Tiers
- **CRITICAL**: $\text{risk\_score} \ge 75.0$ (or `PARSE_ERROR`)
- **HIGH**: $65.0 \le \text{risk\_score} < 75.0$ (configurable via `high_risk_min`)
- **MEDIUM**: $38.0 \le \text{risk\_score} < 65.0$ (configurable via `medium_risk_min`)
- **LOW**: $\text{risk\_score} < 38.0$

---

## 4. Explainable Project Health Score (`backend/scoring/health_scorer.py`)

The overall **Project Health Score ($0\text{--}100$)** is the weighted sum of four normalized dimension sub-scores:

$$\text{Health Score} = w_1 S_{\text{maintainability}} + w_2 S_{\text{complexity}} + w_3 S_{\text{quality}} + w_4 S_{\text{risk}} - P_{\text{parse}}$$

Default weights (configurable in Settings and validated so $\sum w_i = 1.0$):
- **Maintainability ($w_1 = 0.30$)**: Average file Maintainability Index across parsed files.
- **Complexity Control ($w_2 = 0.25$)**: Penalizes high average file CC, high peak method CC, and the percentage of files breaching complexity thresholds.
- **Code Quality & Smell Control ($w_3 = 0.20$)**: Penalizes smell density per file and parser failure ratio, while rewarding adequate documentation (`comment_ratio`).
- **Defect & Technical Debt Resilience ($w_4 = 0.25$)**: Penalizes average file risk score and concentration of High/Critical risk files.
- **Parse Failure Penalty ($P_{\text{parse}}$)**: Up to $15$ points deducted proportionally if `.java` files fail AST syntax parsing.

---

## 5. Multi-Criteria Refactoring Prioritization (`backend/recommendations/prioritizer.py`)

Files are ranked in descending order of **Priority Score ($0\text{--}100$)** using configurable weights (`priority_weights`):

$$\text{Priority Score} = 0.30 C_{\text{norm}} + 0.35 R_{\text{score}} + 0.20 (100 - \text{MI}) + 0.15 S_{\text{size\_smell}}$$

Each ranked file includes:
- Concrete AST triggers (e.g., peak method name & CC, smell codes, nesting depth, fan-out).
- Specific refactoring guidance (e.g., *Extract Method / Guard Clauses*, *Single-Responsibility Class Decomposition*, *Constructor Dependency Injection*).
- Relative effort band (`Low (1–2 hrs)`, `Medium (0.5–1 day)`, `High (2–3 days)`).

