from pathlib import Path
from collections import Counter
import pypdfium2 as pdfium
import pdfplumber
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[3]
out=Path(__file__).parent
doc=pdfium.PdfDocument(root/'progress_report_2569.pdf')
for start in range(0,len(doc),16):
 sheet=Image.new('RGB',(1100,1640),'#dddddd'); draw=ImageDraw.Draw(sheet)
 for k,i in enumerate(range(start,min(start+16,len(doc)))):
  im=doc[i].render(scale=.44).to_pil(); im.thumbnail((265,380)); x=(k%4)*275;y=(k//4)*410
  sheet.paste(im,(x,y+22));draw.text((x+8,y+3),str(i+1),fill='black')
 sheet.save(out/f'contact-{start//16+1}.png')
with pdfplumber.open(root/'progress_report_2569.pdf') as d:
 bad=[];fonts=Counter();sizes=Counter()
 for i,p in enumerate(d.pages):
  t=p.extract_text() or ''
  if '??' in t:bad.append(i+1)
  for c in p.chars: fonts[c['fontname']]+=1;sizes[round(c['size'],1)]+=1
 print('Pages',len(d.pages),'question_marks',bad)
 print('Fonts',fonts.most_common(12));print('Sizes',sizes.most_common(8))
 for i,p in enumerate(d.pages):
  t=p.extract_text() or ''
  if i<10 or '4.5 ผลเปรียบเทียบ' in t or 'สิ่งที่จะทําต่อ' in t:print('PAGE',i+1,t[:90].replace('\n',' '))
  if i<8 or 'Tracking and Identity' in t or 'ผังงานลำดับ' in t or 'ผลแบบจําลอง YOLO บน COCO' in t:
   doc[i].render(scale=1.4).to_pil().save(out/f'final-{i+1}.png')
