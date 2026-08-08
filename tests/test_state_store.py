import unittest

from services.connection.protocol import Envelope
from services.connection.state_store import HealthState, LatestStateStore
from tests.test_protocol import snapshot


class StateStoreTests(unittest.TestCase):
    def test_rejects_old_generation_and_out_of_order_state(self):
        store = LatestStateStore()
        old = store.start_generation()
        current = store.start_generation()
        self.assertFalse(store.publish(old, snapshot(1), {"home_score": 1}, 1_000_000_000))
        self.assertTrue(store.publish(current, snapshot(2), {"home_score": 2}, 2_000_000_000))
        self.assertFalse(store.publish(current, snapshot(1), {"home_score": 1}, 3_000_000_000))
        self.assertEqual(store.view(3_000_000_000).score["home_score"], 2)

    def test_disconnect_retains_last_good_score(self):
        store = LatestStateStore()
        generation = store.start_generation()
        store.set_transport(generation, True, 0)
        store.publish(generation, snapshot(1), {"home_score": 22}, 0)
        store.set_transport(generation, False, 1_000_000_000)
        view = store.view(1_000_000_000)
        self.assertEqual(view.health, HealthState.DISCONNECTED)
        self.assertEqual(view.score, {"home_score": 22})

    def test_live_then_stale_source_then_disconnected(self):
        store = LatestStateStore(source_stale_ns=2_000_000_000,
                                 heartbeat_timeout_ns=3_000_000_000)
        generation = store.start_generation()
        store.set_transport(generation, True, 0)
        store.record_heartbeat(generation, 0)
        store.publish(generation, snapshot(1), {"home_score": 1}, 0)
        self.assertEqual(store.view(1_000_000_000).health, HealthState.LIVE)
        self.assertEqual(store.view(2_500_000_000).health, HealthState.STALE_SOURCE)
        self.assertEqual(store.view(3_500_000_000).health, HealthState.DISCONNECTED)

    def test_serial_age_can_make_a_newly_received_score_stale(self):
        store = LatestStateStore(source_stale_ns=2_000_000_000)
        generation = store.start_generation()
        envelope = Envelope.snapshot(
            "wt32-aabbccddeeff", "boot-1234", 9, 1, 2500, 2000, b"12:00HOME"
        )
        store.set_transport(generation, True, 0)
        store.record_heartbeat(generation, 0)
        store.publish(generation, envelope, {"home_score": 1}, 0)
        view = store.view(0)
        self.assertEqual(view.source_age_ms, 2000)
        self.assertEqual(view.health, HealthState.STALE_SOURCE)

    def test_new_generation_requires_publish_before_reporting_live(self):
        store = LatestStateStore()
        first = store.start_generation()
        store.set_transport(first, True, 0)
        store.record_heartbeat(first, 0)
        store.publish(first, snapshot(1), {"home_score": 22}, 0)

        second = store.start_generation()
        store.set_transport(second, True, 1_000_000_000)
        store.record_heartbeat(second, 1_000_000_000)
        view = store.view(1_000_000_000)

        self.assertEqual(view.score, {"home_score": 22})
        self.assertNotEqual(view.health, HealthState.LIVE)

    def test_rejects_changed_session_in_current_generation(self):
        store = LatestStateStore()
        generation = store.start_generation()
        self.assertTrue(store.publish(
            generation, snapshot(1, session_id="first-session"), {"home_score": 1}, 0
        ))
        self.assertFalse(store.publish(
            generation, snapshot(2, session_id="second-session"), {"home_score": 2}, 1
        ))

        view = store.view(1)
        self.assertEqual(view.score, {"home_score": 1})
        self.assertEqual(view.session_id, "first-session")
        self.assertEqual(view.counters["old_generation"], 1)

    def test_views_expose_immutable_score_and_counter_snapshots(self):
        store = LatestStateStore()
        generation = store.start_generation()
        store.publish(generation, snapshot(1), {"home_score": 1}, 0)
        view = store.view(0)

        with self.assertRaises(TypeError):
            view.score["home_score"] = 2
        with self.assertRaises(TypeError):
            view.counters["published"] = 0
        self.assertEqual(store.view(0).score, {"home_score": 1})
        self.assertEqual(store.view(0).counters["published"], 1)

    def test_counts_generation_order_and_disconnect_rejections(self):
        store = LatestStateStore()
        generation = store.start_generation()
        self.assertFalse(store.publish(generation - 1, snapshot(1), {"home_score": 1}, 0))
        store.set_transport(generation, True, 0)
        self.assertTrue(store.publish(generation, snapshot(2), {"home_score": 2}, 0))
        self.assertFalse(store.publish(generation, snapshot(2), {"home_score": 2}, 1))
        store.set_transport(generation, False, 1)

        self.assertEqual(store.view(1).counters, {
            "published": 1,
            "old_generation": 1,
            "out_of_order": 1,
            "disconnects": 1,
        })
