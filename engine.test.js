import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,deadline,analyze,SAMPLE} from '../js/engine.js';

const line=(t,s,m)=>`09/10/26, ${t} - ${s}: ${m}`;

test('parse reads 12h and 24h timestamps and joins multi-line messages',()=>{
  const m=parse([line('9:05 pm','Ann','hello'),'second line','10/10/26, 07:30 - Bob: hi'].join('\n'));
  assert.equal(m.length,2);
  assert.equal(m[0].date.getHours(),21);
  assert.match(m[0].text,/second line/);
  assert.equal(m[1].date.getHours(),7);
});

test('deadline resolves weekdays, times and ordinals',()=>{
  const base=new Date(2026,9,9,10,0); // Friday
  const d=deadline('submit by Saturday 5pm',base);
  assert.equal(d.getDay(),6);assert.equal(d.getHours(),17);
  assert.equal(deadline('due 12th at 2pm',base).getDate(),12);
  assert.equal(deadline('lunch was nice',base),null);
});

test('deadline understands Hinglish and Kannada time words',()=>{
  const base=new Date(2026,9,9,10,0);
  assert.equal(deadline('kal 10am meeting',base).getDate(),10);
  assert.equal(deadline('naale submit karna',base).getDate(),10);
  assert.equal(deadline('aaj shaam tak bhej do',base).getDate(),9);
});

test('analyze scores mentions and deadlines above small talk',()=>{
  const m=parse([line('9:00 am','A','@Sam please submit the report by Saturday 5pm'),line('9:05 am','B','lol')].join('\n'));
  const A=analyze(m,['Sam']);
  assert.ok(A.items[0].sc>=7);
  assert.ok(A.items[0].why.includes('mentions you'));
  assert.ok(A.items[1].sc<0);
});

test('messages sent by the user are never flagged',()=>{
  const m=parse([line('9:00 am','Sam','I will send it tonight'),line('9:01 am','A','ok')].join('\n'));
  assert.equal(analyze(m,['Sam']).items.length,1);
});

test('decisions and unkept promises are detected',()=>{
  const m=parse([line('9:00 am','A','Team is finalised, final.'),line('9:01 am','B',"I'll upload the sheet by evening"),line('9:02 am','C','ok')].join('\n'));
  const A=analyze(m,['Sam']);
  assert.ok(A.items[0].decision);
  assert.equal(A.ghosts.length,1);
});

test('a promise followed by a completion message is not a ghost task',()=>{
  const m=parse([line('9:00 am','B',"I'll upload the sheet"),line('9:30 am','B','Uploaded, done')].join('\n'));
  assert.equal(analyze(m,['Sam']).ghosts.length,0);
});

test('bundled sample chat produces urgent items for Srujan',()=>{
  const A=analyze(parse(SAMPLE),['Srujan','Sru']);
  assert.ok(A.items.filter(i=>i.sc>=7).length>=3);
  assert.equal(A.total,19);
});
