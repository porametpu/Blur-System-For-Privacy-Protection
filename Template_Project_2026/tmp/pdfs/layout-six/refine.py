from pathlib import Path
import re
root=Path(__file__).resolve().parents[3]
p=root/'progress_chapter3.tex'
s=p.read_text(encoding='utf-8')
# Compact native figure blocks so pairs of related Livestream diagrams fit.
s='\\begingroup\n\\setlength{\\intextsep}{0.5\\baselineskip}\n\n'+s+'\n\\endgroup\n'
# Tall raster diagrams have room for their own description below the caption.
# Keeping it there avoids mistaking the next diagram's description for this one.
pat=r'(\\figureintroduction\{([^}]+)\}\{[^\n]*\}\n)\n(\\begin\{figure\}.*?\\end\{figure\})'
def move_back(m):
    if not (m[2].startswith('fig:activity-') or m[2].startswith('fig:ssd-') or m[2]=='fig:use-case'):
        return m[0]
    desc=m[1].replace(r'\figureintroduction',r'\figuredescription')
    b=m[3].replace(r'\end{figure}',desc+r'\end{figure}')
    return b
s=re.sub(pat,move_back,s,flags=re.S)
s=s.replace('\\section{แผนภาพการทำงานของระบบ}','\\clearpage\n\\section{แผนภาพการทำงานของระบบ}')
# First activity shares its page with the section and subsection headings.
start=s.index('\\label{fig:activity-upload}')
pos=s.rfind('height=0.82\\textheight',0,start)
s=s[:pos]+s[pos:].replace('height=0.82\\textheight','height=0.74\\textheight',1)
p.write_text(s,encoding='utf-8')

p=root/'progress_chapter4.tex'
s=p.read_text(encoding='utf-8')
# The short 15-row table should stay on one page with its title.
s=s.replace('\\small\n\\setlength{\\LTcapwidth}', '\\clearpage\n\\small\n\\setlength{\\LTcapwidth}')
p.write_text(s,encoding='utf-8')

p=root/'progress_chapter5.tex'
s=p.read_text(encoding='utf-8')
s=s.replace('ผลการดำเนินงานในภาคการศึกษานี้คือระบบต้นแบบที่เชื่อมต่อกระบวนการปกปิดใบหน้าจากการอัปโหลดจนถึงการส่งออกผลลัพธ์ พร้อมเครื่องมือเลือกบุคคลและปรับพื้นที่ปกปิดด้วยตนเอง รวมถึงการปกปิดแบบ Livestream ส่วนผลเปรียบเทียบแบบจำลองและตัวเลขอ้างอิงได้รวบรวมไว้ในบทที่ 4',
'ผลการดำเนินงานในภาคการศึกษานี้คือระบบต้นแบบที่รองรับกระบวนการหลักดังกล่าว และมีตัวเลือกโมเดลกับรูปแบบการปกปิดให้ผู้ใช้ปรับตามการใช้งาน ผลเปรียบเทียบแบบจำลองและตัวเลขอ้างอิงได้รวบรวมไว้ในบทที่ 4')
p.write_text(s,encoding='utf-8')
