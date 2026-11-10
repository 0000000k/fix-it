'use strict';
// Offline, deterministic UX copy assertions. User-supplied strings are never executed.
function runSuite(suite){
  if(!suite||typeof suite!=="object"||Array.isArray(suite))throw Error("Suite must be an object.");
  if(JSON.stringify(suite).length>200000)throw Error("Suite exceeds 200 KB.");
  if(!Array.isArray(suite.cases)||suite.cases.length<1||suite.cases.length>100)throw Error("Suite requires 1–100 cases.");
  const ids=new Set();
  const valid=(v,n,field)=>{if(typeof v!=="string"||!v.trim()||v.length>n)throw Error(field+" must be nonempty text of max "+n+" characters.");return v;};
  function evaluate(text,checks){
    const result=checks.map(c=>{
      const content=text.toLocaleLowerCase("en");
      const needle=String(c.phrase||"").toLocaleLowerCase("en");
      let passed;
      if(c.type==="must_include")passed=content.includes(needle);
      if(c.type==="must_not_include")passed=!content.includes(needle);
      if(c.type==="exact")passed=text===c.phrase;
      if(c.type==="max_words")passed=text.trim().split(/\s+/u).length<=c.limit;
      return {id:c.id,passed,critical:c.critical===true,message:passed?"Passed":c.message||"Failed "+c.type};
    });
    const total=result.reduce((n,c)=>n+(c.critical?3:1),0);
    const earned=result.reduce((n,c)=>n+(c.passed?(c.critical?3:1):0),0);
    return {text,passed:result.every(x=>x.passed),score:Math.round(100*earned/total),checks:result};
  }
  const cases=suite.cases.map((c,index)=>{
    if(!c||typeof c!=="object")throw Error("Invalid case "+index);
    const id=valid(c.id,80,"ID"),title=valid(c.title,180,"Title"),before=valid(c.before,4000,"Before"),after=valid(c.after,4000,"After");
    if(ids.has(id))throw Error("Duplicate case: "+id);ids.add(id);
    if(!Array.isArray(c.checks)||c.checks.length<1||c.checks.length>20)throw Error(id+" requires 1–20 checks.");
    const checkIds=new Set();
    const checks=c.checks.map(x=>{
      if(!x||typeof x!=="object")throw Error(id+" check must be an object.");
      valid(x.id,80,"Check ID");
      if(checkIds.has(x.id))throw Error("Duplicate check ID");checkIds.add(x.id);
      if(!["must_include","must_not_include","exact","max_words"].includes(x.type))throw Error("Unsupported check "+x.type);
      if(x.type==="max_words"){if(!Number.isInteger(x.limit)||x.limit<1||x.limit>500)throw Error("Invalid word limit.");}
      else valid(x.phrase,180,"Phrase");
      if(x.message!==undefined&&typeof x.message!=="string")throw Error("Invalid message");
      return x;
    });
    const old=evaluate(before,checks),next=evaluate(after,checks);
    const status=old.passed?(next.passed?"stable-pass":"regression"):(next.passed?"improvement":"stable-fail");
    return {id,title,guidelineId:typeof c.guidelineId==="string"?c.guidelineId.slice(0,80):"",context:typeof c.context==="string"?c.context.slice(0,1000):"",status,before:old,after:next};
  });
  return {suiteId:typeof suite.id==="string"?suite.id.slice(0,100):"unnamed",generatedAt:new Date().toISOString(),grading:"deterministic",summary:{total:cases.length,regressions:cases.filter(c=>c.status==="regression").length,improvements:cases.filter(c=>c.status==="improvement").length,stablePass:cases.filter(c=>c.status==="stable-pass").length,stableFail:cases.filter(c=>c.status==="stable-fail").length},cases};
}
module.exports={runSuite};
