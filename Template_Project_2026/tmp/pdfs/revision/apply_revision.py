from pathlib import Path
import re, shutil
root=Path(__file__).resolve().parents[3]
backup=Path(__file__).parent/'before'
backup.mkdir(exist_ok=True)
for f in root.glob('progress_*.tex'):
    if not (backup/f.name).exists(): shutil.copy2(f,backup/f.name)
shutil.copy2(root/'progress_references.bib',backup/'progress_references.bib')
main=root/'progress_report_2569.tex'
s=main.read_text(encoding='utf-8')
s=s.replace('\\usepackage{multirow}', '\\usepackage{multirow}\n\\usepackage{needspace}\n\\input{progress_format_kku}')
s=s.replace('\\par\\smallskip\n  \\begin{minipage}{0.94\\textwidth}', '\\par\\vspace{\\baselineskip}\n  \\begin{minipage}{\\textwidth}')
s=s.replace('\\textbf{คำอธิบายภาพที่ \\ref{#1}:} #2','จากภาพที่ \\ref{#1} #2')
s=s.replace('\\nocite{*}', '% References are cited next to the supported text.')
main.write_text(s,encoding='utf-8')
# Preserve the supplied image assets; adjust presentation and source attribution.
for n in range(2,5):
 p=root/f'progress_chapter{n}.tex'; s=p.read_text(encoding='utf-8')
 s=s.replace('\\figuresource{ผู้จัดทำ}\n','')
 s=s.replace('height=0.72\\textheight','height=0.60\\textheight')
 if n==2:
  s=s.replace('width=0.8\\textwidth','width=0.64\\textwidth')
  sources={'OpenCV (ม.ป.ป.)':'OpenCV \\cite{opencv_haar_features}', 'GeeksforGeeks (2021)':'GeeksforGeeks \\cite{geeksforgeeks2021eigenfaces}', 'Scholarpedia (ม.ป.ป.)':'Scholarpedia \\cite{scholarpedia_fisherfaces}', 'Albiol และคณะ (2008)':'Albiol และคณะ \\cite{albiol2008hogebgm}'}
  for a,b in sources.items():s=s.replace('\\figuresource{'+a+'}', '\\figuresource{'+b+'}')
  # Attach primary-source references to the theory paragraphs, not the headings.
  sections={
   'การปกปิดข้อมูลในภาพและวิดีโอ':'opencv_filtering,rot2022',
   'Convolutional Neural Network(CNN)':'lecun1998',
   'การตรวจจับใบหน้าด้วย YOLO26':'redmon2016yolo,ultralytics2026yolo26docs',
   'การศึกษาเปรียบเทียบแบบจำลองตรวจจับใบหน้า':'ultralytics2026yolo26docs,deng2020retinaface,guo2021scrfd',
   'YOLO26':'ultralytics2026yolo26docs', 'RetinaFace':'deng2020retinaface', 'SCRFD':'guo2021scrfd',
   'หลักฐานเชิงปริมาณภายใต้เงื่อนไขเดียวกัน':'guo2021scrfd',
   'การตรวจจับใบหน้าด้วย Haar Cascade':'viola2001',
   'Support Vector Machine(SVM)':'cortes1995',
   'การรู้จำใบหน้าและการแทนลักษณะ':'sun2025',
   'Principal Component Analysis และ Eigenfaces':'opencv_face',
   'Linear Discriminant Analysis และ Fisherfaces':'opencv_face',
   'Elastic Bunch Graph Matching':'albiol2008hogebgm',
   'ArcFace และการจัดกลุ่มบุคคล':'deng2019arcface',
   'การติดตามกรอบวัตถุ':'bewley2016sort',
   'Temporal Smoothing':'opencv_tracking',
   'Person Re-identification':'deng2019arcface,bewley2016sort',
   'Frame Skipping':'opencv_tracking',
   'Real-time Processing':'bewley2016sort',
   'Canvas Compositing':'mdn_canvas',
   'การตรวจจับข้อความและข้อมูลส่วนบุคคลจากข้อความ':'pii_label',
   'สถาปัตยกรรมเว็บแอปพลิเคชัน':'fastapi'}
  for title,keys in sections.items():
   pat=r'(\\(?:subsection|subsubsection)\{'+re.escape(title)+r'\}\s*\n)([^\n]+)'
   s=re.sub(pat,lambda m:m[1]+m[2]+' \\cite{'+keys+'}',s,count=1)
  s=s.replace('\\subsubsection{ตารางเปรียบเทียบเชิงคุณภาพ}', '\\clearpage\n\\subsubsection{ตารางเปรียบเทียบเชิงคุณภาพ}')
  s=s.replace('\\endfirsthead\n\\hline', '\\endfirsthead\n\\caption[]{การเปรียบเทียบ YOLO26, RetinaFace และ SCRFD สำหรับงานปกปิดใบหน้า (ต่อ)}\\\\\n\\hline',1)
  s=s.replace('ด้วย\\n', 'ด้วย\\n')
  s=s.replace('ด้วย PrivacyProber','ด้วย PrivacyProber')
  s=s.replace('งานด้าน privacy-preserving video analytics', 'งานด้าน privacy-preserving video analytics')
  s=s.replace('ด้วย\n\nงานด้านป้ายทะเบียน','ด้วย \\cite{rot2022}\n\nงานด้านป้ายทะเบียน')
  s=s.replace('เป็นตัวอย่างของการเตรียมข้อมูลที่ลดความเสี่ยงด้านความเป็นส่วนตัว','เป็นตัวอย่างของการเตรียมข้อมูลที่ลดความเสี่ยงด้านความเป็นส่วนตัว \\cite{iiieta_anpr,mdpi_anpr,vizcarra2024,anpr_dataset}')
  # Keep concept labels whole while allowing the description columns to wrap.
  s=s.replace('YOLO &','\\mbox{YOLO} &').replace('ArcFace Embedding &','\\mbox{ArcFace Embedding} &').replace('Person Re-identification &','\\shortstack[l]{Person\\\\Re-identification} &')
 if n==3:
  s=s.replace('\\caption{ลำดับการประมวลผลภาพและวิดีโอ}', '\\caption{ผังงานลำดับการประมวลผลภาพและวิดีโอ}')
  # Route the loop outside the flow instead of through the decision and output.
  s=s.replace('\\draw[line, dashed] (render.east) -| node[near start, right, font=\\small]{วนซ้ำ} (frame.east);', '\\draw[line, dashed] (render.east) -- ++(7,0) node[right]{เฟรมถัดไป} |- (frame.east);')
  # Place a genuine existing interface screenshot beside the workflow discussion.
  needle='\\section{ลำดับการประมวลผลสื่อ}'
  shot='''\\begin{figure}[H]
\\centering
\\includegraphics[width=0.88\\textwidth]{\\detokenize{images-progress/ภาพ demo หน้าเมนู Detect&Select .jpg}}
\\caption{หน้าจอจริงสำหรับตรวจจับและเลือกบุคคลในกระบวนการปกปิด}
\\label{fig:workflow-screen}
\\figuredescription{fig:workflow-screen}{แสดงส่วนติดต่อที่ผู้ใช้ตรวจรายการใบหน้าและเลือกบุคคลที่จะปกปิดก่อนตรวจสอบและส่งออกผลลัพธ์}
\\end{figure}
'''
  s=s.replace('\\subsection{การประมวลผลแบบเวลาจริงของ Livestream}',shot+'\n\\subsection{การประมวลผลแบบเวลาจริงของ Livestream}')
 p.write_text(s,encoding='utf-8')
# Relocate the existing comparison section intact, including table labels.
p5=root/'progress_chapter5.tex'; s=p5.read_text(encoding='utf-8'); marker='\\section{สรุปผลการดำเนินโครงงาน}'; comparison,summary=s.split(marker,1)
p4=root/'progress_chapter4.tex'; p4.write_text(p4.read_text(encoding='utf-8')+'\n\\clearpage\n'+comparison,encoding='utf-8')
summary=marker+summary
start=summary.index('\nโครงงานนี้'); end=summary.index('\\begin{table}')
summary=summary[:start]+'''
โครงงานนี้ได้พัฒนาเว็บแอปพลิเคชันสำหรับปกปิดใบหน้าในภาพและวิดีโอ โดยเชื่อมกระบวนการอัปโหลด ตรวจจับใบหน้า สร้าง Face Map เลือกบุคคลที่จะปกปิด ตรวจสอบตัวอย่าง และส่งออกผลลัพธ์เข้าด้วยกัน ผู้ใช้สามารถเลือกเอฟเฟกต์และใช้ Manual Control กำหนดบริเวณเพิ่มเติมได้ นอกจากนี้ได้เพิ่ม Livestream พร้อมตัวเลือกโมเดล โหมดการปกปิด และการเลือกบุคคลหลายราย

ผลการดำเนินงานในรอบนี้คือระบบต้นแบบที่มีองค์ประกอบของกระบวนการหลักครบตามตาราง \\ref{tab:objective-summary} ส่วนผลเปรียบเทียบแบบจำลองและตัวเลขอ้างอิงได้รวบรวมไว้ในบทที่ 4 ทั้งนี้ ผลอ้างอิงและผลระดับโมเดลยังไม่ยืนยันความแม่นยำของการจัดกลุ่ม การติดตาม หรือความครอบคลุมของการปกปิดตลอดทั้งระบบ จึงยังต้องเก็บผลการประเมินแบบ end-to-end เพิ่มเติม

งานในภาคการศึกษาถัดไปจะมุ่งเตรียมชุดทดสอบที่มีคำตอบจริง วัดความถูกต้องและเวลาในการประมวลผล วิเคราะห์กรณีตรวจจับหรือจัดกลุ่มผิด และปรับปรุงการจัดการงานเบื้องหลัง ก่อนขยายการตรวจจับไปยังข้อมูลส่วนบุคคลประเภทอื่น รายละเอียดแผนงานแสดงในหัวข้อสิ่งที่จะทำต่อในเทอมหน้า

'''+summary[end:]
summary=summary.replace('\\section{ข้อเสนอแนะในการพัฒนาต่อไป}', '\\section{สิ่งที่จะทำต่อในเทอมหน้า}')
summary=summary.replace('\\subsection[การวิเคราะห์ความเสี่ยงของข้อผิดพลาดจากกระบวนการทำงาน]{การวิเคราะห์ความเสี่ยงของข้อผิดพลาด\\\\จากกระบวนการทำงาน}', '\\subsection{การวิเคราะห์ความเสี่ยงของข้อผิดพลาดจากกระบวนการทำงาน}')
p5.write_text(summary,encoding='utf-8')
print('Report revisions applied; prior sources saved in',backup)
