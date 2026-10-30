from pathlib import Path
root=Path(__file__).resolve().parents[3]
p=root/'progress_chapter4.tex'
s=p.read_text(encoding='utf-8')
s=s.replace('\\clearpage\n\\section{การพัฒนาและการปรับปรุงจากภาคการศึกษาก่อนหน้า}','\\section{การพัฒนาและการปรับปรุงจากภาคการศึกษาก่อนหน้า}')
a=s.index('\\small\n\\setlength{\\LTcapwidth}',s.index('\\section{การพัฒนาและการปรับปรุงจากภาคการศึกษาก่อนหน้า}'))
b=s.index('\\end{longtable}',a)+len('\\end{longtable}')
table=s[a:b].replace('|p{0.29\\textwidth}|p{0.25\\textwidth}|p{0.31\\textwidth}|','|p{0.29\\textwidth}|p{0.25\\textwidth}|p{0.38\\textwidth}|')
table=r'''% ใช้ความกว้างพื้นที่พิมพ์เพื่อลดการตัดบรรทัด โดยคงขนาดฟอนต์
\begingroup
\setlength{\tabcolsep}{4pt}
\renewcommand{\arraystretch}{1.1}
\setlength{\LTpre}{0.4\baselineskip}
\setlength{\LTpost}{0.4\baselineskip}
\captionsetup[table]{skip=0.5\baselineskip}
'''+table+'\n\\endgroup'
s=s[:a]+table+s[b:]
p.write_text(s,encoding='utf-8')
