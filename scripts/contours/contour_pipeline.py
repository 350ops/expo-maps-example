#!/usr/bin/env python3
"""Semi-automated contour-band extraction from map PDFs/PNGs.

Pipeline:
1) Optional PDF -> PNG conversion
2) Georeference with user-provided GCPs
3) Segment elevation color bands (k-means)
4) Polygonize bands and attach elevation attributes
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


OPTIONAL_IMPORT_ERROR = None
try:
    import cv2
    import fitz
    import geopandas as gpd
    import rasterio
    from rasterio import features
    from shapely.geometry import shape
    from sklearn.cluster import KMeans
except ModuleNotFoundError as exc:  # pragma: no cover - runtime dependency guard
    OPTIONAL_IMPORT_ERROR = exc


DEFAULT_ELEVATION_RANGES: Dict[int, Tuple[float, float]] = {
    1: (-12.78, -10.54),
    2: (-10.54, -8.80),
    3: (-8.80, -0.50),
    4: (-0.50, -0.06),
    5: (-0.06, 0.34),
    6: (0.34, 0.53),
    7: (0.53, 0.75),
    8: (0.75, 1.19),
    9: (1.19, 1.54),
    10: (1.54, 2.06),
}


def require_optional_deps() -> None:
    if OPTIONAL_IMPORT_ERROR is not None:
        raise SystemExit(
            "Missing Python dependency: "
            f"{OPTIONAL_IMPORT_ERROR}.\n"
            "Install dependencies with:\n"
            "  pip install -r scripts/contours/requirements.txt"
        )


def run(cmd: List[str]) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, check=True)


def pdf_to_png(pdf_path: Path, output_png: Path, dpi: int) -> Path:
    output_png.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    page = doc.load_page(0)
    scale = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    pix.save(output_png)
    doc.close()
    return output_png


def georeference_with_gcps(
    src_raster: Path,
    gcps_csv: Path,
    target_epsg: int,
    out_geotiff: Path,
) -> Path:
    gcps = pd.read_csv(gcps_csv)
    required = {"id", "px", "py", "x", "y"}
    missing = required.difference(gcps.columns)
    if missing:
        raise ValueError(f"Missing required GCP columns: {sorted(missing)}")

    tmp = out_geotiff.with_name(f"{out_geotiff.stem}.with_gcps.tif")
    tmp.parent.mkdir(parents=True, exist_ok=True)

    cmd = ["gdal_translate", "-of", "GTiff"]
    for _, row in gcps.iterrows():
        cmd.extend(["-gcp", str(row.px), str(row.py), str(row.x), str(row.y)])
    cmd.extend([str(src_raster), str(tmp)])
    run(cmd)

    run(
        [
            "gdalwarp",
            "-t_srs",
            f"EPSG:{target_epsg}",
            "-r",
            "bilinear",
            "-dstalpha",
            str(tmp),
            str(out_geotiff),
        ]
    )
    return out_geotiff


def _sorted_cluster_order_by_lightness(cluster_centers_hsv: np.ndarray) -> Dict[int, int]:
    lightness_order = np.argsort(cluster_centers_hsv[:, 2])  # dark -> bright
    return {int(cluster_idx + 1): int(rank + 1) for rank, cluster_idx in enumerate(lightness_order)}


def segment_color_bands(
    geotiff: Path,
    class_raster: Path,
    n_classes: int,
    bg_s_max: int = 22,
    bg_v_min: int = 220,
) -> Tuple[Path, Dict[int, int]]:
    require_optional_deps()

    with rasterio.open(geotiff) as src:
        rgb = src.read([1, 2, 3])
        profile = src.profile

    image = np.transpose(rgb, (1, 2, 0))
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)

    background_mask = (hsv[:, :, 1] <= bg_s_max) & (hsv[:, :, 2] >= bg_v_min)
    valid = ~background_mask

    samples = hsv[valid].astype(np.float32)
    if len(samples) < n_classes * 100:
        raise ValueError(
            f"Too few valid pixels ({len(samples)}) for {n_classes} classes. "
            "Crop to map area and relax background masking if needed."
        )

    kmeans = KMeans(n_clusters=n_classes, random_state=42, n_init=20)
    labels = kmeans.fit_predict(samples)

    raw_class = np.zeros(valid.shape, dtype=np.uint8)
    raw_class[valid] = labels.astype(np.uint8) + 1

    # Re-map classes so class 1 is darkest and class N is brightest.
    remap = _sorted_cluster_order_by_lightness(kmeans.cluster_centers_)
    class_map = np.zeros_like(raw_class, dtype=np.uint8)
    for old, new in remap.items():
        class_map[raw_class == old] = new

    # Morphological cleanup.
    kernel = np.ones((3, 3), np.uint8)
    cleaned = np.zeros_like(class_map)
    for cls in range(1, n_classes + 1):
        mask = (class_map == cls).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        cleaned[mask == 1] = cls

    profile.update(count=1, dtype=rasterio.uint8, nodata=0)
    with rasterio.open(class_raster, "w", **profile) as dst:
        dst.write(cleaned, 1)

    centers = {
        int(remap[idx + 1]): [float(v) for v in center]
        for idx, center in enumerate(kmeans.cluster_centers_)
    }
    with open(class_raster.with_suffix(".centers_hsv.json"), "w", encoding="utf-8") as f:
        json.dump(centers, f, indent=2)

    return class_raster, remap


def polygonize_classes(
    class_raster: Path,
    output_gpkg: Path,
    elevation_ranges: Dict[int, Tuple[float, float]],
    min_area_m2: float,
) -> Path:
    require_optional_deps()

    with rasterio.open(class_raster) as src:
        arr = src.read(1)
        transform = src.transform
        crs = src.crs

    geometries = []
    class_ids = []
    for geom, val in features.shapes(arr, transform=transform):
        class_val = int(val)
        if class_val == 0:
            continue
        geometries.append(shape(geom))
        class_ids.append(class_val)

    if not geometries:
        raise ValueError("No contour classes found during polygonization")

    gdf = gpd.GeoDataFrame({"class_id": class_ids}, geometry=geometries, crs=crs)
    gdf = gdf.dissolve(by="class_id").reset_index()
    gdf["area_m2"] = gdf.geometry.area
    gdf = gdf[gdf["area_m2"] >= min_area_m2].copy()

    gdf["z_min"] = gdf["class_id"].map(lambda c: elevation_ranges.get(int(c), (None, None))[0])
    gdf["z_max"] = gdf["class_id"].map(lambda c: elevation_ranges.get(int(c), (None, None))[1])

    output_gpkg.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_file(output_gpkg, layer="contour_bands", driver="GPKG")
    return output_gpkg


def load_elevation_ranges(path: Path | None) -> Dict[int, Tuple[float, float]]:
    if path is None:
        return DEFAULT_ELEVATION_RANGES

    df = pd.read_csv(path)
    required = {"class_id", "z_min", "z_max"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Missing required elevation range columns: {sorted(missing)}")

    return {
        int(row.class_id): (float(row.z_min), float(row.z_max))
        for _, row in df.iterrows()
    }


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Input map path (.png/.jpg/.tif/.pdf)")
    parser.add_argument("--gcps", required=True, help="CSV with columns: id,px,py,x,y")
    parser.add_argument("--epsg", required=True, type=int, help="Target EPSG for georeferencing")
    parser.add_argument("--outdir", default="contour_output", help="Output directory")
    parser.add_argument("--classes", type=int, default=10, help="Number of color classes")
    parser.add_argument(
        "--elev-ranges",
        default=None,
        help="Optional CSV with class_id,z_min,z_max; defaults to embedded table",
    )
    parser.add_argument("--min-area", type=float, default=5.0, help="Minimum polygon area in m²")
    parser.add_argument("--pdf-dpi", type=int, default=400, help="DPI if input is PDF")
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    input_path = Path(args.input)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if input_path.suffix.lower() == ".pdf":
        raster_path = outdir / f"{input_path.stem}.png"
        pdf_to_png(input_path, raster_path, dpi=args.pdf_dpi)
    else:
        raster_path = input_path

    geotiff = outdir / "map_georeferenced.tif"
    class_tif = outdir / "map_classes.tif"
    gpkg = outdir / "contour_bands.gpkg"

    georeference_with_gcps(raster_path, Path(args.gcps), args.epsg, geotiff)
    segment_color_bands(geotiff, class_tif, n_classes=args.classes)

    elevation_ranges = load_elevation_ranges(Path(args.elev_ranges) if args.elev_ranges else None)
    polygonize_classes(class_tif, gpkg, elevation_ranges=elevation_ranges, min_area_m2=args.min_area)

    print("\nPipeline completed successfully:")
    print(f"  Georeferenced raster: {geotiff}")
    print(f"  Class raster:         {class_tif}")
    print(f"  Contour polygons:     {gpkg}")


if __name__ == "__main__":
    main()
