
'use client';
import {useEffect,useState} from 'react';
import {Player,Pick,Slot,slots,sample,poolForSlot,totalPoints,estimatedRecord,dayKey} from '../lib/game';

type Stage='position'|'year'|'player'|'reveal'|'finished';
type BoardEntry={name:string;score:number;date:string;mode:string;kicker:boolean};

export default function Home(){
 const [players,setPlayers]=useState<Player[]>([]),[loading,setLoading]=useState(true),[mode,setMode]=useState<'easy'|'hard'>('hard'),[kicker,setKicker]=useState(false),[started,setStarted]=useState(false);
 const [picks,setPicks]=useState<Pick[]>([]),[stage,setStage]=useState<Stage>('position'),[slot,setSlot]=useState<Slot|null>(null),[drawYears,setDrawYears]=useState<number[]>([]),[year,setYear]=useState<number|null>(null),[options,setOptions]=useState<Player[]>([]),[chosen,setChosen]=useState<Player|null>(null),[name,setName]=useState(''),[board,setBoard]=useState<BoardEntry[]>([]),[submitted,setSubmitted]=useState(false),[boardStatus,setBoardStatus]=useState(''),[shared,setShared]=useState(false);
 const [yearRerolls,setYearRerolls]=useState(2),[playerRerolls,setPlayerRerolls]=useState(2);

 useEffect(()=>{fetch('/players.json').then(r=>r.json()).then((p:Player[])=>setPlayers(p)).catch(()=>{}).finally(()=>setLoading(false));refreshBoard()},[]);

 async function refreshBoard(){
  try{
   const r=await fetch('/api/leaderboard',{cache:'no-store'});
   if(!r.ok)throw Error('not configured');
   const data=await r.json();
   setBoard(data.entries);
   setShared(true);
   setBoardStatus('');
  }catch{
   setShared(false);
   try{setBoard(JSON.parse(localStorage.getItem('ftm-board')||'[]'))}catch{setBoard([])}
  }
 }

 const availableYears=Array.from(new Set(players.map(p=>p.year))).sort((a,b)=>a-b);
 const hasKickers=availableYears.length>0&&availableYears.every(y=>players.some(p=>p.year===y&&p.position==='K'));
 const roster=slots(kicker),remaining=roster.filter(s=>!picks.some(p=>p.slot===s)),finished=stage==='finished';

 function chooseSlot(s:Slot){
  setSlot(s);
  setDrawYears(sample(availableYears.filter(y=>poolForSlot(s,players,y,picks).length>=5),3));
  setYearRerolls(2);
  setPlayerRerolls(2);
  setStage('year');
 }

 function rerollYears(){
  if(!slot||yearRerolls<=0)return;
  const eligible=availableYears.filter(y=>poolForSlot(slot,players,y,picks).length>=5);
  const alternatives=eligible.filter(y=>!drawYears.includes(y));
  if(alternatives.length<3)return;
  setDrawYears(sample(alternatives,3));
  setYearRerolls(n=>n-1);
 }

 function chooseYear(y:number){
  if(!slot)return;
  const pool=poolForSlot(slot,players,y,picks);
  if(pool.length<5)return;
  setYear(y);
  setOptions(sample(pool,5));
  setStage('player');
 }

 function rerollPlayers(){
  if(!slot||year===null||playerRerolls<=0)return;
  const pool=poolForSlot(slot,players,year,picks);
  const alternatives=pool.filter(p=>!options.some(o=>o.id===p.id));
  if(alternatives.length<5)return;
  setOptions(sample(alternatives,5));
  setPlayerRerolls(n=>n-1);
 }

 function choosePlayer(p:Player){
  setChosen(p);
  setPicks(old=>[...old,{slot:slot!,player:p}]);
  setStage('reveal');
 }

 function next(){
  setChosen(null);
  setSlot(null);
  setYear(null);
  setOptions([]);
  setStage(picks.length===roster.length?'finished':'position');
 }

 function reset(){
  setPicks([]);
  setStage('position');
  setSlot(null);
  setYear(null);
  setDrawYears([]);
  setOptions([]);
  setChosen(null);
  setStarted(false);
  setSubmitted(false);
  setBoardStatus('');
  setYearRerolls(2);
  setPlayerRerolls(2);
 }

 async function submit(){
  if(!name.trim()||!finished||submitted)return;
  setBoardStatus('Saving...');
  const entry={name:name.trim().slice(0,24),score:+totalPoints(picks).toFixed(1),date:dayKey(),mode,kicker};
  if(shared){
   try{
    const r=await fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:entry.name,mode,kicker,picks:picks.map(p=>({slot:p.slot,id:p.player.id}))})});
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Could not save');
    setSubmitted(true);
    await refreshBoard();
    setBoardStatus('Saved to shared leaderboard');
    return;
   }catch(e){
    setBoardStatus(e instanceof Error?e.message:'Could not save');
    return;
   }
  }
  const updated=[...board,entry];
  localStorage.setItem('ftm-board',JSON.stringify(updated));
  setBoard(updated);
  setSubmitted(true);
  setBoardStatus('Saved on this device only');
 }

 const leaderboard=Object.values(board.filter(e=>e.date===dayKey()&&e.mode===mode&&e.kicker===kicker).reduce<Record<string,BoardEntry>>((acc,e)=>{
  const key=e.name.toLowerCase();
  if(!acc[key]||acc[key].score<e.score)acc[key]=e;
  return acc;
 },{})).sort((a,b)=>b.score-a.score).slice(0,20);

 const record=estimatedRecord(picks);
 const canRerollYears=!!slot&&availableYears.filter(y=>poolForSlot(slot,players,y,picks).length>=5&&!drawYears.includes(y)).length>=3;
 const canRerollPlayers=!!slot&&year!==null&&poolForSlot(slot,players,year,picks).filter(p=>!options.some(o=>o.id===p.id)).length>=5;

 return <main>
  <header>
   <div className="eyebrow">EST. 2000 — 2025 · THE ULTIMATE FANTASY DRAFT</div>
   <h1>FANTASY<br/><span>TIME MACHINE</span></h1>
   <p>One position. Three seasons. Five players. Build a legendary roster.</p>
  </header>

  {!started?
   <section className="panel intro">
    <h2>Set your rules</h2>
    <div className="row">
     <button className={mode==='easy'?'selected':''} onClick={()=>setMode('easy')}>EASY · STATS SHOWN</button>
     <button className={mode==='hard'?'selected':''} onClick={()=>setMode('hard')}>HARD · NO STATS</button>
    </div>
    <label className="toggle">
     <input type="checkbox" disabled={!hasKickers} checked={kicker} onChange={e=>setKicker(e.target.checked)}/>
     Include kicker {!hasKickers&&'(unavailable: no verified kicker data)'}
    </label>
    <p className="muted">Full PPR · 14-game regular season + 2 playoff rounds · Unlimited attempts</p>
    <button className="primary" disabled={loading||players.length===0} onClick={()=>setStarted(true)}>
     {loading?'LOADING DATA...':players.length?'START DRAFT':'PLAYER DATA MISSING — SEE README'}
    </button>
   </section>
  :<>
   <div className="layout">
    <section className="panel game">
     <div className="bar">
      <span>ROUND {Math.min(picks.length+1,roster.length)} / {roster.length}</span>
      <span>{mode.toUpperCase()} · KICKER {kicker?'ON':'OFF'}</span>
     </div>

     {stage==='position'&&<>
      <h2>Choose a position</h2>
      <p className="muted">Pick the roster spot you want to draft next.</p>
      <div className="choices">
       {remaining.map(s=><button key={s} onClick={()=>chooseSlot(s)}>{s}</button>)}
      </div>
     </>}

     {stage==='year'&&<>
      <h2>Choose a season for {slot}</h2>
      <p className="muted">Three randomly drawn seasons. Choose wisely.</p>
      <div className="choices years">
       {drawYears.map(y=><button key={y} onClick={()=>chooseYear(y)}>{y}</button>)}
      </div>
      <button className="quiet reroll-button" disabled={yearRerolls===0||!canRerollYears} onClick={rerollYears}>
       ↻ REROLL YEARS ({yearRerolls} LEFT)
      </button>
      {yearRerolls>0&&!canRerollYears&&<p className="muted">No more completely new sets of three seasons available.</p>}
      <button className="quiet" onClick={()=>setStage('position')}>← Back to positions</button>
     </>}

     {stage==='player'&&<>
      <h2>{year} · Choose your {slot}</h2>
      <p className="muted">Pick one of these five players. Rank and fantasy points are revealed after you lock in.</p>
      <div className="playerlist">
       {options.map(p=><button className="player" key={p.id} onClick={()=>choosePlayer(p)}>
        <span>
         <strong>{p.name}</strong>
         <small>{p.team} · {p.position} · {p.year}</small>
         {mode==='easy'&&<small className="stats">{Object.entries(p.stats).map(([k,v])=>`${k}: ${v.toLocaleString()}`).join(' · ')}</small>}
        </span>
        <b>SELECT →</b>
       </button>)}
      </div>
      <button className="quiet reroll-button" disabled={playerRerolls===0||!canRerollPlayers} onClick={rerollPlayers}>
       ↻ REROLL PLAYERS ({playerRerolls} LEFT)
      </button>
      {playerRerolls>0&&!canRerollPlayers&&<p className="muted">No more completely new sets of five players available.</p>}
     </>}

     {stage==='reveal'&&chosen&&<>
      <div className="eyebrow">PICK LOCKED IN</div>
      <h2>{chosen.name}</h2>
      <p className="muted">{chosen.team} · {chosen.year}</p>
      <div className="results">
       <div><small>POSITION RANK</small><strong>{chosen.position}{chosen.rank}</strong></div>
       <div><small>FULL PPR POINTS</small><strong>{chosen.points.toFixed(1)}</strong></div>
      </div>
      <button className="primary" onClick={next}>{picks.length===roster.length?'SEE FINAL RESULTS →':'NEXT ROUND →'}</button>
     </>}

     {finished&&<>
      <div className="eyebrow">YOUR SEASON IS COMPLETE</div>
      <h2>THE FINAL VERDICT</h2>
      <div className="results">
       <div><small>PROJECTED REGULAR-SEASON RECORD</small><strong>{record.wins}-{record.losses}</strong></div>
       <div><small>FANTASY POINTS</small><strong>{totalPoints(picks).toFixed(1)}</strong></div>
      </div>
      <p className="muted">Playoffs: Semifinal — {record.semifinal}; Championship — {record.championship}.</p>
      <p className="muted">16-game normalized weekly average: {record.weekly.toFixed(1)} pts. Record and playoff results are illustrative estimates, not historical matchup simulations.</p>
      <div className="row">
       <input placeholder="Your leaderboard name" value={name} maxLength={24} onChange={e=>setName(e.target.value)}/>
       <button onClick={submit} disabled={submitted||!name.trim()}>{submitted?'SAVED':'SUBMIT SCORE'}</button>
      </div>
      {boardStatus&&<p className="muted" role="status">{boardStatus}</p>}
      <button className="primary" onClick={reset}>PLAY AGAIN →</button>
     </>}
    </section>

    <aside className="panel">
     <div className="bar"><span>YOUR LINEUP</span><span>{picks.length}/{roster.length}</span></div>
     {roster.map(s=>{
      const pick=picks.find(p=>p.slot===s);
      return <div className="roster" key={s}>
       <b>{s}</b>
       <span>{pick?<><strong>{pick.player.name}</strong><small>{pick.player.year} · {pick.player.position}{pick.player.rank}</small></>:'— empty —'}</span>
       <b>{pick?pick.player.points.toFixed(1):'—'}</b>
      </div>
     })}
     <div className="total"><span>TOTAL PPR</span><strong>{totalPoints(picks).toFixed(1)}</strong></div>
    </aside>
   </div>
  </>}

  <section className="panel leaderboard">
   <div className="bar"><span>DAILY LEADERBOARD</span><span>{dayKey()} · EASTERN</span></div>
   <h2>Today's best</h2>
   <p className="muted">{mode.toUpperCase()} · KICKER {kicker?'ON':'OFF'} · Highest score per name</p>
   {leaderboard.length?leaderboard.map((e,i)=><div className="boardrow" key={e.name}><span>#{i+1} · {e.name}</span><strong>{e.score.toFixed(1)}</strong></div>):<p className="muted">No scores yet. Be the first.</p>}
   <p className="warning">{shared?'Shared leaderboard connected. Scores and rosters are validated, but randomized draft choices are not yet independently verified by the server.':'Local leaderboard only. Follow SETUP_V3.md to enable the shared Supabase leaderboard.'}</p>
  </section>

  <footer>FANTASY TIME MACHINE · HISTORICAL PPR · BUILT FOR THE GRIDIRON OBSESSED</footer>
 </main>;
}

