#!/usr/bin/env python3
"""Download the live indicator sources into a folder, for tools/build_indicators.py.

Runs on the GitHub Pages workflow (weekly, and on every deploy): GitHub's runners can reach these APIs, the
cloud workspace can't. Python 3 standard library only. Writes wb_<CODE>.json, wbmeta_<CODE>.json, imf_<CODE>.json,
who_<CODE>.json and log.txt into the folder named by the first argument (default: indicators-raw). A source that
fails is logged and skipped; the build then drops its indicators, so a bad week never blanks the page.

Usage: python3 fetch_indicators.py [folder]
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else 'indicators-raw'
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, 'log.txt'), 'w', encoding='utf-8')
UA = 'LiberiaAidViewer/1.0 (indicator refresh)'

# World Bank codes (same list as the PC download). Governance codes are read from the live WGI series instead:
# the WDI copies were archived, and the WGI names are the current ones.
WB = ('NY.GDP.MKTP.KD.ZG NY.GDP.PCAP.PP.CD NY.GDP.PCAP.CD FP.CPI.TOTL.ZG GC.REV.XGRT.GD.ZS DT.DOD.DECT.GN.ZS '
      'BX.TRF.PWKR.DT.GD.ZS BX.KLT.DINV.WD.GD.ZS NY.GDP.TOTL.RT.ZS DT.ODA.ODAT.GN.ZS NE.EXP.GNFS.ZS NV.AGR.TOTL.ZS '
      'SL.UEM.TOTL.ZS SL.EMP.VULN.ZS SI.POV.DDAY SI.POV.NAHC SI.POV.GINI SP.POP.TOTL SP.POP.GROW SP.DYN.TFRT.IN '
      'SP.URB.TOTL.IN.ZS SP.POP.0014.TO.ZS SP.DYN.LE00.IN SP.DYN.LE00.FE.IN SP.DYN.LE00.MA.IN SH.DYN.MORT '
      'SP.DYN.IMRT.IN SH.DYN.NMRT SH.STA.MMRT SH.STA.BRTC.ZS SH.IMM.IDPT SH.IMM.MEAS SH.MLR.INCD.P3 SH.DYN.AIDS.ZS '
      'SH.TBS.INCD SH.XPD.CHEX.PC.CD SH.XPD.GHED.CH.ZS SH.XPD.EHEX.CH.ZS SH.MED.PHYS.ZS SH.MED.NUMW.P3 '
      'SH.STA.STNT.ZS SH.STA.WAST.ZS SN.ITK.DEFC.ZS SN.ITK.MSFI.ZS SE.PRM.CMPT.ZS SE.SEC.CMPT.LO.ZS SE.PRM.UNER.ZS '
      'SE.ADT.1524.LT.ZS SE.ADT.LITR.ZS SE.LPV.PRIM SE.XPD.TOTL.GD.ZS SE.PRM.ENRR SE.SEC.ENRR SH.H2O.BASW.ZS '
      'SH.STA.BASS.ZS SH.STA.ODFC.ZS EG.ELC.ACCS.ZS EG.ELC.ACCS.UR.ZS EG.ELC.ACCS.RU.ZS EG.CFT.ACCS.ZS IT.NET.USER.ZS '
      'IT.CEL.SETS.P2 FX.OWN.TOTL.ZS SG.GEN.PARL.ZS SP.ADO.TFRT SP.M18.2024.FE.ZS SL.TLF.CACT.FE.ZS '
      'AG.LND.FRST.ZS EN.GHG.CO2.PC.CE.AR5 IQ.CPA.IRAI.XQ').split()
WGI = {'GE.EST': 'GOV_WGI_GE.EST', 'CC.EST': 'GOV_WGI_CC.EST', 'RL.EST': 'GOV_WGI_RL.EST',
       'VA.EST': 'GOV_WGI_VA.EST', 'PV.EST': 'GOV_WGI_PV.EST', 'RQ.EST': 'GOV_WGI_RQ.EST'}
IMF = ['NGDP_RPCH', 'PCPIPCH', 'GGXWDG_NGDP', 'GGXCNL_NGDP', 'GGR_G01_GDP_PT']
WHO = ['UHC_INDEX_REPORTED']


def log(msg):
    print(msg)
    LOG.write('%s %s\n' % (dt.datetime.now().isoformat(timespec='seconds'), msg))
    LOG.flush()


def get(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json, text/csv, */*'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:  # network errors and HTTP errors alike: retry, then give up on this source
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(str(last))


def save(name, body):
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(body)


def world_bank():
    for code in WB + list(WGI.values()):
        out = code if code not in WGI.values() else [k for k, v in WGI.items() if v == code][0]
        url = ('https://api.worldbank.org/v2/country/LBR;SSF;LIC/indicator/%s?format=json&date=2000:2026&per_page=2000'
               % code)
        if code in WGI.values():
            url = url.replace('country/LBR;SSF;LIC', 'country/LBR').replace('&per_page=2000', '&per_page=2000&source=3')
        try:
            body = get(url)
            j = json.loads(body.decode('utf-8'))
            rows = j[1] if isinstance(j, list) and len(j) > 1 and j[1] else []
            save('wb_%s.json' % out, body)
            log('WB %s: %d rows' % (out, len(rows)))
        except Exception as e:
            log('WB %s FAILED: %s' % (out, e))
        try:
            save('wbmeta_%s.json' % out, get('https://api.worldbank.org/v2/indicator/%s?format=json' % code))
        except Exception as e:
            log('WB meta %s FAILED: %s' % (code, e))


def imf():
    for code in IMF:
        try:
            save('imf_%s.json' % code, get('https://www.imf.org/external/datamapper/api/v1/%s' % code))
            log('IMF %s: ok' % code)
        except Exception as e:
            log('IMF %s FAILED: %s' % (code, e))


def who():
    for code in WHO:
        try:
            q = urllib.parse.quote("SpatialDim eq 'LBR'")
            save('who_%s.json' % code, get('https://ghoapi.azureedge.net/api/%s?$filter=%s' % (code, q)))
            log('WHO %s: ok' % code)
        except Exception as e:
            log('WHO %s FAILED: %s' % (code, e))


def static():
    """Copy the committed inputs that don't change week to week (UNDP composite indices for Liberia, DHS 2019-20)."""
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    for name in ('hdr_composite_LBR.csv', 'dhs_subnational.json', 'dhs_national.json'):
        src = os.path.join(here, name)
        if os.path.exists(src):
            with open(src, 'rb') as f:
                save(name, f.read())
            log('static %s: copied' % name)
        else:
            log('static %s: missing from tools/static' % name)


if __name__ == '__main__':
    log('refresh started %s' % dt.date.today().isoformat())
    world_bank()
    imf()
    who()
    static()
    log('done')
