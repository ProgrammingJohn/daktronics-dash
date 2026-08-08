import threading
import time
import unittest

from services.runtime import ScoreboardRuntime


class FakeSupervisor:
    def __init__(self, stop_result=True, stop_delay=0.0):
        self.stop_result = stop_result
        self.stop_delay = stop_delay
        self.alive = False

    def start(self):
        self.alive = True

    def stop(self, timeout_s=2.0):
        time.sleep(self.stop_delay)
        if self.stop_result:
            self.alive = False
        return self.stop_result

    def discovery_status(self):
        return {
            "phase": "FOUND",
            "active": False,
            "attempts": 1,
            "method": "udp_broadcast",
            "requested_host": None,
            "resolved_host": "10.93.37.138",
        }


class SupervisorFactory:
    def __init__(self, first_stop_result=True, stop_delay=0.0):
        self.instances = []
        self.first_stop_result = first_stop_result
        self.stop_delay = stop_delay

    def __call__(self, *args):
        stop_result = self.first_stop_result if not self.instances else True
        supervisor = FakeSupervisor(stop_result, self.stop_delay)
        self.instances.append(supervisor)
        return supervisor


class RuntimeTests(unittest.TestCase):
    def test_concurrent_starts_leave_exactly_one_live_owner(self):
        factory = SupervisorFactory(stop_delay=0.02)
        runtime = ScoreboardRuntime(supervisor_factory=factory)
        self.assertTrue(runtime.start_synced("football", "host", 1234, "device"))

        barrier = threading.Barrier(3)

        def replace():
            barrier.wait()
            runtime.start_synced("football", "host", 1234, "device")

        workers = [threading.Thread(target=replace) for _ in range(2)]
        for worker in workers:
            worker.start()
        barrier.wait()
        for worker in workers:
            worker.join()

        self.assertEqual(sum(item.alive for item in factory.instances), 1)
        runtime.stop()

    def test_failed_stop_aborts_replacement(self):
        factory = SupervisorFactory(first_stop_result=False)
        runtime = ScoreboardRuntime(supervisor_factory=factory)
        self.assertTrue(runtime.start_synced("football", "host", 1234, "device"))
        self.assertFalse(runtime.start_synced("football", "other", 1234, "device"))
        self.assertEqual(len(factory.instances), 1)

    def test_manual_runtime_stays_live_without_network_heartbeat(self):
        runtime = ScoreboardRuntime()
        self.assertTrue(runtime.start_manual("football"))
        self.assertEqual(runtime.status()["status"], "LIVE")
        runtime.stop()

    def test_synced_status_exposes_discovery_diagnostics(self):
        factory = SupervisorFactory()
        runtime = ScoreboardRuntime(supervisor_factory=factory)
        self.assertTrue(runtime.start_synced(
            "football", None, 1234, "wt32-aabbccddeeff"
        ))
        self.assertEqual(runtime.status()["discovery"], {
            "phase": "FOUND",
            "active": False,
            "attempts": 1,
            "method": "udp_broadcast",
            "requested_host": None,
            "resolved_host": "10.93.37.138",
        })
        runtime.stop()


if __name__ == "__main__":
    unittest.main()
