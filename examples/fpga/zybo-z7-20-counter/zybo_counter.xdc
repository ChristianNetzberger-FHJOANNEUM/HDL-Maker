# Zybo Z7-20 constraints for the existing zybo_counter entity.
# The Z7-10 example and its bitstream stay unchanged. This file is a separate build input.
#
# boardfiles/zybo-z7-20/A.0/part0_pins.xml:
#   sys_clk is PACKAGE_PIN K17, IOSTANDARD LVCMOS33.
#   leds_4bits_tri_o_0 is PACKAGE_PIN M14, IOSTANDARD LVCMOS33.
# boardfiles/zybo-z7-20/A.0/board.xml states frequency 125000000, which is a period of 8.000 ns.
#
# Digilent Zybo-Z7-Master.xdc, Rev. B, states that it is compatible with the Zybo Z7-20 and the Zybo Z7-10:
#   sysclk is PACKAGE_PIN K17, IOSTANDARD LVCMOS33, period 8.00, waveform {0 4}.
#   led[0] is PACKAGE_PIN M14, IOSTANDARD LVCMOS33.
# Both sources name the same pin, standard, and period. No other pin or period is added.

set_property PACKAGE_PIN K17 [get_ports {clk}]
set_property IOSTANDARD LVCMOS33 [get_ports {clk}]
create_clock -name sys_clk -period 8.000 -waveform {0 4} [get_ports {clk}]

set_property PACKAGE_PIN M14 [get_ports {led}]
set_property IOSTANDARD LVCMOS33 [get_ports {led}]
