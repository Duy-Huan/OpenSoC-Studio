import { writeFile } from 'node:fs/promises';
const error = { type: 'object', required: ['code', 'message', 'details', 'correlation_id'], properties: { code: { type: 'string' }, message: { type: 'string' }, details: { type: 'array', items: {} }, correlation_id: { type: 'string' } }, additionalProperties: false };
const models = {};
for (const name of ['chm', 'ip-package', 'soc-config', 'cpu-profile', 'run-manifest', 'trace-event', 'selection']) {
  models[name] = { $ref: `./${name}.schema.json` };
}
models.Error = error;
const routes = [
  ['post', '/projects', null], ['post', '/projects/{id}/rtl-imports', null],
  ['get', '/rtl-imports/{id}', null], ['post', '/rtl-imports/{id}/analyze', null],
  ['post', '/ip-packages/{id}/review', 'ip-package'], ['post', '/ip-packages/{id}/publish', 'ip-package'],
  ['get', '/ip-registry', null], ['get', '/cpu-providers', null], ['get', '/cpu-profiles/{id}/capabilities', null],
  ['post', '/soc-configs', 'soc-config'], ['post', '/soc-configs/{id}/validate', 'soc-config'], ['patch', '/soc-configs/{id}', 'soc-config'],
  ['post', '/firmware/import', null], ['post', '/scenarios', null], ['post', '/runs', 'run-manifest'],
  ['get', '/runs/{id}', null], ['post', '/runs/{id}/cancel', null], ['get', '/runs/{id}/artifacts', null], ['get', '/runs/{id}/events', null],
  ['get', '/runs/{id}/signals', null], ['get', '/runs/{id}/waveforms/{traceId}/window', null],
  ['get', '/runs/{id}/transactions', null], ['get', '/runs/{id}/debug/correlate', null],
];
const paths = {};
for (const [method, path, model] of routes) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(m => ({ in: 'path', name: m[1], required: true, schema: { type: 'string', minLength: 1 } }));
  if (path.endsWith('/events')) parameters.push({ in: 'query', name: 'after_seq', schema: { type: 'integer', minimum: 0 } });
  if (method === 'patch') parameters.push({ in: 'header', name: 'If-Match', required: true, schema: { type: 'string' } });
  const operation = { operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`, description: 'Target contract only. Endpoint NOT IMPLEMENTED in M0. Request/response and project authorization details require refinement before M1.', 'x-implementation-status': 'NOT_IMPLEMENTED', parameters,
    responses: { '200': { description: 'Draft success shape — TBD except referenced models.' }, ...Object.fromEntries([400, 401, 403, 409, 422, 424, 429, 500].map(code => [String(code), { description: 'Structured error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }])) } };
  if (model) operation.requestBody = { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${model}` } } } };
  (paths[path] ??= {})[method] = operation;
}
await writeFile('docs/contracts/openapi.json', JSON.stringify({ openapi: '3.1.0', info: { title: 'OpenSoC-Studio API — M0 draft, not implemented', version: '1.0.0-draft' }, servers: [{ url: '/api/v1' }], paths, components: { schemas: models }, 'x-websocket': { path: '/api/v1/runs/{id}/stream?after_seq=', status: 'NOT_IMPLEMENTED', events: ['job.state', 'build.log', 'sim.log', 'trace.event', 'assertion', 'artifact.ready', 'run.verdict', 'warning'], replay: 'Per-run monotonic seq; authenticated replay from after_seq; no signal-toggle stream.' } }, null, 2) + '\n');
console.log(`Generated OpenAPI draft with ${routes.length} target operations`);
