.section .rodata
pass_message: .ascii "GEM5_WORKLOAD_PASS sum=5050\n"
.equ PASS_LENGTH, .-pass_message
fail_message: .ascii "GEM5_WORKLOAD_FAIL\n"
.section .text
.option norelax
.global _start
_start:
  la t0, values
  li t1, 1
  li t2, 101
  li s0, 0
1:
  sd t1, 0(t0)
  ld t3, 0(t0)
  add s0, s0, t3
  addi t0, t0, 8
  addi t1, t1, 1
  blt t1, t2, 1b
  li t4, 5050
  bne s0, t4, fail
  li t1, -7
  li t2, 3
  div t3, t1, t2
  li t4, -2
  bne t3, t4, fail
  rem t3, t1, t2
  li t4, -1
  bne t3, t4, fail
#ifdef NEGATIVE_CONTROL
  j fail
#endif
  li a0, 1
  la a1, pass_message
  li a2, PASS_LENGTH
  li a7, 64
  ecall
  li a0, 0
  li a7, 93
  ecall
fail:
  li a0, 1
  la a1, fail_message
  li a2, 19
  li a7, 64
  ecall
  li a0, 1
  li a7, 93
  ecall
.section .bss
.balign 8
values: .space 800
