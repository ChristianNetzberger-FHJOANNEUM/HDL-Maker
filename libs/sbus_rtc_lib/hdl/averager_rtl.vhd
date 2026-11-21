--
-- VHDL Architecture sbus_audio.averager.rtl
--
-- Created:
--          by - Net.UNKNOWN (M00443)
--          at - 19:14:36 31.01.2022
--
-- using Mentor Graphics HDL Designer(TM) 2017.1a (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity averager is
   generic( 
      dwidth_g : integer := 8;
      maxnum_g : integer := 256
   );
   port( 
      clk    : in     std_logic;
      reset  : in     std_logic;
      en_i   : in     std_logic;
      en_o   : out    std_logic;
      val_i  : in     std_logic_vector (23 downto 0);
      val_av : out    std_logic_vector (23 downto 0)
   );

-- Declarations

end averager ;

--
architecture rtl of averager is
begin
end architecture rtl;

