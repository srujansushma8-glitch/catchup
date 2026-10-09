/**
 * Catchup core engine. Pure functions only: no DOM, no storage, no network.
 * Everything here is unit tested in Node (see /tests).
 */
/* ---------- 1. parse WhatsApp export ---------- */
function parse(raw){
  const re=/^\[?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?\]?\s*[-–]?\s*([^:]{1,40}?):\s([\s\S]*)$/i;
  const out=[];
  for(const line of raw.replace(/\u200e/g,'').split(/\r?\n/)){
    const m=line.match(re);
    if(m){
      let [,d,mo,y,h,mi,ap,s,t]=m; y=+y<100?2000+ +y:+y; h=+h;
      if(ap){ap=ap.toLowerCase();if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0}
      out.push({sender:s.trim(),date:new Date(y,+mo-1,+d,h,+mi),text:t});
    }else if(out.length&&line.trim()) out[out.length-1].text+='\n'+line;
  }
  return out.filter(m=>!/^(<media omitted>|you deleted|this message was deleted)/i.test(m.text.trim()));
}

/* ---------- 2. deadline detection (English + Hinglish + Kannada words) ---------- */
const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const CUE=/deadline|due\b|submit|before|\bby\b|till|until|last date|meeting|exam|viva|demo|test\b|review|moved|postpone|prepone|reach|bring|report|send|upload|bhej|karna/i;
function deadline(t,base){
  if(!CUE.test(t))return null;
  const s=t.toLowerCase();let d=new Date(base);d.setHours(23,59,0,0);let hit=false;
  if(/\b(today|tonight|aaj|indu)\b/.test(s))hit=true;
  else if(/\b(tomorrow|tmrw|kal|naale)\b/.test(s)){d.setDate(d.getDate()+1);hit=true}
  else if(/\bparso\b/.test(s)){d.setDate(d.getDate()+2);hit=true}
  else{
    const wd=DAYS.findIndex(x=>new RegExp('\\b'+x+'\\b|\\b'+x.slice(0,3)+'\\b').test(s));
    if(wd>=0){d.setDate(d.getDate()+(wd-d.getDay()+7)%7);hit=true}
    else{
      const o=s.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
      if(o){d.setDate(+o[1]);if(d<base)d.setMonth(d.getMonth()+1);hit=true}
    }
  }
  const tm=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if(tm){let h=+tm[1]%12;if(tm[3]==='pm')h+=12;d.setHours(h,+(tm[2]||0),0,0);hit=true}
  return hit?d:null;
}
/** Human readable distance to a deadline. */
const rel=h=>h<1?'within the hour':h<24?'in '+Math.round(h)+'h':'in '+Math.round(h/24)+'d';

/* ---------- 3. score every message ---------- */
function analyze(msgs,me){
  const names=me.map(x=>x.trim().toLowerCase()).filter(Boolean);
  const isMe=s=>names.some(n=>s.toLowerCase().includes(n));
  const nameRe=names.length?new RegExp('(^|[^a-z])@?('+names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![a-z])','i'):/$^/;
  const ref=msgs[msgs.length-1].date, items=[], ghosts=[];
  msgs.forEach((m,i)=>{
    if(isMe(m.sender))return;
    const t=m.text,s=t.toLowerCase(),why=[];let sc=0;
    const mine=nameRe.test(t);
    if(mine){sc+=4;why.push('mentions you')}
    if(/\b(urgent|asap|immediately|important|compulsory|mandatory|no extensions?|last date|deadline)\b/.test(s)){sc+=3;why.push('urgent wording')}
    const dl=deadline(t,m.date);
    if(dl){const h=(dl-ref)/36e5;if(h<0){sc+=2;why.push('deadline passed')}else{sc+=h<=24?5:h<=72?3:1;why.push('deadline '+rel(h))}}
    if(t.includes('?')&&mine&&!msgs.slice(i+1).some(x=>isMe(x.sender))){sc+=3;why.push("question you haven't answered")}
    const decision=/\b(decided|finali[sz]ed|confirmed|final|let['’]?s go with|approved|agreed)\b/.test(s);
    if(decision){sc+=2;why.push('decision')}
    if(/\b(please|pls|need to|needs to|must|should|submit|send|bring|upload|prepare|complete|bhej)\b/.test(s)&&(mine||dl)){sc+=2;why.push('task')}
    const tt=t.trim();
    if(/^[\W\d_]*$/.test(tt)||/^(ok+|okay|k|lol|haha+|thanks|thank you|yes|no|hmm+|nice)\W*$/i.test(tt))sc-=5;
    else if(tt.length<12)sc-=1;
    items.push({m,sc,why,dl,decision});
    if(/\b(i['’]?ll|i will)\b[^.?!]*\b(send|share|upload|bring|do|check|submit|update|finish)\b/.test(s)&&
       !msgs.slice(i+1).some(x=>x.sender===m.sender&&/\b(done|sent|shared|uploaded|submitted|finished|completed)\b/i.test(x.text)))ghosts.push(m);
  });
  return{items,ghosts,ref,total:msgs.length,people:new Set(msgs.map(m=>m.sender)).size};
}

const SAMPLE=`08/10/26, 9:05 am - Prof Mehta: Lab record submission moved to Saturday 5pm. No extensions.
08/10/26, 9:07 am - Ananya: 🙏🙏
08/10/26, 9:30 am - Rohit: guys canteen at 1?
08/10/26, 9:31 am - Kiran: lol yes
08/10/26, 11:12 am - Ananya: I'll share the IoT report draft tonight
08/10/26, 1:40 pm - Rohit: Hackathon team is finalised: Srujan, Ananya, Kiran. Final.
08/10/26, 1:41 pm - Kiran: ok
08/10/26, 3:02 pm - Kiran: kal 10am team meeting at the library, everyone reach on time
08/10/26, 3:05 pm - Rohit: haha nice
08/10/26, 5:20 pm - Ananya: lol
08/10/26, 8:15 pm - Rohit: I'll upload the budget sheet by evening
09/10/26, 8:40 am - Kiran: @Srujan can you set up the ESP32 demo board before the review?
09/10/26, 9:10 am - Prof Mehta: Mini project review is on 12th at 2pm. Attendance mandatory.
09/10/26, 10:25 am - Ananya: Srujan, aaj shaam tak slides bhej do please, I need to compile them tonight
09/10/26, 11:00 am - Rohit: anyone has last year's question papers?
09/10/26, 1:15 pm - Kiran: 👍
09/10/26, 2:50 pm - Rohit: Registration form for the hackathon is due 11th by 11:59pm, Srujan please fill yours
09/10/26, 4:30 pm - Ananya: Draft sent on drive, check it?
09/10/26, 5:45 pm - Prof Mehta: Reminder: Saturday 5pm is final. Submit on the portal.`;




export {parse,deadline,analyze,SAMPLE};
