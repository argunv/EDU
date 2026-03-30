from pathlib import Path


def test_relation_migrations_exist():
    versions = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    files = {p.name for p in versions.glob("*.py")}
    assert "007_profiles_relations_expand.py" in files
    assert "008_profiles_relations_backfill.py" in files
    assert "009_contract_drop_legacy_relations.py" in files
    assert "010_relations_integrity_hardening.py" in files


def test_expand_migration_contains_key_objects():
    versions = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    text = (versions / "007_profiles_relations_expand.py").read_text(encoding="utf-8")
    assert "user_roles" in text
    assert "class_enrollments" in text
    assert "teacher_assignments" in text
    assert "parent_student_links" in text
    assert "teacher_id" in text


def test_hardening_migration_contains_integrity_constraints():
    versions = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    text = (versions / "010_relations_integrity_hardening.py").read_text(encoding="utf-8")
    assert "uq_grades_student_subject_date" in text
    assert "ex_class_enrollments_no_overlap" in text
    assert "ck_class_enrollments_period_valid" in text


def test_no_runtime_legacy_relations_refs():
    app_dir = Path(__file__).resolve().parents[1] / "app"
    legacy_markers = ("teacher_classes", "teacher_subjects", "parent_children")
    allowed_legacy_model_defs = {
        "models/parent.py",
        "models/teacher.py",
        "models/student.py",
    }
    for py in app_dir.rglob("*.py"):
        rel_path = py.relative_to(app_dir).as_posix()
        if rel_path in allowed_legacy_model_defs:
            continue
        content = py.read_text(encoding="utf-8")
        if "alembic" in str(py):
            continue
        for marker in legacy_markers:
            assert marker not in content, f"legacy marker '{marker}' found in {py}"
