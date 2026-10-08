import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestGate } from '../src/services/requestGate.ts';

test('older responses cannot replace the newly selected project', async () => {
 const gate=createRequestGate(); let displayed='';
 let finishOld!: (value:string)=>void;
 const oldResponse=new Promise<string>(resolve=>{finishOld=resolve;});
 const oldRequest=gate.begin();
 const oldLoad=oldResponse.then(value=>{if(gate.isCurrent(oldRequest)) displayed=value;});
 const newRequest=gate.begin();
 const newValue=await Promise.resolve('project B');
 if(gate.isCurrent(newRequest)) displayed=newValue;
 finishOld('project A'); await oldLoad;
 assert.equal(displayed,'project B');
});
test('leaving the board invalidates its pending response', async()=>{
 const gate=createRequestGate(); const request=gate.begin(); let updated=false;
 const response=Promise.resolve().then(()=>{if(gate.isCurrent(request))updated=true;});
 gate.invalidate(); await response; assert.equal(updated,false);
});

