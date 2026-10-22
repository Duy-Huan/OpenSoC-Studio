// OpenSoC reference test instrumentation. Original upstream RTL remains unchanged.
`timescale 1ns/1ps
module opensoc_monitor;
  parameter [63:0] SEED = 64'd88172645463325252;
  integer fd, pc_fd, writes = 0, reads = 0;
  initial begin
    fd = $fopen("mmio.jsonl", "w");
    pc_fd = $fopen("fetch.jsonl", "w");
    #1 testbench.top.mem.xorshift64_state = SEED;
    if ($test$plusargs("opensoc_wave")) begin
      $dumpfile("waveform.vcd");
      $dumpvars(0, testbench.clk, testbench.resetn, testbench.trap,
        testbench.top.tests_passed, testbench.top.uut.picorv32_core.reg_pc,
        testbench.top.mem_axi_awvalid, testbench.top.mem_axi_awready, testbench.top.mem_axi_awaddr,
        testbench.top.mem_axi_wvalid, testbench.top.mem_axi_wready, testbench.top.mem_axi_wdata, testbench.top.mem_axi_wstrb,
        testbench.top.mem_axi_bvalid, testbench.top.mem_axi_bready,
        testbench.top.mem_axi_arvalid, testbench.top.mem_axi_arready, testbench.top.mem_axi_araddr,
        testbench.top.mem_axi_rvalid, testbench.top.mem_axi_rready, testbench.top.mem_axi_rdata);
    end
  end
  always @(posedge testbench.clk) if (testbench.resetn) begin
    if (testbench.top.mem_axi_arvalid && testbench.top.mem_axi_arready) begin
      reads = reads + 1;
      if (testbench.top.mem_axi_arprot[2] && reads < 2000)
        $fwrite(pc_fd, "{\"ticks\":\"%0d\",\"tick_fs\":\"1000000\",\"fetch_address\":\"0x%08x\"}\n", $time, testbench.top.mem_axi_araddr);
    end
    if (testbench.top.mem_axi_bvalid && testbench.top.mem_axi_bready) begin
      writes = writes + 1;
      if (testbench.top.mem.latched_waddr >= 32'h10000000)
        $fwrite(fd, "{\"schema_version\":\"1.0\",\"event_kind\":\"MMIO_WRITE\",\"transaction_id\":\"write-%0d\",\"sim_time\":{\"ticks\":\"%0d\",\"tick_fs\":\"1000000\",\"origin\":\"simulation_zero\"},\"address\":\"0x%08x\",\"write_data\":\"0x%08x\",\"byte_enable\":\"0x%01x\",\"correlation\":{\"kind\":\"DECODED\",\"confidence\":\"DERIVED\"}}\n", writes, $time, testbench.top.mem.latched_waddr, testbench.top.mem.latched_wdata, testbench.top.mem.latched_wstrb);
    end
  end
endmodule
