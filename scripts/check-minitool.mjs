import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = 'output/minitool/';
const html = fs.readFileSync(root + 'index.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(m => m[1]);
for (const src of scripts) assert(fs.existsSync(root + src));
assert(!/https?:\/\//.test(html));
assert(!/<script\b[^>]*type=["']module/i.test(html));
assert(html.includes('viewport-fit=cover'));
const unsupported = /\?\.|\?\?|\.at\(|replaceAll\(|fetch\(|XMLHttpRequest|new WebSocket|new Worker|eval\(|new Function\(|WebAssembly/;
for (const src of scripts) {
 const code = fs.readFileSync(root + src, 'utf8');
 assert(!unsupported.test(code), '不支持的运行时或语法: ' + src);
 new vm.Script(code);
}
class Element {
 constructor(value='') { this.value=value; this.textContent=''; this.checked=false; this.disabled=false; this.options=[]; this.dataset={}; this.events={}; this.classList={add(){},remove(){},toggle(){}}; this.style={}; this._html=''; }
 set innerHTML(value) { this._html=value; if(value.includes('<option>')) this.options=[...value.matchAll(/<option>([^<]+)<\/option>/g)].map(m=>({value:m[1]})); }
 get innerHTML() { return this._html; }
 addEventListener(name,fn) { this.events[name]=fn; }
 querySelectorAll() { return []; }
 querySelector() { return this.submit || new Element(); }
 setAttribute() {} scrollIntoView() {} appendChild(child) { child.parentNode=this; } removeChild() {} remove() {}
}
for (const mode of ['native', 'legacy', 'storage-denied']) {
 const nodes=new Map(); const get=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s)};
 get('#startDate').value='2026-10-04';get('#endDate').value='2026-10-24';
 const events=['婚嫁','乔迁','开业','出行'].map(name=>{const e=new Element();e.dataset.event=name;return e});
 const zodiac=[...'鼠牛虎兔龙蛇马羊猴鸡狗猪'].map(z=>new Element(z));
 const submit=new Element();get('#pickerForm').submit=submit;
 const calls=[];const data={'liangchen:saved':'["2026-10-23"]'};
 const storage={getItem(key){if(mode==='storage-denied')throw Error('denied');return data[key]||null},setItem(key,val){if(mode==='storage-denied')throw Error('denied');data[key]=val}};
 const sdk={async getStorage({key}){calls.push('get:'+key);return {data:data[key]||null}},async setStorage({key,data:val}){calls.push('set:'+key);data[key]=val}};
 const doc={querySelector(s){return s==='#detailPanel'?null:get(s)},querySelectorAll(s){if(s==='.event-option')return events;if(s==='input[name="familyZodiac"]')return zodiac;if(s==='.today-item small')return [new Element(),new Element(),new Element()];return []},createElement(){return new Element()},body:new Element(),documentElement:new Element()};
 const context={document:doc,localStorage:storage,console,setTimeout,clearTimeout};context.window=context;
 if(mode==='native')context.xhs={launchOptions:{miniToolEnv:{buildVersion:9490000}},miniTool:sdk};
 const ctx=vm.createContext(context);
 for(const script of scripts)vm.runInContext(fs.readFileSync(root+script,'utf8'),ctx,{timeout:10000});
 for(let i=0;i<500&&!get('#resultGrid').innerHTML.includes('result-card');i++)await new Promise(r=>setTimeout(r,10));
 assert(get('#resultGrid').innerHTML.includes('result-card'),'初始计算未完成: '+mode);
 assert.equal(typeof ctx.Solar,'object');
 assert(get('#city').options.length>100);
 if(mode==='native'){assert(calls.some(c=>c.startsWith('get:')));assert(calls.some(c=>c.startsWith('set:')));}
 await events[2].events.click();
 await get('#pickerForm').events.submit({preventDefault(){}});
 assert.equal(get('#resultEvent').textContent,'开业');
 zodiac.forEach(z=>z.checked=true);
 await get('#pickerForm').events.submit({preventDefault(){}});
 assert(get('#resultGrid').innerHTML.includes('empty-result'),'全生肖筛选应显示空结果');
 console.log('PASS:',mode,'脚本顺序、初始化、日期计算、事项切换、全生肖空结果、存储分支');
}
console.log('PASS: 离线资源与脚本静态校验。此检查不代表容器或真机验收。');
