from pathlib import Path
import re,json,hashlib
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image,ImageDraw
import pdfplumber

out=Path(__file__).resolve().parent
root=out.parents[2]
pdf=out/'build/progress_report_2569.pdf'
reader=PdfReader(pdf)
texts=[p.extract_text() or '' for p in reader.pages]
aux=(out/'build/progress_report_2569.aux').read_text(encoding='utf-8')
log=(out/'build/progress_report_2569.log').read_text(encoding='utf-8',errors='replace')
figures=re.findall(r'\\newlabel\{(fig:[^}]+)\}\{\{(\d+)\}\{([^}]+)',aux)
print('Pages:',len(texts),'Figures:',len(figures))
print('Log issues:',[x for x in log.splitlines() if re.search(r'undefined|Overfull|Missing character|LaTeX Error|^!|Float too large',x)])
print('Question marks:',[i+1 for i,t in enumerate(texts) if '??' in t])
cit={k for m in re.findall(r'\\citation\{([^}]+)\}',aux) for k in m.split(',')}
print('Undefined citation keys:',cit-set(re.findall(r'\\bibcite\{([^}]+)\}',aux)))
print('Description on different page:',[(label,n,page) for label,n,page in figures if not re.search(r'จาก\s*ภาพ\s*ที่\s*'+n+r'(?!\d)',texts[int(page)+8])])
print('Figures:',figures)
print('Data table label:',re.findall(r'\\newlabel\{tab:data-model\}.*',aux))
assets=json.loads((out/'asset-hashes.json').read_text(encoding='utf-8'))
print('Changed image assets:',[p for p,h in assets.items() if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h])
doc=pdfium.PdfDocument(pdf)
for start in range(0,len(doc),12):
    sheet=Image.new('RGB',(1350,1440),'#ddd');draw=ImageDraw.Draw(sheet)
    for j,i in enumerate(range(start,min(start+12,len(doc)))):
        im=doc[i].render(scale=.53).to_pil();im.thumbnail((330,440))
        x=(j%4)*337;y=(j//4)*480
        sheet.paste(im,(x,y+25));draw.text((x+8,y+5),str(i+1),fill='black')
    sheet.save(out/f'contact-{start//12+1}.png')
for label,n,page in figures:
    if int(n)<=10 or label in ('fig:demo-manual-control','fig:demo-auto-blur'):
        i=int(page)+8
        doc[i].render(scale=1.3).to_pil().save(out/f'page-{i+1}.png')
with pdfplumber.open(pdf) as pd:
    for i,t in enumerate(texts):
        if '4.2' in t and 'การออกแบบข้อมูลและส่วนประกอบ' in t or 'ตารางที่ 6 โครงสร้างข้อมูลหลักของระบบ' in t:
            print('Data table review PDF page:',i+1, 'table boxes:',[x.bbox for x in pd.pages[i].find_tables()])
            doc[i].render(scale=1.3).to_pil().save(out/f'page-{i+1}.png')
