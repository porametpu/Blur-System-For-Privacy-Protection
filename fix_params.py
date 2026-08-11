import os
import glob
import re

api_dir = 'frontend/src/app/api'
route_files = glob.glob(f'{api_dir}/**/route.ts', recursive=True)

for file in route_files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Replace the type signature
    new_content = re.sub(
        r'\{ params \}: \{ params: \{ ([^}]+) \} \}',
        r'{ params }: { params: Promise<{ \1 }> }',
        content
    )
    
    # Ensure params is awaited
    if 'const { videoId } = await params;' not in new_content and 'const { videoId } = params;' in new_content:
        new_content = new_content.replace('const { videoId } = params;', 'const { videoId } = await params;')
    if 'const { videoId, personId } = await params;' not in new_content and 'const { videoId, personId } = params;' in new_content:
        new_content = new_content.replace('const { videoId, personId } = params;', 'const { videoId, personId } = await params;')
        
    
    if new_content != content:
        with open(file, 'w') as f:
            f.write(new_content)
        print(f'Fixed {file}')

