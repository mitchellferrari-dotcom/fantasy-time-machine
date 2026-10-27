'use client';
import {useEffect,useState} from 'react';
import {Player,Pick,Slot,slots,sample,poolForSlot,totalPoints,estimatedRecord,dayKey,dailyRandom} from '../lib/game';

type Stage='position'|'year'|'player'|'reveal'|'finished';
type BoardEntry={name:string;score:number;date:string;mode:string;kicker:boolean};

export default function Home(){
 const [players,setPlayers]=useState<Player[]>([]),[loading,setLoading]=useState(true),[mode,setMode]=useState<'unlimited'|'daily'>('unlimited'),[started,setStarted]=useState(false);
 const [picks,setPicks]=useState<Pick[]>([]),[stage,setStage]=useState<Stage>('position'),[slot,setSlot]=useState<Slot|null>(null),[drawYears,setDrawYears]=useState<number[]>([]),[year,setYear]=useState<number|null>(null),[options,setOptions]=useState<Player[]>([]),[chosen,setChosen]=useState<Player|null>(null),[name,setName]=useState(''),[board,setBoard]=useState<BoardEntry[]>([]),[submitted,setSubmitted]=useState(false),[boardStatus,setBoardStatus]=useState(''),[shared,setShared]=useState(false);
 const [yearRerolls,setYearRerolls]=useState(2),[playerRerolls,setPlayerRerolls]=useState(2);
 const [dailyDate,setDailyDate]=useState(dayKey());
 const [dailyLocked,setDailyLocked]=useState(false);
 useEffect(()=>{
  const check=()=>{const today=dayKey();setDailyDate(today);setDailyLocked(localStorage.getItem('ftm-daily-started-'+today)==='1');};
  check();const interval=setInterval(check,30000);return ()=>clearInterval(interval);
 },[]);
 const isDaily=mode==='daily';
 const dailyDraw=(kind:string, index:number, slotValue:Slot, selectedYear:number|null=null)=>dailyRandom(
  [dailyDate,kind,index,slotValue,selectedYear??'',...picks.map(p=>p.slot+':'+p.player.id)].join('|')
 );
 function startDraft(){
  if(isDaily){
   const key='ftm-daily-started-'+dayKey();
   if(localStorage.getItem(key)==='1'){setDailyLocked(true);return;}
   localStorage.setItem(key,'1');setDailyLocked(true);
  }
  setStarted(true);
 }


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
 const roster=slots(),remaining=roster.filter(s=>!picks.some(p=>p.slot===s)),finished=stage==='finished';

 function chooseSlot(s:Slot){
  setSlot(s);
  setDrawYears(sample(availableYears.filter(y=>poolForSlot(s,players,y,picks).length>=5),3,isDaily?dailyDraw('years',0,s):Math.random));
  setStage('year');
 }

 function rerollYears(){
  if(!slot||yearRerolls<=0)return;
  const eligible=availableYears.filter(y=>poolForSlot(slot,players,y,picks).length>=5);
  const alternatives=eligible.filter(y=>!drawYears.includes(y));
  if(alternatives.length<3)return;
  setDrawYears(sample(alternatives,3,isDaily?dailyDraw('years',3-yearRerolls,slot):Math.random));
  setYearRerolls(n=>n-1);
 }

 function chooseYear(y:number){
  if(!slot)return;
  const pool=poolForSlot(slot,players,y,picks);
  if(pool.length<5)return;
  setYear(y);
  setOptions(sample(pool,5,isDaily?dailyDraw('players',0,slot,y):Math.random));
  setStage('player');
 }

 function rerollPlayers(){
  if(!slot||year===null||playerRerolls<=0)return;
  const pool=poolForSlot(slot,players,year,picks);
  const alternatives=pool.filter(p=>!options.some(o=>o.id===p.id));
  if(alternatives.length<5)return;
  setOptions(sample(alternatives,5,isDaily?dailyDraw('players',3-playerRerolls,slot,year):Math.random));
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
  const entry={name:name.trim().slice(0,24),score:+totalPoints(picks).toFixed(1),date:dayKey(),mode,kicker:false};
  if(shared){
   try{
    const r=await fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:entry.name,mode,kicker:false,picks:picks.map(p=>({slot:p.slot,id:p.player.id}))})});
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

 const leaderboard=Object.values(board.filter(e=>(mode==='daily'?e.date===dailyDate:true)&&e.mode===mode&&e.kicker===false).reduce<Record<string,BoardEntry>>((acc,e)=>{
  const key=e.name.toLowerCase();
  if(!acc[key]||acc[key].score<e.score)acc[key]=e;
  return acc;
 },{})).sort((a,b)=>b.score-a.score).slice(0,20);

 const record=estimatedRecord(picks);
 const finalScore=totalPoints(picks);
 const myRank=submitted ? leaderboard.findIndex(e=>e.name.toLowerCase()===name.trim().toLowerCase() && Math.abs(e.score-finalScore)<0.11)+1 : 0;
 const challengeUrl='https://www.fantasytimemachine.org/';
 const challengeText=`I scored ${finalScore.toFixed(1)} PPR points and went ${record.wins}-${record.losses} in Fantasy Time Machine! Can you beat my draft?\nPlay here: ${challengeUrl}`;
 const [shareStatus,setShareStatus]=useState('');

 async function copyChallenge(){
  try{await navigator.clipboard.writeText(challengeText);setShareStatus('Challenge copied!');}
  catch{setShareStatus('Copy unavailable. Share this link: '+challengeUrl);}
 }

 async function shareScorecard(){
  try{
   const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1500;
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
   ctx.fillStyle='#14243b';ctx.fillRect(0,0,1080,1500);
   ctx.fillStyle='#f2c65c';ctx.fillRect(0,0,1080,16);
   ctx.textBaseline='top';
   ctx.fillStyle='#f2c65c';ctx.font='bold 35px Arial';ctx.fillText('FANTASY TIME MACHINE',65,75);
   ctx.fillStyle='#ffffff';ctx.font='bold 66px Arial';ctx.fillText(isDaily?'MY DAILY DRAFT':'MY ALL-TIME DRAFT',65,155);
   ctx.fillStyle='#b8c7dc';ctx.font='28px Arial';ctx.fillText((isDaily?'DAILY HARD':'UNLIMITED HARD')+'  •  FULL PPR',65,255);
   ctx.fillStyle='#f2c65c';ctx.font='bold 90px Arial';ctx.fillText(finalScore.toFixed(1),65,325);
   ctx.fillStyle='#b8c7dc';ctx.font='27px Arial';ctx.fillText('TOTAL FANTASY POINTS',65,425);
   ctx.fillStyle='#ffffff';ctx.font='bold 44px Arial';ctx.fillText(`PROJECTED RECORD: ${record.wins}-${record.losses}`,65,505);
   if(myRank>0){ctx.fillStyle='#f2c65c';ctx.font='bold 31px Arial';ctx.fillText(`${isDaily?'TODAY\'S':'ALL-TIME'} RANK: #${myRank}`,65,575);}
   ctx.fillStyle='#b8c7dc';ctx.font='bold 26px Arial';ctx.fillText('MY LINEUP',65,650);
   let y=715;
   for(const pick of roster.map(s=>picks.find(p=>p.slot===s)).filter((p):p is Pick=>!!p)){
    ctx.fillStyle='#263c59';ctx.fillRect(55,y-10,970,76);
    ctx.fillStyle='#f2c65c';ctx.font='bold 26px Arial';ctx.fillText(pick.slot,75,y+8);
    ctx.fillStyle='#ffffff';ctx.font='bold 27px Arial';ctx.fillText(`${pick.player.name} (${pick.player.year}) · ${pick.player.position}${pick.player.rank}`,195,y+8,665);
    ctx.fillStyle='#ffffff';ctx.textAlign='right';ctx.font='bold 25px Arial';ctx.fillText(pick.player.points.toFixed(1),1000,y+8);ctx.textAlign='left';
    y+=86;
   }
   ctx.fillStyle='#f2c65c';ctx.font='bold 36px Arial';ctx.fillText('CAN YOU BEAT MY DRAFT?',65,1350);
   ctx.fillStyle='#ffffff';ctx.font='28px Arial';ctx.fillText('www.fantasytimemachine.org',65,1410);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw new Error('Could not generate image');
   const file=new File([blob],'fantasy-time-machine-scorecard.png',{type:'image/png'});
   if(navigator.share && navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file]});setShareStatus('Scorecard shared! Use COPY CHALLENGE LINK to send one clickable game link.');return;}
    catch(e){if((e as Error).name==='AbortError')return;}
   }
   const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setShareStatus('Scorecard downloaded!');
  }catch{setShareStatus('Could not create scorecard. Please try again.');}
 }


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
    <h2>Choose your challenge</h2>
    <div className="row">
     <button className={mode==='unlimited'?'selected':''} onClick={()=>setMode('unlimited')}>UNLIMITED HARD</button>
     <button className={mode==='daily'?'selected':''} onClick={()=>setMode('daily')}>DAILY HARD</button>
    </div>
    <p className="muted">Full PPR · 2 year rerolls + 2 player rerolls · {isDaily?"Same daily draws for everyone · One attempt per browser each Central Time day":"Fresh random draft every time · Unlimited attempts"}</p>
    <button className="primary" disabled={loading||players.length===0||(isDaily&&dailyLocked)} onClick={startDraft}>
     {loading?'LOADING DATA...':!players.length?'PLAYER DATA MISSING — SEE README':isDaily&&dailyLocked?'DAILY ATTEMPT USED — COME BACK TOMORROW':'START DRAFT'}
    </button>
   </section>
  :<>
   <div className="layout">
    <section className="panel game">
     <div className="bar">
      <span>ROUND {Math.min(picks.length+1,roster.length)} / {roster.length}</span>
      <span>{isDaily?"DAILY HARD":"UNLIMITED HARD"}</span>
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
      <div className="row">
       <button className="primary" onClick={shareScorecard}>SHARE SCORECARD ↗</button>
       <button onClick={copyChallenge}>COPY CHALLENGE LINK ↗</button>
      </div>
      {shareStatus&&<p className="muted" role="status">{shareStatus}</p>}
      <button className="primary" onClick={reset}>{isDaily?'BACK TO MODES →':'PLAY AGAIN →'}</button>
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
   <div className="bar"><span>{isDaily?"DAILY LEADERBOARD":"ALL-TIME LEADERBOARD"}</span><span>{isDaily?dailyDate+" · CENTRAL":"UNLIMITED HARD"}</span></div>
   <h2>{isDaily?"Today's scores":"All-time best"}</h2>
   <p className="muted">{isDaily?"One scored entry per name per day":"Highest score per name"}</p>
   {leaderboard.length?leaderboard.map((e,i)=><div className="boardrow" key={e.name}><span>#{i+1} · {e.name}</span><strong>{e.score.toFixed(1)}</strong></div>):<p className="muted">No scores yet. Be the first.</p>}
   <p className="warning">{shared?'Shared leaderboard connected. Scores and rosters are validated, but daily draft choices are deterministic in the browser but are not independently verified by the server.':'Local leaderboard only. Follow SETUP_V3.md to enable the shared Supabase leaderboard.'}</p>
  </section>

  <footer>FANTASY TIME MACHINE · HISTORICAL PPR · BUILT FOR THE GRIDIRON OBSESSED</footer>
 </main>;
}
