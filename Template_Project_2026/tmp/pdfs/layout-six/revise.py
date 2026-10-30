from pathlib import Path
import re, shutil, hashlib, json

out = Path(__file__).resolve().parent
root = out.parents[2]
names = ['progress_report_2569.tex', 'progress_chapter2.tex', 'progress_chapter3.tex', 'progress_chapter4.tex', 'progress_chapter5.tex', 'progress_references.bib']
for name in names:
    shutil.copy2(root/name, out/(name+'.before'))
(out/'asset-hashes.json').write_text(json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'images-progress').glob('*') if p.is_file()}),encoding='utf-8')

main=(root/names[0]).read_text(encoding='utf-8')
a=main.index('% แหล่งที่มาของภาพ')
b=main.index('\\begin{document}',a)
main=main[:a]+r'''% กรอบภาพหน้าจอคงขนาดรวมตามความกว้างที่ระบุ รวมเส้นกรอบด้วย
\newcommand{\reportscreenshot}[2][0.86\textwidth]{%
  \begingroup
  \setlength{\fboxsep}{0pt}%
  \setlength{\fboxrule}{0.4pt}%
  \fbox{\includegraphics[width=\dimexpr#1-2\fboxrule\relax]{#2}}%
  \endgroup
}

% คำอธิบายก่อนภาพแยกจากตัวภาพ เพื่อใช้พื้นที่ท้ายหน้าก่อนหน้าได้
\newcommand{\figureintroduction}[2]{%
  \par\noindent จากภาพที่ \ref{#1} #2\par
}

'''+main[b:]
(root/names[0]).write_text(main,encoding='utf-8')

s=(root/names[1]).read_text(encoding='utf-8')
# Move external-image references into captions; keep a clean short LOF title.
pat=r'\\caption\{([^\n]+)\}\n(\\label\{[^\n]+\}\n)\\figuresource\{[^\n]*?\\cite\{([^}]+)\}\}\n'
s,n=re.subn(pat,lambda m:r'\caption['+m[1]+']{'+m[1]+r'~\cite{'+m[3]+'}}\n'+m[2],s)
assert n==4,n
captions={
'ผลเปรียบเทียบ RetinaFace และ SCRFD ภายใต้โปรโตคอลเดียวกัน':'guo2021scrfd',
'การเปรียบเทียบ YOLO26, RetinaFace และ SCRFD สำหรับงานปกปิดใบหน้า':'jocher2026yolo26,ultralytics2026yolo26docs,deng2020retinaface,guo2021scrfd',
'การเปรียบเทียบ YOLO26, RetinaFace และ SCRFD สำหรับงานปกปิดใบหน้า (ต่อ)':'jocher2026yolo26,ultralytics2026yolo26docs,deng2020retinaface,guo2021scrfd',
}
for title,keys in captions.items():
    s=s.replace(r'\caption{'+title+'}',r'\caption['+title+']{'+title+r'~\cite{'+keys+'}}')
    s=s.replace(r'\caption[]{'+title+'}',r'\caption[]{'+title+r'~\cite{'+keys+'}}')
# Theory explanations can flow before the image rather than leave a large hole.
def intro_before(m):
    block=m[0]
    desc=re.search(r'\\figuredescription\{[^\n]+\}\n',block)
    assert desc
    intro=desc[0].replace(r'\figuredescription',r'\figureintroduction')
    return intro+'\n'+block.replace(desc[0],'')
s=re.sub(r'\\begin\{figure\}.*?\\end\{figure\}',intro_before,s,flags=re.S)
s=s.replace('\\clearpage\n\\subsubsection{ตารางเปรียบเทียบเชิงคุณภาพ}','\\subsubsection{ตารางเปรียบเทียบเชิงคุณภาพ}')
(root/names[1]).write_text(s,encoding='utf-8')

s=(root/names[2]).read_text(encoding='utf-8')
# Allow short architecture text and following explanations to use available space.
s=s.replace('\\clearpage\n\\section{สถาปัตยกรรมของระบบ}','\\section{สถาปัตยกรรมของระบบ}')
s=s.replace('\\clearpage\n\\section{ลำดับการประมวลผลสื่อ}','\\section{ลำดับการประมวลผลสื่อ}')
s=re.sub(r'\\includegraphics\[width=0.88\\textwidth\](\{\\detokenize\{[^\n]+\}\})',r'\\reportscreenshot[0.88\\textwidth]\1',s)
def revise_diagram(m):
    b=m[0]
    if 'images-progress/activity' in b:
        b=b.replace('height=0.60\\textheight,width=0.95\\textwidth','height=0.82\\textheight,width=\\textwidth')
    elif 'images-progress/System Sequence' in b:
        b=b.replace('height=0.60\\textheight,width=0.95\\textwidth','height=0.84\\textheight,width=\\textwidth')
    if r'\label{fig:workflow-screen}' not in b:
        return intro_before([b])
    return b
s=re.sub(r'\\begin\{figure\}.*?\\end\{figure\}',revise_diagram,s,flags=re.S)
# The separate use-case start is unnecessary once its explanation can precede it.
s=s.replace('\\clearpage\n\\subsection{Use Case Diagram}','\\subsection{Use Case Diagram}')
(root/names[2]).write_text(s,encoding='utf-8')

s=(root/names[3]).read_text(encoding='utf-8')
s,n=re.subn(r'\\includegraphics\[width=0.86\\textwidth\](\{\\detokenize\{[^\n]+\}\})',r'\\reportscreenshot\1',s)
assert n==7,n
title='ผลการเปรียบเทียบโมเดลตรวจจับใบหน้าและผลอ้างอิงแบบจำลอง YOLO ทุกขนาด'
s=s.replace(r'\caption{'+title+'}',r'\caption['+title+']{'+title+r'~\cite{wu2023yunet}}')
title='ผลแบบจำลอง YOLO บน COCO ที่ความละเอียด 640 พิกเซล'
s=s.replace(r'\caption{'+title+'}',r'\caption['+title+']{'+title+r'~\cite{ultralytics2023yolov8,ultralytics2024yolo11,ultralytics2026yolo26docs}}')
# Distinguish the externally reported rows from the existing project rows.
s=s.replace('ส่วนนี้แยกผลการทดสอบบนชุดข้อมูล WIDER FACE ของโครงงานออกจากผลอ้างอิงของแบบจำลองตระกูล YOLO บนชุดข้อมูล COCO เพื่อไม่ให้เปรียบเทียบตัวชี้วัดจากคนละชุดข้อมูลโดยตรง',
'ส่วนนี้แยกผลที่ระบุว่า YOLOv26n (Ours) บนชุดข้อมูล WIDER FACE ออกจากผลอ้างอิง โดยแถว YuNet, RetinaFace และ MTCNN ในตารางที่ \\ref{tab:yunet_comparison} นำมาจากงานของ Wu และคณะ \\cite{wu2023yunet} ส่วนผลอ้างอิงของแบบจำลองตระกูล YOLO บนชุดข้อมูล COCO แสดงแยกในตารางที่ \\ref{tab:yolo-family-reference} เพื่อไม่ให้เปรียบเทียบตัวชี้วัดจากคนละชุดข้อมูลโดยตรง')
# Bring the interpretation directly after its own table, instead of after COCO.
a=s.index('ตาราง \\ref{tab:yunet_comparison} แสดงว่า')
b=s.index('\n\n',a)
interpret=s[a:b]
s=s[:a]+s[b:]
a=s.index('\\end{table}',s.index('\\label{tab:yunet_comparison}'))+len('\\end{table}')
s=s[:a]+'\n\n'+interpret+s[a:]
s=s.replace('\\clearpage\n\\small\n\\setlength{\\LTcapwidth}', '\\small\n\\setlength{\\LTcapwidth}')
(root/names[3]).write_text(s,encoding='utf-8')

s=(root/names[4]).read_text(encoding='utf-8')
s,n=re.subn(r'\\begin\{table\}\[H\].*?\\end\{table\}\n\n','',s,count=1,flags=re.S)
assert n==1
s=s.replace('ผลการดำเนินงานในรอบนี้คือระบบต้นแบบที่มีองค์ประกอบของกระบวนการหลักครบตามตาราง \\ref{tab:objective-summary}', 'ผลการดำเนินงานในภาคการศึกษานี้คือระบบต้นแบบที่เชื่อมต่อกระบวนการปกปิดใบหน้าจากการอัปโหลดจนถึงการส่งออกผลลัพธ์ พร้อมเครื่องมือเลือกบุคคลและปรับพื้นที่ปกปิดด้วยตนเอง รวมถึงการปกปิดแบบ Livestream')
(root/names[4]).write_text(s,encoding='utf-8')

s=(root/names[5]).read_text(encoding='utf-8')
assert 'wu2023yunet' not in s
s+='''
@article{wu2023yunet,
  title={{YuNet}: A Tiny Millisecond-level Face Detector},
  author={Wu, Wei and Peng, Hanyang and Yu, Shiqi},
  journal={Machine Intelligence Research},
  volume={20},
  number={5},
  pages={656--665},
  year={2023},
  doi={10.1007/s11633-023-1423-y}
}
'''
(root/names[5]).write_text(s,encoding='utf-8')
print('Updated six report sources; backups and image hashes saved.')
