"""ELF structural and board-range validation. This module does not execute firmware."""
import struct
from .domain import DomainError

IBEX = {'id': 'ibex_simple_system_small', 'xlen': 32, 'endianness': 'little', 'machine': 243,
        'memory_base': 0x100000, 'memory_size': 0x100000, 'boot_entry': 0x100080,
        'source_revision': '1b29dae8866e6c0f0a3cd9dead53a77b4f45e357', 'runtime_status': 'UNSUPPORTED'}


def inspect_elf(data: bytes, profile=IBEX):
    def reject(code, message): raise DomainError(code, message)
    if len(data) < 16 or data[:4] != b'\x7fELF': reject('ELF_MAGIC_INVALID', 'Expected an ELF image')
    if data[4] not in {1, 2} or data[5] not in {1, 2} or data[6] != 1: reject('ELF_FORMAT_UNSUPPORTED', 'Unknown ELF class, byte order or version')
    xlen = 32 if data[4] == 1 else 64
    endian = '<' if data[5] == 1 else '>'
    header = struct.Struct(endian + ('HHIIIIIHHHHHH' if xlen == 32 else 'HHIQQQIHHHHHH'))
    if len(data) < 16 + header.size: reject('ELF_TRUNCATED', 'ELF header is truncated')
    typ, machine, elf_version, entry, phoff, _, flags, ehsize, phentsize, phnum, _, _, _ = header.unpack_from(data, 16)
    if typ != 2 or elf_version != 1: reject('ELF_TYPE_UNSUPPORTED', 'A linked executable ELF (ET_EXEC) is required')
    if ehsize != 16 + header.size: reject('ELF_HEADER_INVALID', 'ELF header size is inconsistent')
    if machine != profile['machine'] or xlen != profile['xlen'] or data[5] != 1: reject('FIRMWARE_ISA_MISMATCH', 'Board profile requires little-endian ELF32 RISC-V')
    if flags & 0x6: reject('FIRMWARE_ABI_MISMATCH', 'The selected Ibex profile does not implement floating-point ABI')
    if flags & 0x8: reject('FIRMWARE_ABI_MISMATCH', 'RV32E is not selected in this small profile')
    ph = struct.Struct(endian + ('IIIIIIII' if xlen == 32 else 'IIQQQQQQ'))
    if not phnum or phnum > 256 or phentsize != ph.size or phoff < ehsize or phoff + phnum*phentsize > len(data): reject('ELF_SEGMENTS_INVALID', 'Invalid or truncated program header table')
    segments = []
    for i in range(phnum):
        fields = ph.unpack_from(data, phoff+i*phentsize)
        if xlen == 32: ptype, offset, vaddr, paddr, filesz, memsz, permissions, align = fields
        else: ptype, permissions, offset, vaddr, paddr, filesz, memsz, align = fields
        if ptype != 1: continue
        if filesz > memsz or offset+filesz > len(data): reject('ELF_SEGMENT_TRUNCATED', f'LOAD segment {i} exceeds file bounds')
        if paddr != vaddr: reject('ELF_RELOCATION_UNSUPPORTED', 'Physical and virtual LOAD addresses must match for this bare-metal profile')
        if align > 1 and (align & (align-1) or vaddr % align != offset % align): reject('ELF_SEGMENT_ALIGNMENT', f'LOAD segment {i} is misaligned')
        base, end = profile['memory_base'], profile['memory_base'] + profile['memory_size']
        if paddr < base or paddr + memsz > end: reject('FIRMWARE_MEMORY_CONFLICT', f'LOAD segment {i} lies outside board RAM')
        if any(paddr < int(s['address'], 16)+s['memory_size'] and int(s['address'], 16) < paddr+memsz for s in segments): reject('ELF_SEGMENT_OVERLAP', 'Overlapping LOAD segments are unsupported')
        segments.append({'address': hex(paddr), 'file_offset': offset, 'file_size': filesz, 'memory_size': memsz, 'flags': permissions})
    if not segments or not any(s['flags'] & 1 and int(s['address'], 16) <= entry < int(s['address'], 16)+s['memory_size'] for s in segments): reject('FIRMWARE_ENTRY_INVALID', 'Entry must lie in an executable LOAD segment')
    if entry != profile['boot_entry']: reject('FIRMWARE_BOOT_CONFLICT', 'ELF entry must match the pinned Simple System reset boot entry 0x100080')
    return {'schema_version': '1.0', 'format': 'elf', 'xlen': xlen, 'machine': machine, 'endianness': 'little', 'entry': hex(entry), 'elf_flags': hex(flags), 'segments': segments, 'profile_id': profile['id'], 'profile_revision': profile['source_revision'], 'compatibility': 'STRUCTURAL_CHECKS_PASSED', 'isa_extensions': 'NOT_FULLY_DERIVABLE_FROM_ELF_HEADER', 'simulation_executed': False, 'boot_verified': False}
