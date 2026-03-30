"""Поведение очереди писем: устойчивость к отсутствию RabbitMQ и ошибкам publish."""

import sys
import types

import pytest

import app.services.email_queue as email_queue


@pytest.fixture(autouse=True)
def reset_email_queue_globals():
    email_queue._connection = None
    email_queue._channel = None
    yield
    email_queue._connection = None
    email_queue._channel = None


def _make_fake_pika_module():
    fake = types.ModuleType("pika")

    class BasicProperties:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    fake.BasicProperties = BasicProperties
    fake.URLParameters = lambda url: url

    class BlockingConnection:
        def __init__(self, params):
            self.params = params

        def channel(self):
            class Ch:
                def queue_declare(self, **kwargs):
                    return None

                def basic_publish(self, **kwargs):
                    pass

                def close(self):
                    pass

            self._ch = Ch()
            return self._ch

        def process_data_events(self, time_limit=0):
            return None

        def close(self):
            pass

    fake.BlockingConnection = BlockingConnection
    return fake


def test_publish_email_task_returns_false_when_no_channel(monkeypatch):
    monkeypatch.setattr(email_queue, "get_channel", lambda: None)
    ok = email_queue.publish_email_task({"type": "test", "to": "a@b.c"}, "corr-1")
    assert ok is False


def test_get_channel_reuses_open_channel(monkeypatch):
    class Ch:
        pass

    class Conn:
        def process_data_events(self, time_limit=0):
            return None

    email_queue._connection = Conn()
    email_queue._channel = Ch()

    monkeypatch.setattr(
        email_queue,
        "_close_channel",
        lambda: (_ for _ in ()).throw(AssertionError("_close_channel unexpected")),
    )
    got = email_queue.get_channel()
    assert isinstance(got, Ch)


def test_get_channel_reconnects_when_process_data_events_fails(monkeypatch):
    class BrokenConn:
        def process_data_events(self, time_limit=0):
            raise OSError("broken")

    email_queue._connection = BrokenConn()
    email_queue._channel = object()

    fake = _make_fake_pika_module()
    monkeypatch.setitem(sys.modules, "pika", fake)
    ch = email_queue.get_channel()
    assert ch is not None


def test_publish_email_task_success(monkeypatch):
    monkeypatch.setitem(sys.modules, "pika", _make_fake_pika_module())

    class ShallowChannel:
        def __init__(self):
            self.published = []

        def basic_publish(self, **kwargs):
            self.published.append(kwargs)

    shallow = ShallowChannel()
    monkeypatch.setattr(email_queue, "get_channel", lambda: shallow)

    ok = email_queue.publish_email_task({"type": "reset_password", "x": 1}, "cid-99")
    assert ok is True
    assert len(shallow.published) == 1
    pub = shallow.published[0]
    assert pub["routing_key"] == email_queue.settings.notifier_queue
    body = pub["body"].decode("utf-8")
    assert "reset_password" in body


def test_publish_email_task_closes_on_publish_error(monkeypatch):
    monkeypatch.setitem(sys.modules, "pika", _make_fake_pika_module())

    class FailingChannel:
        def basic_publish(self, **kwargs):
            raise RuntimeError("broker down")

    monkeypatch.setattr(email_queue, "get_channel", lambda: FailingChannel())

    closed = []

    def spy_close():
        closed.append(True)
        email_queue._connection = None
        email_queue._channel = None

    monkeypatch.setattr(email_queue, "_close_channel", spy_close)

    ok = email_queue.publish_email_task({"type": "t"}, None)
    assert ok is False
    assert closed == [True]


def test_close_channel_swallow_errors():
    """_close_channel не должен валить вызывающего при ошибках закрытия."""

    class BadCh:
        def close(self):
            raise OSError("noop")

    class BadConn:
        def close(self):
            raise OSError("noop")

    email_queue._channel = BadCh()
    email_queue._connection = BadConn()
    email_queue._close_channel()
    assert email_queue._channel is None
    assert email_queue._connection is None
