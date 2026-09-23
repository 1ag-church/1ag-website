"""Overlay the SMS inbox change on fresh production exports without reverting other releases."""
from pathlib import Path
import json
import sys

here = Path(__file__).resolve().parent
repo = here.parents[1]
root = Path(sys.argv[1])
for slug in ('pastoralos-staff', 'pastoralos-worker', 'pastoralos-twilio'):
    folder = root / slug
    baseline = json.loads((folder / 'baseline.json').read_text())
    files = {f['name']: f['content'] for f in baseline['files']}
    for name in ('model.ts', 'communications.ts', 'broadcast-worker.ts', 'inbound.ts'):
        key = 'lib/pastoral/' + name
        if key in files:
            files[key] = (repo / 'pastoralos' / key).read_text()
    for key in files:
        if (here / key).is_file():
            files[key] = (here / key).read_text()
    for name, content in files.items():
        target = folder / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    payload = dict(project_id='mewbiwkdstngmbeispwo', name=slug,
                   entrypoint_path=f'supabase/functions/{slug}/index.ts',
                   import_map_path=f'supabase/functions/{slug}/deno.json',
                   verify_jwt=baseline['verify_jwt'],
                   files=[dict(name=k, content=v) for k, v in files.items()])
    (folder / 'deploy.json').write_text(json.dumps(payload))
    changed = [f['name'] for f in baseline['files'] if f['content'] != files[f['name']]]
    print(slug, 'baseline', baseline['version'], 'changed:', ', '.join(changed))
tests = root / 'pastoralos-twilio/tests'
tests.mkdir(exist_ok=True)
(tests / 'routing.test.ts').write_text((here / 'tests/routing.test.ts').read_text())
