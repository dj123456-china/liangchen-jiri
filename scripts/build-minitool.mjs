import fs from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';
import postcss from 'postcss';

const out = path.resolve('output/minitool');
await fs.mkdir(path.join(out, 'vendor'), { recursive: true });
for (const name of ['app.js', 'cities.js', 'compat.js', 'vendor/lunar.js']) {
  const code = await fs.readFile(name, 'utf8');
  const result = await transform(code, { target: ['es2017', 'chrome61'], format: name === 'vendor/lunar.js' ? undefined : 'iife', minify: true, legalComments: 'none' });
  const license = name === 'vendor/lunar.js' ? '/* lunar-javascript — ' + await fs.readFile('node_modules/lunar-javascript/LICENSE', 'utf8') + ' */\n' : '';
  await fs.writeFile(path.join(out, name), license + result.code);
}
const root = postcss.parse(await fs.readFile('styles.css', 'utf8'));
const flex = new Set(['.note-card-large']);
root.walkRules(rule => { if (rule.nodes.some(d => d.prop === 'display' && /^(inline-)?flex$/.test(d.value))) rule.selector.split(',').forEach(s => flex.add(s.trim())); });
root.walkRules(rule => {
  const gaps = {};
  rule.walkDecls(decl => {
    if (decl.prop === 'gap') { const v = decl.value.split(/\s+(?![^()]*\))/); gaps.row = v[0]; gaps.col = v[1] || v[0]; decl.cloneBefore({ prop: 'grid-gap' }); }
    if (decl.prop === 'column-gap') { gaps.col = decl.value; decl.cloneBefore({ prop: 'grid-column-gap' }); }
    if (decl.prop === 'row-gap') { gaps.row = decl.value; decl.cloneBefore({ prop: 'grid-row-gap' }); }
    if (decl.prop === 'inset') { ['top','right','bottom','left'].forEach(prop => decl.cloneBefore({ prop })); }
    if (decl.value.includes('clamp(')) decl.cloneBefore({ value: decl.value.replace(/clamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '$2') });
    if (/\bmin\(/.test(decl.value) && !decl.value.includes('minmax')) {
      const fallback = decl.value.replace(/min\(730px, 75vw\)/g, '75vw').replace(/min\(510px, 100%\)/g, '100%');
      if (fallback !== decl.value) decl.cloneBefore({ value: fallback });
    }
    if (decl.prop === 'appearance') decl.cloneBefore({ prop: '-webkit-appearance' });
    if (decl.prop === 'align-items' && ['start','end'].includes(decl.value)) decl.cloneBefore({value: `flex-${decl.value}`});
  });
  if (!Object.keys(gaps).length) return;
  const sels = rule.selector.split(',').map(s => s.trim()).filter(s => flex.has(s));
  if (!sels.length) return;
  const fallback = postcss.rule({ selector: sels.map(s => `.no-flex-gap ${s} > * + *`).join(', ') });
  const column = sels.some(s => ['.brand-word','.calendar-advice','.rail-day','.score','.note-card','.empty-result'].includes(s));
  if (column && gaps.row) fallback.append({prop:'margin-top',value: gaps.row});
  if (!column && gaps.col) fallback.append({prop:'margin-left',value: gaps.col});
  rule.after(fallback);
  if (sels.some(s => ['.event-options','.time-chips','.hero-meta','.footer','.today-date'].includes(s)) && gaps.row) {
    rule.after(postcss.rule({selector:sels.map(s=>`.no-flex-gap ${s} > *`).join(', ')}).append({prop:'margin-bottom',value:gaps.row}));
  }
});
const declarations = [];
root.walkDecls(decl => declarations.push(decl));
for (const decl of declarations) {
  if (!decl.value.includes('clamp(')) continue;
  const value = decl.value.replace(/clamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, decl.prop === 'font' ? '$1' : '$2');
  const prev = decl.prev();
  if (prev && prev.type === 'decl' && prev.prop === decl.prop && !prev.value.includes('clamp(')) prev.value = value;
  else decl.cloneBefore({ value });
}
await fs.writeFile(path.join(out,'styles.css'), root.toString());
await fs.copyFile('index.html',path.join(out,'index.html'));
await fs.copyFile('favicon.svg',path.join(out,'favicon.svg'));
console.log(`离线产物已生成：${out}`);
