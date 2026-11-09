"""Check published USDZ packages. Requires Python with OpenUSD (usd-core)."""

import json
import struct
import zipfile
from pathlib import Path

from pxr import Usd, UsdGeom, UsdValidation

ROOT = Path(__file__).resolve().parents[2]
TOLERANCE_M = 0.0005
registry = UsdValidation.ValidationRegistry()
validator_names = [
    meta.name
    for meta in registry.GetAllValidatorMetadata()
    if meta.name.startswith(("usdUtilsValidators:", "usdGeomValidators:", "usdShadeValidators:", "usdValidation:"))
]
context = UsdValidation.ValidationContext(registry.GetOrLoadValidatorsByName(validator_names))

models = json.loads((ROOT / "tools/models/replacements.json").read_text(encoding="utf-8"))
for slug, model in models.items():
    if model["status"] != "ready":
        continue

    path = ROOT / model["usdz"]
    assert path.stat().st_size <= 5_000_000, f"{slug}: USDZ exceeds 5 MB"
    with zipfile.ZipFile(path) as archive, path.open("rb") as binary:
        assert archive.testzip() is None
        assert archive.namelist()[0].endswith(".usdc")
        for member in archive.infolist():
            assert member.compress_type == zipfile.ZIP_STORED
            binary.seek(member.header_offset + 26)
            name_length, extra_length = struct.unpack("<HH", binary.read(4))
            assert (member.header_offset + 30 + name_length + extra_length) % 64 == 0

    stage = Usd.Stage.Open(str(path))
    assert stage and stage.GetDefaultPrim(), f"{slug}: no USD stage or default prim"
    assert UsdGeom.GetStageMetersPerUnit(stage) == 1, f"{slug}: expected meters"
    assert UsdGeom.GetStageUpAxis(stage) == "Y", f"{slug}: expected Y-up"
    for prim in stage.Traverse():
        texture = prim.GetAttribute("inputs:file")
        if texture:
            assert texture.Get().resolvedPath, f"{slug}: missing texture {texture.Get()}"

    for error in context.Validate(stage):
        assert error.GetType() != UsdValidation.ValidationErrorType.Error, error.GetMessage()
        print(error.GetType(), error.GetMessage())

    cache = UsdGeom.BBoxCache(Usd.TimeCode.Default(), ["default"])
    bounds = cache.ComputeWorldBound(stage.GetDefaultPrim()).ComputeAlignedRange()
    low, high = bounds.GetMin(), bounds.GetMax()
    for axis, dimension in enumerate(model["dimensionsM"]):
        assert abs(high[axis] - low[axis] - dimension) < TOLERANCE_M, f"{slug}: axis {axis} size mismatch"
    assert abs(low[1]) < TOLERANCE_M, f"{slug}: model does not rest on Y=0"
    for axis in (0, 2):
        assert abs((low[axis] + high[axis]) / 2) < TOLERANCE_M, f"{slug}: model is not centered"

    print(f"{slug}: USDZ valid, {path.stat().st_size} bytes, bounds match manifest")
