LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
library std;
use std.textio.all;

entity bhv_source_real_dual is
generic( 
   filename : string := "signal.txt"
);
port( 
   clk    : in     std_logic;
   reset  : in     std_logic;
   enable : in     std_logic;
   sig0   : out    real;
   sig1   : out    real
);
end entity bhv_source_real_dual;

--
architecture bhv of bhv_source_real_dual is
  signal sig0_int: real := 0.0;
  signal sig1_int: real := 0.0;
  signal enable_q: std_logic;
begin
  
  -- process to read a text-file
file_read: process
   file text_file: text open read_mode is filename;
   variable l: line;
   variable value: real;
   variable i: integer := 0;
   begin
         while not endfile(text_file) loop
           if reset = '0' and enable = '1' and enable_q = '0' then --sensitive to rising edge of enable
              readline (text_file,l);
              read(l,value);
              sig0_int  <= value;
              read(l,value);
              sig1_int  <= value;
            end if;
            enable_q <= enable;
           wait until clk ='1' and clk'event;
         end loop;
         wait;
end process;

-- assign internal signal to output
sig0 <= sig0_int;
sig1 <= sig1_int;

end architecture bhv;
