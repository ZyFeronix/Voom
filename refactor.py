import os, re
api_dir = 'd:/Vsocial/public/api'
replacements = [(r'INSERT OR IGNORE', 'INSERT IGNORE'), (r"datetime\('now',\s*'\+1 day'\)", 'DATE_ADD(NOW(), INTERVAL 1 DAY)'), (r"datetime\('now'\)", 'NOW()'), (r"date\('now',\s*'-7 days'\)", 'DATE_SUB(NOW(), INTERVAL 7 DAY)')]
for r, d, f in os.walk(api_dir):
 for file in f:
  if file.endswith('.php'):
   path = os.path.join(r, file)
   with open(path, 'r', encoding='utf-8') as fh:
    content = fh.read()
   orig = content
   for pat, repl in replacements:
    content = re.sub(pat, repl, content)
   if orig != content:
    with open(path, 'w', encoding='utf-8') as fh:
     fh.write(content)
    print(f'Updated {path}')
