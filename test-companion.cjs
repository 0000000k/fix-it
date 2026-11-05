'use strict';
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const http=require('node:http');
const readline=require('node:readline');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fixit-test-'));
const port=39000+Math.floor(Math.random()*600);
const child=spawn(process.execPath,[path.join(__dirname,'companion.js')],{env:{...process.env,FIXIT_DATA_DIR:root,FIXIT_PORT:String(port)},stdio:['pipe','pipe','pipe']});
const responses=new Map();
const lines=readline.createInterface({input:child.stdout});
lines.on('line',line=>{try{const item=JSON.parse(line);if(item.id!==undefined){const done=responses.get(item.id);if(done){responses.delete(item.id);done(item);}}}catch(e){throw e;}});
let seq=0;
function rpc(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('MCP call timed out')),2500);responses.set(id,x=>{clearTimeout(timeout);resolve(x);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
function request(method,pathname,code,data){return new Promise((resolve,reject)=>{const request=http.request({method,hostname:'127.0.0.1',port,path:pathname,headers:{'X-Fix-It-Code':code,'Content-Type':'application/json'}},res=>{let content='';res.on('data',x=>content+=x);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(content)});}catch(e){reject(e);}});});request.on('error',reject);request.end(data?JSON.stringify(data):undefined);});}
async function wait(){for(let n=0;n<40;n++){try{const r=await request('GET','/health','',null);if(r.body.ok)return;}catch(e){}await new Promise(r=>setTimeout(r,60));}throw Error('Server did not start');}
(async()=>{try{
 await wait();
 const code=JSON.parse(fs.readFileSync(path.join(root,'connection.json'))).connectionCode;
 assert.equal((await request('GET','/v1/status','wrong')).status,401);
 assert.equal((await request('GET','/v1/status',code)).status,200);
 const initialized=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});
 assert.equal(initialized.result.serverInfo.name,'fix-it');
 const list=await rpc('tools/list');assert.ok(list.result.tools.some(x=>x.name==='fixit_submit_findings'));
 const scan=await request('POST','/v1/scans',code,{scope:'page',total:2,texts:[{id:'1:2',text:'Log in',layer:'CTA',parent:'Login page'},{id:'1:3',text:'Start',layer:'Button',parent:'Dashboard'}],ruleFindings:[{nodeId:'1:2',category:'Terminology',avoid:'Log in',prefer:'Sign in'}],knowledge:{glossary:[{avoid:'Log in',prefer:'Sign in'}],guide:{name:'UX Style',text:'Prefer Sign in'},sources:[{id:'guide-1',name:'Error guidance',text:'Explain next steps.'}]}});
 assert.equal(scan.status,200);assert.equal(scan.body.submitted,2);
 const scanId=scan.body.scanId;
 const scans=await rpc('tools/call',{name:'fixit_list_scans',arguments:{}});
 assert.equal(JSON.parse(scans.result.content[0].text).scans[0].id,scanId);
 const read=await rpc('tools/call',{name:'fixit_get_scan',arguments:{scan_id:scanId,offset:0,limit:1}});
 assert.equal(JSON.parse(read.result.content[0].text).texts[0].text,'Log in');
 const readGuide=await rpc('tools/call',{name:'fixit_read_guide',arguments:{scan_id:scanId,guide_id:'guide-1'}});
 assert.match(JSON.parse(readGuide.result.content[0].text).text,/next steps/);
 const invalid=await rpc('tools/call',{name:'fixit_submit_findings',arguments:{scan_id:scanId,findings:[{node_id:'not-in-scan',severity:'high',reason:'Incorrect'}]}});
 assert.equal(invalid.result.isError,true);
 const submit=await rpc('tools/call',{name:'fixit_submit_findings',arguments:{scan_id:scanId,findings:[{node_id:'1:2',category:'Terminology',severity:'medium',reason:'The approved word is Sign in.',suggestion:'Sign in',guideline_source:'UX Style',confidence:'high'}]}});
 assert.equal(JSON.parse(submit.result.content[0].text).saved,1);
 const result=await request('GET','/v1/scans/'+scanId+'/findings',code);
 assert.equal(result.body.findings.length,1);assert.equal(result.body.findings[0].suggestion,'Sign in');
 assert.equal(result.body.status,'complete');
 console.log('PASS manifest-independent MCP + HTTP full scan → findings flow.');
}finally{child.kill('SIGTERM');fs.rmSync(root,{recursive:true,force:true});}})().catch(err=>{console.error(err);process.exitCode=1;child.kill();});
