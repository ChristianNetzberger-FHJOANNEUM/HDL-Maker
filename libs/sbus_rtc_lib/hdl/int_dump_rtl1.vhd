--
-- VHDL Architecture sbus_audio.int_dump.rtl
--
-- Created:
--          by - Net.UNKNOWN (M00443)
--          at - 19:39:31 31.01.2022
--
-- using Mentor Graphics HDL Designer(TM) 2017.1a (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity Copy_of_int_dump is
   generic( 
      dwidth_g : integer := 8
   );
   port( 
      clk      : in     std_logic;
      dump     : in     std_logic_vector (7 downto 0);
      en_i     : in     std_logic;
      reset    : in     std_logic;
      scale    : in     std_logic_vector (2 downto 0);
      val_i    : in     std_logic_vector (dwidth_g-1 downto 0);
      en_o     : out    std_logic;
      val_dump : out    std_logic_vector (dwidth_g-1 downto 0)
   );

-- Declarations

end Copy_of_int_dump ;

--
architecture rtl of Copy_of_int_dump is
begin
-- dummy code to avoid blackbox   replace with YOUR CODE!
en_o <= en_i;          

end architecture rtl;

