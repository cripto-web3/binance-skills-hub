#!/usr/bin/env python3
"""Build quarterly + annual income statement charts for a stock (META by default).

Data source: stockanalysis.com public financials pages (USD millions).
Chart style: dark theme like the Binance App Financials tab (yellow Revenue,
orange Net Income grouped bars).
Outputs:
  - data/<ticker>-income-quarterly.json / <ticker>-income-annual.json
  - charts/<ticker>-financials-quarterly.png
  - charts/<ticker>-financials-annual.png
"""
import json, os, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

plt.rcParams.update({
    'figure.facecolor': '#0d1117',
    'axes.facecolor': '#0d1117',
    'axes.edgecolor': '#30363d',
    'axes.labelcolor': '#c9d1d9',
    'text.color': '#c9d1d9',
    'xtick.color': '#c9d1d9',
    'ytick.color': '#8b949e',
    'grid.color': '#21262d',
    'font.size': 11,
})

# ---------- DATA (USD millions) ----------
# Source: stockanalysis.com (fetched Aug 20, 2026). Public financials.
DATA = {
    'META': {
        'name': 'Meta Platforms, Inc.',
        'quarterly': {
            'labels': ['Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
            'revenue':    [28645, 31999, 34146, 40111, 36455, 39071, 40589, 48385, 42314, 47516, 51242, 59893, 56311, 60801],
            'grossProfit':[21167, 24313, 26205, 30836, 27797, 29856, 31223, 37166, 32474, 37210, 39800, 47813, 45038, 49465],
            'opIncome':   [ 9435, 11431, 13736, 16936, 14889, 14880, 17352, 23505, 15868, 18374, 20715, 25272, 23561, 18782],
            'netIncome':  [ 5709,  7788, 11583, 14017, 12369, 13465, 15688, 20838, 16644, 18337,  2709, 22768, 26773, 15848],
        },
        'annual': {
            'labels': ['2020', '2021', '2022', '2023', '2024', '2025'],
            'revenue':    [85965, 117929, 116609, 134902, 164501, 200966],
            'grossProfit':[69900,  97432,  92855, 108943, 134340, 164791],
            'opIncome':  [32671,  46753,  33555,  46751,  69380,  83276],
            'netIncome': [29146,  39370,  23200,  39098,  62360,  68098],
        },
        'ttm': {
            'labels': ['TTM\n(through 2026/Q2)'],
            'revenue':    [228247], 'grossProfit': [186586], 'opIncome': [86926], 'netIncome': [68098],
        },
    },
}

YELLOW = '#f0b90b'   # Binance yellow
ORANGE = '#f97316'
TEAL   = '#2dd4bf'


def fmt_b(v):
    """v is in USD millions; show as B/T."""
    bv = v / 1000.0
    if bv >= 1000:
        return f'{bv/1000:.2f}T'
    return f'{bv:.2f}B'


def bar_chart(d, outfile, title, figsize=(13, 6.2)):
    labels = d['labels']
    rev = d['revenue']
    ni = d['netIncome']
    fig, ax = plt.subplots(figsize=figsize)
    x = range(len(labels))
    w = 0.38
    b1 = ax.bar([i - w/2 for i in x], rev, w, color=YELLOW, label='Revenue')
    b2 = ax.bar([i + w/2 for i in x], ni, w, color=ORANGE, label='Net Income')
    for b, v in zip(list(b1) + list(b2), rev + ni):
        ax.annotate(f'${fmt_b(v)}', (b.get_x() + b.get_width()/2, b.get_height()),
                    ha='center', va='bottom', fontsize=8.5, color='#e6edf3')
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels)
    ax.set_ylabel('USD millions')
    ax.set_title(title, fontsize=15, color='#f0b90b', pad=14)
    ax.grid(axis='y', alpha=0.35)
    ax.set_axisbelow(True)
    ax.legend(loc='upper left', facecolor='#161b22', edgecolor='#30363d')
    plt.setp(ax.get_xticklabels(), rotation=35, ha='right')
    ax.spines[['top', 'right']].set_visible(False)
    plt.tight_layout()
    plt.savefig(outfile, dpi=140)
    plt.close()
    print(f'saved {outfile}')


def margins_table(d):
    """Derived ratios (annual or quarterly) matching the Binance App card."""
    out = []
    for i, lab in enumerate(d['labels']):
        rev, gp, oi, ni = d['revenue'][i], d['grossProfit'][i], d['opIncome'][i], d['netIncome'][i]
        out.append({
            'period': lab,
            'revenue': rev, 'gross_profit': gp, 'operating_income': oi, 'net_income': ni,
            'gross_margin_pct': round(100 * gp / rev, 2),
            'operating_margin_pct': round(100 * oi / rev, 2),
            'profit_margin_pct': round(100 * ni / rev, 2),
        })
    return out


def main(ticker='META', chart_only=False):
    d = DATA[ticker]
    name = d['name']
    os.makedirs('/home/ubuntu/charts', exist_ok=True)
    os.makedirs('/home/ubuntu/data', exist_ok=True)
    if not chart_only:
        json.dump({'quarterly': d['quarterly'], 'annual': d['annual'], 'ttm': d['ttm'],
                   'quarterly_margins': margins_table(d['quarterly']),
                   'annual_margins': margins_table(d['annual'])},
                  open(f'/home/ubuntu/data/{ticker.lower()}-income.json', 'w'), indent=1)
        print(f'saved /home/ubuntu/data/{ticker.lower()}-income.json')
    bar_chart(d['quarterly'], f'/home/ubuntu/charts/{ticker.lower()}-income-quarterly.png',
              f'{name} ({ticker}) — Quarterly Revenue vs Net Income (USD)', figsize=(14.5, 6.5))
    bar_chart(d['annual'], f'/home/ubuntu/charts/{ticker.lower()}-income-annual.png',
              f'{name} ({ticker}) — Annual Revenue vs Net Income (USD)', figsize=(12, 6))
    return 0


if __name__ == '__main__':
    ticker = sys.argv[1] if len(sys.argv) > 1 else 'META'
    sys.exit(main(ticker, chart_only=len(sys.argv) > 2 and sys.argv[2] == '--chart-only'))
