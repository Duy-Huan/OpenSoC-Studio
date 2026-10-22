"""Fixed syscall-emulation RISC-V board; not vendor CPU RTL or hybrid MMIO."""
import json
import sys
import m5
from m5.objects import System, SrcClockDomain, VoltageDomain, AddrRange, RiscvTimingSimpleCPU, SystemXBar, MemCtrl, DDR3_1600_8x8, SEWorkload, Process, Root

system=System()
system.clk_domain=SrcClockDomain(clock='1GHz',voltage_domain=VoltageDomain())
system.mem_mode='timing';system.mem_ranges=[AddrRange('512MiB')]
system.cpu=RiscvTimingSimpleCPU()
system.membus=SystemXBar()
system.cpu.icache_port=system.membus.cpu_side_ports;system.cpu.dcache_port=system.membus.cpu_side_ports
system.cpu.createInterruptController()
system.mem_ctrl=MemCtrl(dram=DDR3_1600_8x8(range=system.mem_ranges[0]))
roundtrip=len(sys.argv)>2 and sys.argv[2]=='tlm_roundtrip'
if roundtrip:
    from m5.objects import Gem5ToTlmBridge64, TlmToGem5Bridge64, SystemC_Kernel, CommMonitor
    system.to_tlm=Gem5ToTlmBridge64(addr_ranges=system.mem_ranges)
    system.from_tlm=TlmToGem5Bridge64()
    system.before_tlm=CommMonitor();system.after_tlm=CommMonitor()
    system.membus.mem_side_ports=system.before_tlm.cpu_side_port
    system.before_tlm.mem_side_port=system.to_tlm.gem5
    system.to_tlm.tlm=system.from_tlm.tlm
    system.from_tlm.gem5=system.after_tlm.cpu_side_port
    system.after_tlm.mem_side_port=system.mem_ctrl.port
else: system.mem_ctrl.port=system.membus.mem_side_ports
system.system_port=system.membus.cpu_side_ports
system.workload=SEWorkload.init_compatible(sys.argv[1]);system.cpu.workload=Process(cmd=[sys.argv[1]])
system.cpu.createThreads()
if roundtrip: root=Root(full_system=False,system=system,systemc_kernel=SystemC_Kernel())
else: root=Root(full_system=False,system=system)
m5.ticks.setGlobalFrequency('1THz')
m5.instantiate();event=m5.simulate(1000000000)
m5.stats.dump()
with open('gem5-exit.json','w') as stream: json.dump({'tick':str(m5.curTick()),'tick_fs':'1000','origin':'simulation_zero','cause':event.getCause(),'code':event.getCode(),'fidelity':'GEM5_TIMING_CPU_INTERNAL_SYSTEMC_TLM_ROUNDTRIP_NOT_RTL' if roundtrip else 'GEM5_TIMING_CPU_SYSCALL_EMULATION_NOT_RTL'},stream)
print('GEM5_EXIT',event.getCause(),event.getCode())
raise SystemExit(0 if event.getCode()==0 and event.getCause()=='exiting with last active thread context' else 1)
