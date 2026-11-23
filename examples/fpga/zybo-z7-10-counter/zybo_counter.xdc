# Pins and the clock frequency are taken from boardfiles/zybo-z7-10/A.0.
# sys_clk is PACKAGE_PIN K17, IOSTANDARD LVCMOS33.
# board.xml states frequency 125000000, which is a period of 8.000 ns.
# leds_4bits_tri_o_0 is PACKAGE_PIN M14, IOSTANDARD LVCMOS33.
# No other pin or period is added.

set_property PACKAGE_PIN K17 [get_ports {clk}]
set_property IOSTANDARD LVCMOS33 [get_ports {clk}]
create_clock -name sys_clk -period 8.000 [get_ports {clk}]

set_property PACKAGE_PIN M14 [get_ports {led}]
set_property IOSTANDARD LVCMOS33 [get_ports {led}]
