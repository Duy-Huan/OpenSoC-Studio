// OpenSoC sample source. Project-owned license pending owner selection.
// This example is a pin-level register. No bus or simulation verification claim.
module register_bank #(
  parameter int DATA_WIDTH = 32
) (
  input  logic                  clk_i,
  input  logic                  rst_ni,
  input  logic                  write_en_i,
  input  logic [DATA_WIDTH-1:0] data_i,
  output logic [DATA_WIDTH-1:0] data_o
);
  always_ff @(posedge clk_i or negedge rst_ni) begin
    if (!rst_ni) data_o <= '0;
    else if (write_en_i) data_o <= data_i;
  end
endmodule
