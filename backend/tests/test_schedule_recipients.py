"""Сбор получателей уведомлений по классу (ученики + привязанные родители)."""

from app.services.schedule import get_class_recipient_emails


def test_get_class_recipient_emails_empty_when_no_active_students(db, class_9a):
    assert get_class_recipient_emails(db, class_9a.id) == []


def test_get_class_recipient_emails_includes_student_and_parent_emails(
    db, class_1a, student_user, parent_user
):
    student_user.email = "learner@example.com"
    parent_user.email = "guardian@example.com"
    db.add(student_user)
    db.add(parent_user)
    db.commit()

    emails = set(get_class_recipient_emails(db, class_1a.id))
    assert emails == {"learner@example.com", "guardian@example.com"}
