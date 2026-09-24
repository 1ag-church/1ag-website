"""Apply Serving Teams to fresh production exports, preserving unrelated deployed changes."""
from pathlib import Path
import json
import sys

repo = Path(__file__).resolve().parents[2]
root = Path(sys.argv[1])
for slug in ('pastoralos-staff', 'pastoralos-worker'):
    folder = root / slug
    baseline = json.loads((folder / 'baseline.json').read_text())
    files = {f['name']: f['content'] for f in baseline['files']}
    # Verify shared file parity before overlaying; whitespace-only differences are harmless.
    key = 'lib/pastoral/communications.ts'
    for name in ('communications.ts', 'serving.ts'):
        files['lib/pastoral/' + name] = (repo / 'pastoralos/lib/pastoral' / name).read_text()
    if slug.endswith('staff'):
        key = 'lib/pastoral/staff-api.ts'
        needle = "if(data.action.type.startsWith('conversation.')"
        assert files[key].count(needle) == 1
        files[key] = "import {applyServingAction} from './serving.ts';\n" + files[key].replace(needle, "if(data.action.type.startsWith('serving.')){\n        state=applyServingAction(current.state,data.action,staff.email);\n      }else " + needle)
    else:
        files['lib/pastoral/serving-reminders.ts'] = (repo / 'pastoralos/lib/pastoral/serving-reminders.ts').read_text()
        key = 'supabase/functions/pastoralos-worker/index.ts'
        needle = '    const broadcasts=await runBroadcastWorker('
        assert files[key].count(needle) == 1
        files[key] = "import {queueServingReminders} from '../../../lib/pastoral/serving-reminders.ts';\n" + files[key].replace(needle, '    await queueServingReminders({load:()=>storage.load(owner),save:(version,state)=>storage.save(owner,version,state)});\n' + needle)
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
    old = {f['name']: f['content'] for f in baseline['files']}
    print(slug, 'baseline', baseline['version'], 'changes', [k for k,v in files.items() if old.get(k) != v])
