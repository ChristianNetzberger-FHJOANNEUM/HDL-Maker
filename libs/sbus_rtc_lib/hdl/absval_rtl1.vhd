--
-- VHDL Architecture sbus_audio.absval.rtl
--
-- Created:
--          by - Net.UNKNOWN (M00443)
--          at - 18:54:00 31.01.2022
--
-- using Mentor Graphics HDL Designer(TM) 2017.1a (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity Copy_of_absval is
   generic( 
      dwidth_g : integer := 8
   );
   port( 
      clk      : in     std_logic;
      val_i    : in     std_logic_vector (dwidth_g-1 downto 0);
      en_i     : in     std_logic;
      reset    : in     std_logic;
      absval_o : out    std_logic_vector (dwidth_g-1 downto 0);
      en_o     : out    std_logic
   );

-- Declarations

end Copy_of_absval ;

--
ARCHITECTURE rtl OF Copy_of_absval IS
BEGIN
-- dummy code to avoid blackbox   replace with YOUR CODE!
en_o <= en_i;          
END ARCHITECTURE rtl;

