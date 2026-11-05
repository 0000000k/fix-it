// Fix it v0.7 — read-only copy checks and a user-managed local knowledge base.
// Confluence uses an opt-in local companion bridge; no Atlassian credentials enter the plugin.
const DEFAULT_KNOWLEDGE = {
  glossary: [],
  guide: { name: '', text: '' },
  sources: [],
  checks: { doubleSpaces: true, ellipsis: false }
};
const STORAGE_KEY = 'copy-inspector-knowledge-v02';
let knowledge = DEFAULT_KNOWLEDGE;
let lastScan = null;
let connectionCode = '';
let activeAiScanId = '';
const COMPANION_URL = 'http://localhost:38412';

figma.showUI(__html__, { width: 430, height: 800, themeColors: false });

function getTextNodes(scope) {
  const nodes = new Map();
  const add = node => { if (node && node.type === 'TEXT') nodes.set(node.id, node); };
  if (scope === 'selection') {
    for (const selected of figma.currentPage.selection) {
      add(selected);
      if (typeof selected.findAllWithCriteria === 'function') {
        selected.findAllWithCriteria({ types: ['TEXT'] }).forEach(add);
      }
    }
  } else {
    figma.currentPage.findAllWithCriteria({ types: ['TEXT'] }).forEach(add);
  }
  return [...nodes.values()];
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function matchedTerm(text, term) {
  // Respect Unicode letters & numbers. Avoid finding 'log' inside 'catalog'.
  const re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegex(term) + '(?=$|[^\\p{L}\\p{N}])', 'iu');
  return re.test(text);
}
function verifyKnowledge(input) {
  if (!input || !Array.isArray(input.glossary) || input.glossary.length > 500) {
    throw new Error('The glossary must contain at most 500 rules.');
  }
  const glossary = input.glossary.map((entry, index) => {
    const avoid = String(entry.avoid || '').trim();
    const prefer = String(entry.prefer || '').trim();
    const note = String(entry.note || '').trim();
    if (!avoid || !prefer || avoid.length > 200 || prefer.length > 200 || note.length > 500) {
      throw new Error(`Glossary rule ${index + 1} must have valid avoid/prefer terms (max 200 characters).`);
    }
    return { avoid, prefer, note };
  });
  const seen = new Set();
  for (const rule of glossary) {
    const normalized = rule.avoid.toLocaleLowerCase();
    if (seen.has(normalized)) throw new Error(`Duplicate glossary term: ${rule.avoid}`);
    seen.add(normalized);
  }
  const guide = {
    name: String(input.guide?.name || '').slice(0, 120),
    text: String(input.guide?.text || '')
  };
  if (guide.text.length > 100000) throw new Error('Pasted style guide too large (limit: 100,000 characters).');
  if (!Array.isArray(input.sources || []) || (input.sources || []).length > 20) {
    throw new Error('You can save up to 20 imported guides.');
  }
  const sources = (input.sources || []).map((entry, index) => {
    const kind = String(entry.kind || 'text');
    if (!['pdf', 'confluence', 'text'].includes(kind)) throw new Error(`Invalid guide type ${index + 1}.`);
    const text = String(entry.text || '');
    if (!text || text.length > 100000) throw new Error(`Invalid guide ${index + 1} (100,000 character maximum).`);
    return {
      id: String(entry.id || '').slice(0, 100),
      kind,
      name: String(entry.name || 'Untitled guide').slice(0, 150),
      text,
      url: kind === 'confluence' ? String(entry.url || '').slice(0, 2048) : '',
      importedAt: String(entry.importedAt || '').slice(0, 40)
    };
  });
  if (sources.reduce((total, source) => total + source.text.length, guide.text.length) > 220000) {
    throw new Error('Combined guide text exceeds 220,000 characters. Remove a guide or shorten it.');
  }
  const checks = {
    doubleSpaces: input.checks?.doubleSpaces === true,
    ellipsis: input.checks?.ellipsis === true
  };
  return { glossary, guide, sources, checks };
}
async function scan(scope) {
  await figma.currentPage.loadAsync();
  const textNodes = getTextNodes(scope);
  const texts = textNodes.map(node => ({
    id: node.id,
    text: node.characters,
    layer: node.name,
    parent: node.parent ? node.parent.name : 'Page'
  }));
  const findings = [];
  for (const node of texts) {
    for (const rule of knowledge.glossary) {
      if (matchedTerm(node.text, rule.avoid)) findings.push({
        nodeId: node.id, layer: node.layer, parent: node.parent, text: node.text,
        avoid: rule.avoid, prefer: rule.prefer, note: rule.note, category: 'Terminology'
      });
    }
    if (knowledge.checks.doubleSpaces && / {2,}/.test(node.text)) {
      findings.push({ nodeId: node.id, layer: node.layer, parent: node.parent,
        text: node.text, avoid: 'Multiple spaces', prefer: 'Single space',
        note: 'Formatting check', category: 'Formatting' });
    }
    if (knowledge.checks.ellipsis && /\.\.\./.test(node.text)) {
      findings.push({ nodeId: node.id, layer: node.layer, parent: node.parent,
        text: node.text, avoid: '...', prefer: '…',
        note: 'Formatting check', category: 'Formatting' });
    }
  }
  lastScan = {scope, total: texts.length, texts, ruleFindings: findings};
  figma.ui.postMessage({ type: 'results', count: texts.length, texts, findings });
}

// A local bridge avoids Confluence Cloud CORS restrictions and keeps API tokens off the canvas/UI.
async function importConfluencePage(message) {
  const url = String(message.url || '').trim();
  const accessKey = String(message.accessKey || '').trim();
  if (!url || !accessKey) throw new Error('Enter a Confluence URL and the bridge connection code.');
  let response;
  try {
    response = await fetch('http://localhost:38411/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Fix-It-Key': accessKey },
      body: JSON.stringify({ url })
    });
  } catch (_) {
    throw new Error('Cannot reach the local Confluence bridge. Start it with node confluence-bridge.js and check localhost permissions.');
  }
  let json;
  try { json = await response.json(); } catch (_) { throw new Error('The local bridge did not return JSON.'); }
  if (!response.ok) throw new Error(json.error || `Confluence bridge HTTP ${response.status}`);
  if (!json || typeof json.html !== 'string' || !json.html.trim()) throw new Error('No readable content returned from Confluence.');
  figma.ui.postMessage({ type: 'confluence-imported', name: String(json.title || 'Confluence guide'), html: json.html, url: String(json.url || url) });
}


async function companionRequest(endpoint, options = {}) {
  if (!connectionCode) throw new Error('Enter the Fix it connection code in AI review, then choose Connect.');
  let response;
  try {
    response = await fetch(COMPANION_URL + endpoint, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Fix-It-Code': connectionCode }
    });
  } catch (_) { throw new Error('Cannot reach Fix it companion. Restart Claude Desktop or run node companion.js --standalone.'); }
  let data = {};
  try { data = await response.json(); } catch (_) { throw new Error('Companion returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || 'Companion error ' + response.status);
  return data;
}
async function connectCompanion(input) {
  connectionCode = String(input || connectionCode || '').trim();
  if (!connectionCode) throw new Error('Connection code is required. Run node setup-claude.mjs --show-code to retrieve it.');
  const status = await companionRequest('/v1/status');
  if (status.latest && status.latest.id) activeAiScanId = status.latest.id;
  await figma.clientStorage.setAsync('fix-it-ai-connection-v1', connectionCode);
  figma.ui.postMessage({ type: 'ai-connected', status });
}
async function publishScan() {
  if (!lastScan) throw new Error('Run Scan copy first.');
  const payload = {
    scope: lastScan.scope, total: lastScan.total,
    texts: lastScan.texts.slice(0, 500),
    ruleFindings: lastScan.ruleFindings.filter(f => lastScan.texts.slice(0,500).some(t=>t.id===f.nodeId)).slice(0, 2000),
    knowledge
  };
  const result = await companionRequest('/v1/scans', {method:'POST',body:JSON.stringify(payload)});
  activeAiScanId = result.scanId;
  figma.ui.postMessage({type:'ai-published',...result});
}
async function refreshAi() {
  if (!activeAiScanId) throw new Error('Send a scan to Claude first.');
  const result = await companionRequest('/v1/scans/' + encodeURIComponent(activeAiScanId) + '/findings');
  figma.ui.postMessage({type:'ai-findings',...result});
}
figma.ui.onmessage = async message => {
  try {
    if (message.type === 'close-ui') {
      figma.closePlugin();
    } else if (message.type === 'scan') {
      await scan(message.scope === 'selection' ? 'selection' : 'page');
    } else if (message.type === 'connect-ai') {
      await connectCompanion(message.code);
    } else if (message.type === 'publish-ai') {
      await publishScan();
    } else if (message.type === 'refresh-ai') {
      await refreshAi();
    } else if (message.type === 'import-confluence') {
      await importConfluencePage(message);
    } else if (message.type === 'save-knowledge') {
      const validated = verifyKnowledge(message.knowledge);
      await figma.clientStorage.setAsync(STORAGE_KEY, validated);
      knowledge = validated;
      figma.ui.postMessage({ type: 'knowledge-saved', knowledge });
    } else if (message.type === 'select-node') {
      const node = await figma.getNodeByIdAsync(String(message.id));
      if (!node || node.type !== 'TEXT') throw new Error('Text layer no longer exists. Run a new scan.');
      // Selection is page-specific: first switch to the node's page if necessary.
      let page = node;
      while (page && page.type !== 'PAGE') page = page.parent;
      if (page && figma.currentPage.id !== page.id) await figma.setCurrentPageAsync(page);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: String(error.message || error) });
  }
};
(async () => {
  try {
    const saved = await figma.clientStorage.getAsync(STORAGE_KEY);
    if (saved) knowledge = verifyKnowledge(saved);
    else {
      // Migrates rules from v0.1 to avoid losing any user edits.
      const old = await figma.clientStorage.getAsync('copy-inspector-rules-v1');
      if (Array.isArray(old)) {
        knowledge = verifyKnowledge({ ...DEFAULT_KNOWLEDGE, glossary: old });
        await figma.clientStorage.setAsync(STORAGE_KEY, knowledge);
      }
    }
    connectionCode = String(await figma.clientStorage.getAsync('fix-it-ai-connection-v1') || '');
  } catch (_) {
    knowledge = DEFAULT_KNOWLEDGE;
  }
  figma.ui.postMessage({ type: 'init', knowledge, hasConnectionCode: Boolean(connectionCode) });
})();
