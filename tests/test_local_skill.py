from __future__ import annotations

import hashlib
import json
import runpy
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.parse import unquote, urlsplit

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_rules import links_in_markdown
from local_skill import DEFAULT_NAME, MARKER, update_local_skill


class LocalSkillTests(unittest.TestCase):
    def test_update_command_installs_self_contained_pi_skill(self):
        compiler = SCRIPTS / "compile-reference-dsl.py"
        with TemporaryDirectory() as directory:
            home = Path(directory).resolve()
            main = runpy.run_path(str(compiler))["main"]
            with patch.object(Path, "home", return_value=home), patch.object(
                sys, "argv", [str(compiler), "--update-skill"]
            ):
                self.assertEqual(main(), 0)
            target = home / ".pi" / "agent" / "skills" / DEFAULT_NAME
            self.assertFalse((home / ".agents").exists())
            self.assertTrue((target / "SKILL.md").is_file())
            self.assertTrue((target / "hooks" / "README.md").is_file())
            self.assertFalse((target / "_project").exists())
            manifest = json.loads((target / MARKER).read_text(encoding="utf-8"))
            self.assertEqual(manifest["name"], DEFAULT_NAME)
            for path in target.rglob("*.md"):
                for _, _, href in links_in_markdown(path.read_text(encoding="utf-8")):
                    url = urlsplit(href)
                    if url.scheme or url.netloc or not url.path:
                        continue
                    destination = (path.parent / unquote(url.path)).resolve()
                    with self.subTest(path=path.relative_to(target), href=href):
                        self.assertTrue(destination.is_relative_to(target))
                        self.assertTrue(destination.exists())

    def test_updates_pi_installation_and_preserves_local_edits(self):
        with TemporaryDirectory() as directory:
            home = Path(directory).resolve()
            target = home / ".pi" / "agent" / "skills" / DEFAULT_NAME
            shared_entry = home / ".agents" / "skills" / DEFAULT_NAME / "SKILL.md"
            shared_entry.parent.mkdir(parents=True)
            shared_entry.write_bytes(b"shared")
            target.mkdir(parents=True)
            entry = target / "SKILL.md"
            entry.write_bytes(b"old")
            (target / MARKER).write_text(
                json.dumps(
                    {
                        "format": 1,
                        "version": "0.1.0",
                        "name": DEFAULT_NAME,
                        "files": {"SKILL.md": hashlib.sha256(b"old").hexdigest()},
                    }
                ),
                encoding="utf-8",
            )
            outputs = {Path("SKILL.md"): "新指令\n"}
            with patch.object(Path, "home", return_value=home):
                self.assertEqual(update_local_skill(outputs), target)
                self.assertEqual(entry.read_text(encoding="utf-8"), "新指令\n")
                entry.write_text("本地修改", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "本地修改"):
                    update_local_skill(outputs)
            self.assertEqual(entry.read_text(encoding="utf-8"), "本地修改")
            self.assertEqual(shared_entry.read_bytes(), b"shared")
