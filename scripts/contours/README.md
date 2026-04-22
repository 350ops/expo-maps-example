# Contour extraction pipeline (PDF/PNG -> georeferenced contour bands)

This script builds a semi-automated workflow for scanned/exported contour maps:

1. Convert PDF to PNG (first page) when needed.
2. Georeference with GCPs (`gdal_translate` + `gdalwarp`).
3. Segment color bands with KMeans in HSV space.
4. Polygonize classes and export `contour_bands.gpkg`.

## Prerequisites

- Python 3.10+
- GDAL command-line tools available on PATH:
  - `gdal_translate`
  - `gdalwarp`

Install Python dependencies:

```bash
pip install -r scripts/contours/requirements.txt
```

## GCP input format

Create a CSV with **pixel** and **map** coordinates:

```csv
id,px,py,x,y
A3,1280,950,325820.000,467120.000
A4,1380,920,325860.000,467145.000
A5,1480,1220,325868.163,467130.914
A6,1620,1260,325764.107,467161.988
CONTROL,1450,1300,325700.000,467100.000
```

> Keep `x,y` in one CRS (preferably projected meters, e.g., UTM).

## Run

```bash
python scripts/contours/contour_pipeline.py \
  --input /path/to/map.png \
  --gcps /path/to/gcps.csv \
  --epsg 32643 \
  --outdir contour_output \
  --classes 10
```

For PDF input:

```bash
python scripts/contours/contour_pipeline.py \
  --input /path/to/map.pdf \
  --gcps /path/to/gcps.csv \
  --epsg 32643 \
  --outdir contour_output \
  --pdf-dpi 400
```

## Optional custom elevation ranges

If class-to-elevation ranges differ from defaults, provide a CSV:

```csv
class_id,z_min,z_max
1,-12.78,-10.54
2,-10.54,-8.80
...
10,1.54,2.06
```

Run with:

```bash
python scripts/contours/contour_pipeline.py \
  --input /path/to/map.png \
  --gcps /path/to/gcps.csv \
  --epsg 32643 \
  --elev-ranges /path/to/elevation_ranges.csv
```

## Outputs

- `map_georeferenced.tif`
- `map_classes.tif`
- `map_classes.centers_hsv.json`
- `contour_bands.gpkg` (layer: `contour_bands`)

## Common errors

- `ModuleNotFoundError: No module named 'rasterio'`
  - Install dependencies: `pip install -r scripts/contours/requirements.txt`
- `gdal_translate: command not found`
  - Install GDAL binaries and ensure they are on PATH.
