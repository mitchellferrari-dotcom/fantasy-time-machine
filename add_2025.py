"""Add verified 2025 nflverse regular-season player stats to existing players.json.
Run: python add_2025.py
Requires: pip install pandas requests
"""
from pathlib import Path
import json
import pandas as pd
import requests
from io import BytesIO

URL = 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2025.csv'
OUT = Path(__file__).parent / 'public' / 'players.json'
CAPS = {'QB':32,'RB':32,'WR':50,'TE':32}
STATS = {'passing_yards':'Pass Yds','passing_tds':'Pass TD','passing_interceptions':'INT','carries':'Carries','rushing_yards':'Rush Yds','rushing_tds':'Rush TD','receptions':'Rec','targets':'Targets','receiving_yards':'Rec Yds','receiving_tds':'Rec TD','passing_2pt_conversions':'Pass 2PT','rushing_2pt_conversions':'Rush 2PT','receiving_2pt_conversions':'Rec 2PT','special_teams_tds':'ST TD'}
print('Downloading 2025 NFL player statistics from nflverse...',flush=True)
r=requests.get(URL,timeout=120);r.raise_for_status()
df=pd.read_csv(BytesIO(r.content),low_memory=False)
if 'team' in df.columns and 'recent_team' not in df.columns:df=df.rename(columns={'team':'recent_team'})
if 'interceptions' in df.columns and 'passing_interceptions' not in df.columns:df=df.rename(columns={'interceptions':'passing_interceptions'})
required={'player_id','player_display_name','position','recent_team','season','week','season_type','fantasy_points_ppr'}
missing=required-set(df.columns)
if missing:raise SystemExit('Source format changed, missing: '+', '.join(sorted(missing)))
df=df[(df.season==2025)&(df.season_type=='REG')&df.position.isin(CAPS)].dropna(subset=['player_id','player_display_name']).copy()
if df.empty:raise SystemExit('No 2025 regular-season data returned. Nothing changed.')
for c in STATS:
 if c not in df.columns:df[c]=0
 df[c]=pd.to_numeric(df[c],errors='coerce').fillna(0)
df['fantasy_points_ppr']=pd.to_numeric(df['fantasy_points_ppr'],errors='coerce').fillna(0)
df=df.sort_values('week')
agg={c:'sum' for c in STATS};agg.update({'fantasy_points_ppr':'sum','week':'nunique','player_display_name':'last','recent_team':'last'})
g=df.groupby(['season','player_id','position'],as_index=False).agg(agg).rename(columns={'week':'games'})
g['rank']=g.groupby(['season','position'])['fantasy_points_ppr'].rank(method='first',ascending=False).astype(int)
g=g[g.apply(lambda x:x['rank']<=CAPS[x['position']],axis=1)]
counts=g.groupby('position').size().to_dict()
if any(counts.get(pos,0)!=cap for pos,cap in CAPS.items()):raise SystemExit(f'Incomplete 2025 position groups: {counts}; nothing changed.')
records=[]
for _,row in g.iterrows():
 stats={label:round(float(row[c]),2) for c,label in STATS.items() if row[c]!=0}
 records.append({'id':f"2025-{row['player_id']}-{row['position']}",'name':str(row['player_display_name']),'team':str(row['recent_team']),'year':2025,'position':str(row['position']),'rank':int(row['rank']),'points':round(float(row['fantasy_points_ppr']),2),'games':int(row['games']),'stats':stats})
existing=json.loads(OUT.read_text(encoding='utf-8'))
existing=[p for p in existing if p['year']!=2025]
existing.extend(records)
existing.sort(key=lambda x:(x['year'],x['position'],x['rank']))
OUT.write_text(json.dumps(existing,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'SUCCESS: Added {len(records)} verified 2025 QB/RB/WR/TE seasons. Total records: {len(existing)}')
print('Kickers are still disabled pending a separately validated scoring formula.')
