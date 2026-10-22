import json
from pathlib import Path
from apps.api.main import app

root = Path(__file__).resolve().parents[2]
schema = app.openapi()
destination = root / 'docs/contracts/openapi.runtime.json'
destination.write_text(json.dumps(schema, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def ts(value):
    if '$ref' in value: return value['$ref'].rsplit('/', 1)[1]
    if 'const' in value: return json.dumps(value['const'])
    if 'enum' in value: return ' | '.join(json.dumps(v) for v in value['enum'])
    if 'anyOf' in value: return '(' + ' | '.join(ts(v) for v in value['anyOf']) + ')'
    kind = value.get('type')
    if kind == 'array': return f'Array<{ts(value.get("items", {}))}>'
    if kind in {'number', 'integer'}: return 'number'
    if kind in {'string', 'boolean', 'null'}: return kind
    if kind == 'object':
        if not value.get('properties'): return 'Record<string, unknown>'
        required = value.get('required', [])
        return '{\n' + '\n'.join(f'  {json.dumps(k)}{"" if k in required else "?"}: {ts(v)};' for k, v in value['properties'].items()) + '\n}'
    return 'unknown'


lines = ['// Generated from FastAPI OpenAPI by infra/scripts/export-contracts.py. Do not edit.']
for name, value in schema['components']['schemas'].items(): lines.append(f'export type {name} = {ts(value)};')
(root / 'apps/web/src/api-contracts.ts').write_text('\n\n'.join(lines)+'\n', encoding='utf-8')
print(f'Exported {len(schema["paths"])} implemented API paths and generated TypeScript request schemas')
