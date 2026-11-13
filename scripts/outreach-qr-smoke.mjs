import path from 'node:path';
import {randomUUID} from 'node:crypto';
process.env.DATA_DIR=path.resolve('.test-data','qr-smoke-'+randomUUID());
process.env.WHATSAPP_MODE='simulation';
const {read,update}=await import('../lib/store.ts');
const {runOutreachWorker,stopOutreachWorker}=await import('./outreach-worker.mjs');
const id=randomUUID();
update(state=>{state.outreachSessions=[{id,name:'QR smoke test',enabled:true,testOnly:false,dailyLimit:1,generation:1,desiredConnected:true,status:'queued',updatedAt:Date.now()}];});
const running=runOutreachWorker();
const deadline=Date.now()+100000;
let passed=false;
try{
 while(Date.now()<deadline){const session=read().outreachSessions[0];if(session.status==='qr'&&session.qr?.startsWith('data:image/png;base64,')){console.log('PASS real WhatsApp Web QR generated; PNG bytes '+session.qr.length);passed=true;break;}if(session.status==='error')throw Error(session.error);await new Promise(resolve=>setTimeout(resolve,500));}
 if(!passed)throw Error('QR generation timeout. Current status: '+read().outreachSessions[0].status);
}finally{stopOutreachWorker();await running;}
