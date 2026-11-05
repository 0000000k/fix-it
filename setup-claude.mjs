#!/usr/bin/env node
// Installs Fix it MCP connector into Claude Desktop config on macOS. Backups existing config.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir=process.env.FIXIT_DATA_DIR||path.join(os.homedir(),'.fix-it-local');
const connection=path.join(dir,'connection.json');
fs.mkdirSync(dir,{recursive:true,mode:0o700});
if(!fs.existsSync(connection))fs.writeFileSync(connection,JSON.stringify({connectionCode:crypto.randomBytes(24).toString('hex'),createdAt:new Date().toISOString()},null,2),{mode:0o600});
fs.chmodSync(connection,0o600);
const token=JSON.parse(fs.readFileSync(connection,'utf8')).connectionCode;
if(process.argv.includes('--show-code')){
  console.log('Fix it connection code: '+token);
  process.exit(0);
}
if(process.platform!=='darwin'){
  console.error('Automatic Claude Desktop setup currently supports macOS only. See README.md for manual configuration.');
  process.exit(1);
}
const configDir=path.join(os.homedir(),'Library','Application Support','Claude');
const configPath=path.join(configDir,'claude_desktop_config.json');
let existing={};
if(fs.existsSync(configPath)){
  try{existing=JSON.parse(fs.readFileSync(configPath,'utf8'));}
  catch(err){console.error('Claude Desktop config has invalid JSON. Fix it before running setup; no file was changed.');process.exit(1);}
  const backup=configPath+'.backup-'+new Date().toISOString().replace(/[:.]/g,'-');
  fs.copyFileSync(configPath,backup);
  console.log('Backed up current Claude config to '+backup);
}
if(existing===null||Array.isArray(existing)||typeof existing!=='object'){
  console.error('Claude Desktop config must be a JSON object. No file was changed.');process.exit(1);
}
existing.mcpServers={...(existing.mcpServers||{}), 'fix-it':{command:process.execPath,args:[path.join(path.dirname(fileURLToPath(import.meta.url)),'companion.js')]}};
fs.mkdirSync(configDir,{recursive:true});
const tmp=configPath+'.fixit.tmp';
fs.writeFileSync(tmp,JSON.stringify(existing,null,2)+'\n',{mode:0o600});
fs.renameSync(tmp,configPath);
console.log('\nFix it MCP added to Claude Desktop config: '+configPath);
console.log('Existing MCP servers and other settings were preserved.');
console.log('\nConnection code (copy this into Fix it → AI review):\n'+token);
console.log('\nNext: Fully quit Claude Desktop and open it again.');
console.log('Then open Figma Desktop and load the plugin via manifest.json.');
