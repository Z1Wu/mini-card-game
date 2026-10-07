import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("dev-worktree.py")
SPEC = importlib.util.spec_from_file_location("dev_worktree", SCRIPT)
dev_worktree = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dev_worktree)


class WorktreePortAllocatorTests(unittest.TestCase):
    def setUp(self):
        self.lock_directory = tempfile.TemporaryDirectory()
        self.lock_patch = patch.object(
            dev_worktree, "LOCK_DIRECTORY", Path(self.lock_directory.name)
        )
        self.lock_patch.start()
        self.availability_patch = patch.object(
            dev_worktree, "ports_are_free", return_value=True
        )
        self.availability_patch.start()
        self.locks = []

    def tearDown(self):
        for lock in self.locks:
            lock.close()
        self.availability_patch.stop()
        self.lock_patch.stop()
        self.lock_directory.cleanup()

    def hold_slot(self, slot):
        selected, lock = dev_worktree.acquire_slot(slot)
        self.assertEqual(selected, slot)
        self.locks.append(lock)

    def test_port_ranges_are_distinct_for_adjacent_slots(self):
        first = dev_worktree.ports_for(20)
        second = dev_worktree.ports_for(21)

        self.assertEqual(first, (8805, 8806, 3020))
        self.assertTrue(set(first).isdisjoint(second))

    def test_automatic_allocation_skips_a_locked_slot(self):
        with patch.object(dev_worktree, "worktree_seed", return_value=20):
            first_slot, first_lock = dev_worktree.acquire_slot(None)
            self.locks.append(first_lock)
            second_slot, second_lock = dev_worktree.acquire_slot(None)
            self.locks.append(second_lock)

        self.assertNotEqual(first_slot, second_slot)

    def test_explicit_allocation_rejects_a_locked_slot(self):
        self.hold_slot(20)

        with self.assertRaisesRegex(RuntimeError, "already in use"):
            dev_worktree.acquire_slot(20)


if __name__ == "__main__":
    unittest.main()
