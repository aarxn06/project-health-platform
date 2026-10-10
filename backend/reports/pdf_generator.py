import io
import json
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart


NAVY = colors.HexColor("#0f172a")
SLATE_DARK = colors.HexColor("#334155")
SLATE_MUTED = colors.HexColor("#64748b")
BLUE_ACCENT = colors.HexColor("#2563eb")
VIOLET_ACCENT = colors.HexColor("#7c3aed")
BG_LIGHT = colors.HexColor("#f8fafc")
BORDER_GRAY = colors.HexColor("#cbd5e1")
RISK_HIGH_COLOR = colors.HexColor("#dc2626")
RISK_MED_COLOR = colors.HexColor("#d97706")
RISK_LOW_COLOR = colors.HexColor("#16a34a")


def _build_visualizations_drawing(summary: dict, top_files: list[dict]) -> Drawing:
    """
    Create a clean ReportLab vector Drawing containing:
    Left: Risk Category Distribution Bar Chart
    Right: Top Files by Cyclomatic Complexity vs LOC
    """
    d = Drawing(480, 145)

    # Background card for Left Chart
    d.add(Rect(0, 5, 225, 135, fillColor=BG_LIGHT, strokeColor=BORDER_GRAY, rx=4, ry=4))
    d.add(
        String(
            12,
            124,
            "Risk Category Distribution (Files)",
            fontName="Helvetica-Bold",
            fontSize=9,
            fillColor=NAVY,
        )
    )

    high_c = summary.get("high_risk_count", 0)
    med_c = summary.get("medium_risk_count", 0)
    low_c = summary.get("low_risk_count", 0)
    max_risk_c = max(high_c, med_c, low_c, 1)

    risk_bars = [
        ("High Risk", high_c, RISK_HIGH_COLOR),
        ("Medium Risk", med_c, RISK_MED_COLOR),
        ("Low Risk", low_c, RISK_LOW_COLOR),
    ]
    for idx, (label, val, col) in enumerate(risk_bars):
        y_pos = 92 - idx * 32
        d.add(String(12, y_pos, label, fontName="Helvetica", fontSize=8, fillColor=SLATE_DARK))
        bar_w = max(4, (val / max_risk_c) * 115.0)
        d.add(Rect(75, y_pos - 3, bar_w, 13, fillColor=col, strokeColor=None, rx=2, ry=2))
        d.add(
            String(
                75 + bar_w + 6,
                y_pos,
                str(val),
                fontName="Helvetica-Bold",
                fontSize=8,
                fillColor=NAVY,
            )
        )

    # Background card for Right Chart
    d.add(Rect(245, 5, 235, 135, fillColor=BG_LIGHT, strokeColor=BORDER_GRAY, rx=4, ry=4))
    d.add(
        String(
            257,
            124,
            "Top Hotspot Files (Cyclomatic Complexity)",
            fontName="Helvetica-Bold",
            fontSize=9,
            fillColor=NAVY,
        )
    )

    hotspots = sorted(
        top_files, key=lambda x: x.get("cyclomatic_complexity", 0), reverse=True
    )[:4]
    max_cc = max((f.get("cyclomatic_complexity", 1) for f in hotspots), default=1)
    max_cc = max(max_cc, 1)

    if not hotspots:
        d.add(
            String(
                257,
                70,
                "No parsed files available",
                fontName="Helvetica",
                fontSize=8,
                fillColor=SLATE_MUTED,
            )
        )
    else:
        for idx, hf in enumerate(hotspots):
            y_pos = 96 - idx * 24
            short_name = hf.get("file_name", "")[:16]
            cc_val = hf.get("cyclomatic_complexity", 0)
            d.add(
                String(
                    257,
                    y_pos,
                    short_name,
                    fontName="Helvetica",
                    fontSize=7.5,
                    fillColor=SLATE_DARK,
                )
            )
            bar_w = max(4, (cc_val / max_cc) * 95.0)
            d.add(
                Rect(
                    345,
                    y_pos - 2,
                    bar_w,
                    11,
                    fillColor=BLUE_ACCENT,
                    strokeColor=None,
                    rx=2,
                    ry=2,
                )
            )
            d.add(
                String(
                    345 + bar_w + 5,
                    y_pos,
                    f"CC={cc_val}",
                    fontName="Helvetica-Bold",
                    fontSize=7.5,
                    fillColor=NAVY,
                )
            )

    return d


def generate_analysis_pdf_report(analysis_run) -> bytes:
    """
    Generate a comprehensive, printable academic-grade PDF report from a stored
    AnalysisRun record using ReportLab. Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Software Quality & Health Report - {analysis_run.project.name if analysis_run.project else 'Project'}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=NAVY,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=SLATE_MUTED,
        spaceAfter=10,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=NAVY,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodySmall",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=12.5,
        textColor=SLATE_DARK,
        spaceAfter=5,
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.5,
        textColor=SLATE_DARK,
    )
    cell_bold_style = ParagraphStyle(
        "TableCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=NAVY,
    )

    summary = analysis_run.to_summary_dict()
    file_dicts = [fm.to_dict(include_details=False) for fm in analysis_run.file_metrics]
    recommendations = [rec.to_dict() for rec in analysis_run.recommendations]
    health_breakdown = summary.get("health_breakdown", {})

    story = []

    # 1. Header & Title
    story.append(
        Paragraph(
            "AI-Driven Software Engineering Metrics & Project Health Intelligence Report",
            title_style,
        )
    )
    story.append(
        Paragraph(
            f"<b>Project:</b> {summary['project_name'] or 'Unnamed Project'} &nbsp;|&nbsp; "
            f"<b>Run:</b> {summary['version_label']} &nbsp;|&nbsp; "
            f"<b>Language:</b> {summary['language']} &nbsp;|&nbsp; "
            f"<b>Analysis Date (UTC):</b> {(summary['created_at'] or '')[:19].replace('T', ' ')}",
            subtitle_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_GRAY, spaceAfter=8))

    # 2. Executive Project Summary & Overall Health Score
    story.append(Paragraph("1. Executive Project Summary & Health Score", section_heading))

    mode_label = (
        "Connected ML Defect Model + Static Metrics"
        if summary["scoring_mode"] == "ML_MODEL_PREDICTION"
        else "Deterministic Rule-Based Heuristic Analysis (No External ML Model Active)"
    )

    exec_table_data = [
        [
            Paragraph("<b>Overall Health Score</b>", cell_bold_style),
            Paragraph(
                f"<b>{summary['health_score']} / 100 (Grade {summary['health_grade']})</b>",
                cell_bold_style,
            ),
            Paragraph("<b>Assessment Mode</b>", cell_bold_style),
            Paragraph(mode_label, cell_style),
        ],
        [
            Paragraph("<b>Analyzed Java Files</b>", cell_bold_style),
            Paragraph(
                f"{summary['total_files']} ({summary['parsed_files']} parsed, {summary['failed_files']} failed)",
                cell_style,
            ),
            Paragraph("<b>Total Physical LOC</b>", cell_bold_style),
            Paragraph(
                f"{summary['total_loc']} LOC ({summary['total_lines']} total lines)", cell_style
            ),
        ],
        [
            Paragraph("<b>Total Classes / Methods</b>", cell_bold_style),
            Paragraph(
                f"{summary['total_classes']} classes / {summary['total_methods']} methods",
                cell_style,
            ),
            Paragraph("<b>Avg / Max File Complexity</b>", cell_bold_style),
            Paragraph(
                f"Avg CC: {summary['avg_complexity']} | Max CC: {summary['max_complexity']}",
                cell_style,
            ),
        ],
        [
            Paragraph("<b>Avg Maintainability Index</b>", cell_bold_style),
            Paragraph(f"{summary['avg_maintainability']} / 100", cell_style),
            Paragraph("<b>Total Code Smells</b>", cell_bold_style),
            Paragraph(
                f"{summary['total_code_smells']} smells | Avg Comment Ratio: {summary['avg_comment_ratio']}%",
                cell_style,
            ),
        ],
        [
            Paragraph("<b>Risk Distribution</b>", cell_bold_style),
            Paragraph(
                f"High: {summary['high_risk_count']} | Medium: {summary['medium_risk_count']} | Low: {summary['low_risk_count']}",
                cell_style,
            ),
            Paragraph("<b>Archive Source</b>", cell_bold_style),
            Paragraph(str(summary.get("archive_filename") or "N/A"), cell_style),
        ],
    ]

    exec_table = Table(exec_table_data, colWidths=[38 * mm, 50 * mm, 40 * mm, 50 * mm])
    exec_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BG_LIGHT),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(exec_table)
    story.append(Spacer(1, 6))

    # 3. Health Score Breakdown & Explanation
    story.append(Paragraph("2. Health Score Breakdown & Scoring Methodology", section_heading))
    story.append(
        Paragraph(
            health_breakdown.get(
                "methodology_note",
                "Health score is calculated from normalized software quality indicators.",
            ),
            body_style,
        )
    )

    components = health_breakdown.get("components", {})
    if components:
        comp_rows = [
            [
                Paragraph("<b>Quality Dimension</b>", cell_bold_style),
                Paragraph("<b>Normalized Score</b>", cell_bold_style),
                Paragraph("<b>Weight</b>", cell_bold_style),
                Paragraph("<b>Contribution</b>", cell_bold_style),
                Paragraph("<b>Measured Indicator</b>", cell_bold_style),
            ]
        ]
        for _, comp in components.items():
            sub_s = f"{comp['subscore']:.1f}/100" if comp.get("subscore") is not None else "N/A"
            w_pct = f"{comp.get('effective_weight', 0) * 100:.0f}%"
            contrib = f"+{comp.get('weighted_contribution', 0):.1f}"
            comp_rows.append(
                [
                    Paragraph(comp.get("label", ""), cell_bold_style),
                    Paragraph(sub_s, cell_style),
                    Paragraph(w_pct, cell_style),
                    Paragraph(contrib, cell_style),
                    Paragraph(comp.get("raw_indicator", ""), cell_style),
                ]
            )
        comp_table = Table(comp_rows, colWidths=[40 * mm, 26 * mm, 18 * mm, 24 * mm, 70 * mm])
        comp_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        # Ensure header text in comp_table is white
        for col_i in range(5):
            comp_rows[0][col_i].style = ParagraphStyle(
                f"Hdr{col_i}",
                parent=cell_bold_style,
                textColor=colors.white,
            )
        story.append(comp_table)

    story.append(Spacer(1, 8))

    # 4. Embedded Visualizations
    story.append(Paragraph("3. Visual Analytics Summary", section_heading))
    story.append(_build_visualizations_drawing(summary, file_dicts))
    story.append(Spacer(1, 8))

    # 5. File-Level Metrics, Risk & Refactoring Priority Table
    story.append(Paragraph("4. File-Level Risk & Refactoring Priority Ranking", section_heading))
    story.append(
        Paragraph(
            "Files are ranked by their composite Refactoring Priority Score combining risk exposure, "
            "cyclomatic complexity, maintainability deficit, and static code-smell severity.",
            body_style,
        )
    )

    prio_rows = [
        [
            Paragraph("<font color='white'><b>Rank</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>Java File</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>LOC</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>CC (Max)</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>MI</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>Smells</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>Risk</b></font>", cell_bold_style),
            Paragraph("<font color='white'><b>Priority (Effort)</b></font>", cell_bold_style),
        ]
    ]

    for rec in recommendations[:20]:
        sm = rec.get("supporting_metrics", {})
        mi_str = (
            f"{sm['maintainability_index']:.1f}"
            if sm.get("maintainability_index") is not None
            else "N/A"
        )
        prio_rows.append(
            [
                Paragraph(f"#{rec['priority_rank']}", cell_bold_style),
                Paragraph(rec["file_name"], cell_style),
                Paragraph(str(sm.get("loc", 0)), cell_style),
                Paragraph(
                    f"{sm.get('cyclomatic_complexity', 0)} ({sm.get('max_method_complexity', 0)})",
                    cell_style,
                ),
                Paragraph(mi_str, cell_style),
                Paragraph(str(sm.get("code_smell_count", 0)), cell_style),
                Paragraph(f"{rec['risk_category']} ({rec['risk_score']})", cell_style),
                Paragraph(
                    f"{rec['priority_level']} - {rec['priority_score']} ({rec.get('estimated_effort', 'N/A')})",
                    cell_style,
                ),
            ]
        )

    prio_table = Table(
        prio_rows,
        colWidths=[12 * mm, 42 * mm, 14 * mm, 18 * mm, 14 * mm, 14 * mm, 26 * mm, 38 * mm],
    )
    prio_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(prio_table)
    story.append(Spacer(1, 8))

    # 6. Actionable Refactoring Recommendations
    story.append(Paragraph("5. Top Actionable Refactoring Recommendations", section_heading))
    for rec in recommendations[:8]:
        reasons_str = "; ".join(rec.get("primary_reasons", []))
        actions_str = " ".join(rec.get("suggested_actions", []))
        story.append(
            Paragraph(
                f"<b>#{rec['priority_rank']} {rec['file_name']}</b> "
                f"(Priority: {rec['priority_level']} [{rec['priority_score']}/100], "
                f"Estimated Effort: {rec.get('estimated_effort', 'N/A')})<br/>"
                f"• <i>Findings:</i> {reasons_str}<br/>"
                f"• <i>Recommended Action:</i> {actions_str}",
                body_style,
            )
        )

    # 7. Methodology, Limitations & Interpretation Notes
    story.append(Paragraph("6. Analysis Methodology, Limitations & Interpretation Notes", section_heading))
    limitations_notes = [
        "<b>Static AST Metric Extraction:</b> Source files are parsed into Abstract Syntax Trees using <i>javalang</i>. "
        "McCabe Cyclomatic Complexity is computed from AST branching nodes (if, for, while, do, switch cases, catch clauses, ternary operators, and short-circuit boolean operators).",
        "<b>Maintainability Index Formula:</b> Calculated via the normalized 0–100 SEI/Visual Studio derivative combining Halstead Volume (V), Cyclomatic Complexity (G), physical Lines of Code (LOC), and Comment Ratio.",
        "<b>Rule-Based vs. ML Assessment:</b> When no external trained scikit-learn model is loaded, risk scores represent deterministic rule-based heuristics. Static source metrics measure structural complexity and maintainability debt; they do not prove the presence or absence of runtime bugs.",
        "<b>Scope Limitations:</b> Static source-only analysis does not execute unit tests, measure dynamic code coverage, or resolve bytecode dependencies from external Maven/Gradle JARs.",
    ]
    for note in limitations_notes:
        story.append(Paragraph(f"• {note}", body_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
