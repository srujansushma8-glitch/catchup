/** Encryption helpers: PBKDF2-SHA256 -> AES-256-GCM, all via the browser Web Crypto API. */
const enc=new TextEncoder(),dec=new TextDecoder();
export const ITERATIONS=600000;
export const b64=u=>{let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s)};
export const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function derive(pass,salt,iterations=ITERATIONS){
  const k=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptJSON(key,obj){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(obj)));
  return {iv:b64(iv),ct:b64(new Uint8Array(ct))};
}
export async function decryptJSON(key,o){
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,unb64(o.ct))));
}
