import re
from pathlib import PurePosixPath
from .storage import digest


class DomainError(Exception):
    def __init__(self, code, message, status=422, details=None):
        self.code, self.message, self.status, self.details = code, message, status, details or []


def safe_sources(files):
    seen = set()
    total = 0
    for source in files:
        path = source.path
        p = PurePosixPath(path)
        parts = path.split('/')
        if p.is_absolute() or '\\' in path or ':' in path or any(x in ('', '.', '..') for x in parts) or any(re.search(r'[<>"|?*\x00-\x1f]', x) or x.endswith(('.', ' ')) or x.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1,10)), *(f'LPT{i}' for i in range(1,10))} for x in parts):
            raise DomainError('UNSAFE_SOURCE_PATH', f'Unsafe source path: {path}')
        if p.suffix.lower() not in {'.sv', '.v', '.svh', '.vh'}:
            raise DomainError('UNSUPPORTED_SOURCE_TYPE', f'Only RTL source/header files are accepted: {path}')
        if path.casefold() in seen:
            raise DomainError('SOURCE_COLLISION', f'Case-insensitive path collision: {path}')
        seen.add(path.casefold())
        total += len(source.content.encode('utf-8'))
        if total > 4_000_000:
            raise DomainError('IMPORT_QUOTA', 'Maximum total source size is 4 MB', 429)
    available = {s.path for s in files}
    for source in files:
        # Only literal contained includes are permitted; macros in include names need review.
        for line in source.content.splitlines():
            if re.match(r'^\s*`\s*(line|pragma)\b', line):
                raise DomainError('UNSUPPORTED_PREPROCESSOR', 'Line/pragma directives need a separately reviewed import flow')
            if re.match(r'^\s*`\s*include\b', line):
                match = re.fullmatch(r'\s*`\s*include\s+"([a-zA-Z0-9_./-]+)"\s*(?://.*)?', line)
                if not match or any(x in ('', '.', '..') for x in match[1].split('/')) or match[1].startswith('/'):
                    raise DomainError('UNSAFE_INCLUDE', f'Only literal project-contained includes are allowed: {source.path}')
                target = str(PurePosixPath(source.path).parent / match[1])
                if target not in available:
                    raise DomainError('MISSING_INCLUDE', f'Include not uploaded: {target}')
    return [{'path': s.path, 'sha256': digest(s.content.encode()), 'size': len(s.content.encode())} for s in files]


def validate_soc(soc):
    errors = []
    def error(code, identifier, message): errors.append({'code': code, 'id': identifier, 'message': message})
    ids = set()
    clocks = {c.id for c in soc.clocks}
    if len(clocks) != len(soc.clocks): error('DUPLICATE_CLOCK', soc.id, 'Clock IDs must be unique')
    instances = {i.id: i for i in soc.instances}
    for i in soc.instances:
        if i.id in ids: error('DUPLICATE_INSTANCE', i.id, 'Instance IDs must be unique')
        ids.add(i.id)
        ports = set()
        for p in i.interfaces:
            if p.id in ports: error('DUPLICATE_INTERFACE', f'{i.id}.{p.id}', 'Interface IDs must be unique')
            ports.add(p.id)
            if p.clock_domain not in clocks: error('UNKNOWN_CLOCK', f'{i.id}.{p.id}', 'Select a declared clock domain')
    for reset in soc.resets:
        if reset.clock_domain not in clocks: error('UNKNOWN_CLOCK', reset.id, 'Reset refers to an unknown clock domain')
    regions, region_ids = [], set()
    for r in soc.address_regions:
        if r.id in region_ids: error('DUPLICATE_REGION', r.id, 'Region IDs must be unique')
        region_ids.add(r.id)
        if r.instance_id not in instances: error('UNKNOWN_INSTANCE', r.id, 'Region owner does not exist')
        base, size, alignment = int(r.base, 16), int(r.size, 16), int(r.alignment, 16)
        if not size: error('EMPTY_REGION', r.id, 'Size must be positive')
        if alignment == 0 or alignment & (alignment-1) or base % alignment or size % alignment: error('ADDRESS_ALIGNMENT', r.id, 'Base and size must align to a nonzero power of two')
        if base + size > 1 << soc.address_width: error('ADDRESS_OVERFLOW', r.id, 'Range exceeds the selected address width')
        for p, a, z in regions:
            if size and z > a and base < z and a < base + size: error('ADDRESS_OVERLAP', r.id, f'Overlaps {p} using half-open address intervals')
        regions.append((r.id, base, base+size))
    used, edge_ids = set(), set()
    for e in soc.connections:
        if e.id in edge_ids: error('DUPLICATE_CONNECTION', e.id, 'Connection IDs must be unique')
        edge_ids.add(e.id)
        def find(endpoint):
            i = instances.get(endpoint.instance_id)
            return next((p for p in i.interfaces if p.id == endpoint.interface_id), None) if i else None
        a, b = find(e.from_), find(e.to)
        if not a or not b:
            error('UNKNOWN_ENDPOINT', e.id, 'Connection endpoint does not exist'); continue
        if a.role != 'initiator' or b.role != 'target': error('ROLE_MISMATCH', e.id, 'Connect an initiator to a target')
        if (a.protocol, a.data_width, a.address_width) != (b.protocol, b.data_width, b.address_width): error('BUS_MISMATCH', e.id, 'Protocol and widths must match; no bridge has been verified')
        if a.clock_domain != b.clock_domain: error('CLOCK_DOMAIN_MISMATCH', e.id, 'A reviewed CDC bridge is required')
        key = (e.to.instance_id, e.to.interface_id)
        if key in used: error('DUPLICATE_TARGET', e.id, 'A target already has an initiator')
        used.add(key)
    return errors
