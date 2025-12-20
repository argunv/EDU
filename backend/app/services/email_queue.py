"""Publish email tasks to RabbitMQ for notifier service."""
import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_connection = None
_channel = None


def _close_channel() -> None:
    """Invalidate connection and channel so next publish will reconnect."""
    global _connection, _channel
    ch, conn = _channel, _connection
    _channel = None
    _connection = None
    try:
        if ch is not None:
            ch.close()
    except Exception as e:
        logger.warning("email_queue: error closing channel: %s", e)
    try:
        if conn is not None:
            conn.close()
    except Exception as e:
        logger.warning("email_queue: error closing connection: %s", e)


def get_channel():
    global _connection, _channel
    if _channel is not None:
        try:
            _connection.process_data_events(time_limit=0)
            return _channel
        except Exception as e:
            logger.warning("email_queue: connection broken, reconnecting: %s", e)
            _close_channel()
    try:
        import pika
        params = pika.URLParameters(settings.rabbitmq_url)
        _connection = pika.BlockingConnection(params)
        _channel = _connection.channel()
        _channel.queue_declare(queue=settings.notifier_queue, durable=True)
        return _channel
    except Exception as e:
        logger.warning("email_queue: failed to connect to RabbitMQ: %s", e)
        _close_channel()
        return None


def publish_email_task(task: dict[str, Any], correlation_id: str | None = None) -> bool:
    """Publish a dict task to the notifier queue. Returns True if published."""
    ch = get_channel()
    if not ch:
        logger.warning("email_queue: cannot publish task (no channel); task type=%s", task.get("type"))
        return False
    try:
        import pika
        body = json.dumps(task).encode("utf-8")
        props = pika.BasicProperties(
            delivery_mode=2,
            content_type="application/json",
            correlation_id=correlation_id or "",
        )
        ch.basic_publish(
            exchange="",
            routing_key=settings.notifier_queue,
            body=body,
            properties=props,
        )
        return True
    except Exception as e:
        logger.warning("email_queue: publish failed: %s; task type=%s", e, task.get("type"))
        _close_channel()
        return False
