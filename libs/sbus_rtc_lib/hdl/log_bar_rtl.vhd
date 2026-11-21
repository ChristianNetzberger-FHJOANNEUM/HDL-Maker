--
-- VHDL Architecture sbus_audio.log_bar.rtl
--
-- Created:
--          by - Net.UNKNOWN (M00443)
--          at - 21:07:58 31.01.2022
--
-- using Mentor Graphics HDL Designer(TM) 2017.1a (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity log_bar is
   generic( 
      dwidth_g : integer := 8
   );
   port( 
      clk        : in     std_logic;
      en_i       : in     std_logic;
      reset      : in     std_logic;
      val_i      : in     std_logic_vector (dwidth_g-1 downto 0);
      en_o       : out    std_logic;
      val_logbar : out    std_logic_vector (dwidth_g-1 downto 0)
   );

-- Declarations

end log_bar ;

--
architecture rtl of log_bar is
  signal result: std_logic_vector(dwidth_g-1 downto 0);
begin
  
  process(clk)
  variable tmp: std_logic_vector(dwidth_g-1 downto 0);
  begin
    if rising_edge(clk) then
      tmp := val_i;
      for i in dwidth_g-2 downto 0 loop
         tmp(i) := val_i(i) or tmp(i+1); 
      end loop;
      val_logbar <= tmp;
    end if;
  end process;
  
end architecture rtl;

