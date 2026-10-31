#!/usr/bin/env python3
"""Build app/liberia-aid-viewer/data/indicators.js (window.LBR_IND) from the downloads in indicators-raw/.

indicators-raw/ is filled on a computer with ordinary internet access by fetch_indicators.ps1 (the cloud workspace's
proxy blocks these hosts). Files read, each optional (a missing file just drops its indicators):
  wb_<CODE>.json, wbmeta_<CODE>.json   World Bank API: Liberia (LBR), Sub-Saharan Africa (SSF), low income (LIC)
  imf_<CODE>.json                      IMF DataMapper, Liberia, with forecasts
  hdr_composite.csv                    UNDP Human Development Report composite indices, time series
  who_<CODE>.json                      WHO Global Health Observatory
  dhs_subnational.json, dhs_national.json   DHS Program API, Liberia DHS 2019-20, by county
Output: themes with indicator series (Liberia, comparison groups, latest values) and DHS county measures in the
same shape as the census map's county measures (data/maps.js 'cm'), which mapview.js adds to the Census map.
"""
import csv
import datetime as dt
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.environ.get('LBR_IND_RAW') or os.path.join(HERE, '..', 'indicators-raw')
OUT = os.environ.get('LBR_IND_OUT') or os.path.join(HERE, '..', 'app', 'liberia-aid-viewer', 'data', 'indicators.js')
MAPS = os.environ.get('LBR_MAPS') or os.path.join(HERE, '..', 'app', 'liberia-aid-viewer', 'data', 'maps.js')
FIRST = 2000

THEMES = ['Economy', 'Poverty and inequality', 'Population', 'Health', 'Nutrition and food', 'Education',
          'Water, energy and digital', 'Gender', 'Governance', 'Environment']

# (theme, source key, label, format, better, note). Format: p = %, n = number, d = decimal, u = US$, s = score.
# better: 'up' or 'down' (which direction is an improvement), '' if neither. Source key: wb:CODE, imf:CODE,
# hdr:column-prefix, who:CODE. Where two keys are given with '|', the first one that has data is used.
CATALOGUE = [
    ('Economy', 'imf:NGDP_RPCH|wb:NY.GDP.MKTP.KD.ZG', 'GDP growth', 'p', '', 'Real GDP, % change on the year before.'),
    ('Economy', 'wb:NY.GDP.PCAP.PP.CD', 'GDP per person (PPP)', 'u', 'up', 'Current international dollars, adjusted for prices.'),
    ('Economy', 'wb:NY.GDP.PCAP.CD', 'GDP per person', 'u', 'up', 'Current US dollars.'),
    ('Economy', 'imf:PCPIPCH|wb:FP.CPI.TOTL.ZG', 'Inflation', 'p', 'down', 'Consumer prices, average % change.'),
    ('Economy', 'imf:GGR_G01_GDP_PT|wb:GC.REV.XGRT.GD.ZS', 'Government revenue', 'p', '', '% of GDP (IMF: including grants).'),
    ('Economy', 'imf:GGXCNL_NGDP', 'Government budget balance', 'p', '', '% of GDP; negative is a deficit.'),
    ('Economy', 'imf:GGXWDG_NGDP', 'Government debt', 'p', 'down', 'Gross debt, % of GDP.'),
    ('Economy', 'wb:DT.DOD.DECT.GN.ZS', 'External debt', 'p', 'down', 'External debt stocks, % of GNI.'),
    ('Economy', 'wb:DT.ODA.ODAT.GN.ZS', 'Aid received', 'p', '', 'Net ODA received, % of GNI.'),
    ('Economy', 'wb:BX.TRF.PWKR.DT.GD.ZS', 'Remittances received', 'p', '', 'Personal remittances, % of GDP.'),
    ('Economy', 'wb:BX.KLT.DINV.WD.GD.ZS', 'Foreign direct investment', 'p', '', 'Net inflows, % of GDP.'),
    ('Economy', 'wb:NY.GDP.TOTL.RT.ZS', 'Natural resource rents', 'p', '', '% of GDP (minerals, forests, oil and gas).'),
    ('Economy', 'wb:NE.EXP.GNFS.ZS', 'Exports', 'p', '', 'Goods and services, % of GDP.'),
    ('Economy', 'wb:NV.AGR.TOTL.ZS', 'Agriculture, forestry and fishing', 'p', '', 'Value added, % of GDP.'),
    ('Economy', 'wb:SL.UEM.TOTL.ZS', 'Unemployment', 'p', 'down', '% of the labour force (ILO modelled estimate).'),
    ('Economy', 'wb:SL.EMP.VULN.ZS', 'Vulnerable employment', 'p', 'down', 'Own-account and family workers, % of employment (ILO modelled estimate).'),
    ('Poverty and inequality', 'wb:SI.POV.DDAY', 'Extreme poverty', 'p', 'down', '% of people living on less than US$3.00 a day (2021 prices).'),
    ('Poverty and inequality', 'wb:SI.POV.NAHC', 'Poverty, national line', 'p', 'down', '% of people below Liberia’s national poverty line.'),
    ('Poverty and inequality', 'wb:SI.POV.GINI', 'Income inequality (Gini)', 'd', 'down', '0 = everyone equal, 100 = one person has everything.'),
    ('Poverty and inequality', 'hdr:hdi', 'Human Development Index', 'r', 'up', 'UNDP: health, education and income combined, 0 to 1.'),
    ('Population', 'wb:SP.POP.TOTL', 'Population', 'n', '', ''),
    ('Population', 'wb:SP.POP.GROW', 'Population growth', 'p', '', '% a year.'),
    ('Population', 'wb:SP.DYN.TFRT.IN', 'Fertility rate', 'd', '', 'Births per woman.'),
    ('Population', 'wb:SP.URB.TOTL.IN.ZS', 'Urban population', 'p', '', '% of people living in towns and cities.'),
    ('Population', 'wb:SP.POP.0014.TO.ZS', 'Children under 15', 'p', '', '% of the population.'),
    ('Population', 'wb:SP.DYN.LE00.IN', 'Life expectancy at birth', 'd', 'up', 'Years.'),
    ('Health', 'wb:SH.DYN.MORT', 'Under-5 mortality', 'd', 'down', 'Deaths before age 5 per 1,000 live births (UN IGME).'),
    ('Health', 'wb:SP.DYN.IMRT.IN', 'Infant mortality', 'd', 'down', 'Deaths before age 1 per 1,000 live births (UN IGME).'),
    ('Health', 'wb:SH.DYN.NMRT', 'Newborn mortality', 'd', 'down', 'Deaths in the first 28 days per 1,000 live births (UN IGME).'),
    ('Health', 'wb:SH.STA.MMRT', 'Maternal mortality', 'n', 'down', 'Deaths per 100,000 live births (UN MMEIG modelled estimate).'),
    ('Health', 'wb:SH.STA.BRTC.ZS', 'Births with a skilled attendant', 'p', 'up', '% of births (surveys and health records).'),
    ('Health', 'wb:SH.IMM.IDPT', 'DTP3 vaccination', 'p', 'up', '% of children aged 12–23 months (WHO/UNICEF estimate).'),
    ('Health', 'wb:SH.IMM.MEAS', 'Measles vaccination', 'p', 'up', '% of children aged 12–23 months (WHO/UNICEF estimate).'),
    ('Health', 'wb:SH.MLR.INCD.P3', 'Malaria cases', 'd', 'down', 'New cases per 1,000 people at risk (WHO estimate).'),
    ('Health', 'wb:SH.DYN.AIDS.ZS', 'HIV prevalence', 'p', 'down', '% of people aged 15–49 (UNAIDS estimate).'),
    ('Health', 'wb:SH.TBS.INCD', 'Tuberculosis cases', 'n', 'down', 'New cases per 100,000 people (WHO estimate).'),
    ('Health', 'who:UHC_INDEX_REPORTED', 'Universal health coverage index', 's', 'up', 'WHO service coverage index, 0 to 100.'),
    ('Health', 'wb:SH.XPD.CHEX.PC.CD', 'Health spending per person', 'u', '', 'Current US dollars, all sources.'),
    ('Health', 'wb:SH.XPD.GHED.CH.ZS', 'Government share of health spending', 'p', '', '% of current health spending.'),
    ('Health', 'wb:SH.XPD.EHEX.CH.ZS', 'Donor share of health spending', 'p', '', 'External (aid) funding, % of current health spending.'),
    ('Health', 'wb:SH.MED.PHYS.ZS', 'Doctors', 'd', 'up', 'Per 1,000 people.'),
    ('Health', 'wb:SH.MED.NUMW.P3', 'Nurses and midwives', 'd', 'up', 'Per 1,000 people.'),
    ('Nutrition and food', 'wb:SH.STA.STNT.ZS', 'Stunting', 'p', 'down', '% of children under 5 too short for their age (JME modelled estimate).'),
    ('Nutrition and food', 'wb:SH.STA.WAST.ZS', 'Wasting', 'p', 'down', '% of children under 5 too thin for their height (surveys).'),
    ('Nutrition and food', 'wb:SN.ITK.DEFC.ZS', 'Undernourishment', 'p', 'down', '% of people who don’t get enough food energy (FAO).'),
    ('Nutrition and food', 'wb:SN.ITK.MSFI.ZS', 'Food insecurity', 'p', 'down', '% of people moderately or severely food insecure (FAO).'),
    ('Education', 'wb:SE.PRM.CMPT.ZS', 'Primary completion', 'p', 'up', 'Gross intake to the last grade of primary, % of the age group (UNESCO UIS).'),
    ('Education', 'wb:SE.SEC.CMPT.LO.ZS', 'Lower-secondary completion', 'p', 'up', 'Gross intake to the last grade, % of the age group (UNESCO UIS).'),
    ('Education', 'wb:SE.PRM.UNER.ZS', 'Out-of-school children', 'p', 'down', '% of primary-school-age children (UNESCO UIS).'),
    ('Education', 'wb:SE.PRM.ENRR', 'Primary enrolment', 'p', '', 'Gross, % of the age group; over 100 means many older pupils.'),
    ('Education', 'wb:SE.SEC.ENRR', 'Secondary enrolment', 'p', '', 'Gross, % of the age group.'),
    ('Education', 'wb:SE.ADT.1524.LT.ZS', 'Youth literacy', 'p', 'up', '% of people aged 15–24.'),
    ('Education', 'wb:SE.ADT.LITR.ZS', 'Adult literacy', 'p', 'up', '% of people aged 15 and over.'),
    ('Education', 'wb:SE.LPV.PRIM', 'Learning poverty', 'p', 'down', '% of 10-year-olds who can’t read a simple text (World Bank/UIS).'),
    ('Education', 'wb:SE.XPD.TOTL.GD.ZS', 'Government education spending', 'p', '', '% of GDP.'),
    ('Water, energy and digital', 'wb:SH.H2O.BASW.ZS', 'Basic drinking water', 'p', 'up', '% of people (WHO/UNICEF JMP).'),
    ('Water, energy and digital', 'wb:SH.STA.BASS.ZS', 'Basic sanitation', 'p', 'up', '% of people (WHO/UNICEF JMP).'),
    ('Water, energy and digital', 'wb:SH.STA.ODFC.ZS', 'Open defecation', 'p', 'down', '% of people (WHO/UNICEF JMP).'),
    ('Water, energy and digital', 'wb:EG.ELC.ACCS.ZS', 'Access to electricity', 'p', 'up', '% of people.'),
    ('Water, energy and digital', 'wb:EG.ELC.ACCS.RU.ZS', 'Electricity, rural', 'p', 'up', '% of rural people.'),
    ('Water, energy and digital', 'wb:EG.ELC.ACCS.UR.ZS', 'Electricity, urban', 'p', 'up', '% of urban people.'),
    ('Water, energy and digital', 'wb:EG.CFT.ACCS.ZS', 'Clean cooking', 'p', 'up', '% of people using clean fuels and technology for cooking.'),
    ('Water, energy and digital', 'wb:IT.NET.USER.ZS', 'Internet users', 'p', 'up', '% of people (ITU).'),
    ('Water, energy and digital', 'wb:IT.CEL.SETS.P2', 'Mobile subscriptions', 'd', '', 'Per 100 people (ITU).'),
    ('Water, energy and digital', 'wb:FX.OWN.TOTL.ZS', 'Bank or mobile money account', 'p', 'up', '% of adults (Global Findex survey).'),
    ('Gender', 'wb:SG.GEN.PARL.ZS', 'Women in parliament', 'p', 'up', '% of seats in the House of Representatives (IPU).'),
    ('Gender', 'wb:SP.ADO.TFRT', 'Adolescent births', 'd', 'down', 'Births per 1,000 women aged 15–19.'),
    ('Gender', 'wb:SP.M18.2024.FE.ZS', 'Child marriage', 'p', 'down', '% of women aged 20–24 first married by 18 (surveys).'),
    ('Gender', 'wb:SL.TLF.CACT.FE.ZS', 'Women in the labour force', 'p', '', '% of women aged 15 and over (ILO modelled estimate).'),
    ('Gender', 'wb:SP.DYN.LE00.FE.IN', 'Life expectancy, women', 'd', 'up', 'Years.'),
    ('Gender', 'wb:SP.DYN.LE00.MA.IN', 'Life expectancy, men', 'd', 'up', 'Years.'),
    ('Gender', 'hdr:gii', 'Gender Inequality Index', 'r', 'down', 'UNDP: 0 = women and men equal, 1 = most unequal.'),
    ('Governance', 'wb:GE.EST', 'Government effectiveness', 'g', 'up', 'Worldwide Governance Indicators estimate, about −2.5 (weak) to +2.5 (strong). Liberia only: this series is archived for other countries.'),
    ('Governance', 'wb:CC.EST', 'Control of corruption', 'g', 'up', 'Worldwide Governance Indicators estimate, about −2.5 to +2.5.'),
    ('Governance', 'wb:RL.EST', 'Rule of law', 'g', 'up', 'Worldwide Governance Indicators estimate, about −2.5 to +2.5.'),
    ('Governance', 'wb:VA.EST', 'Voice and accountability', 'g', 'up', 'Worldwide Governance Indicators estimate, about −2.5 to +2.5.'),
    ('Governance', 'wb:PV.EST', 'Political stability', 'g', 'up', 'Worldwide Governance Indicators estimate, about −2.5 to +2.5.'),
    ('Governance', 'wb:RQ.EST', 'Regulatory quality', 'g', 'up', 'Worldwide Governance Indicators estimate, about −2.5 to +2.5.'),
    ('Governance', 'wb:IQ.CPA.IRAI.XQ', 'Policies and institutions (CPIA)', 'd', 'up', 'World Bank country rating, 1 (low) to 6 (high).'),
    ('Environment', 'wb:AG.LND.FRST.ZS', 'Forest cover', 'p', 'up', '% of land area (FAO).'),
    ('Environment', 'wb:EN.GHG.CO2.PC.CE.AR5', 'CO₂ emissions per person', 'd', '', 'Tonnes a year, excluding land use.'),
]
GROUPS = {'LBR': 'Liberia', 'SSF': 'Sub-Saharan Africa', 'LIC': 'Low-income countries'}
BY_ID = {'LR': 'LBR', 'ZG': 'SSF', 'XM': 'LIC'}
SRC_NAME = {'wb': 'World Bank, World Development Indicators', 'imf': 'IMF World Economic Outlook (DataMapper)',
            'hdr': 'UNDP Human Development Report', 'who': 'WHO Global Health Observatory'}
SRC_URL = {'wb': 'https://data.worldbank.org/indicator/{c}?locations=LR', 'imf': 'https://www.imf.org/external/datamapper/{c}@WEO/LBR',
           'hdr': 'https://hdr.undp.org/data-center/specific-country-data#/countries/LBR', 'who': 'https://www.who.int/data/gho/data/indicators'}


def load(name):
    p = os.path.join(RAW, name)
    if not os.path.exists(p) or not os.path.getsize(p):
        return None
    try:
        return json.load(open(p, encoding='utf-8-sig'))
    except ValueError:
        return None


def clean(v, f):
    return None if v is None else round(float(v), 3 if f in ('r', 'g') else 2 if abs(float(v)) < 100 else 0)


def wb(code, f):
    j = load('wb_%s.json' % code)
    if not isinstance(j, list) or len(j) < 2 or not j[1]:
        return None
    out = {}
    for r in j[1]:
        if r.get('value') is None:
            continue
        iso = BY_ID.get((r.get('country') or {}).get('id'))  # the World Bank's own codes; LIC is 'XM' in the API
        if iso in GROUPS:
            out.setdefault(iso, {})[int(r['date'])] = clean(r['value'], f)
    meta = load('wbmeta_%s.json' % code)
    org = ''
    if isinstance(meta, list) and len(meta) > 1 and meta[1]:
        org = (meta[1][0].get('sourceOrganization') or '').strip()
    return out, org


def imf(code, f):
    j = load('imf_%s.json' % code)
    try:
        vals = j['values'][code]['LBR']
    except (TypeError, KeyError):
        return None
    return {'LBR': {int(y): clean(v, f) for y, v in vals.items() if v is not None}}, ''


HDR = None
STATIC = os.path.join(HERE, 'static')  # committed copies: UNDP composite indices (Liberia rows), DHS survey data


def hdr(col, f):
    global HDR
    if HDR is None:
        HDR = {}
        p = os.path.join(STATIC, 'hdr_composite_LBR.csv')
        if os.path.exists(p):
            for row in csv.DictReader(open(p, encoding='utf-8-sig', errors='replace')):
                if row.get('iso3') == 'LBR':
                    HDR = row
    out = {}
    for k, v in HDR.items():
        m = re.fullmatch(col + r'_(\d{4})', k or '')
        if m and v not in ('', None):
            try:
                out[int(m.group(1))] = clean(v, f)
            except ValueError:
                pass
    return ({'LBR': out}, '') if out else None


def who(code, f):
    j = load('who_%s.json' % code)
    if not j or not j.get('value'):
        return None
    out = {}
    for r in j['value']:
        if r.get('SpatialDim') == 'LBR' and r.get('NumericValue') is not None and r.get('Dim1') in (None, 'SEX_BTSX', 'BTSX'):
            out[int(r['TimeDim'])] = clean(r['NumericValue'], f)
    return ({'LBR': out}, '') if out else None


def series(key, f):
    keys = key.split('|')
    for n, k in enumerate(keys):
        src, code = k.split(':', 1)
        got = {'wb': wb, 'imf': imf, 'hdr': hdr, 'who': who}[src](code, f)
        if got and got[0].get('LBR'):
            data = dict(got[0])
            for k2 in keys[n + 1:]:  # comparison groups from a fallback World Bank series when the first source has none
                s2, c2 = k2.split(':', 1)
                alt = wb(c2, f) if s2 == 'wb' else None
                if alt:
                    for g in ('SSF', 'LIC'):
                        data.setdefault(g, alt[0].get(g) or {})
            return src, code, data, got[1]
    return None


def indicators(this_year):
    out, missing = [], []
    for theme, key, label, f, better, note in CATALOGUE:
        got = series(key, f)
        if not got:
            missing.append(key)
            continue
        src, code, data, org = got
        lbr = {y: v for y, v in data['LBR'].items() if y >= FIRST}
        actual = {y: v for y, v in lbr.items() if y <= this_year - (1 if src == 'imf' else 0)}
        if not actual:
            missing.append(key)
            continue
        ly = max(actual)
        item = {'t': THEMES.index(theme), 'l': label, 'f': f, 'b': better, 'n': note, 'k': code,
                's': SRC_NAME[src], 'u': SRC_URL[src].format(c=code),
                'y': ly, 'v': actual[ly], 'lbr': [[y, lbr[y]] for y in sorted(lbr)]}
        if src == 'imf':
            item['fc'] = this_year - 1  # years after this are IMF projections
        for g in ('SSF', 'LIC'):
            if data.get(g):
                pts = {y: v for y, v in data[g].items() if y >= FIRST}
                item[g.lower()] = [[y, pts[y]] for y in sorted(pts)]
        out.append(item)
    return out, missing


DHS_MEASURES = [  # (DHS indicator id, label, better)
    ('CN_NUTS_C_HA2', 'Children stunted', 'down'),
    ('RH_DELA_C_SKP', 'Births with a skilled provider', 'up'),
    ('RH_ANCN_W_N4P', 'Women with 4+ antenatal visits', 'up'),
    ('FP_CUSM_W_MOD', 'Married women using modern contraception', 'up'),
    ('ED_LITR_W_LIT', 'Women who can read', 'up'),
    ('ED_LITR_M_LIT', 'Men who can read', 'up'),
    ('AN_ANEM_W_ANY', 'Women with anaemia', 'down'),
    ('ML_NETC_C_ITN', 'Children under 5 who slept under a bed net', 'up'),
    ('WS_SRCE_H_IMP', 'Households with improved water', 'up'),
    ('HC_ELEC_H_ELC', 'Households with electricity', 'up'),
    ('CP_BREG_C_REG', 'Births registered (under 5s)', 'up'),
    ('HC_WIXQ_P_LOW', 'People in the poorest fifth nationally', 'down'),
]


def norm(s):
    return re.sub(r'[^a-z]', '', (s or '').lower().replace('county', ''))


def dhs(counties):
    def static(name):
        p = os.path.join(STATIC, name)
        return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None
    sub, nat = static('dhs_subnational.json'), static('dhs_national.json')
    if not sub or not sub.get('Data'):
        return [], ''
    names = {norm(n): i for i, n in enumerate(counties)}
    by = {}
    survey = ''
    for r in sub['Data']:
        if r.get('ByVariableLabel') or r.get('IsPreferred') == 0:
            continue
        i = names.get(norm((r.get('CharacteristicLabel') or '').replace('incl. Monrovia', '')))  # the survey's Montserrado county includes Monrovia
        if i is None:
            continue
        by.setdefault(r['IndicatorId'], [None] * len(counties))[i] = r['Value']
        survey = survey or '%s %s' % (r.get('SurveyYearLabel') or r.get('SurveyYear'), r.get('SurveyType') or 'DHS')
    natv = {}
    for r in (nat or {}).get('Data', []):
        if not r.get('ByVariableLabel') and r.get('IsPreferred', 1) != 0:
            natv.setdefault(r['IndicatorId'], r['Value'])
    out = []
    for iid, label, better in DHS_MEASURES:
        v = by.get(iid)
        if not v or sum(x is not None for x in v) < len(counties) - 2:
            continue
        out.append({'g': 'Health and living (DHS %s)' % survey.split(' ')[0] if survey else 'Health and living (DHS)', 'k': 'dhs_' + iid,
                    'l': label + ' (%)', 'f': 'p', 'v': v, 'nat': natv.get(iid), 'b': better, 'note': '',
                    'src': 'Liberia Demographic and Health Survey %s (LISGIS, Ministry of Health and ICF), indicator %s, via the DHS Program API. Survey estimates with margins of error.' % (survey.split(' ')[0] if survey else '2019–20', iid)})
    return out, survey


def main():
    this_year = dt.date.today().year
    counties = []
    if os.path.exists(MAPS):
        s = open(MAPS, encoding='utf-8').read()
        j = json.loads(s[s.index('=') + 1:s.rstrip().rindex(';')])
        counties = [c['n'] for c in j['counties']]
    inds, missing = indicators(this_year)
    dm, survey = dhs(counties)
    fetched = ''
    lp = os.path.join(RAW, 'log.txt')
    if os.path.exists(lp):
        fetched = dt.date.fromtimestamp(os.path.getmtime(lp)).strftime('%-d %B %Y')
    data = {'fetched': fetched, 'themes': THEMES, 'groups': GROUPS, 'ind': inds, 'dhs': dm}
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('window.LBR_IND=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('indicators.js: %.0f kB, %d indicators, %d DHS county measures (%s)' % (os.path.getsize(OUT) / 1e3, len(inds), len(dm), survey))
    if missing:
        print('  no data for:', ', '.join(missing))


if __name__ == '__main__':
    main()
