--
-- VHDL Architecture training_lib.comp_dds.rtl
--
-- Created:
--          by - net.UNKNOWN (KPERSM7467)
--          at - 18:39:35 27.10.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity comp_dds_wavgen is
   generic( 
      nbits_g    : integer := 32;
      unsigned_g : boolean := true
   );
   port( 
      fcw        : in     std_logic_vector (nbits_g-1 downto 0);
      reset      : in     std_logic;
      enable_i   : in     std_logic;
      clk        : in     std_logic;
      dds_ramp   : out    std_logic_vector (nbits_g-1 downto 0);
      dds_rect   : out    std_logic_vector (nbits_g-1 downto 0);
      dds_triang : out    std_logic_vector (nbits_g-1 downto 0);
      dds_strobe : out    std_logic;
      dds_wave   : out    std_logic;
      enable_o   : out    std_logic
   );

-- Declarations

end comp_dds_wavgen ;

--
architecture rtl of comp_dds_wavgen is
  signal accu: std_logic_vector(nbits_g-1 downto 0);
  signal accu_msb,accu_msb_q0: std_logic;
  signal ramp,rectangular, triangular, triangular_tmp: std_logic_vector(nbits_g-1 downto 0);
  signal sign_mask: std_logic_vector(nbits_g-1 downto 0);
  signal enable_q: std_logic;
begin
  
  --accumulator------------------
  --integrates the frequency control word fcw
  process(clk)
  begin
    if rising_edge(clk) then
      if reset = '1' then
         accu <= (others => '0');
      else
         enable_q <= enable_i;       
         if enable_i = '1' then
            accu <= accu + fcw;
         end if;
      end if;
    end if;
  end process;

  --- most significant bit (msb) of accumulator
  accu_msb <= accu(accu'left);
  
  ---falling edge detection to generate strobe signal
  process(clk)
  begin
    if rising_edge(clk) then
      if reset = '1' then
         accu_msb_q0 <= '0';
      else
         accu_msb_q0 <= accu_msb;
      end if;
    end if;
  end process;
  
  dds_strobe    <= '1' when accu_msb = '0' and accu_msb_q0 = '1' else '0';
  dds_wave      <= accu_msb;   --rectangular waveform 50% duty cycle
  
  ---waveform generation-----------------
  --unsigned values
  ramp            <= accu;                                              --range 0 to 2**(nbits_g)-1
  triangular_tmp  <= accu when accu(accu'left) = '0' else not accu  ;   --range 0 to 2**(nbits_g-1)-1
  triangular   <= triangular_tmp(triangular_tmp'left-1 downto 0) & '0'; -- multiply by two
  rectangular  <= (others => accu(accu'left));                          --range 0 to 2**(nbits_g)-1
                                                                        -- MSB to all positions

 ---register output signals and convert to signed or unsigned, depending on the generic unsigned_g
  sign_mask <= (others => '0') when unsigned_g else (nbits_g-1 => '1', others => '0');
  
  process(clk)
  begin
    if rising_edge(clk) then
      dds_ramp <= ramp xor sign_mask;
      dds_triang <= triangular xor sign_mask;
      dds_rect <= rectangular xor sign_mask;
      enable_o <= enable_q;
    end if;
  end process;
  
--alternate boolean equation for strobe:
--  strobe <= not accu_msb and accu_msb_q0;

-- 
end architecture rtl;

