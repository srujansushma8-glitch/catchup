import test from 'node:test';
import assert from 'node:assert/strict';
import {derive,encryptJSON,decryptJSON,b64,unb64} from '../js/crypto.js';

const salt=new Uint8Array(16).fill(7);

test('base64 helpers round trip',()=>{
  const u=Uint8Array.from([0,1,2,250,255]);
  assert.deepEqual([...unb64(b64(u))],[...u]);
});

test('encrypt then decrypt returns the original data',async()=>{
  const key=await derive('correct horse',salt,1000);
  const box=await encryptJSON(key,{chat:'secret text'});
  assert.ok(!JSON.stringify(box).includes('secret text'));
  assert.deepEqual(await decryptJSON(key,box),{chat:'secret text'});
});

test('a wrong passcode cannot decrypt',async()=>{
  const box=await encryptJSON(await derive('right',salt,1000),{a:1});
  await assert.rejects(decryptJSON(await derive('wrong',salt,1000),box));
});

test('each encryption uses a fresh IV',async()=>{
  const key=await derive('p',salt,1000);
  const a=await encryptJSON(key,{a:1}),b=await encryptJSON(key,{a:1});
  assert.notEqual(a.iv,b.iv);
});
