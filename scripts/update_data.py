#!/usr/bin/env python3
"""Refresh assets/data.js from the AnaGrow Google Sheet (Google Ads + GA4 tabs).

Reads the two tabs via Google Sheets' public CSV export endpoint, so the
spreadsheet must be shared as "Anyone with the link – Viewer" for this to
work from a GitHub Actions runner (no OAuth involved).

Usage: python3 scripts/update_data.py
Writes: assets/data.js
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

SHEET_ID = "1_oIQBKvh0lL6notumhgPRR2ADt_zejJldWDkvdaYhTk"
GID_GOOGLE_ADS = "0"
GID_GA4 = "1872956501"

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "assets" / "data.js"


def fetch_csv(gid: str) -> list[list[str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    if raw.lstrip().lower().startswith(b"<!doctype") or raw.lstrip().lower().startswith(b"<html"):
        raise RuntimeError(
            f"gid={gid} returned an HTML page instead of CSV — the sheet is probably not "
            "shared as 'Anyone with the link' (Viewer). Share it publicly (view-only) and retry."
        )
    text = raw.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text)))


def parse_ptbr_number(s: str) -> float:
    s = s.strip()
    if not s:
        return 0.0
    s = s.replace("R$", "").strip()
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def load_ads():
    rows = fetch_csv(GID_GOOGLE_ADS)
    header, *data = rows
    out = {}
    for row in data:
        if not row or not row[0].strip():
            continue
        date, cost, impr, clicks, conv = (row + ["0"] * 5)[:5]
        date = date.strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            continue
        out[date] = {
            "gasto": round(parse_ptbr_number(cost), 2),
            "impressions": int(float(impr or 0)),
            "clicks": int(float(clicks or 0)),
            "conversions": parse_ptbr_number(conv),
        }
    return out


def load_ga4():
    rows = fetch_csv(GID_GA4)
    header, *data = rows
    out = {}
    for row in data:
        if not row or not row[0].strip():
            continue
        date, sessions, events = (row + ["0"] * 3)[:3]
        date = date.strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            continue
        out[date] = {
            "sessions": int(float(sessions or 0)),
            "pageviews": int(float(events or 0)),
        }
    return out


def main():
    ads = load_ads()
    ga4 = load_ga4()
    if not ads or not ga4:
        print("ERROR: fetched empty data, aborting without overwriting data.js", file=sys.stderr)
        sys.exit(1)

    all_dates = sorted(set(ads) | set(ga4))
    rows = []
    for d in all_dates:
        a = ads.get(d, {"gasto": 0, "impressions": 0, "clicks": 0, "conversions": 0})
        g = ga4.get(d, {"sessions": 0, "pageviews": 0})
        rows.append({
            "date": d,
            "gasto": a["gasto"],
            "impressions": a["impressions"],
            "clicks": a["clicks"],
            "conversions": a["conversions"],
            "sessions": g["sessions"],
            "pageviews": g["pageviews"],
        })

    js = "const RAW_DATA = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    OUT_FILE.write_text(js, encoding="utf-8")
    print(f"Wrote {len(rows)} rows ({all_dates[0]} .. {all_dates[-1]}) to {OUT_FILE}")


if __name__ == "__main__":
    main()
