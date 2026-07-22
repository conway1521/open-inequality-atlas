#!/usr/bin/env python3
"""Regenerate manifest.json from the data modules.

Self-contained: reads only data/*.json, so it can run in CI on every commit
without the raw upstream sources. The page works without the manifest, but the
manifest is the machine-readable registry of what the atlas currently holds:
which metric each module carries, how many countries, and the year span.

Run: python3 build_manifest.py
"""
import json, glob, os

# label and source per module, keyed by the data filename stem
MODULES = {
    "wealth_timeseries": {"metric": "wealth_gini", "label": "wealth Gini", "topic": "wealth",
        "field": "wealth_gini", "source": "WID"},
    "wealth_top1":      {"metric": "wealth_top1",     "label": "top 1% wealth share",    "topic": "wealth",
        "source": "WID"},
    "wealth_bottom50":  {"metric": "wealth_bottom50", "label": "bottom 50% wealth share", "topic": "wealth",
        "source": "WID"},
    "income_gini":   {"metric": "income_gini",   "label": "income Gini",     "topic": "income",
        "source": "World Bank PIP via OWID"},
    "median_income": {"metric": "median_income", "label": "median income",   "topic": "income",
        "source": "World Bank PIP via OWID"},
    "gdp_pc":        {"metric": "gdp_pc",        "label": "GDP per person",   "topic": "income",
        "source": "OWID / Global Carbon Budget"},
    "life_expectancy": {"metric": "life_exp",    "label": "life expectancy",  "topic": "wellbeing",
        "source": "UN WPP, Clio Infra, Riley via OWID"},
    "co2_per_capita":  {"metric": "co2_pc",      "label": "CO2 per person",   "topic": "wellbeing",
        "source": "Global Carbon Budget via OWID"},
    "poverty_rate":  {"metric": "poverty_rate",  "label": "poverty rate",     "topic": "wellbeing",
        "source": "World Bank PIP via OWID"},
    "life_satisfaction": {"metric": "life_satisfaction", "label": "life satisfaction", "topic": "wellbeing",
        "source": "World Happiness Report via OWID"},
}

HERE = os.path.dirname(os.path.abspath(__file__))


def span(path, spec):
    """Return (countries, min_year, max_year) for a module file."""
    data = json.load(open(path))
    isos, lo, hi = set(), 10**9, -10**9
    if isinstance(data, list):                       # wealth_timeseries: list of rows
        field = spec.get("field", "value")
        for r in data:
            if r.get(field) is None:
                continue
            isos.add(r["geo_id"]); lo = min(lo, r["year"]); hi = max(hi, r["year"])
    else:                                            # module: {iso: [[year, value], ...]}
        for iso, pts in data.items():
            if not pts:
                continue
            isos.add(iso); lo = min(lo, pts[0][0]); hi = max(hi, pts[-1][0])
    return len(isos), (lo if isos else None), (hi if isos else None)


def main():
    metrics = []
    for stem, spec in MODULES.items():
        path = os.path.join(HERE, "data", stem + ".json")
        if not os.path.exists(path):
            continue                                 # module not built yet; skip
        n, lo, hi = span(path, spec)
        metrics.append({
            "id": spec["metric"], "label": spec["label"], "topic": spec["topic"],
            "file": f"data/{stem}.json", "countries": n,
            "year_min": lo, "year_max": hi, "source": spec["source"],
        })
    metrics.sort(key=lambda m: (m["topic"], m["label"]))
    manifest = {"version": "0.4.0", "metrics": metrics}
    out = os.path.join(HERE, "manifest.json")
    json.dump(manifest, open(out, "w"), indent=2)
    print(f"Wrote {out} with {len(metrics)} metrics")
    for m in metrics:
        print(f"  {m['id']:16} {m['countries']:>3} countries  {m['year_min']}-{m['year_max']}")


if __name__ == "__main__":
    main()
