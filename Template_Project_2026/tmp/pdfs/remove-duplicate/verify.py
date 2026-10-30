from pathlib import Path
import re
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image,ImageDraw

out=Path(__file__).resolve().parent
root=out.parents[2]
pdf=out/'build/progress_report_2569.pdf'
reader=PdfReader(pdf)
texts=[p.extract_text() or '' for p in reader.pages]
aux=(out/'build/progress_report_2569.aux').read_text(encoding='utf-8')
log=(out/'build/progress_report_2569.log').read_text(encoding='utf-8',errors='replace')
print('Pages:',len(texts))
print('Log issues:',[x for x in log.splitlines() if re.search(r'undefined|Overfull|Missing character|LaTeX Error|^!',x)])
print('Question marks:',[i+1 for i,t in enumerate(texts) if '??' in t])
cit={k for m in re.findall(r'\\citation\{([^}]+)\}',aux) for k in m.split(',')}
print('Undefined citation keys:',cit-set(re.findall(r'\\bibcite\{([^}]+)\}',aux)))
figures=re.findall(r'\\newlabel\{(fig:[^}]+)\}\{\{(\d+)\}\{([^}]+)',aux)
print('Figures:',len(figures),'numbers:',[int(n) for _,n,_ in figures])
print('Retained screenshot:',[x for x in figures if x[0]=='fig:demo-detect-select'])
print('Removed label present:', 'fig:workflow-screen' in aux)
nums={int(n) for t in texts for n in re.findall(r'จาก\s*ภาพ\s*ที่\s*(\d+)',t)}
print('Missing descriptions:',set(range(1,32))-nums)
print('Screenshot file uses:',sum(p.read_text(encoding='utf-8').count('images-progress/ภาพ demo หน้าเมนู Detect&Select .jpg') for p in root.glob('progress_chapter*.tex')))
doc=pdfium.PdfDocument(pdf)
for start in range(0,len(doc),12):
    sheet=Image.new('RGB',(1350,1440),'#ddd');draw=ImageDraw.Draw(sheet)
    for j,i in enumerate(range(start,min(start+12,len(doc)))):
        im=doc[i].render(scale=.53).to_pil();im.thumbnail((330,440))
        x=(j%4)*337;y=(j//4)*480
        sheet.paste(im,(x,y+25));draw.text((x+8,y+5),str(i+1),fill='black')
    sheet.save(out/f'contact-{start//12+1}.png')
for i in range(23,28):
    doc[i].render(scale=1.25).to_pil().save(out/f'page-{i+1}.png')
for i,t in enumerate(texts):
    if 'หน้าจอการตรวจจับและเลือกบุคคลที่ต้องการปกปิด' in t and 'สารบัญภาพ' not in t:
        doc[i].render(scale=1.25).to_pil().save(out/'retained-screenshot.png')
