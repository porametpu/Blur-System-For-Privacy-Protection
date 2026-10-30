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
print('Pages:',len(texts))
print('Question marks:',[i+1 for i,t in enumerate(texts) if '??' in t])
nums={int(n) for t in texts for n in re.findall(r'จาก\s*ภาพ\s*ที่\s*(\d+)',t)}
print('Missing explanations:',sorted(set(range(1,33))-nums))
print('Source-heading pages:',[i+1 for i,t in enumerate(texts) if 'ที่มา:' in t])
print('Removed table still present:',any('สรุปผลเทียบกับวัตถุประสงค์' in t for t in texts))
aux=(out/'build/progress_report_2569.aux').read_text(encoding='utf-8')
cit={k for m in re.findall(r'\\citation\{([^}]+)\}',aux) for k in m.split(',')}
bib=set(re.findall(r'\\bibcite\{([^}]+)\}',aux))
print('Missing citations:',sorted(cit-bib))
assets=json.loads((out/'asset-hashes.json').read_text(encoding='utf-8'))
print('Changed assets:',[p for p,h in assets.items() if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h])
log=(out/'build/progress_report_2569.log').read_text(encoding='utf-8',errors='replace')
print('Log issues:',[l for l in log.splitlines() if re.search(r'undefined|Overfull|Missing character|^!|LaTeX Error',l)])
print('Borders:',sum((root/f'progress_chapter{c}.tex').read_text(encoding='utf-8').count('\\reportscreenshot') for c in range(1,6)))
doc=pdfium.PdfDocument(pdf)
for start in range(0,len(doc),12):
    sheet=Image.new('RGB',(1350,1440),'#ddd');draw=ImageDraw.Draw(sheet)
    for j,i in enumerate(range(start,min(start+12,len(doc)))):
        im=doc[i].render(scale=.53).to_pil(); im.thumbnail((330,440))
        x=(j%4)*337;y=(j//4)*480
        sheet.paste(im,(x,y+25));draw.text((x+8,y+5),str(i+1),fill='black')
    sheet.save(out/f'contact-{start//12+1}.png')
with pdfplumber.open(pdf) as pd:
    for i,t in enumerate(texts):
        caps=re.findall(r'(?m)^ภาพที่\s*(\d+)',t)
        if caps or re.search(r'5\.1\s*สรุป',t) or 'COCO ที่ความละเอียด' in t or 'ผลเปรียบเทียบ RetinaFace' in t:
            print('Page',i+1,'figures',caps,'images',[(round(im['x0'],1),round(im['top'],1),round(im['width'],1),round(im['height'],1)) for im in pd.pages[i].images])
            doc[i].render(scale=1.3).to_pil().save(out/f'page-{i+1}.png')
