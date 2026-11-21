--
-- VHDL Architecture zybo_rtc_lib.dma_wr_mux.rtl
--
-- Created:
--          by - net.UNKNOWN (KPERSM7467)
--          at - 11:55:46 14.05.2018
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity dma_wr_mux is
   port( 
      clk         : in     std_logic;
      mux_control : in     std_logic;
      reset       : in     std_logic;
      wdata64     : in     std_logic_vector (63 downto 0);
      wdata32     : in     std_logic_vector (31 downto 0);
      we          : in     std_logic;
      wr_enable   : in     std_logic;
      dma_wdata   : out    std_logic_vector (63 downto 0);
      dma_we      : out    std_logic
   );

-- Declarations

end dma_wr_mux ;

--
architecture rtl of dma_wr_mux is
  signal mux: std_logic;
  signal wdata32_reg: std_logic_vector(31 downto 0);
begin
  process(clk)
  begin
    if rising_edge(clk) then
        if reset = '1' or wr_enable = '0' or mux_control = '0' then
          mux <= '0';
        elsif we = '1' then
          mux <= not mux;
        end if;
      end if;
    end process;
  dma_we <= we and mux when mux_control = '1' else we; 

  -- create parallel 64-bit word from two serial 32-bit words
  process(clk)
  begin
     if rising_edge(clk) then
        if we = '1' then
           wdata32_reg <= wdata32(31 downto 0);
        end if;
      end if;
    end process;
  dma_wdata <= wdata64 when mux_control = '0' else wdata32 & wdata32_reg;
end architecture rtl;

