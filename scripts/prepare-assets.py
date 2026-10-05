import json
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
assets = root.parent / 'tmp/interview-site-assets'
bank = json.loads((root / 'data/question-bank.json').read_text(encoding='utf-8-sig'))
notes = []
for filename in ['corrections.json', 'multimodal-corrections.json']:
    notes.extend(json.loads((assets / filename).read_text(encoding='utf-8-sig')))
ids = {q['id'] for q in bank['questions']}
assert len(ids) == len(bank['questions']) == 2464
assert len(notes) == len({n['questionId'] for n in notes}) == 27
assert all(n['questionId'] in ids for n in notes)
(root / 'data/corrections.json').write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding='utf-8')
for source in bank['sources']:
    shutil.copy2(root.parent / '面试题' / source['filename'], root / 'public/sources' / (source['id'] + '.pdf'))
print('Verified 2464 questions, 27 editorial notes and copied 9 original PDFs.')
