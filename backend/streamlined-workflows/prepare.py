"""Build deploy payloads from fresh Supabase function exports, preserving unrelated code.
Usage: python3 prepare.py <snapshot-root> <output-root>
Each snapshot-root/<slug>/baseline.json is the get_edge_function result.
"""
from pathlib import Path
import hashlib
import json
import sys

here = Path(__file__).resolve().parent
repo = here.parents[1]
snapshots, output = map(Path, sys.argv[1:3])
shared = repo / 'pastoralos/lib/pastoral'
for slug in ('pastoralos-staff', 'pastoralos-twilio', 'pastoralos-worker'):
    original = json.loads((snapshots / slug / 'baseline.json').read_text())
    files = {f['name']: f['content'] for f in original['files']}
    for name in ('model.ts', 'people-csv.ts', 'communications.ts', 'broadcast-worker.ts', 'prayer-approval.ts', 'inbound.ts'):
        key = 'lib/pastoral/' + name
        if key in files:
            files[key] = (shared / name).read_text()
    files['lib/pastoral/contact-permissions.ts'] = (shared / 'contact-permissions.ts').read_text()
    files['lib/pastoral/prayer-flow.ts'] = (here / 'lib/pastoral/prayer-flow.ts').read_text()
    if slug == 'pastoralos-staff':
        files['lib/pastoral/workspace-import.ts'] = (here / 'lib/pastoral/workspace-import.ts').read_text()
    if slug == 'pastoralos-worker':
        files['lib/pastoral/assimilation-worker.ts'] = (shared / 'assimilation-worker.ts').read_text()
        key = 'supabase/functions/pastoralos-worker/index.ts'
        files[key] = (here / key).read_text()
    dest = output / slug
    dest.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        p = dest / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    payload = dict(project_id='mewbiwkdstngmbeispwo', name=slug,
                   entrypoint_path=f'supabase/functions/{slug}/index.ts',
                   import_map_path=f'supabase/functions/{slug}/deno.json',
                   verify_jwt=original['verify_jwt'],
                   files=[dict(name=k, content=v) for k, v in files.items()])
    (dest / 'deploy.json').write_text(json.dumps(payload))
    print(slug, len(files), 'files; base version', original['version'])
