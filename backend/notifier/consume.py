"""
Notifier service: consumes email tasks from RabbitMQ and sends via SMTP.
Uses app.core.config for RabbitMQ, queue name, SMTP and frontend URL (env overrides).
"""
import json
import logging
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import pika

# Import after app is on PYTHONPATH (e.g. run as python -m notifier.consume from backend root)
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("notifier")

RABBITMQ_URL = settings.rabbitmq_url
QUEUE = settings.notifier_queue
SMTP_HOST = settings.smtp_host
SMTP_PORT = settings.smtp_port
SMTP_USER = settings.smtp_user
SMTP_PASSWORD = settings.smtp_password
SMTP_FROM = settings.smtp_from
FRONTEND_URL = settings.frontend_url


def send_reset_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/auth/reset-password?token={token}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Сброс пароля"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    text = f"Перейдите по ссылке для сброса пароля: {link}"
    msg.attach(MIMEText(text, "plain", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())


def send_lesson_cancelled_emails(
    emails: list[str],
    class_name: str,
    subject_name: str,
    day_label: str,
    time_str: str,
) -> None:
    """Отправляет уведомление об отмене урока каждому получателю (ученики класса и их родители)."""
    subject = "Урок отменён"
    text = (
        f"Урок «{subject_name}» в классе {class_name} отменён.\n"
        f"День: {day_label}, время: {time_str}.\n\n"
        "Пожалуйста, обратите внимание на актуальное расписание."
    )
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        for to_email in emails:
            if not to_email or not to_email.strip():
                continue
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email.strip()
            msg.attach(MIMEText(text, "plain", "utf-8"))
            try:
                server.sendmail(SMTP_FROM, to_email.strip(), msg.as_string())
            except Exception as e:
                logger.warning("Failed to send lesson_cancelled to %s: %s", to_email, e)


def on_message(ch, method, properties, body):
    try:
        task = json.loads(body)
        if task.get("type") == "reset_password":
            send_reset_email(task["email"], task["token"])
        elif task.get("type") == "lesson_cancelled":
            send_lesson_cancelled_emails(
                task.get("emails") or [],
                task.get("class_name") or "—",
                task.get("subject_name") or "—",
                task.get("day_label") or "—",
                task.get("time") or "—",
            )
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.exception("Error processing message: %s", e)
        try:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as nack_err:
            logger.warning("Nack failed: %s", nack_err)


def main():
    while True:
        conn = None
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            conn = pika.BlockingConnection(params)
            ch = conn.channel()
            ch.queue_declare(queue=QUEUE, durable=True)
            ch.basic_consume(queue=QUEUE, on_message_callback=on_message)
            logger.info("Consuming queue=%s", QUEUE)
            ch.start_consuming()
        except Exception as e:
            logger.warning("Connection error: %s; reconnecting in 5s", e)
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
            time.sleep(5)


if __name__ == "__main__":
    main()
