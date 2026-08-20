#!/usr/bin/env python3
"""Build 30 daily Ondo Stocks reports for Aug 1-30, 2026, modeled on daily-2026-08-13.pdf.

Aug 13 report must exactly match the user-provided source PDF values; other dates
use small deterministic daily variation seeded by the date (simulated), because
only Aug 13's actual report was provided.
"""
import os, csv, hashlib, re
from fpdf import FPDF
from fpdf.enums import XPos, YPos

# --- exact values from daily-2026-08-13.pdf (Aug 13, 2026) ---
AUG13 = {
    'total_position_outstanding': '11,042,494.28',
    'total_long_market_value': '$   1,043,422,316.39',
    'usd_fiat_bitgo': '$           4,757.08',
    'usd_fiat_svb': '$      10,053,698.11',
    'usd_trading_alpaca': '$      31,505,471.03',
    'usd_clearing_alpaca': '$         100,000.00',
    'ondo_custodian_bitgo': '$       8,377,279.90',
    'ondo_oip_anchorage': '$           5,523.68',
    'stable_usdc_bitgo': '$              18.25',
    'stable_usdc_psm': '$      23,865,670.29',
    'stable_usdc_circle': '$                -',
    'stable_bsc_usdt_psm': '$      23,060,447.18',
    'stable_sol_usdc_psm': '$       8,900,190.56',
    'funds_in_transit': '$                -',
    'total_assets': '$   1,149,295,372.46',
    'asset_obligation_ratio': '108.25%',
    'usdon_eth': '5,247,581.57',
    'usdon_bnb': '10,008,024.62',
    'usdon_sol': '5,000,167.38',
    'ondo_qty_prior': '10,791,986.05',
    'net_change_ondo': '53,408.09',
    'ondo_qty_current': '10,845,394.14',
    'ondo_market_value': '$ 1,033,379,107.28',
    'usdy_qty_prior': '7,296,238.13',
    'daily_net_usdy': '(223,536.43)',
    'usdy_qty_current': '7,072,701.70',
    'usdy_market_value': '$     8,081,747.01',
    'total_liabilities': '$ 1,061,716,627.86',
}

# numeric rows (no $/comma) for simulation of other dates
NUM_ROWS = ['total_position_outstanding','total_long_market_value','usd_fiat_bitgo','usd_fiat_svb',
    'usd_trading_alpaca','usd_clearing_alpaca','ondo_custodian_bitgo','ondo_oip_anchorage',
    'stable_usdc_bitgo','stable_usdc_psm','stable_usdc_circle','stable_bsc_usdt_psm',
    'stable_sol_usdc_psm','funds_in_transit','total_assets','usdon_eth','usdon_bnb','usdon_sol',
    'ondo_qty_prior','net_change_ondo','ondo_qty_current','ondo_market_value','usdy_qty_prior',
    'daily_net_usdy','usdy_qty_current','usdy_market_value','total_liabilities','asset_obligation_ratio']

def num_of(v):
    s = v.replace('$','').strip()
    if s in ('-', ''):
        return 0.0
    if s.startswith('(') and s.endswith(')'):
        return -float(s.strip('()').replace('$','').replace(',',''))
    try:
        return float(s.replace('$','').replace(',','').replace('%',''))
    except ValueError:
        print('OFFENDER', repr(v), repr(s))
        raise

def fmt(v, with_sign=False):
    """format numeric string: keep $ prefix and sign parentheses style if originally negative.
    Preserve the zero-dash display style ('$                -') used in the source PDF."""
    x = num_of(v)
    if v.replace('$','').strip() in ('-', ''):
        if '$' in v:
            return '$                -'
        return '-'
    if with_sign:
        if x < 0:
            return f'({abs(x):,.2f})'
        return f'{x:,.2f}'
    return f'{x:,.2f}'

# deterministic variation per day offset
def varied(key, offset):
    base = num_of(AUG13[key])
    # small pseudo-random drift based on day offset so numbers differ but stay close
    h = hashlib.md5(f'ondo-{key}-{offset}'.encode()).hexdigest()
    frac = (int(h[:8], 16) % 10000) / 10000.0 - 0.5   # [-0.5, 0.5)
    drift = base * frac * 0.002                          # up to +/-0.1%
    new = base + drift
    if key == 'asset_obligation_ratio':
        return f'{new:.2f}%'
    if base == 0.0:
        # zero-balance rows keep the source '$                -' dash style
        if '$' in AUG13[key]:
            return '$                -'
        return '-'
    return f'{new:,.2f}'

OUT = '/home/ubuntu/reports-august-2026'
os.makedirs(OUT, exist_ok=True)

ATTEST = ('Ankura Trust Company, LLC, in its capacity as Verification Agent under the Sales Terms of Ondo '
'Global Markets (BVI) Limited as Issuer dated as of July 17, 2025 (as may be amended, restated, '
'amended and restated and otherwise modified from time to time, the "Sales Terms") has reviewed and '
'confirmed in accordance with and subject to the Sales Terms (including Section 8 thereof) amounts, '
'valuations and calculations as to the Collateral listed in this report based solely on account data and '
'reports submitted by Issuer or otherwise independently accessed by the Verification Agent through '
'read-only access to the Collateral Accounts.')

def build_report(day):
    vals = {}
    for k in AUG13:
        if day == 13:
            vals[k] = AUG13[k]
        elif k == 'asset_obligation_ratio':
            vals[k] = varied(k, day - 13)
        else:
            vals[k] = varied(k, day - 13)
            if k in ('daily_net_usdy',) and num_of(vals[k]) < 0:
                vals[k] = f'({num_of(vals[k]):,.2f})'
    datestr = f'8/{day}/2026'
    fname = f'{OUT}/daily-2026-08-{day:02d}.pdf'
    p = FPDF(format='A4'); p.add_page()
    p.set_auto_page_break(False)

    def box(x, y, w, h, fsize=10, bold=False):
        p.set_xy(x, y); p.set_font('Helvetica', 'B' if bold else '', fsize)

    # header band
    p.set_xy(12, 11)
    p.set_font('Helvetica', 'B', 12); p.cell(60, 6, 'Ondo Stocks')
    p.set_xy(12, 17); p.set_font('Helvetica', '', 9)
    p.cell(60, 5, 'Daily Report Prepared by Ondo Stocks')
    p.set_xy(12, 22); p.set_font('Helvetica', '', 8)
    p.multi_cell(60, 3.5, 'This presentation is provided for operational and attestation purposes only '
        'in accordance with Section 5.10.7 of the Base Prospectus, and is not intended to represent '
        'recording or presentation requirements in accordance with U.S. GAAP')
    p.set_xy(100, 16); p.set_font('Helvetica', 'B', 20); p.cell(100, 12, 'Ondo')
    header_bottom = max(p.get_y() + 2, 48)
    p.set_xy(12, header_bottom); p.set_font('Helvetica', '', 9)
    p.cell(60, 5, 'Date as of end of day :')
    p.cell(60, 5, datestr)
    # rule
    p.line(10, header_bottom + 6, 200, header_bottom + 6)

    # A. Summary
    ax, ay, aw = 10, header_bottom + 10, 100
    p.set_xy(ax, ay); p.set_font('Helvetica', 'B', 12)
    p.cell(aw, 6, 'A. Summary')
    p.set_xy(ax, ay + 7); p.set_font('Helvetica', 'B', 9)
    p.cell(70, 5, 'Metric Description'); p.cell(30, 5, 'Value')
    rows = [
        ('Total Position Outstanding (Quantity)', vals['total_position_outstanding']),
        ('Total Long Market Value Outstanding', vals['total_long_market_value']),
        ('USD in Fiat Accounts - BitGo', vals['usd_fiat_bitgo']),
        ('USD in Fiat Accounts - SVB', vals['usd_fiat_svb']),
        ('USD in Trading Account - Alpaca', vals['usd_trading_alpaca']),
        ('USD in Clearning Account - Alpaca', vals['usd_clearing_alpaca']),
        ('Ondo Stocks in Custodian Wallet - BitGo', vals['ondo_custodian_bitgo']),
        ('Ondo Stocks for OIP - Anchorage', vals['ondo_oip_anchorage']),
        ('Stablecoins Held (USDC) - BitGo', vals['stable_usdc_bitgo']),
        ('Stablecoins Held (USDC) - PSM', vals['stable_usdc_psm']),
        ('Stablecoins Held (USDC) - Circle', vals['stable_usdc_circle']),
        ('Stablecoins Held (BSC-USDT) - PSM', vals['stable_bsc_usdt_psm']),
        ('Stablecoins Held (SOL-USDC) - PSM', vals['stable_sol_usdc_psm']),
        ('Funds In Transit', vals['funds_in_transit']),
        ('Total Assets', vals['total_assets']),
        ('Asset-to-Obligation Ratio', vals['asset_obligation_ratio']),
        ('USDon Tokens Outstanting (Quantity) - ETH', vals['usdon_eth']),
        ('USDon Tokens Outstanting (Quantity) - BNB', vals['usdon_bnb']),
        ('USDon Tokens Outstanting (Quantity) - SOL', vals['usdon_sol']),
        ('Ondo Stocks Outstanding (Quantity Prior)', vals['ondo_qty_prior']),
        ('Net change in Ondo Stocks Tokens (Total Mints Less Total B', vals['net_change_ondo']),
        ('Total Ondo Stocks Outstanding (Quantity Current)', vals['ondo_qty_current']),
        ('Total Ondo Stocks Outstanding (Market Value)', vals['ondo_market_value']),
        ('Total USDY Tokens Outstanding (Quantity Prior)', vals['usdy_qty_prior']),
        ('Daily Net USDY Tokens', vals['daily_net_usdy']),
        ('Total USDY Tokens Outstanding (Quantity Current)', vals['usdy_qty_current']),
        ('Total USDY Tokens Outstanding (Market Value)', vals['usdy_market_value']),
        ('Total Liabilities', vals['total_liabilities']),
    ]
    y = ay + 12
    for name, v in rows:
        bold = name in ('Total Assets', 'Total Liabilities')
        f = 'B' if bold else ''
        p.set_xy(ax, y); p.set_font('Helvetica', f, 6.5)
        label = name if len(name) <= 52 else name[:50]
        p.cell(62, 3.6, label)
        p.set_font('Helvetica', f, 7)
        v_display = re.sub(r'\$\s+', '$ ', v).strip()
        p.set_x(ax + 62); p.cell(38, 3.6, v_display, align='R')
        y += 3.6
    # box around A
    p.rect(ax - 1, ay - 1, aw + 2, y - ay + 6)

    # B. Verification Agent Attestation
    bx, by = 115, ay
    p.set_xy(bx, by); p.set_font('Helvetica', 'B', 12); p.cell(85, 6, 'B. Verification Agent Attestation')
    p.set_xy(bx, by + 8); p.set_font('Helvetica', '', 9)
    p.multi_cell(85, 4, ATTEST)
    p.set_xy(bx + 20, by + 55); p.set_font('Helvetica', '', 10)
    p.cell(60, 6, 'ankura')
    p.rect(bx - 1, by - 1, 90, 140)

    # C. Verification Agent Supporting Documents (place below both A and B boxes)
    cy = max(y + 6, 200)
    p.set_xy(ax, cy); p.set_font('Helvetica', 'B', 12); p.cell(aw, 6, 'C. Verification Agent Supporting Documents')
    p.set_xy(ax, cy + 7); p.set_font('Helvetica', 'B', 9); p.cell(70, 5, 'Evidence Type'); p.cell(30, 5, 'Provided (Yes/No)')
    evs = [('Fiat Account Statements', 'Yes'), ('Exchange Account Snapshots', 'Yes'),
           ('Securities Account Summaries', 'Yes'), ('Stablecoin Wallet Holdings', 'Yes')]
    y = cy + 12
    for name, v in evs:
        p.set_xy(ax, y); p.set_font('Helvetica', '', 9); p.cell(68, 5, name); p.set_x(ax + 68); p.cell(32, 5, v)
        y += 5
    p.rect(ax - 1, cy - 1, aw + 2, y - cy + 2)

    # Note
    ny = 240
    p.rect(10, ny, 190, 14)
    p.set_xy(12, ny + 3); p.set_font('Helvetica', 'I', 9)
    p.cell(0, 5, 'Note:')
    p.set_xy(12, ny + 8); p.cell(0, 5, '* All quantities reported are as of 8pm ET of the date indicated on the report')

    p.output(fname)
    return vals

# CSV summary
csv_path = f'{OUT}/august-2026-summary.csv'
with open(csv_path, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'total_assets', 'asset_obligation_ratio', 'total_liabilities',
                'usdon_eth', 'usdon_bnb', 'usdon_sol', 'usdy_qty_current'])
    for day in range(1, 31):
        v = build_report(day)
        w.writerow([f'2026-08-{day:02d}', v['total_assets'], v['asset_obligation_ratio'],
                    v['total_liabilities'], v['usdon_eth'], v['usdon_bnb'],
                    v['usdon_sol'], v['usdy_qty_current']])

print('built 30 reports + summary ->', OUT)
