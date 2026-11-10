'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const textMessages=[];
const values=new Map();
let posted=null;
const textNode={type:'TEXT',id:'22:17',characters:'Log in to continue',name:'Primary Button',parent:{type:'FRAME',id:'12:1',name:'Auth screen',parent:{type:'PAGE',id:'0:1',name:'Main'}}};
const figma={
 showUI:(html,options)=>{assert.match(html,/<!doctype html>/i);assert.equal(options.width,430)},
 currentPage:{id:'0:1',name:'Main',selection:[],loadAsync:async()=>{},findAllWithCriteria:()=>[textNode]},
 ui:{postMessage:m=>textMessages.push(m),onmessage:null},
 clientStorage:{getAsync:async key=>values.get(key),setAsync:async(key,value)=>{values.set(key,value)}},
 getNodeByIdAsync:async()=>textNode,
 viewport:{scrollAndZoomIntoView:()=>{}}
};
const mockFetch=async(url,options)=>{
 assert.match(url,/localhost:38412/);
 if(url.endsWith('/v1/evals/run'))return {ok:true,json:async()=>({report:{summary:{total:1,regressions:0,improvements:0},cases:[]}})};
 if(url.endsWith('/v1/evals/latest'))return {ok:true,json:async()=>({report:{summary:{total:1,regressions:0,improvements:0},cases:[]}})};
 if(url.endsWith('/v1/status'))return {ok:true,json:async()=>({connected:true,latest:null})};
 if(url.endsWith('/v1/scans')){posted=JSON.parse(options.body);return {ok:true,json:async()=>({scanId:'scan-123456789abc',submitted:posted.texts.length,total:posted.total})};}
 if(url.endsWith('/findings'))return {ok:true,json:async()=>({findings:[{nodeId:'22:17',category:'Terminology',severity:'medium',suggestion:'Sign in',reason:'Approved term'}],status:'complete'})};
 throw Error('Unexpected fetch '+url);
};
const html=fs.readFileSync(__dirname+'/ui.html','utf8');
const source=fs.readFileSync(__dirname+'/code.js','utf8');
vm.runInNewContext(source,{figma,__html__:html,fetch:mockFetch,console,setTimeout,clearTimeout});
const sleep=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 await sleep();assert.ok(textMessages.some(x=>x.type==='init'));
 await figma.ui.onmessage({type:'save-knowledge',knowledge:{glossary:[{avoid:'Log in',prefer:'Sign in',note:'Public test fixture'}],guide:{name:'',text:''},sources:[],checks:{doubleSpaces:true,ellipsis:false}}});
 await figma.ui.onmessage({type:'scan',scope:'page'});
 const r=textMessages.findLast(x=>x.type==='results');assert.equal(r.count,1);assert.equal(r.findings[0].prefer,'Sign in');
 await figma.ui.onmessage({type:'connect-ai',code:'example-code'});
 assert.ok(textMessages.some(x=>x.type==='ai-connected'));
 await figma.ui.onmessage({type:'publish-ai'});
 assert.equal(posted.texts[0].id,'22:17');assert.ok(posted.knowledge.glossary.length>0);
 assert.ok(textMessages.some(x=>x.type==='ai-published'));
 await figma.ui.onmessage({type:'refresh-ai'});
 assert.equal(textMessages.findLast(x=>x.type==='ai-findings').findings[0].nodeId,'22:17');
 await figma.ui.onmessage({type:'run-evals'});
 assert.ok(textMessages.some(x=>x.type==='eval-results'));
 console.log('PASS mocked Figma scan, local rules, connect, publish and AI finding refresh.');
})().catch(e=>{console.error(e);process.exitCode=1});
