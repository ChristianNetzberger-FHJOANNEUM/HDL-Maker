LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
library std;
use std.textio.all;

entity bhv_sink_real_dual is
generic( 
   filename : string := "signal.txt"
);
port( 
   clk    : in     std_logic;
   reset  : in     std_logic;
   enable : in     std_logic;
   sig0   : in    real;
   sig1   : in    real
);
end entity bhv_sink_real_dual;

--
architecture bhv of bhv_sink_real_dual is
  signal sig0_int: real := 0.0;
  signal sig1_int: real := 0.0;
  signal enable_q: std_logic;
begin
  
  -- process to read a text-file
file_read: process
   file text_file: text open write_mode is filename;
   variable l: line;
   variable value: real;
   variable i: integer := 0;
   variable whitespace: character := ' ';
   begin
           if reset = '0' and enable = '1' and enable_q = '0' then --sensitive to rising edge of enable
              write(l,sig0);
              write(l,whitespace);
              write(l,sig1);
              writeline (text_file,l);
           end if;
           enable_q <= enable;
           wait until clk ='1' and clk'event;
end process;


end architecture bhv;
