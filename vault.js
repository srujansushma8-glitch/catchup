import {encryptJSON,decryptJSON} from './crypto.js';
/** localStorage wrapper that never throws (storage can be blocked). */
export const LS={
  get(k){try{return localStorage.getItem(k)}catch{return null}},
  set(k,v){try{localStorage.setItem(k,v);return true}catch{return false}},
  del(k){try{localStorage.removeItem(k)}catch{}}
};
const N='cu.fail.n',T='cu.fail.t';
/** Encrypted persistence plus brute-force lockout. */
export const vault={
  async save(st){if(st.GUEST||!st.KEY)return true;return LS.set('cu.blob',JSON.stringify(await encryptJSON(st.KEY,{SET:st.SET,CHATS:st.CHATS})))},
  async load(key){return decryptJSON(key,JSON.parse(LS.get('cu.blob')))},
  fail(){const n=(+LS.get(N)||0)+1;LS.set(N,n);if(n>=5)LS.set(T,Date.now()+Math.min(300,5*2**(n-4))*1000)},
  lockLeft(){return Math.max(0,Math.ceil(((+LS.get(T)||0)-Date.now())/1000))},
  reset(){LS.del(N);LS.del(T)},
  erase(){['cu.user','cu.blob',N,T].forEach(k=>LS.del(k))}
};
