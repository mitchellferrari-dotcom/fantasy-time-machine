import {NextRequest, NextResponse} from 'next/server';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Player, Slot, slots, totalPoints, dayKey} from '../../../lib/game';

export const runtime='nodejs';
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured=()=>Boolean(url&&key&&/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(url!));
const headers=()=>({'apikey':key!,'Authorization':`Bearer ${key}`,'Content-Type':'application/json'});
const endpoint=()=>`${url!.replace(/\/$/,'')}/rest/v1/ftm_scores`;
const error=(message:string,status=400)=>NextResponse.json({error:message},{status});
let cached:Player[]|null=null;
async function players(){if(!cached)cached=JSON.parse(await readFile(path.join(process.cwd(),'public','players.json'),'utf8'));return cached!;}
export async function GET(){
 if(!configured())return error('Shared leaderboard not configured',503);
 try{
  const r=await fetch(`${endpoint()}?select=name,score,date,mode,kicker&order=score.desc&limit=500`,{headers:headers(),cache:'no-store'});
  if(!r.ok)return error('Leaderboard database unavailable',502);
  return NextResponse.json({entries:await r.json()},{headers:{'Cache-Control':'no-store'}});
 }catch{return error('Leaderboard unavailable',502)}
}
export async function POST(req:NextRequest){
 if(!configured())return error('Shared leaderboard not configured',503);
 let body:any;try{body=await req.json()}catch{return error('Invalid JSON')}
 if(typeof body.name!=='string'||!/^.{1,24}$/.test(body.name.trim())||/[<>\x00-\x1f]/.test(body.name))return error('Invalid name');
 if(body.mode!=='easy'&&body.mode!=='hard')return error('Invalid mode');
 if(typeof body.kicker!=='boolean'||!Array.isArray(body.picks))return error('Invalid roster');
 const expected=slots(body.kicker);
 if(body.picks.length!==expected.length)return error('Incomplete roster');
 const byId=new Map((await players()).map(p=>[p.id,p]));
 const picked: {slot:Slot;player:Player}[]=[];
 const usedNames=new Set<string>();const usedSlots=new Set<string>();
 for(const item of body.picks){
  if(!item||typeof item.id!=='string'||typeof item.slot!=='string'||!expected.includes(item.slot))return error('Invalid pick');
  const player=byId.get(item.id);if(!player)return error('Unknown player');
  const pos=item.slot.replace(/[12]/,'');
  if(item.slot==='FLEX'?!['RB','WR','TE'].includes(player.position):player.position!==pos)return error('Invalid position');
  if(usedSlots.has(item.slot)||usedNames.has(player.name.toLowerCase()))return error('Duplicate player or slot');
  usedSlots.add(item.slot);usedNames.add(player.name.toLowerCase());picked.push({slot:item.slot,player});
 }
 const score=Number(totalPoints(picked).toFixed(1));
 const entry={name:body.name.trim(),name_key:body.name.trim().toLowerCase(),date:dayKey(),mode:body.mode,kicker:body.kicker,score};
 try{
  // On conflict, update only if this is a better score. Implemented atomically in SQL RPC.
  const r=await fetch(`${url!.replace(/\/$/,'')}/rest/v1/rpc/ftm_submit_best`,{method:'POST',headers:headers(),body:JSON.stringify({p_name:entry.name,p_date:entry.date,p_mode:entry.mode,p_kicker:entry.kicker,p_score:entry.score})});
  if(!r.ok)return error('Could not save score to database',502);
  return NextResponse.json({ok:true,score});
 }catch{return error('Leaderboard unavailable',502)}
}

