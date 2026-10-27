"""Build Fantasy Time Machine historical QB/RB/WR/TE player data from nflverse.
Run in project root: python build_players.py
Kickers intentionally excluded until a separately validated source is available.
"""
from pathlib import Path
import json
import pandas as pd

URL = 'https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.csv'
POSITIONS = {'QB': 32, 'RB': 32, 'WR': 50, 'TE': 32}
STATS = {
    'passing_yards': 'Pass Yds', 'passing_tds': 'Pass TD', 'interceptions': 'INT',
    'carries': 'Carries', 'rushing_yards': 'Rush Yds', 'rushing_tds': 'Rush TD',
    'receptions': 'Rec', 'targets': 'Targets', 'receiving_yards': 'Rec Yds',
    'receiving_tds': 'Rec TD', 'passing_2pt_conversions': 'Pass 2PT',
    'rushing_2pt_conversions': 'Rush 2PT', 'receiving_2pt_conversions': 'Rec 2PT',
    'sack_fumbles_lost': 'Sack Fum Lost', 'rushing_fumbles_lost': 'Rush Fum Lost',
    'receiving_fumbles_lost': 'Rec Fum Lost', 'special_teams_tds': 'ST TD',
}
print('Downloading nflverse weekly player stats (this may take a minute)...', flush=True)
df = pd.read_csv(URL, low_memory=False)
required = {'player_id','player_display_name','position','recent_team','season','week','season_type','fantasy_points_ppr',*STATS.keys()}
missing = required - set(df.columns)
if missing:
    raise SystemExit(f'Dataset schema changed; missing columns: {sorted(missing)}')
df = df[df['season'].between(2000, 2025) & df['position'].isin(POSITIONS) & (df['season_type'] == 'REG')].copy()
df = df.dropna(subset=['player_id', 'player_display_name'])
df['fantasy_points_ppr'] = pd.to_numeric(df['fantasy_points_ppr'], errors='coerce')
# Use the published nflverse PPR points consistently, not an invented formula.
# A weekly record is a game appearance; season games are counted as distinct weeks.
keys = ['season','player_id','position']
for c in STATS:
    df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)
df = df.sort_values(['season','week'])
agg = {c:'sum' for c in STATS}
agg.update({'fantasy_points_ppr':'sum','week':'nunique','player_display_name':'last','recent_team':'last'})
seasonal = df.groupby(keys, as_index=False).agg(agg)
seasonal = seasonal.rename(columns={'week':'games'})
seasonal['rank'] = seasonal.groupby(['season','position'])['fantasy_points_ppr'].rank(method='first', ascending=False).astype(int)
seasonal = seasonal[seasonal.apply(lambda r: r['rank'] <= POSITIONS[r['position']], axis=1)]
records = []
for _, r in seasonal.iterrows():
    stats = {label: int(r[col]) if float(r[col]).is_integer() else round(float(r[col]), 2) for col,label in STATS.items() if r[col] != 0}
    records.append({
        'id': f"{int(r['season'])}-{r['player_id']}-{r['position']}",
        'name': str(r['player_display_name']), 'team': str(r['recent_team']),
        'year': int(r['season']), 'position': str(r['position']),
        'rank': int(r['rank']), 'points': round(float(r['fantasy_points_ppr']), 2),
        'games': int(r['games']), 'stats': stats,
    })
records.sort(key=lambda r:(r['year'],r['position'],r['rank']))
coverage = seasonal.groupby(['season','position']).size().unstack(fill_value=0)
print('\nSeason coverage (first and last five years):')
print(pd.concat([coverage.head(5),coverage.tail(5)]).to_string())
missing_seasons = sorted(set(range(2000,2025)) - set(coverage.index))
if missing_seasons:
    raise SystemExit(f'ERROR: Missing seasons: {missing_seasons}. File not written.')
missing_positions = [(y,p) for y in range(2000,2025) for p in POSITIONS if (y,p) not in seasonal.set_index(['season','position']).index]
if missing_positions:
    raise SystemExit(f'ERROR: Missing year/position groups: {missing_positions}. File not written.')
out = Path('public/players.json')
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')), encoding='utf-8')
print(f'\nWrote {len(records):,} player-seasons to {out.resolve()}')
print('Kickers NOT included; leave Include kicker unchecked.')
print('Note: games = number of weekly player rows, not verified official games played.')


