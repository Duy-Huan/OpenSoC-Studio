"""Bounded, out-of-process slang analysis. No HDL execution or simulation."""
import json
import sys
from pathlib import Path
import pyslang as slang


def analyze(request):
    manager = slang.SourceManager()
    options = slang.ast.CompilationOptions()
    options.errorLimit = 100
    options.maxInstanceDepth = 32
    options.maxGenerateSteps = 10000
    options.maxConstexprSteps = 10000
    options.maxInstanceArray = 1024
    options.maxConstantSize = 65536
    if request.get('top'):
        options.topModules = {request['top']}
    compilation = slang.ast.Compilation(slang.Bag([options]))
    for source in request['files']:
        if Path(source['path']).suffix.lower() in {'.sv', '.v'}:
            compilation.addSyntaxTree(slang.syntax.SyntaxTree.fromText(source['content'], manager, name=source['path']))
    root = compilation.getRoot()
    diagnostics = []
    for d in compilation.getAllDiagnostics():
        diagnostics.append({'code': str(d.code), 'severity': 'error' if d.isError() else 'warning',
            'message': slang.DiagnosticEngine.reportAll(manager, [d]),
            'file': str(manager.getFileName(d.location)), 'line': manager.getLineNumber(d.location), 'column': manager.getColumnNumber(d.location)})
    nodes = []
    def location(symbol):
        return {'file': str(manager.getFileName(symbol.location)), 'line': manager.getLineNumber(symbol.location), 'column': manager.getColumnNumber(symbol.location)}
    def visit(instance, depth=0):
        if depth > 32 or len(nodes) > 5000:
            raise ValueError('Elaboration output limit exceeded')
        ports = []
        for p in instance.body.portList:
            direction = str(p.direction).split('.')[-1].lower()
            ports.append({'name': p.name, 'direction': {'in': 'input', 'out': 'output'}.get(direction, direction), 'type': str(p.type), 'width': p.type.bitWidth, 'source': location(p), 'provenance': 'EXTRACTED'})
        node = {'id': str(instance.hierarchicalPath), 'name': instance.name, 'module': instance.definition.name, 'source': location(instance.definition), 'ports': ports, 'children': [], 'provenance': 'EXTRACTED'}
        nodes.append(node)
        for symbol in instance.body:
            if isinstance(symbol, slang.ast.InstanceSymbol):
                node['children'].append(visit(symbol, depth+1))
        return node
    hierarchy = [visit(i) for i in root.topInstances]
    if not hierarchy and not any(d['severity'] == 'error' for d in diagnostics):
        diagnostics.append({'code': 'NO_TOP_MODULE', 'severity': 'error', 'message': 'No elaborated top module found', 'file': '', 'line': 0, 'column': 0})
    return {'schema_version': '1.0', 'tool': 'pyslang', 'tool_version': slang.__version__, 'top_requested': request.get('top'), 'hierarchy': hierarchy,
        'diagnostics': diagnostics, 'success': not any(d['severity'] == 'error' for d in diagnostics),
        'fidelity': 'RTL_ELABORATION_ONLY', 'simulation_executed': False,
        'limitations': ['Interface/CSR semantics require human review.', 'Instance-array expansion and parameter overrides require a future provider adapter.']}


if __name__ == '__main__':
    try:
        request = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
        result = analyze(request)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'worker_error': type(exc).__name__, 'message': str(exc)}))
        sys.exit(1)
