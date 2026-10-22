`timescale 1ns/1ps
module opensoc_counter_monitor;
  initial begin
    #6000;
    $display("OPENSOC_RESET_ASSERT");
    testbench.resetn = 0;
    #200;
    $display("OPENSOC_RESET_RELEASE");
    testbench.resetn = 1;
  end
  always @(posedge testbench.clk) if (testbench.resetn && testbench.trap)
    $fatal(1, "Unexpected CPU trap in counter regression");
endmodule
