"""Overlay care release onto fresh production exports; do not rebuild old deployments."""
from pathlib import Path
import json
import sys

repo = Path(__file__).resolve().parents[2]
root = Path(sys.argv[1])
shared = repo / 'pastoralos/lib/pastoral'
for slug in ('pastoralos-staff', 'pastoralos-worker', 'pastoralos-twilio'):
    folder = root / slug
    baseline = json.loads((folder / 'baseline.json').read_text())
    files = {f['name']: f['content'] for f in baseline['files']}
    names = ['model.ts', 'pastoral-care.ts', 'serving.ts']
    if slug.endswith('staff'):
        names += ['serving-confirmations.ts']
        key = 'lib/pastoral/staff-api.ts'
        content = files[key]
        content = "import {applyCareAction} from './pastoral-care.ts';\nimport {applyServingInvite} from './serving-confirmations.ts';\n" + content
        content = content.replace('export interface StaffApiDependencies {', 'export interface StaffApiDependencies {\n  health?(owner:string):Promise<{lastCompletedAt:string|null;lastError:string|null}>;')
        content = content.replace('    async uploadEmailImage(', '''    async health(owner){
      const {data,error}=await client.from('pastoral_worker_runtime').select('last_completed_at,last_error').eq('owner_id',owner).maybeSingle();
      if(error||!data)throw Error('Scheduler status unavailable.');
      return {lastCompletedAt:data.last_completed_at,lastError:data.last_error};
    },
    async uploadEmailImage(''')
        content = content.replace("['/api/email-image','/api/delivery-connection'", "['/api/health','/api/email-image','/api/delivery-connection'")
        content = content.replace("    if(path === '/api/delivery-connection')", "    if(path==='/api/health')return deps.health?json(await deps.health(staff.workspaceOwner)):json({error:'Scheduler status unavailable.'},503);\n    if(path === '/api/delivery-connection')")
        needle = "      if(data.action.type.startsWith('serving.')){"
        assert content.count(needle) == 1
        content = content.replace(needle, """      if(data.action.type.startsWith('care.')){
        state=applyCareAction(current.state,data.action,staff.email);
      }else if(data.action.type==='serving.invite'){
        state=applyServingInvite(current.state,data.action,staff.email,deps.deliveryConnection?.()??{sms:false,email:false});
      }else if(data.action.type.startsWith('serving.')){""")
        files[key] = content
        key = 'lib/pastoral/edge-staff.ts'
        assert '(email-image|' in files[key]
        files[key] = files[key].replace('(email-image|', '(health|email-image|')
    elif slug.endswith('worker'):
        names += ['care-reminders.ts', 'serving-reminders.ts', 'sms-conversations.ts', 'worker-jobs.ts']
        key = 'supabase/functions/pastoralos-worker/index.ts'
        files[key] = (repo / 'backend/pastoral-care' / key).read_text()
    else:
        names += ['inbound.ts']
    for name in names:
        files['lib/pastoral/' + name] = (shared / name).read_text()
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
