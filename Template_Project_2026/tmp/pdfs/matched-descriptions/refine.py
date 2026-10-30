from pathlib import Path
root=Path(__file__).resolve().parents[3]
p=root/'progress_chapter3.tex'
s=p.read_text(encoding='utf-8')
s=s.replace('แสดงการเชื่อมต่อจาก Web Browser ผ่านส่วนหน้า Next.js/React ไปยัง FastAPI ซึ่งประสานบริการตรวจจับใบหน้า การสร้างเวกเตอร์ลักษณะ การติดตาม และการสร้างผลลัพธ์ โดยใช้ SQLite จัดเก็บข้อมูลของระบบ และใช้ Cloudinary เป็นทางเลือกสำหรับจัดเก็บไฟล์ผลลัพธ์เมื่อกำหนดค่าบริการไว้แล้ว',
            'แสดงการเชื่อมต่อจาก Web Browser ผ่าน Next.js/React ไปยัง FastAPI และบริการประมวลผล โดยใช้ SQLite เก็บข้อมูลของระบบ และเลือกใช้ Cloudinary สำหรับจัดเก็บไฟล์ผลลัพธ์')
s=s.replace('แสดงขั้นตอนตั้งแต่รับไฟล์และสร้างเฟรมตัวอย่าง ตรวจจับและจัดกลุ่มใบหน้า พร้อมบันทึก Timeline จากนั้นผู้ใช้เลือกบุคคล เพิ่มพื้นที่ปกปิดด้วยตนเอง และกำหนดเอฟเฟกต์ ก่อนตรวจสอบตัวอย่างและส่งออกไฟล์ผลลัพธ์',
            'แสดงลำดับการอัปโหลดสื่อ สร้างเฟรมตัวอย่าง ตรวจจับและจัดกลุ่มบุคคล บันทึก Timeline เลือกพื้นที่และเอฟเฟกต์ปกปิด ก่อนตรวจสอบตัวอย่างและส่งออกผลลัพธ์')
# Compact only the simple six-step flowchart; detailed Activity figures retain size.
s=s.replace('node distance=0.8cm,\n    processbox/.style=', 'node distance=0.65cm,\n    processbox/.style=')
p.write_text(s,encoding='utf-8')

p=root/'progress_chapter4.tex'
s=p.read_text(encoding='utf-8')
text='ส่วนหลัง (backend) แยกความรับผิดชอบเป็นบริการตรวจจับใบหน้า บริการรู้จำใบหน้า บริการติดตามวัตถุ และบริการสร้างผลลัพธ์ การแยกส่วนดังกล่าวช่วยให้เปลี่ยนแบบจำลองหรือปรับวิธีปกปิดได้ แบ่งเป็นคอมโพเนนต์สำหรับอัปโหลดสื่อ เลือกบุคคล แสดง Timeline ควบคุมการปกปิดด้วยตนเอง และส่งออกผลลัพธ์'
assert s.count(text)==1
s=s.replace(text,'\\begin{samepage}\n'+text+'\\par\n\\end{samepage}')
assert s.count('\\reportscreenshot{')==7
s=s.replace('\\reportscreenshot{','\\reportscreenshot[0.80\\textwidth]{')
s=s.replace('\\setlength{\\intextsep}{0.4\\baselineskip}\n\n% ===', '\\setlength{\\intextsep}{0.25\\baselineskip}\n\\captionsetup[figure]{skip=0.75\\baselineskip}\n\n% ===')
p.write_text(s,encoding='utf-8')
