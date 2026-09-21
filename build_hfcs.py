#!/usr/bin/env python3
"""How many households own less than nothing, and who could take a hit.

The atlas already reports that in five countries the poorest half owns less than
nothing. That is a share of a national total: add up what half the country holds and
the sum comes out negative. It says nothing about how many people are in that
position, and a share can be dragged under by a small number of households deeply in
debt. This is the headcount beside it.

Reads the four HFCS statistical-table workbooks in data/raw/hfcs/ and writes two files:

  data/hfcs_negative.json     table F3, households whose debts exceed what they hold
  data/hfcs_resilience.json   tables G2, G3 and H1, whether a household could absorb
                              a shock: money left over at the end of the month, help
                              available in an emergency, and credit refused

Resilience was going to come from Eurostat SILC, whose "cannot face an unexpected
expense" is the cleanest version of the question. Eurostat is not reachable from where
this is built. HFCS turns out to be the better source anyway: it is the same survey,
the same waves and the same countries as the headcount above, so the two sit together
without a new comparability seam between them.

It is a different measure from the wealth shares and must never be drawn on the same
axis as them:

  the shares      WID, per adult, an aggregate share of a national total, 213
                  countries, annual, mostly imputed
  this            ECB HFCS, per household, a count of households below zero, euro area
                  plus a few neighbours, four survey waves, measured

Table F3 of each wave, which carries the total and four breakdowns. Three are kept:

  all             every household
  housing         outright owners, owners with a mortgage, renters and others
  age             the age of the reference person, in six bands

The income breakdown is dropped. It is a headcount of negative net *wealth* cut by
*income*, and the atlas's whole argument is that those two are different things, so
the cut invites exactly the conflation the rest of the page works to prevent.

Three things about the source that the app has to repeat rather than hide:

  N and M         too few observations, and missing. Stored as null, never as zero.
  "< 0.1"         the source's way of saying below a tenth of a per cent. Stored at
                  0.1, its stated ceiling, so a reading built on it can never claim
                  the number is smaller than the source will support.
  the wave year   waves are named 2010, 2014, 2017 and 2021 and the fieldwork behind
                  each ran in different years in different countries. The year here
                  is the wave's name, not a reference date, and the app says so.

The country set changes between waves, so the euro-area aggregate is not the same
aggregate across waves either. The app says that too.

Usage: pip install openpyxl && python3 build_hfcs.py
"""
import json
import os
import re

try:
    import openpyxl
except ImportError:
    raise SystemExit('needs openpyxl: pip install openpyxl')

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RAW = os.path.join(DATA, 'raw', 'hfcs')

# table G3's cut by net wealth is the one this atlas thinks in, so it is kept in full
SAVE_ROWS = {
    'ALL': 'all',
    'Owners - outright': 'own_outright',
    'Owners - with mortgage': 'own_mortgage',
    'Renters / other': 'renting',
    '16-34': 'age_16_34', '35-44': 'age_35_44', '45-54': 'age_45_54',
    '55-64': 'age_55_64', '65-74': 'age_65_74', '75+': 'age_75_plus',
}
# G3 repeats "Bottom 20%" under both Income and Net wealth; only the wealth cut is taken,
# and it is taken by position because the two carry the same label
WEALTH_CUT = ['w_bottom20', 'w_20_40', 'w_40_60', 'w_60_80', 'w_80_90', 'w_90_100']
# the country-level indicators, matched on the code at the start of the row label
FLAT = {
    'DOFINASSIST': 'help',        # could raise money from friends or relatives in an emergency
    'DOCREDITREFUSED': 'refused', # refused credit, or given less than asked, among applicants
    'DOCREDITC': 'constrained',   # credit constrained, on the survey's own definition
}

# the rows of table F3 worth keeping, by the label in its second column
ROWS = {
    'ALL': 'all',
    'Owners - outright': 'own_outright',
    'Owners - with mortgage': 'own_mortgage',
    'Renters / other': 'renting',
    '16-34': 'age_16_34',
    '35-44': 'age_35_44',
    '45-54': 'age_45_54',
    '55-64': 'age_55_64',
    '65-74': 'age_65_74',
    '75+': 'age_75_plus',
}
# HFCS reports two-letter codes; the atlas keys on ISO3
ISO3 = {
    'BE': 'BEL', 'CZ': 'CZE', 'DE': 'DEU', 'EE': 'EST', 'IE': 'IRL', 'GR': 'GRC',
    'ES': 'ESP', 'FR': 'FRA', 'HR': 'HRV', 'IT': 'ITA', 'CY': 'CYP', 'LV': 'LVA',
    'LT': 'LTU', 'LU': 'LUX', 'HU': 'HUN', 'MT': 'MLT', 'NL': 'NLD', 'AT': 'AUT',
    'PL': 'POL', 'PT': 'PRT', 'SI': 'SVN', 'SK': 'SVK', 'FI': 'FIN',
}


def value(cell):
    """A percentage, or None where the source says it cannot give one."""
    if cell is None:
        return None
    if isinstance(cell, (int, float)):
        return round(float(cell), 2)
    t = str(cell).strip()
    if t in ('N', 'M', ''):
        return None
    if t.startswith('<'):
        m = re.search(r'([\d.]+)', t)
        return round(float(m.group(1)), 2) if m else None   # the stated ceiling
    try:
        return round(float(t), 2)
    except ValueError:
        return None


def sheet_rows(wb, prefix):
    names = [s for s in wb.sheetnames if s.startswith(prefix)]
    if not names:
        return None
    return list(wb[names[0]].iter_rows(max_row=70, max_col=40, values_only=True))


def header_cols(rows):
    """Column index -> area code, from whichever row carries 'euro area'."""
    for r in rows[:8]:
        found = {}
        for i, c in enumerate(r):
            if not c:
                continue
            name = str(c).replace('\n', ' ').strip()
            if name.lower() == 'euro area':
                found[i] = 'EA'
            elif name in ISO3:
                found[i] = ISO3[name]
        if len(found) > 3:
            return found
    return {}


def read_negative(wb):
    rows = sheet_rows(wb, 'F3')
    if not rows:
        return None
    cols = header_cols(rows)
    out = {}
    for r in rows:
        key = ROWS.get(str(r[1]).strip() if r[1] else '')
        if not key:
            continue
        for i, iso in cols.items():
            v = value(r[i])
            if v is not None:
                out.setdefault(iso, {})[key] = v
    return out


def read_resilience(wb):
    """G3's breakdowns of money left over, plus the flat indicators in G2 and H1."""
    out = {}
    rows = sheet_rows(wb, 'G3')
    if rows:
        cols = header_cols(rows)
        # the wealth quintiles are the second block labelled Bottom 20% .. 90-100%, so
        # the section header in column A is tracked rather than trusting the labels
        section, seen = None, 0
        for r in rows:
            a = str(r[0]).strip() if r[0] else ''
            b = str(r[1]).strip() if r[1] else ''
            if a and len(a) < 40 and not a.startswith('Table'):
                section = a
                seen = 0
            key = None
            if section == 'Net wealth' and b:
                if seen < len(WEALTH_CUT):
                    key = WEALTH_CUT[seen]
                    seen += 1
            elif section != 'Income':
                key = SAVE_ROWS.get(b)
            if not key:
                continue
            for i, iso in cols.items():
                v = value(r[i])
                if v is not None:
                    out.setdefault(iso, {}).setdefault('save', {})[key] = v
    for prefix in ('G2', 'H1'):
        rows = sheet_rows(wb, prefix)
        if not rows:
            continue
        cols = header_cols(rows)
        for r in rows:
            a = str(r[0]).strip() if r[0] else ''
            code = a.split()[0] if a else ''
            key = FLAT.get(code)
            if not key:
                continue
            for i, iso in cols.items():
                v = value(r[i])
                if v is not None:
                    out.setdefault(iso, {})[key] = v
    return out


def series(waves, years, iso, pick):
    got = [pick(waves[y].get(iso, {})) for y in years]
    return got if any(v is not None for v in got) else None


def main():
    if not os.path.isdir(RAW):
        raise SystemExit('missing %s\n%s' % (RAW, __doc__))
    neg, res = {}, {}
    for fn in sorted(os.listdir(RAW)):
        if not fn.endswith('.xlsx'):
            continue
        m = re.search(r'(20\d{2})', fn)
        if not m:
            continue
        wb = openpyxl.load_workbook(os.path.join(RAW, fn), read_only=True, data_only=True)
        year = int(m.group(1))
        a = read_negative(wb)
        if a:
            neg[year] = a
        b = read_resilience(wb)
        if b:
            res[year] = b
        wb.close()

    NOTE = ('Waves are named by year and the fieldwork behind each ran in different years in '
            'different countries, so a wave is a label rather than a reference date. The set of '
            'countries changes between waves, which moves the euro-area aggregate too. Cells the '
            'survey reports as too few observations are absent here, never zero.')

    years = sorted(neg)
    out = {
        'unit': 'per cent of households whose debts exceed their assets',
        'source': 'ECB Household Finance and Consumption Survey, statistical table F3.',
        'note': NOTE, 'waves': years, 'cuts': list(dict.fromkeys(ROWS.values())), 'by': {},
    }
    for iso in sorted({i for w in neg.values() for i in w}):
        block = {}
        for cut in out['cuts']:
            got = series(neg, years, iso, lambda d, c=cut: d.get(c))
            if got:
                block[cut] = got
        if block:
            out['by'][iso] = block
    p1 = os.path.join(DATA, 'hfcs_negative.json')
    json.dump(out, open(p1, 'w', encoding='utf-8'), separators=(',', ':'), sort_keys=True)

    ryears = sorted(res)
    SAVE_CUTS = list(dict.fromkeys(list(SAVE_ROWS.values()) + WEALTH_CUT))
    rout = {
        'unit': 'per cent of households',
        'source': 'ECB Household Finance and Consumption Survey, statistical tables G2, G3 and H1.',
        'note': NOTE, 'waves': ryears, 'cuts': SAVE_CUTS, 'by': {},
    }
    for iso in sorted({i for w in res.values() for i in w}):
        block = {}
        saves = {}
        for cut in SAVE_CUTS:
            got = series(res, ryears, iso, lambda d, c=cut: (d.get('save') or {}).get(c))
            if got:
                saves[cut] = got
        if saves:
            block['save'] = saves
        for k in FLAT.values():
            got = series(res, ryears, iso, lambda d, c=k: d.get(c))
            if got:
                block[k] = got
        if block:
            rout['by'][iso] = block
    p2 = os.path.join(DATA, 'hfcs_resilience.json')
    json.dump(rout, open(p2, 'w', encoding='utf-8'), separators=(',', ':'), sort_keys=True)

    print('waves            %s' % ', '.join(str(y) for y in years))
    print('below zero       %d areas -> %s (%d KB)'
          % (len(out['by']), os.path.relpath(p1, HERE), os.path.getsize(p1) // 1024))
    print('resilience       %d areas -> %s (%d KB)'
          % (len(rout['by']), os.path.relpath(p2, HERE), os.path.getsize(p2) // 1024))

    ea = rout['by'].get('EA', {})
    last = len(ryears) - 1
    print('\neuro area, wave %d:' % ryears[last])
    sv = ea.get('save', {})
    for cut in ['all', 'w_bottom20', 'w_90_100', 'renting', 'own_outright', 'age_16_34']:
        v = sv.get(cut, [None] * len(ryears))[last]
        if v is not None:
            print('   %-13s %5.1f%% have money left over, so %5.1f%% do not' % (cut, v, 100 - v))
    for k, lab in (('help', 'could raise help in an emergency'),
                   ('refused', 'refused credit or given less'),
                   ('constrained', 'credit constrained')):
        v = ea.get(k, [None] * len(ryears))[last]
        if v is not None:
            print('   %-13s %5.1f%%  (%s)' % (k, v, lab))


if __name__ == '__main__':
    main()
