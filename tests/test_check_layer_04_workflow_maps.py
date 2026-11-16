"""中文工作流图、清单、所有者与迁移契约的变异回归。"""
from __future__ import annotations

import importlib.util
import json
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "scripts"))
SPEC = importlib.util.spec_from_file_location("workflow_map_validator", REPO / "scripts/check-layer-04-workflow-maps.py")
assert SPEC and SPEC.loader
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class WorkflowMapMigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        shutil.copytree(REPO / "docs", self.root / "docs")

    def test_real_repository_routes_and_all_eight_module_maps_pass(self):
        self.assertEqual(validator.check_repository(REPO), [])

    def test_single_chinese_layout_needs_no_mirrors_or_root_policy_or_ci(self):
        self.assertFalse((self.root / "AGENTS.md").exists())
        self.assertFalse((self.root / ".github").exists())
        self.assertEqual(validator.check_repository(self.root), [])

    def test_each_route_checkpoint_is_required(self):
        for route in validator.ROUTE_MODULES:
            path = self.root / validator.ROUTES_DIR / f"{route}.md"
            original = path.read_text()
            for checkpoint in (f"{validator.TOP_PREFIXES[route]}{i:02d}" for i in range(1, 8)):
                with self.subTest(route=route, checkpoint=checkpoint):
                    path.write_text(original.replace(checkpoint, "BROKEN"))
                    self.assertTrue(validator.check_repository(self.root))
            path.write_text(original)

    def test_every_module_edge_is_protected(self):
        for module in validator.MODULES:
            path = self.root / validator.MODULES_DIR / f"{module}.md"
            original = path.read_text()
            diagram = validator.FENCE.search(original)
            self.assertIsNotNone(diagram)
            for edge in validator.EDGE.finditer(diagram.group(1)):
                literal = edge.group(0)
                with self.subTest(module=module, edge=literal):
                    path.write_text(original.replace(literal, "", 1))
                    self.assertTrue(validator.check_repository(self.root))
            path.write_text(original)

    def test_module_checkpoints_cannot_be_removed_or_reordered(self):
        for module in validator.MODULES:
            path = self.root / validator.MODULES_DIR / f"{module}.md"
            original = path.read_text()
            for match in validator.STEP.finditer(original):
                with self.subTest(module=module, checkpoint=match.group(2)):
                    path.write_text(original[:match.start()] + original[match.end():])
                    self.assertTrue(validator.check_repository(self.root))
            path.write_text(original)

    def test_required_owner_links_must_be_operational_not_inline_code(self):
        for module, checkpoints in validator.MODULE_CHECKPOINT_L3_OWNERS.items():
            path = self.root / validator.MODULES_DIR / f"{module}.md"
            original = path.read_text()
            for checkpoint, owners in checkpoints.items():
                for owner in owners:
                    target = f"../../layer-03-workflow-checkpoints/{owner}.md"
                    with self.subTest(module=module, checkpoint=checkpoint, owner=owner):
                        changed = re.sub(r"\[[^\]]+\]\(" + re.escape(target) + r"\)", lambda m: "`" + m[0] + "`", original)
                        self.assertNotEqual(changed, original)
                        path.write_text(changed)
                        self.assertTrue(validator.check_repository(self.root))
            path.write_text(original)

    def test_single_agent_cannot_call_delegated_module(self):
        path = self.root / validator.ROUTES_DIR / "coding-single-agent.md"
        path.write_text(path.read_text().replace("modules/single-execution.md", "modules/delegated-execution.md"))
        self.assertTrue(validator.check_repository(self.root))

    def test_route_cannot_skip_current_state_verification(self):
        path = self.root / validator.ROUTES_DIR / "coding-single-agent.md"
        text = path.read_text()
        text, count = re.subn(r"(SM04\s+--[^\n]*-->\s+)SM05", r"\g<1>SM07", text)
        self.assertEqual(count, 1)
        path.write_text(text)
        self.assertTrue(validator.check_repository(self.root))

    def test_manifest_rejects_each_missing_legacy_mapping(self):
        path = self.root / validator.MIGRATION_MANIFEST
        original = path.read_text()
        data = json.loads(original)
        for route, value in data["routes"].items():
            for index in range(len(value["steps"])):
                changed = json.loads(original)
                changed["routes"][route]["steps"].pop(index)
                with self.subTest(route=route, index=index):
                    path.write_text(json.dumps(changed, ensure_ascii=False))
                    self.assertTrue(validator.check_repository(self.root))
        path.write_text(original)

    def test_map_cannot_have_unreachable_orphan(self):
        path = self.root / validator.MODULES_DIR / "entry-readiness.md"
        path.write_text(path.read_text().replace("```mermaid\n", '```mermaid\n    ORPHAN["不可达"]\n', 1))
        self.assertTrue(validator.check_repository(self.root))


if __name__ == "__main__":
    unittest.main()
