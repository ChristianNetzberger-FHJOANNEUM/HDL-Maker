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

entity absval is
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

end absval ;

--
ARCHITECTURE rtl OF absval IS
BEGIN
  process(clk)
  begin
    if rising_edge(clk) then
      if reset = '1' then
        absval_o <= (others => '0');
      else
        en_o <= en_i;
        absval_o <= val_i;
        if val_i(val_i'left) = '1' then
          absval_o <= not val_i +1;
        end if;
      end if;
    end if;
   end process;   
          
END ARCHITECTURE rtl;

