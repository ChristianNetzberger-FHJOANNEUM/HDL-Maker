--
-- VHDL Architecture proj_audio_lib.comp_pwm.rtl
--
-- Created:
--          by - net.UNKNOWN (KPERSM7467)
--          at - 20:10:11 06.11.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity comp_pwm is
   generic( 
      nbits_g : integer := 8
   );
   port( 
      clk       : in     std_logic;
      reset     : in     std_logic;
      sample_en : in     std_logic;
      sig_i     : in     std_logic_vector (nbits_g-1 downto 0);
      pwm_o     : out    std_logic
   );

-- Declarations

end comp_pwm ;

--
architecture rtl of comp_pwm is
  signal cnt: std_logic_vector(nbits_g-1 downto 0);
  signal sig_binoffset: std_logic_vector(sig_i'range);
begin
  
  process(clk)
  begin
    if rising_edge(clk) then
      if reset = '1' then
        cnt <= (others => '0');
      else
        if sample_en = '1' then
          cnt <= (others => '0');
        else
          cnt <= cnt+1;
        end if;
      end if;
    end if;
  end process;
  
  sig_binoffset <= not sig_i(sig_i'left) & sig_i(sig_i'left-1 downto 0);   
  pwm_o <= '1' when cnt < sig_binoffset else '0';      
      
end architecture rtl;

