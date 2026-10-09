import {st} from './state.js';
import {$,$$,esc,toast,VIEWS,clearCache} from './ui.js';
import {SAMPLE,parse} from './engine.js';
import {derive,b64,unb64,ITERATIONS} from './crypto.js';
import {LS,vault} from './vault.js';



function upd(){$$('.net').forEach(n=>{n.textContent=st.reqs+' network request'+(st.reqs===1?'':'s');n.className='net pill '+(st.reqs?'warn':'ok')})}
const _f=window.fetch;window.fetch=(...a)=>{st.reqs++;upd();return _f.apply(window,a)};
const _o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(...a){st.reqs++;upd();return _o.apply(this,a)};

function go(v,id){st.VIEW=v;if(v==='chat')st.OPEN=id;st.ARM=null;$$('[data-v]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.v===(v==='chat'?'chats':v))));$('#view').innerHTML=VIEWS[v]();upd();window.scrollTo(0,0)}

/* ================= actions ================= */
async function addChat(name,raw,dest){
  if(parse(raw).length<2){toast('No messages found. Use a WhatsApp export without media.');return}
  const c={id:String(Date.now()),name:name||'Imported chat',raw,added:Date.now()};
  st.CHATS.push(c);const ok=await vault.save(st);
  if(!ok&&!st.GUEST)toast('Storage is blocked, so this chat will only last for this tab.');
  dest?go(dest):go('chat',c.id);
}
$('#view').addEventListener('click',async e=>{
  const x=e.target.closest('.tx.blur');if(x){x.classList.toggle('show');return}
  const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,id=t.dataset.id;
  if(a==='nav')go(id);
  else if(a==='open'){st.TAB='triage';go('chat',id)}
  else if(a==='tab'){st.TAB=id;go('chat',st.OPEN)}
  else if(a==='demo')await addChat('Demo: college project group',SAMPLE,'overview');
  else if(a==='analyze'){
    const f=$('#cf').files[0];
    if(f&&(f.size>5e6||!/\.txt$/i.test(f.name))){toast('Use a .txt export under 5 MB.');return}
    let raw=f?await f.text():$('#cp').value;
    await addChat($('#cn').value.trim().slice(0,60),raw.slice(0,5e6));
  }
  else if(a==='del'){if(st.ARM!==id){st.ARM=id;go('chats');st.ARM=id;$('#view').innerHTML=VIEWS.chats();return}st.CHATS=st.CHATS.filter(c=>c.id!==id);st.ARM=null;await vault.save(st);toast('Chat deleted');go('chats')}
  else if(a==='save'){st.SET.names=$('#sn').value;st.SET.budget=+$('#sb').value;st.SET.hide=$('#sh').checked;st.SET.win=+$('#sw').value;clearCache();await vault.save(st);toast('Settings saved');go('settings')}
  else if(a==='signout')signOut();
  else if(a==='erase'){if(st.ARM!=='erase'){st.ARM='erase';$('#view').innerHTML=VIEWS.settings();return}vault.erase();signOut()}
});
$('#view').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.tx.blur'))e.target.classList.toggle('show')});
$$('[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
$('#out').onclick=()=>signOut();

/* ================= auth ================= */
function signOut(){st.KEY=null;st.USER=null;st.CHATS=[];st.GUEST=false;clearCache();$('#shell').hidden=true;$('#auth').hidden=false;gate()}
function enter(){$('#auth').hidden=true;$('#shell').hidden=false;$('#who').textContent=(st.GUEST?'Guest: ':'Signed in as ')+st.USER.name;go('overview')}
function gate(){
  const u=LS.get('cu.user'),has=u&&LS.get('cu.blob');let name='';if(has){try{name=JSON.parse(u).name}catch{}}
  const canCrypto=!!(window.crypto&&crypto.subtle);
  $('#gate').innerHTML=`<h1 class="u14">${has?'Welcome back':'Create your private profile'}</h1>
  <p class="sub u12">${has?`Signed out as <b>${esc(name)}</b>. Enter your passcode to unlock your chats.`:'This profile lives only on this device. There is no server account.'}</p>
  <form id="af" autocomplete="off">${has?'':'<label for="an">Display name</label><input id="an" type="text" required maxlength="30">'}
  <label for="ap">Passcode${has?'':' (at least 6 characters)'}</label><input id="ap" type="password" required minlength="6" autocomplete="${has?'current-password':'new-password'}">
  <p class="err" id="ae" role="alert"></p>
  <div class="row u13"><button class="pri" type="submit" ${canCrypto?'':'disabled'}>${has?'Unlock dashboard':'Create profile'}</button><button type="button" id="guest">Explore with demo data</button></div></form>
  <p class="hint">${canCrypto?'Demo mode needs no sign-in and saves nothing.':'Encryption needs a secure (https) page. Demo mode still works.'}</p>
  ${has?'<p class="hint"><a href="#" id="reset">Not you? Reset this device</a></p>':''}`;
  $('#guest').onclick=()=>{st.GUEST=true;st.USER={name:'Guest'};st.SET={names:'Srujan, Sru',budget:8,hide:true,win:0};st.CHATS=[];enter();$('#view').querySelector('[data-a=demo]')?.click()};
  if($('#reset'))$('#reset').onclick=e=>{e.preventDefault();vault.erase();gate()};
  $('#af').onsubmit=async e=>{
    e.preventDefault();const pass=$('#ap').value,err=$('#ae');err.textContent='';
    try{
      if(has){if(vault.lockLeft()>0){err.textContent='Too many attempts. Try again in '+vault.lockLeft()+'s.';return}
        const salt=unb64(JSON.parse(u).salt),key=await derive(pass,salt,JSON.parse(u).it||150000);
        let d;try{d=await vault.load(key)}catch{vault.fail();err.textContent='Wrong passcode. Try again.'+(vault.lockLeft()?' Locked for '+vault.lockLeft()+'s.':'');return}vault.reset();
        st.KEY=key;st.USER={name};st.SET=d.SET;st.CHATS=d.CHATS;st.GUEST=false;enter();
      }else{
        if(pass.length<6){err.textContent='Use at least 6 characters.';return}
        const nm=$('#an').value.trim()||'You',salt=crypto.getRandomValues(new Uint8Array(16));
        st.KEY=await derive(pass,salt);st.USER={name:nm};st.SET={names:nm,budget:8,hide:true,win:0};st.CHATS=[];st.GUEST=false;
        if(!(await vault.save(st))||!LS.set('cu.user',JSON.stringify({name:nm,salt:b64(salt),it:ITERATIONS}))){err.textContent='Browser storage is blocked. Use demo mode instead.';st.KEY=null;return}
        enter();
      }
    }catch(x){err.textContent='Something went wrong: '+x.message}
  };
}
gate();

/* ---------- bootstrap: dynamic styles, offline, theme, idle lock ---------- */
const applyDyn=()=>{$$('[data-w]').forEach(e=>{e.style.width=e.dataset.w+'%'});$$('[data-bg]').forEach(e=>{e.style.background=e.dataset.bg})};
new MutationObserver(applyDyn).observe($('#view'),{childList:true,subtree:true});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').then(()=>{st.sw=true}).catch(()=>{});
const saved=LS.get('cu.theme');if(saved)document.documentElement.dataset.theme=saved;
$('#theme').onclick=()=>{const d=document.documentElement,dark=d.dataset.theme==='dark'||(!d.dataset.theme&&window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches);d.dataset.theme=dark?'light':'dark';LS.set('cu.theme',d.dataset.theme)};
let idle;const bump=()=>{clearTimeout(idle);if(st.USER&&!st.GUEST)idle=setTimeout(()=>{signOut();toast('Locked after 5 minutes of inactivity')},300000)};
['click','keydown','pointermove'].forEach(e=>addEventListener(e,bump,{passive:true}));
