'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fix-it-install-test-'));
try{
 const target=path.join(root,'registered-plugin');
 fs.mkdirSync(target);
 fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({id:'test-figma-id-123',name:'Fix it'}));
 const result=spawnSync('bash',[path.join(__dirname,'install-update.sh')],{env:{...process.env,FIX_IT_TARGET_DIR:target},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
 assert.ok(fs.existsSync(path.join(target,'evals','runner.cjs')));
 assert.ok(fs.existsSync(path.join(target,'evals','demo-suite.json')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(target,'manifest.json'))).id,'test-figma-id-123');
 const demo=require(path.join(target,'evals','demo-suite.json'));
 const {runSuite}=require(path.join(target,'evals','runner.cjs'));
 assert.equal(runSuite(demo).summary.total,6);
 console.log('PASS installer retains Figma ID and ships local eval runner.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
