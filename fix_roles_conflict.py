import re
with open('frontend/src/screens/landing/config/roleOptions.js', 'r') as f:
    content = f.read()

resolved = re.sub(
    r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [a-f0-9]+',
    r'\1',
    content,
    flags=re.DOTALL
)

with open('frontend/src/screens/landing/config/roleOptions.js', 'w') as f:
    f.write(resolved)
