"""Rules in propose.py that manufacture or protect verification, tested without any model.
Run: venv-author/bin/python -m pytest tools/author/tests -q   (or python3 -m pytest)"""
import json, os, sys, subprocess, tempfile, shutil, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
spec = importlib.util.spec_from_file_location("propose", os.path.join(HERE, "..", "propose.py")); propose = importlib.util.module_from_spec(spec); spec.loader.exec_module(propose)

def words(*rows):
    return [{"i": i, "startMs": s, "endMs": e, "status": st, **({"verifiedBy": vb} if vb else {})} for (i, s, e, st, vb) in rows]

def test_bounded_run_is_interpolated_between_anchors():
    cue = {"words": words((0, 1000, 1200, "verified", "auto:align>=0.7"), (1, 1250, 1400, "proposed", None), (2, 1500, 1800, "verified", "auto:align>=0.7"))}
    n = propose.interpolate_gaps(cue, 1000, 2000)
    assert n == 1 and cue["words"][1]["status"] == "verified" and cue["words"][1]["verifiedBy"] == "auto:interpolated" and cue["words"][1]["interpolated"]

def test_run_longer_than_three_or_gap_over_limit_stays_proposed():
    cue = {"words": words((0, 1000, 1200, "verified", "x"), *[(i, 1200 + 50 * i, 1240 + 50 * i, "proposed", None) for i in range(1, 5)], (5, 1900, 2000, "verified", "x"))}
    assert propose.interpolate_gaps(cue, 1000, 2000) == 0
    cue = {"words": words((0, 1000, 1200, "verified", "x"), (1, 1300, 1400, "proposed", None), (2, 3000, 3200, "verified", "x"))}
    assert propose.interpolate_gaps(cue, 1000, 3300) == 0

def test_cue_without_anchor_is_left_alone():
    cue = {"words": words((0, 1000, 1200, "proposed", None), (1, 1300, 1400, "proposed", None))}
    assert propose.interpolate_gaps(cue, 1000, 2000) == 0 and all(w["status"] == "proposed" for w in cue["words"])

def test_implausible_timing_is_replaced_by_a_shared_gap():
    cue = {"words": words((0, 1000, 1200, "verified", "x"), (1, 900, 950, "proposed", None), (2, 1600, 1800, "verified", "x"))}
    propose.interpolate_gaps(cue, 1000, 2000)
    w = cue["words"][1]; assert 1200 <= w["startMs"] < w["endMs"] <= 1600

def test_human_word_is_never_touched():
    cue = {"words": words((0, 1000, 1200, "verified", "x"), (1, 1250, 1400, "verified", "human"), (2, 1500, 1800, "verified", "x"))}
    propose.interpolate_gaps(cue, 1000, 2000); assert cue["words"][1]["verifiedBy"] == "human"

def test_rerun_keeps_human_entries_and_never_sets_cue_status(tmp_path):
    scene = os.path.join(ROOT, "assets", "tos-bridge"); work = os.path.join(tmp_path, "s"); shutil.copytree(scene, work, ignore=shutil.ignore_patterns("hls", "*.mp4"))
    p = os.path.join(work, "companion.en.json"); c = json.load(open(p))
    c["cues"]["c002"]["words"][0].update({"startMs": 6700, "endMs": 6900, "status": "verified", "verifiedBy": "human"})
    c["cues"]["c003"]["status"] = "rejected"; c["cues"]["c003"].pop("verifiedBy", None)
    json.dump(c, open(p, "w"))
    inter = os.path.join(ROOT, "docs", "architecture-figures")  # any dir: we only need words/delivery files below
    wjson = os.path.join(tmp_path, "w.json"); json.dump({"c002": [{"i": 0, "startMs": 7000, "endMs": 7081, "score": 0.0}, {"i": 1, "startMs": 7101, "endMs": 7323, "score": 0.9}]}, open(wjson, "w"))
    r = subprocess.run([sys.executable, os.path.join(HERE, "..", "propose.py"), p, "--words", wjson, "--auto"], capture_output=True, text=True)
    assert r.returncode == 3 and "refusing" in r.stdout, r.stdout + r.stderr  # human verification present: refuse without --force
    r = subprocess.run([sys.executable, os.path.join(HERE, "..", "propose.py"), p, "--words", wjson, "--auto", "--force"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    c2 = json.load(open(p))
    assert c2["cues"]["c002"]["words"][0]["verifiedBy"] == "human" and c2["cues"]["c002"]["words"][0]["startMs"] == 6700
    assert c2["cues"]["c003"]["status"] == "rejected", "a rule never changes a cue's status"
    assert os.path.exists(p + ".bak")
