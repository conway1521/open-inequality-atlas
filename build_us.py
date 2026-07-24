#!/usr/bin/env python3
"""Process the US county datasets (Opportunity Insights + Social Capital Atlas)
into the atlas module shape, keyed on county FIPS.

Filename-agnostic: it does not care what the files are called. It reads each
CSV's header and decides what the file is from the columns present, so you can
drop in whatever you downloaded. Streams row by row, so a large outcomes file
is fine.

Where to put the files: attach them in the chat (they land under
/root/.claude/uploads/<session>/) or drop them in ./data/raw_us/. This script
scans both.

Outputs (only these get committed; the raw CSVs stay out of the repo):
  data/us_county.json   { metric_id: { "01001": value, ... } }
  data/us_state.json    { metric_id: { "01": value, ... } }  (population-weighted)
  data/us_names.json    { "01001": "Autauga County, AL", "01": "Alabama", ... }
  data/us_manifest.json  what was found, coverage per metric

Run: python3 build_us.py
"""
import csv, json, glob, gzip, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def open_csv(path):
    """Open a .csv or .csv.gz transparently. Gzip lets county files clear GitHub's 100 MB limit."""
    if path.endswith(".gz"):
        return gzip.open(path, mode="rt", encoding="utf-8", errors="replace", newline="")
    return open(path, newline="", encoding="utf-8", errors="replace")
SCAN_DIRS = [
    "/root/.claude/uploads",
    os.path.join(HERE, "data", "raw_us"),
    HERE,
]

STATE_FIPS = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California",
    "08": "Colorado", "09": "Connecticut", "10": "Delaware", "11": "District of Columbia",
    "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho", "17": "Illinois",
    "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana",
    "23": "Maine", "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska", "32": "Nevada",
    "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York",
    "37": "North Carolina", "38": "North Dakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon",
    "42": "Pennsylvania", "44": "Rhode Island", "45": "South Carolina", "46": "South Dakota",
    "47": "Tennessee", "48": "Texas", "49": "Utah", "50": "Vermont", "51": "Virginia",
    "53": "Washington", "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
    "72": "Puerto Rico",
}
STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
    "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
    "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
    "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY", "72": "PR",
}

# metric id -> (accepted column names, lowercased; first match wins), rounding, higher_is_worse
# The atlas reads these ids; add rows here as new columns appear in the report's "unmatched" list.
METRICS = {
    "us_mobility":       (["kfr_pooled_pooled_p25"], 3, False),
    "us_econ_conn":      (["ec_county", "economic_connectedness", "ec"], 3, False),
    "us_cohesion":       (["clustering_county", "clustering"], 3, False),
    "us_volunteering":   (["volunteering_rate_county", "volunteering_rate"], 3, False),
    "us_homeownership":  (["home_ownership", "homeownership", "hous_own_share"], 3, False),
    "us_house_value":    (["median_house_value", "medianhousevalue", "median_house_value2010"], 0, False),
    "us_income_gini":    (["gini", "gini99", "income_gini"], 3, True),
    "us_median_income":  (["median_hhinc", "hhinc_mean2000", "median_household_income", "med_hhinc2016"], 0, False),
    "us_poverty":        (["poor_share2010", "poverty_rate", "poor_share2000", "poor_share1990"], 3, True),
    "us_single_parent":  (["singleparent_share2010", "single_mom_share2010", "singleparent_share2000"], 3, True),
    "us_college":        (["frac_coll_plus2010", "frac_coll_plus2000", "share_college"], 3, False),
    "us_life_exp":       (["le_agg", "life_expectancy", "le_raceadj"], 1, False),
    "us_le_gap":         ([], 1, True),   # derived: top-quartile minus bottom-quartile life expectancy
    "us_incarceration":  (["jail2010", "incarceration_rate", "incar"], 4, True),
    "us_teen_birth":     (["teenbrth", "teen_birth", "teenbirth_rate"], 3, True),
    "us_subprime":       (["subprime", "subprime_share", "share_subprime"], 3, True),
    "us_debt_collections": (["debt_in_collections", "collections_share", "debt_collections"], 3, True),
    # credit files (long by kid_race x par_pctile; we keep the pooled rows)
    "us_credit_score":   (["shrunk_xkid_vscore2020", "vscore2020"], 0, False),
    "us_debt_card":      (["shrunk_xkid_brcbalance2020", "brcbalance2020"], 0, True),
    "us_debt_mortgage":  (["shrunk_xkid_mtabalance2020", "mtabalance2020"], 0, False),
    "us_debt_auto":      (["shrunk_xkid_auabalance2020", "auabalance2020"], 0, True),
    "us_debt_student":   (["shrunk_xkid_stubalance2020", "stubalance2020"], 0, True),
    "us_delinquency":    (["shrunk_xkid_delinq90_02020", "delinq90_02020"], 3, True),
}
POOLED = {"pooled", "all", "", "p", "tot", "total", "na"}   # aggregate labels in long-format files
POP_COLS = ["pop2018", "population", "county_pop2018", "cty_pop2018", "pop", "count_pop2018", "cty_pop2000"]
# a full 5-digit county FIPS in one column
FULL_FIPS_COLS = ["fips", "countyfips", "county_fips", "cty_fips", "geoid", "geo_id", "fips5",
                  "fips_code", "fipscode", "cty", "cnty_fips", "countyfp5"]
# a 2-digit state code + a 3-digit within-state county code (e.g. Opportunity Insights county_outcomes)
STATE_COLS = ["state", "statefp", "statefips", "st_fips", "statefips2010", "statecode", "par_state"]
COUNTY_COLS = ["county", "countyfp", "county_code", "cofips", "countycode", "par_county"]
NAME_COLS = ["county_name", "countyname", "cty_name", "czname", "name"]


def norm_header(cols):
    return {c.strip().lower(): c for c in cols}


def find_col(hdr, options):
    for o in options:
        if isinstance(o, str) and o in hdr:
            return hdr[o]
    return None


def digits(v):
    return str(v).strip().replace('"', "").split(".")[0]


def fips5(v):
    v = digits(v)
    if not v.isdigit():
        return None
    return v.zfill(5)[:5] if len(v) <= 5 else None


def resolve_fips(rec, cmap):
    """Return a 5-digit county FIPS from a row, trying a full column first, then state+county."""
    full = cmap.get("full")
    if full:
        f = fips5(rec.get(full, ""))
        if f and f[:2] in STATE_FIPS:
            return f
    st, cty = cmap.get("state"), cmap.get("county")
    if st and cty:                                   # 2-digit state + 3-digit county (OI county_outcomes)
        s, c = digits(rec.get(st, "")), digits(rec.get(cty, ""))
        if s.isdigit() and c.isdigit() and len(s) <= 2 and len(c) <= 3:
            f = s.zfill(2) + c.zfill(3)
            if f[:2] in STATE_FIPS:
                return f
    if cty:                                          # a lone county column that already holds a full 5-digit FIPS
        f = fips5(rec.get(cty, ""))
        if f and f[:2] in STATE_FIPS and len(digits(rec.get(cty, ""))) >= 4:
            return f
    return None


def scan_csvs():
    seen, files = set(), []
    for d in SCAN_DIRS:
        for p in glob.glob(os.path.join(d, "**", "*.csv"), recursive=True) + glob.glob(os.path.join(d, "**", "*.csv.gz"), recursive=True):
            rp = os.path.realpath(p)
            # skip our own outputs and the wealth data dir
            if "/data/" in p and "raw_us" not in p:
                continue
            if rp not in seen and os.path.getsize(p) > 0:
                seen.add(rp)
                files.append(p)
    return files


def main():
    files = scan_csvs()
    if not files:
        print("No CSVs found. Attach the county files in the chat (they land under")
        print("/root/.claude/uploads/) or put them in ./data/raw_us/, then re-run.")
        print("\nWhat to grab from opportunityinsights.org/data (County level):")
        print("  - the outcomes file whose header has a 'kfr_pooled_pooled_p25' column (upward mobility)")
        print("  - the county covariates file (homeownership, median house value, gini, poverty, ...)")
        print("  - social_capital_county.csv from the Social Capital Atlas (ec_county)")
        return 1

    county = {k: {} for k in METRICS}      # metric -> fips -> value
    pop = {}                               # fips -> population
    names = {}                             # fips -> "County, ST"
    report = []

    for path in files:
        try:
            fh = open_csv(path)
            rdr = csv.reader(fh)
            header = next(rdr)
        except Exception as e:
            print(f"  skip {os.path.basename(path)}: {e}")
            continue
        hdr = norm_header(header)
        cmap = {"full": find_col(hdr, FULL_FIPS_COLS),
                "state": find_col(hdr, STATE_COLS),
                "county": find_col(hdr, COUNTY_COLS)}
        present = {mid: find_col(hdr, opts) for mid, (opts, _, _) in METRICS.items()}
        present = {mid: col for mid, col in present.items() if col}
        # life expectancy tables give it by income quartile and gender; derive a level and a rich-poor gap
        le_lvl = [hdr[c] for c in hdr if c.startswith("le_raceadj_q") and c[-2:] in ("_f", "_m")]
        if not le_lvl:
            le_lvl = [hdr[c] for c in hdr if c.startswith("le_agg_q") and c[-2:] in ("_f", "_m")]
        le_bot = [c for c in le_lvl if "_q1_" in c.lower()]
        le_top = [c for c in le_lvl if "_q4_" in c.lower()]
        has_geo = cmap["full"] or cmap["county"]
        if not has_geo or not (present or le_lvl):
            why = "no FIPS column" if not has_geo else "no known metric columns"
            report.append((os.path.basename(path), why + f" — header: {', '.join(header[:16])}", 0, []))
            fh.close()
            continue
        # long-format files (credit) carry a row per race x parent-percentile; keep only the pooled rows
        race_col, pct_col = find_col(hdr, ["kid_race"]), find_col(hdr, ["par_pctile", "kid_pctile"])
        pop_col = find_col(hdr, POP_COLS)
        name_col = find_col(hdr, NAME_COLS)
        rows = 0

        def num(x):
            try:
                return float(x)
            except (ValueError, TypeError):
                return None

        for row in rdr:                       # header already consumed; rdr yields data rows as lists
            if not row or len(row) < len(header):
                continue
            rec = dict(zip(header, row))
            if race_col and str(rec.get(race_col, "")).strip().lower() not in POOLED:
                continue
            if pct_col and str(rec.get(pct_col, "")).strip().lower() not in POOLED:
                continue
            fips = resolve_fips(rec, cmap)
            if not fips:
                continue
            rows += 1
            for mid, col in present.items():
                v = rec.get(col, "")
                if v not in ("", "NA", "NaN", None):
                    try:
                        county[mid][fips] = float(v)
                    except ValueError:
                        pass
            if le_lvl:
                lvl = [num(rec.get(c)) for c in le_lvl]
                lvl = [x for x in lvl if x is not None]
                if lvl:
                    county["us_life_exp"][fips] = sum(lvl) / len(lvl)
                bot = [num(rec.get(c)) for c in le_bot if num(rec.get(c)) is not None]
                top = [num(rec.get(c)) for c in le_top if num(rec.get(c)) is not None]
                if bot and top:
                    county.setdefault("us_le_gap", {})[fips] = sum(top) / len(top) - sum(bot) / len(bot)
            if pop_col:
                try:
                    pop[fips] = float(rec.get(pop_col, "") or 0) or pop.get(fips, 0)
                except ValueError:
                    pass
            if name_col and fips not in names:
                nm = rec.get(name_col, "").strip()
                if nm and not nm.isdigit():
                    base = nm.split(",")[0].strip()   # drop any state suffix already in the name
                    st = STATE_ABBR.get(fips[:2], "")
                    names[fips] = f"{base}, {st}" if st else base
        fh.close()
        matched = sorted(present.keys()) + (["us_life_exp", "us_le_gap"] if le_lvl else [])
        report.append((os.path.basename(path), "ok", rows, matched))

    # drop metrics with no data
    county = {k: v for k, v in county.items() if v}

    # state aggregation: population-weighted mean where population exists, else simple mean
    state = {k: {} for k in county}
    for mid, vals in county.items():
        acc = {}  # st -> [wsum, w]
        for fips, v in vals.items():
            st = fips[:2]
            w = pop.get(fips, 1.0) or 1.0
            a = acc.setdefault(st, [0.0, 0.0])
            a[0] += v * w
            a[1] += w
        ndp = METRICS[mid][1]
        state[mid] = {st: round(a[0] / a[1], ndp) for st, a in acc.items() if a[1] > 0}

    # round county values
    for mid in county:
        ndp = METRICS[mid][1]
        county[mid] = {f: round(v, ndp) for f, v in county[mid].items()}

    # names: fill any missing county with a generic label, add state names
    all_fips = {f for vals in county.values() for f in vals}
    for f in all_fips:
        names.setdefault(f, f"{f} ({STATE_ABBR.get(f[:2], '')})")
    for st, nm in STATE_FIPS.items():
        names[st] = nm

    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    json.dump(county, open(os.path.join(HERE, "data/us_county.json"), "w"), separators=(",", ":"))
    json.dump(state, open(os.path.join(HERE, "data/us_state.json"), "w"), separators=(",", ":"))
    json.dump(names, open(os.path.join(HERE, "data/us_names.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    manifest = {
        "level": "us_county",
        "metrics": [
            {"id": mid, "counties": len(county[mid]), "states": len(state[mid]),
             "higher_is_worse": METRICS[mid][2]}
            for mid in sorted(county)
        ],
        "counties_total": len(all_fips),
    }
    json.dump(manifest, open(os.path.join(HERE, "data/us_manifest.json"), "w"), indent=2)

    print("Files read:")
    for name, status, rows, matched in report:
        print(f"  {name}: {status}, {rows} county rows, matched {matched or '(none)'}")
    print(f"\nCounties covered: {len(all_fips)}")
    print("Metrics built:")
    for mid in sorted(county):
        print(f"  {mid:22} {len(county[mid]):>4} counties  {len(state[mid]):>2} states")
    if not county:
        print("\nNo known metric columns matched. Paste a file header and I'll add the aliases.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
