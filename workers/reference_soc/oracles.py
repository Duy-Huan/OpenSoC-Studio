"""Independent host arithmetic/prime oracles for UART emitted by actual RTL firmware."""
import math
import re

MASK = 0xffffffff
def signed(value): return value if value < 0x80000000 else value - 0x100000000


def arithmetic(a, b):
    sa, sb = signed(a), signed(b)
    if not b: quotient, remainder = -1, sa
    elif sa == -0x80000000 and sb == -1: quotient, remainder = sa, 0
    else:
        quotient = (abs(sa)//abs(sb)) * (-1 if (sa < 0) != (sb < 0) else 1)
        remainder = sa - quotient*sb
    return ([a*b & MASK, (sa*sb >> 32) & MASK, (sa*b >> 32) & MASK, (a*b >> 32) & MASK],
            [quotient & MASK, (a//b if b else MASK), remainder & MASK, (a % b if b else a)])


def check_uart(text, expected_tests):
    executed = re.findall(r'^([a-z0-9_]+)\.\.OK\s*$', text, re.M)
    assembly = sorted(executed) == sorted(expected_tests)
    primes = [(int(a), int(b)) for a, b in re.findall(r'(\d+)(?:st|nd|rd|th) prime is (\d+)\.', text)]
    expected_primes = [n for n in range(2, 130) if all(n%d for d in range(2, math.isqrt(n)+1))]
    prime_check = primes == list(enumerate(expected_primes, 1)) and 'checksum: 1772A48F OK' in text
    lines = text.splitlines(); vectors = 0; arithmetic_ok = True
    for i, line in enumerate(lines):
        match = re.fullmatch(r'input\s+\[[0-9A-Fa-f]{8}\]\s+([0-9A-Fa-f]{8})\s+\[[0-9A-Fa-f]{8}\]\s+([0-9A-Fa-f]{8})\s*', line)
        if not match: continue
        a, b = (int(v, 16) for v in match.groups()); mul, div = arithmetic(a, b)
        for offset, label, expected in [(1, 'hard mul', mul), (2, 'soft mul', mul), (3, 'hard div', div), (4, 'soft div', div)]:
            actual_line = lines[i+offset] if i+offset < len(lines) else ''
            actual = [int(v,16) for v in re.findall(r'\b[0-9A-Fa-f]{8}\b', actual_line)]
            arithmetic_ok &= actual_line.startswith(label) and actual == expected
        vectors += 1
    irq = {name: int(count) for name, count in re.findall(r'Number of (fast external|slow external|timer) IRQs counted: (\d+)', text)}
    return {'assembly_names': executed, 'assembly_complete': assembly, 'prime_values_correct': prime_check, 'prime_count': len(primes), 'arithmetic_vectors': vectors,
            'independent_arithmetic_correct': arithmetic_ok and vectors == 15, 'interrupt_counts': irq, 'interrupts_observed': len(irq) == 3 and all(v > 0 for v in irq.values())}
