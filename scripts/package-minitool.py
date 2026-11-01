"""检查离线资源闭环，并生成根目录入口 ZIP。"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from zipfile import ZipFile, ZIP_DEFLATED
import re

root=Path('output/minitool').resolve()
allowed={'.html','.css','.js','.png','.jpg','.jpeg','.gif','.webp','.svg','.woff','.woff2','.json'}
files=sorted(p for p in root.rglob('*') if p.is_file())
assert (root/'index.html').is_file()
assert [p.name for p in files if p.suffix=='.html']==['index.html']
for p in files:
 assert p.suffix in allowed, f'不允许的文件类型: {p.name}'
 assert not any(part.startswith('.') or part=='node_modules' for part in p.relative_to(root).parts)

def check_ref(value, parent):
 if value.startswith('#'): return
 parsed=urlsplit(value)
 assert not parsed.scheme and not parsed.netloc and not value.startswith('/'), f'非相对资源路径: {value}'
 target=(parent/unquote(parsed.path)).resolve()
 assert target.is_relative_to(root) and target.is_file(), f'缺失资源: {value}'

class CheckHTML(HTMLParser):
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  assert tag not in ['iframe','object','base']
  assert not any(k.startswith('on') for k in attrs)
  assert attrs.get('target')!='_blank' and 'download' not in attrs
  if tag=='script': assert attrs.get('src') and attrs.get('type')!='module'
  for key in ['src','href','poster']:
   if key in attrs: check_ref(attrs[key],root)
CheckHTML().feed((root/'index.html').read_text())
for p in files:
 if p.suffix not in ['.css','.js']: continue
 text=p.read_text()
 if p.suffix=='.css':
  for url in re.findall(r'url\([\'\"]?([^\)\'\"]+)',text):
   if not url.startswith('data:'): check_ref(url,p.parent)
 else:
  assert not re.search(r'\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|WebAssembly|eval\s*\(|new\s+(?:Function|Worker|SharedWorker)\s*\()',text)
  assert not re.search(r'navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|credentials|locks|serviceWorker)',text)
  assert not re.search(r'window\.(?:open|prompt)\s*\(',text)
zip_path=Path('output/liangchen-minitool.zip')
with ZipFile(zip_path,'w',ZIP_DEFLATED,compresslevel=9) as z:
 for p in files: z.write(p,p.relative_to(root).as_posix())
with ZipFile(zip_path) as z:
 assert 'index.html' in z.namelist() and z.testzip() is None
assert zip_path.stat().st_size<=10*1024*1024
print(f'PASS: 资源路径、允许类型、经典脚本、禁用能力扫描、ZIP 完整性；{len(files)} 文件')
print(f'ZIP: {zip_path.resolve()} ({zip_path.stat().st_size} bytes)')
print(f'解压后: {sum(p.stat().st_size for p in files)} bytes')
