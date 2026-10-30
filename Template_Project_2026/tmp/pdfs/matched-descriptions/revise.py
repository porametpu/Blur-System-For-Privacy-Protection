from pathlib import Path
import re,json,hashlib

out=Path(__file__).resolve().parent
root=out.parents[2]
assets={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'images-progress').glob('*') if p.is_file()}
(out/'asset-hashes.json').write_text(json.dumps(assets),encoding='utf-8')
for chapter in (2,3):
    p=root/f'progress_chapter{chapter}.tex'
    s=p.read_text(encoding='utf-8')
    pat=r'(\\figureintroduction\{([^}]+)\}\{[^\n]*\}\n)\n(\\begin\{figure\}.*?\\end\{figure\})'
    def attach(m):
        label=re.search(r'\\label\{([^}]+)\}',m[3])[1]
        assert label==m[2],(label,m[2])
        desc=m[1].replace(r'\figureintroduction',r'\figuredescription')
        return m[3].replace(r'\end{figure}',desc+r'\end{figure}')
    s,n=re.subn(pat,attach,s,flags=re.S)
    assert n=={2:4,3:6}[chapter],n
    s=s.replace('แสดงการแบ่งความรับผิดชอบระหว่าง Browser/Webcam, Detection API, Tracking and Identity และ Stabilization and Privacy ตั้งแต่รับเฟรมจนถึงการแสดงผลที่ปกปิดแล้ว',
                'แสดงการแบ่งหน้าที่ระหว่าง Browser, Detection API, Tracking and Identity และ Privacy and Display ตั้งแต่รับและส่งเฟรม ตรวจจับใบหน้า ติดตามบุคคล ปรับตำแหน่งกรอบ จนถึงการปกปิดและแสดงผลบน Canvas')
    p.write_text(s,encoding='utf-8')

p=root/'progress_chapter4.tex'
s=p.read_text(encoding='utf-8')
a=s.index(r'\begin{table}[H]',s.index(r'\section{การออกแบบข้อมูลและส่วนประกอบ}'))
b=s.index(r'\end{table}',a)+len(r'\end{table}')
table=s[a:b]
table=table.replace(r'|p{0.26\textwidth}|p{0.28\textwidth}|p{0.31\textwidth}|',r'|p{0.26\textwidth}|p{0.30\textwidth}|p{0.33\textwidth}|')
table=r'''% จัดตารางให้ต่อจากหัวข้อโดยคงขนาดตัวอักษรเดิม
\begingroup
\setlength{\intextsep}{0.4\baselineskip}
\renewcommand{\arraystretch}{1.1}
\captionsetup[table]{skip=0.5\baselineskip}
'''+table+'\n'+r'\endgroup'
s=s[:a]+table+s[b:]
s=s.replace(r'\caption{หน้าจอการทำงานของโหมด AI Auto-Blur}',r'\caption{หน้าจอแสดงความคืบหน้าการประมวลผล AI Auto-Blur}')
s=s.replace('ภาพตัวอย่างการทำงานของโหมด AI Auto-Blur ซึ่งตรวจจับและปกปิดใบหน้าโดยอัตโนมัติ',
            'แสดงหน้าจอ AI Auto-Blur in Progress พร้อมแถบและร้อยละความคืบหน้า ขณะระบบวิเคราะห์เฟรม ตรวจจับใบหน้า และเตรียมผลลัพธ์สำหรับตรวจสอบในขั้นตอนถัดไป')
s=s.replace('ภาพตัวอย่างหน้า Manual Control สำหรับวาดกรอบครอบบริเวณที่ต้องการปกปิด ปรับขนาดกรอบ และกำหนดให้กรอบติดตามวัตถุในวิดีโอ',
            'แสดงหน้า Manual Control พร้อมพื้นที่ภาพสำหรับวาดกรอบปกปิด ตัวเลือก Track Objects และปุ่ม Save \& Preview สำหรับบันทึกกรอบและตรวจสอบตัวอย่าง')
p.write_text(s,encoding='utf-8')

blocks=[m[0] for p in root.glob('progress_chapter*.tex') for m in re.finditer(r'\\begin\{figure\}.*?\\end\{figure\}',p.read_text(encoding='utf-8'),re.S)]
for b in blocks:
    label=re.search(r'\\label\{([^}]+)\}',b)[1]
    desc=re.findall(r'\\figuredescription\{([^}]+)\}',b)
    assert desc==[label],(label,desc)
assert len(blocks)==31,len(blocks)
assert not any(r'\figureintroduction{' in p.read_text(encoding='utf-8') for p in root.glob('progress_chapter*.tex'))
print('All 31 figures have exactly one correctly paired description inside the figure.')
