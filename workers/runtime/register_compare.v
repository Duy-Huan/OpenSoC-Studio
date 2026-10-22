`timescale 1ns/1ps
module register_compare;
  reg clk_i=0, rst_ni=0, write_en_i=0;
  reg [31:0] data_i=0;
  wire [31:0] rtl_value, gate_value;
  register_bank rtl(clk_i,rst_ni,write_en_i,data_i,rtl_value);
  register_bank_gate gate(clk_i,rst_ni,write_en_i,data_i,gate_value);
  always #5 clk_i=~clk_i;
  task check(input [31:0] expected);
    begin
      #1;
      if (rtl_value !== expected || gate_value !== expected) $fatal(1,"REGISTER_ORACLE_FAIL expected=%h rtl=%h gate=%h",expected,rtl_value,gate_value);
    end
  endtask
  integer i;
  initial begin
    $dumpfile("register.vcd"); $dumpvars(0,register_compare);
    @(posedge clk_i); check(0);
    @(negedge clk_i); rst_ni=1;
    for(i=0;i<16;i=i+1) begin
      @(negedge clk_i); write_en_i=1; data_i=32'h12345678 ^ (32'h1020304*i);
      @(posedge clk_i); check(data_i);
      @(negedge clk_i); write_en_i=0; data_i=~data_i;
      @(posedge clk_i); check(~data_i);
    end
    @(negedge clk_i); rst_ni=0; check(0);
`ifdef NEGATIVE_CONTROL
    check(1);
`endif
    $display("REGISTER_ORACLE_PASS vectors=16 hold=16 reset=2"); $finish;
  end
endmodule
