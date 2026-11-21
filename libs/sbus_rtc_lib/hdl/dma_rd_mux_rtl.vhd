--
-- VHDL Architecture zybo_rtc_lib.dma_rd_mux.rtl
--
-- Created:
--          by - net.UNKNOWN (KPERSM7467)
--          at - 21:01:11 08.05.2018
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity dma_rd_mux is
   port( 
      clk         : in     std_logic;
      mux_control : in     std_logic;
      dma_rdata   : in     std_logic_vector (63 downto 0);
      rd          : in     std_logic;
      rd_enable   : in     std_logic;
      reset       : in     std_logic;
      dma_rd      : out    std_logic;
      rdata32     : out    std_logic_vector (31 downto 0);
      rdata64     : out    std_logic_vector (63 downto 0)
   );

-- Declarations

end dma_rd_mux ;

--
architecture rtl of dma_rd_mux is
  signal mux: std_logic;
begin
  process(clk)
  begin
    if rising_edge(clk) then
        if reset = '1' or rd_enable = '0' or mux_control = '0' then
          mux <= '0';
        elsif rd = '1' then
          mux <= not mux;
        end if;
      end if;
    end process;
  dma_rd <= rd and mux when mux_control = '1' else rd; 
  rdata64(31 downto 0)  <= dma_rdata(31 downto 0) when mux = '0' else dma_rdata(63 downto 32);
  rdata64(63 downto 32) <= dma_rdata(63 downto 32);
  rdata32 <= dma_rdata(31 downto 0) when mux = '0' else dma_rdata(63 downto 32);
end architecture rtl;

