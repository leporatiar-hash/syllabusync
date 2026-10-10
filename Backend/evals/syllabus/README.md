# Syllabus parsing eval

Synthetic Spring 2027 syllabi, each built around a known failure case, with the correct deadlines:

| File | Tests |
|---|---|
| 01_table | schedule table with year-less dates ("Jan 14"), spring break rows |
| 02_long | 42k chars of policy first, schedule at the very end |
| 03_relative | dates given only as "Week N / Tuesday", spring break week |
| 04_recurring | "quiz every Monday", MLK day and spring break skipped |
| 05_titles | "Week 3 Reflection", "Lecture Quiz 2" style titles |
| 06_dense | 40-row daily schedule |

```bash
venv_fresh/bin/python evals/syllabus/generate.py     # writes the PDFs + truth.json here
venv_fresh/bin/python evals/syllabus/run_eval.py     # calls the real pipeline (uses OPENAI_API_KEY from .env; a few cents)
```

Results (2026-10-10): gpt-4o-mini before fixes 71% of deadlines found; after fixes 94%;
after fixes with gpt-4.1-mini (now the default) 97% found, 98% correct, 12/12 exams.
Remaining misses: 2 rows of the dense table; a weekly item expanded past the last day of class.
