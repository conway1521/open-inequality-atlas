#!/usr/bin/env python3
"""Build the commuting-zone module from the Opportunity Insights / Chetty files.

Reads the raw CZ CSVs in data/ and writes data/us_cz.json, keyed by commuting
zone (the 1990 Tolbert-Sizer definitions, ~741 zones). Each zone carries:

  name        commuting-zone name
  mob         upward mobility: kid's income rank at parent p25 (kfr_pooled_p25)
  inc         median household income, 2016
  pov         poverty share, 2010
  rent        two-bed rent, 2015
  coll        college-plus share, 2010
  sp          single-parent share, 2010
  cr25, cr75  kid credit score at parent p25 / p75 (pooled race)
  mort25,75   kid mortgage balance at parent p25 / p75
  delq25,75   kid 90-day delinquency rate at parent p25 / p75

The p25/p75 pairs are the point: hold the place fixed and read how financial
life differs for kids who started poor versus rich in the same zone.

Run: python3 build_cz.py
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def load_long(fname, valcol):
    """A file keyed by (cz, race, parent percentile). Keep the pooled race,
    return {cz: {25: v, 50: v, 75: v}}."""
    out = {}
    with open(os.path.join(DATA, fname)) as f:
        for r in csv.DictReader(f):
            if r.get("kid_race") != "Pooled":
                continue
            cz, pct, v = r["par_cz"], r["par_pctile"], num(r.get(valcol))
            if v is None or pct not in ("25", "50", "75"):
                continue
            out.setdefault(cz, {})[int(pct)] = v
    return out


def main():
    zones = {}

    # outcomes: mobility
    with open(os.path.join(DATA, "cz_outcomes_simple.csv")) as f:
        for r in csv.DictReader(f):
            cz = r["cz"]
            zones[cz] = {"name": r["czname"].strip(), "mob": num(r.get("kfr_pooled_pooled_p25"))}

    # covariates: the context
    with open(os.path.join(DATA, "cz_covariates.csv")) as f:
        for r in csv.DictReader(f):
            z = zones.setdefault(r["cz"], {"name": r["czname"].strip()})
            z["inc"] = num(r.get("med_hhinc2016"))
            z["pov"] = num(r.get("poor_share2010"))
            z["rent"] = num(r.get("rent_twobed2015"))
            z["coll"] = num(r.get("frac_coll_plus2010"))
            z["sp"] = num(r.get("singleparent_share2010"))

    # financial life, by parent percentile
    fin = {
        ("cr", "avg_credit_score_2020_cz.csv", "shrunk_xkid_vscore2020"),
        ("mort", "avg_mortgage_balance_2020_cz.csv", "shrunk_xkid_mtabalance2020"),
        ("delq", "avg_delinq_rate_2020_cz.csv", "shrunk_xkid_delinq90_02020"),
    }
    for key, fname, valcol in fin:
        table = load_long(fname, valcol)
        for cz, byp in table.items():
            z = zones.get(cz)
            if not z:
                continue
            if 25 in byp:
                z[key + "25"] = round(byp[25], 2)
            if 75 in byp:
                z[key + "75"] = round(byp[75], 2)

    # drop zones with no mobility (the spine of this layer) and tidy numbers
    clean = {}
    for cz, z in zones.items():
        if z.get("mob") is None:
            continue
        for k in ("mob", "pov", "rent", "coll", "sp"):
            if z.get(k) is not None:
                z[k] = round(z[k], 4)
        if z.get("inc") is not None:
            z["inc"] = round(z["inc"])
        clean[cz] = z

    out = os.path.join(DATA, "us_cz.json")
    json.dump(clean, open(out, "w"), separators=(",", ":"))
    withfin = sum(1 for z in clean.values() if "cr25" in z and "cr75" in z)
    print(f"Wrote {out}: {len(clean)} commuting zones, {withfin} with the p25/p75 credit gap")
    # a couple of sanity lines
    top = sorted(clean.values(), key=lambda z: z.get("mob", 0), reverse=True)[:3]
    bot = sorted(clean.values(), key=lambda z: z.get("mob", 1))[:3]
    print("  most mobile:", ", ".join(f"{z['name']} {z['mob']:.2f}" for z in top))
    print("  least mobile:", ", ".join(f"{z['name']} {z['mob']:.2f}" for z in bot))


if __name__ == "__main__":
    main()
