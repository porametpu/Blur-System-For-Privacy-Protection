from pathlib import Path
import re, json, hashlib
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

out=Path(__file__).resolve().parent
root=out.parents[2]
pdf=out/'build/progress_report_2569.pdf'
reader=PdfReader(pdf)
texts=[p.extract_text() or '' for p in reader.pages]
assets=json.loads((out/'asset-hashes.json').read_text(encoding='utf-8'))
print('Changed image assets:',[p for p,h in assets.items() if hashlib.sha256(Path(p).read_bytes()).hexdigest()!=h])
diagrams=json.loads((out/'diagram-hashes.json').read_text(encoding='utf-8'))
s=(root/'progress_chapter3.tex').read_text(encoding='utf-8')
current={re.search(r'\\label\{([^}]+)\}',m[0])[1]:hashlib.sha256(m[0].encode()).hexdigest() for m in re.finditer(r'\\begin\{figure\}.*?\\end\{figure\}',s,re.S)}
print('Changed diagram blocks:',[k for k,h in diagrams.items() if current.get(k)!=h])
blocks=[m[0] for f in root.glob('progress_chapter*.tex') for m in re.finditer(r'\\begin\{figure\}.*?\\end\{figure\}',f.read_text(encoding='utf-8'),re.S)]
print('Figures:',len(blocks),'Missing descriptions:',sum(r'\figuredescription{' not in b for b in blocks))
nums={int(n) for t in texts for n in re.findall(r'จาก\s*ภาพ\s*ที่\s*(\d+)',t)}
print('Missing PDF descriptions:',sorted(set(range(1,33))-nums))
print('Unresolved question marks:',[i+1 for i,t in enumerate(texts) if '??' in t])
aux=(out/'build/progress_report_2569.aux').read_text(encoding='utf-8')
cited={k for match in re.findall(r'\\citation\{([^}]+)\}',aux) for k in match.split(',')}
bib=set(re.findall(r'\\bibcite\{([^}]+)\}',aux))
print('Undefined citation keys:',sorted(cited-bib))
print('Identical two covers:',texts[0]==texts[1])
print('Table label on one line:',any('Person Re-identification' in t for t in texts))
print('Pages:',len(texts))
doc=pdfium.PdfDocument(pdf)
for i,t in enumerate(texts):
    if 'สังเคราะห์สถาปัตยกรรม' in t or 'แนวคิดที่เกี่ยวข้องและการนำไปใช้' in t or any(re.search(r'จาก\s*ภาพ\s*ที่\s*'+str(n)+r'\s',t) for n in range(26,33)) or 'เอกสารอ้างอิง (ต่อ)' in t:
        print('Review page:',i+1,t[:65].replace('\n',' '))
        doc[i].render(scale=1.3).to_pil().save(out/f'final-{i+1}.png')
for start in range(0,len(doc),16):
    sheet=Image.new('RGB',(1100,1640),'#ddd');draw=ImageDraw.Draw(sheet)
    for j,i in enumerate(range(start,min(start+16,len(doc)))):
        im=doc[i].render(scale=.44).to_pil(); im.thumbnail((265,380))
        x=(j%4)*275;y=(j//4)*410
        sheet.paste(im,(x,y+22));draw.text((x+8,y+3),str(i+1),fill='black')
    sheet.save(out/f'contact-{start//16+1}.png')
