#!/usr/bin/env python3
"""Check math consistency of META 2026/Q2 financials shown in Binance App (from 62034.jpg).

Values read from the screenshot (62034.jpg):
  Revenue 2026/Q2        $60.8B   Net Income     $15.85B
  Gross Profit           $49.47B  EBITDA         $25.13B
  Operating Income       $18.78B  Gross Margin   81.37%
  Operating Margin       30.88%   Profit Margin  26.07%
  Revenue Growth YoY     27.96%   NI Growth YoY  -13.57%
  Basic EPS              $6.23    Diluted EPS    $6.18
Cross-check identities:
  gross margin   = gross profit / revenue
  profit margin  = net income / revenue
  operating income ~= revenue x operating margin
  EBITDA margin  = EBITDA / revenue
"""

r = {
    'revenue': 60.8, 'net_income': 15.85, 'gross_profit': 49.47,
    'ebitda': 25.13, 'operating_income': 18.78, 'basic_eps': 6.23,
    'diluted_eps': 6.18,
    'gross_margin': 81.37, 'operating_margin': 30.88, 'profit_margin': 26.07,
    'revenue_growth_yoy': 27.96, 'ni_growth_yoy': -13.57,
}

def close(a, b, tol=0.02):
    return abs(a - b) <= tol

checks = [
    ('Gross Margin     = Gross Profit / Revenue',
     100 * r['gross_profit'] / r['revenue'], r['gross_margin']),
    ('Profit Margin    = Net Income / Revenue',
     100 * r['net_income'] / r['revenue'], r['profit_margin']),
    ('Operating Income = Revenue x Op Margin (implied)',
     r['revenue'] * r['operating_margin'] / 100, r['operating_income']),
    ('EBITDA Margin    = EBITDA / Revenue',
     100 * r['ebitda'] / r['revenue'], None),
    ('EPS dilution     = Basic / Diluted',
     r['basic_eps'] / r['diluted_eps'], None),
]

print('META 2026/Q2 math check (values from Binance App screenshot 62034.jpg)')
ok = True
for name, calc, reported in checks:
    if reported is None:
        print(f'  {name}: {calc:.2f}')
    else:
        status = 'OK ' if close(calc, reported) else 'MISMATCH'
        if not close(calc, reported):
            ok = False
        print(f'  {name}: calc {calc:.2f} vs reported {reported:.2f} -> {status}')

# derive NI growth implies prior Q2 NI
prior_ni = r['net_income'] / (1 + r['ni_growth_yoy'] / 100)
print(f'  Implied 2025/Q2 Net Income (from -13.57% growth): ${prior_ni:.2f}B')
prior_rev = r['revenue'] / (1 + r['revenue_growth_yoy'] / 100)
print(f'  Implied 2025/Q2 Revenue      (from +27.96% growth): ${prior_rev:.2f}B')
print('ALL CHECKS PASSED' if ok else 'CHECKS FAILED')
