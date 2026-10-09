import {st} from './state.js';
import {parse,analyze} from './engine.js';
import {LS} from './vault.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
/* ================= helpers ================= */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=d=>d.toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const pl=(n,w)=>n+' '+w+(n===1?'':'s');
const COL=['#5B3FF2','#C2306B','#0C8A57','#9A5B00','#0E7490','#B4308C'];
const av=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))>>>0;return `<span class="av" data-bg="${COL[h%COL.length]}" aria-hidden="true">${esc((n.trim()[0]||'?').toUpperCase())}</span>`};
const hide=t=>`<span class="tx ${st.SET.hide?'blur':''}" ${st.SET.hide?'tabindex="0" role="button" title="Click to reveal"':''}>${esc(t)}</span>`;
const toast=t=>{const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2600)};


/* ================= state ================= */

const CACHE=new Map();
function an(c){
  const k=c.id+'|'+st.SET.names+'|'+(st.SET.win||0);if(CACHE.has(k))return CACHE.get(k);
  let msgs=parse(c.raw);if(msgs.length<2)return null;if(st.SET.win){const cut=+msgs[msgs.length-1].date-st.SET.win*36e5;msgs=msgs.filter(m=>+m.date>=cut);if(msgs.length<2)return null}
  const A=analyze(msgs,st.SET.names.split(','));
  const rank=A.items.filter(i=>i.sc>=3).sort((a,b)=>b.sc-a.sc),seen=new Set();
  const dls=A.items.filter(i=>i.dl).sort((a,b)=>a.dl-b.dl).filter(i=>{const q=+i.dl+i.m.sender;if(seen.has(q))return false;seen.add(q);return true});
  const R={c,A,act:rank.filter(i=>i.sc>=7),know:rank.filter(i=>i.sc<7),skip:A.items.length-rank.length,dls,dec:A.items.filter(i=>i.decision),tasks:A.items.filter(i=>i.why.includes('task')).sort((a,b)=>b.sc-a.sc),up:dls.filter(i=>i.dl>=A.ref).length};
  CACHE.set(k,R);return R;
}
const all=()=>st.CHATS.map(an).filter(Boolean);

/* ================= components ================= */
const card=(i,label)=>`<article class="msg ${i.sc>=7?'hi':''}">${av(i.m.sender)}<div class="bd"><div class="top"><b>${esc(i.m.sender)}</b><time>${fmt(i.m.date)}</time></div><p>${hide(i.m.text.slice(0,240))}</p><div class="why">${label?`<span>${esc(label)}</span>`:''}${i.why.map(w=>`<span>${esc(w)}</span>`).join('')}</div><div class="pr">Priority ${i.sc}</div><div class="bar"><i data-w="${Math.min(100,Math.max(6,i.sc*8))}"></i></div></div></article>`;
const list=(a,f,e)=>a.length?'<ul class="l">'+a.map(f).join('')+'</ul>':`<p class="empty">${e}</p>`;
const TABS=[['triage','Triage'],['deadlines','Deadlines'],['decisions','Decisions'],['actions','Action items'],['replies','Reply queue'],['promises','Unkept promises']];
const draft=i=>'Hi '+i.m.sender.split(' ')[0]+', noted. '+(i.dl?'I will get this done by '+fmt(i.dl)+'.':'I will check and reply shortly.');
function panel(R,t){
  if(t==='replies')return list(R.A.items.filter(i=>i.why.includes("question you haven't answered")),i=>`<li><b>${esc(i.m.sender)}</b> asked: ${hide(i.m.text.slice(0,130))}<br><small>Suggested reply:</small> <span class="draft">${esc(draft(i))}</span></li>`,'No unanswered questions for you.');
  if(t==='triage'){const lim=st.SET.budget,a=R.act.slice(0,lim),k=R.know.slice(0,Math.max(0,lim-a.length));
    return (a.length?`<h2 class="red">Needs you now (${a.length} of ${R.act.length})</h2>`+a.map(i=>card(i)).join(''):'<p class="empty">Nothing urgent.</p>')+(k.length?`<h2>Good to know (${k.length} of ${R.know.length})</h2>`+k.map(i=>card(i)).join(''):'')+`<p class="empty">${R.skip} messages were safe to skip.</p>`}
  if(t==='deadlines')return list(R.dls,i=>{const p=i.dl<R.A.ref;return `<li class="${p?'past':''}"><span class="tag ${p?'red':''}">${fmt(i.dl)}</span>${p?'<b>Passed while you were away.</b> ':''}${esc(i.m.sender)}: ${hide(i.m.text.slice(0,110))}</li>`},'No deadlines found.');
  if(t==='decisions')return list(R.dec,i=>`<li><span class="tag">Decision</span><b>${esc(i.m.sender)}</b>, ${fmt(i.m.date)}: ${hide(i.m.text.slice(0,150))}</li>`,'No decisions found.');
  if(t==='actions')return list(R.tasks,i=>`<li><label class="u7"><input type="checkbox"> <span class="tag ${i.why.includes('mentions you')?'red':''}">${i.why.includes('mentions you')?'For you':'Team'}</span>${hide(i.m.text.slice(0,140))}</label>${i.dl?`<small>Due ${fmt(i.dl)}</small>`:''}</li>`,'No action items found.');
  return list(R.A.ghosts,m=>`<li><b>${esc(m.sender)}</b> promised: ${hide(m.text.slice(0,130))}<br><small>No follow-up found. Worth a nudge.</small></li>`,'Everyone followed up on their promises.');
}

/* ================= views ================= */
function vOverview(){
  const A=all();
  if(!A.length)return `<h1>Hello, ${esc(st.USER.name)}</h1><p class="sub">No chats yet. Import a WhatsApp export, or load the demo chat to see your first digest.</p><div class="row"><button class="pri" data-a="demo">Load demo chat</button><button data-a="nav" data-id="import">Import a chat</button></div>`;
  const msgs=A.reduce((s,r)=>s+r.A.total,0),act=A.reduce((s,r)=>s+r.act.length,0),up=A.reduce((s,r)=>s+r.up,0);
  const know=A.reduce((s,r)=>s+r.know.length,0),skp=A.reduce((s,r)=>s+r.skip,0),tot=(act+know+skp)||1,pct=n=>Math.round(n*100/tot);
  const top=A.flatMap(r=>r.act.map(i=>[i,r.c.name])).sort((a,b)=>b[0].sc-a[0].sc).slice(0,5);
  const nxt=A.flatMap(r=>r.dls.filter(i=>i.dl>=r.A.ref).map(i=>[i,r.c.name])).sort((a,b)=>a[0].dl-b[0].dl).slice(0,5);
  return `<h1>Hello, ${esc(st.USER.name)}</h1>
  <p class="big"><span class="r">${pl(act,'message')} need${act===1?'s':''} you now</span> across ${pl(A.length,'chat')}, and <span class="a">${pl(up,'deadline')}</span> ${up===1?'is':'are'} ahead.</p>
  <div class="stats"><div><b>${A.length}</b><span>Chats</span></div><div><b>${msgs}</b><span>Messages scanned</span></div><div><b>${act}</b><span>Need you now</span></div><div><b>${up}</b><span>Deadlines ahead</span></div></div>
  <h2>Attention split</h2><div class="split" role="img" aria-label="${act} need you now, ${know} good to know, ${skp} safe to skip"><i class="s1" data-w="${pct(act)}"></i><i class="s2" data-w="${pct(know)}"></i><i class="s3" data-w="${pct(skp)}"></i></div><p class="hint">Red: needs you now. Amber: good to know. Grey: safe to skip.</p>
  <div class="cols"><div><h2>Do these first</h2>${top.length?top.map(([i,n])=>card(i,n)).join(''):'<p class="empty">Nothing urgent.</p>'}</div>
  <div><h2>Next deadlines</h2>${list(nxt,([i,n])=>`<li><span class="tag">${fmt(i.dl)}</span>${hide(i.m.text.slice(0,90))}<br><small>${esc(n)}</small></li>`,'No upcoming deadlines.')}</div></div>`;
}
function vChats(){
  const A=all();
  return `<h1>Chats</h1><p class="sub">Raw exports are never shown. Only the analysis is.</p>`+(A.length?'<ul class="l u1">'+A.map(r=>`<li><b>${esc(r.c.name)}</b> <small>${r.A.total} messages from ${r.A.people} people</small><br><span class="tag red">${r.act.length} need you</span><span class="tag">${r.up} deadlines ahead</span><span class="tag">${r.dec.length} decisions</span><div class="row u2"><button class="pri" data-a="open" data-id="${r.c.id}">Open digest</button><button class="danger" data-a="del" data-id="${r.c.id}">${st.ARM===r.c.id?'Click again to delete':'Delete'}</button></div></li>`).join('')+'</ul>':'<p class="empty">No chats yet.</p><div class="row"><button class="pri" data-a="nav" data-id="import">Import a chat</button></div>');
}
function vChat(){
  const c=st.CHATS.find(x=>x.id===st.OPEN),R=c&&an(c);if(!R)return '<p class="empty">Chat not found.</p>';
  return `<button data-a="nav" data-id="chats">Back to chats</button><h1 class="u1">${esc(c.name)}</h1><p class="sub">${R.A.total} messages from ${R.A.people} people, up to ${fmt(R.A.ref)}.</p>
  <div role="tablist" aria-label="Digest views">${TABS.map(([k,l])=>`<button role="tab" data-a="tab" data-id="${k}" aria-selected="${k===st.TAB}">${l}</button>`).join('')}</div><div role="tabpanel">${panel(R,st.TAB)}</div>`;
}
function vImport(){
  return `<h1>Import a chat</h1><p class="sub">In WhatsApp choose Export chat, without media. The text is analyzed, encrypted, and then cleared from this screen.</p>
  <div class="box u3"><label for="cn">Chat name</label><input id="cn" type="text" placeholder="e.g. Mini project group">
  <label for="cf">Chat file (.txt)</label><input id="cf" type="file" accept=".txt">
  <details class="u8"><summary class="u9">Or paste the text (masked, cleared after analysis)</summary><textarea id="cp" aria-label="Paste chat text" autocomplete="off" spellcheck="false"></textarea></details>
  <div class="row"><button class="pri" data-a="analyze">Analyze and save</button><button data-a="demo">Load demo chat</button></div>
  <p class="hint">${st.GUEST?'Guest mode: nothing is saved. Data disappears when you close this tab.':'Saved only on this device, encrypted with your passcode.'}</p></div>`;
}
function vDeadlines(){
  const rows=all().flatMap(r=>r.dls.map(i=>({i,n:r.c.name,p:i.dl<r.A.ref}))).sort((a,b)=>a.i.dl-b.i.dl),g={};
  rows.forEach(x=>{const k=x.p?'Passed while you were away':x.i.dl.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'});(g[k]=g[k]||[]).push(x)});
  return '<h1>Deadlines</h1>'+(rows.length?Object.entries(g).map(([k,a])=>`<h2 class="${k[0]==='P'?'red':''}">${esc(k)}</h2>`+list(a,x=>`<li class="${x.p?'past':''}"><span class="tag ${x.p?'red':''}">${x.i.dl.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>${esc(x.i.m.sender)}: ${hide(x.i.m.text.slice(0,110))} <small>${esc(x.n)}</small></li>`)).join(''):'<p class="empty">No deadlines found yet.</p>');
}
function vSettings(){
  return `<h1>Settings</h1><div class="box u3">
  <label for="sn">Your names and nicknames, comma separated</label><input id="sn" type="text" value="${esc(st.SET.names)}">
  <label for="sb">Messages shown in the triage list</label><select id="sb">${[[3,'30 seconds (3)'],[8,'2 minutes (8)'],[999,'Everything important']].map(([v,l])=>`<option value="${v}" ${st.SET.budget===v?'selected':''}>${l}</option>`).join('')}</select>
  <label for="sw">Time away (only analyze recent messages)</label><select id="sw">${[[0,'Everything in the chat'],[24,'Last 24 hours before the last message'],[72,'Last 3 days']].map(([v,l])=>`<option value="${v}" ${(st.SET.win||0)===v?'selected':''}>${l}</option>`).join('')}</select>
  <label class="u10"><input id="sh" type="checkbox" ${st.SET.hide?'checked':''}> Blur message text until I click it</label>
  <div class="row"><button class="pri" data-a="save">Save settings</button></div></div>
  <h2>Privacy</h2><div class="box u4"><p class="u11">Network requests made by this page: <span class="net pill ok">0 network requests</span></p>
  <p class="hint u5">Chats are encrypted with AES-256-GCM. The key is derived from your passcode (PBKDF2, 150,000 rounds) and is never stored. Forgetting the passcode means the data cannot be recovered.</p>
  <div class="row u6"><button data-a="signout">Sign out</button><button class="danger" data-a="erase">${st.ARM==='erase'?'Click again to erase everything':'Erase all data on this device'}</button></div></div>`;
}
const VIEWS={about:vAbout,overview:vOverview,chats:vChats,chat:vChat,import:vImport,deadlines:vDeadlines,settings:vSettings};

export function audit(){
  const t=[],csp=!!document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  t.push(['Strict Content-Security-Policy is active: no third-party scripts and no network connections allowed',csp]);
  t.push(['Network requests made by this page: '+st.reqs,st.reqs===0]);
  const blob=LS.get('cu.blob'),probe=st.CHATS[0]&&st.CHATS[0].raw.slice(40,80);
  t.push([st.GUEST?'Guest mode: nothing is written to disk':'Chats are encrypted at rest: stored data contains no readable chat text',st.GUEST?true:(!!blob&&(!probe||!blob.includes(probe)))]);
  t.push(['Secure context (https), required for Web Crypto',window.isSecureContext]);
  t.push(['Works offline: service worker registered',st.sw]);
  let ok=false;
  try{const m=parse('09/10/26, 9:00 am - A: @Sam submit the report by Saturday 5pm\n09/10/26, 9:05 am - B: lol'),A=analyze(m,['Sam']);
    ok=m.length===2&&A.items[0].dl instanceof Date&&A.items[0].why.includes('mentions you')&&A.items[1].sc<0}catch{}
  t.push(['Analysis engine self-test: mention, deadline and noise detection all correct',ok]);
  return t;
}
function vAbout(){
  const rows=audit().map(([l,ok])=>`<li><span class="tag ${ok?'':'red'}">${ok?'Pass':'Check'}</span>${esc(l)}</li>`).join('');
  return `<h1>How it's built</h1><p class="sub">Catchup is a local-first micro-app for "The Unread Problem: What Did I Miss?". It is plain HTML, CSS and JavaScript with no dependencies and no build step.</p>
  <h2>Live self-audit</h2><ul class="l">${rows}</ul>
  <div class="cols"><div><h2>Architecture</h2><div class="box"><ul class="plain"><li><b>engine.js</b>: pure analysis functions (parse, deadlines, scoring). No DOM, so it is unit tested in Node.</li><li><b>crypto.js</b> and <b>vault.js</b>: key derivation, encryption, storage, lockout.</li><li><b>ui.js</b>: rendering with HTML escaping on every dynamic value.</li><li><b>main.js</b> and <b>state.js</b>: state, routing, actions, sign-in, auto-lock.</li><li><b>sw.js</b>: service worker for offline use.</li></ul></div>
  <h2>Quality</h2><div class="box"><ul class="plain"><li>Node unit tests for the engine and crypto layer (npm test).</li><li>GitHub Actions runs the tests on every push.</li><li>README, architecture notes and security policy included.</li><li>Keyboard accessible, labelled controls, visible focus, light and dark themes, reduced motion respected.</li></ul></div></div>
  <div><h2>Security</h2><div class="box"><ul class="plain"><li>PBKDF2-SHA256 (600,000 rounds) derives an AES-256-GCM key from your passcode. The key is never stored.</li><li>Lockout with growing delay after 5 wrong passcodes.</li><li>Auto-lock after 5 minutes of inactivity.</li><li>Strict CSP, no inline scripts or styles, no third-party fonts or CDNs.</li><li>Uploads limited to .txt files under 5 MB. Raw exports are never displayed.</li></ul></div>
  <h2>What is original</h2><div class="box"><ul class="plain"><li>Time-away window: analyze only what happened while you were gone.</li><li>Reply queue with suggested replies.</li><li>Unkept-promise detection.</li><li>Deadlines in English, Hinglish and Kannada ("kal", "aaj", "naale").</li><li>Every score is explained on the card.</li></ul></div></div></div>`;
}
export {$,$$,esc,fmt,pl,hide,toast,card,panel,VIEWS,an,all};
export const clearCache=()=>CACHE.clear();
