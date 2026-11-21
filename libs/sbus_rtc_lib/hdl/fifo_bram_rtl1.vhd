--
-- VHDL Architecture dataflow_lib.fifo_bram.rtl
--
-- Created:
--          by - Net.UNKNOWN (KPERSM7467)
--          at - 18:56:05 28.12.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity fifo_bram_ringbuf is
   generic( 
      awidth_g : integer := 10;
      dwidth_g : integer := 32
   );
   port( 
      clk         : in     std_logic;
      reset       : in     std_logic;
      we_ack      : out    std_logic;
      wdata       : in     std_logic_vector (dwidth_g-1 downto 0);
      we          : in     std_logic;
      fifo_en     : in     std_logic;
      rd_ack      : out    std_logic;
      fifo_size   : out    std_logic_vector (15 downto 0);
      rdata       : out    std_logic_vector (dwidth_g-1 downto 0);
      raddr       : out    std_logic_vector (awidth_g-1 downto 0);
      waddr       : out    std_logic_vector (awidth_g-1 downto 0);
      rb_mode     : in     std_logic;
      rdptr_reset : in     std_logic;
      rd          : in     std_logic
   );

-- Declarations

end fifo_bram_ringbuf ;

--
architecture rtl of fifo_bram_ringbuf is
  type mem_t is array (0 to 2**awidth_g-1) of std_logic_vector(dwidth_g-1 downto 0);
  shared variable fifo_mem: mem_t;
  signal wrcnt, rdcnt, rdcnt_next: std_logic_vector(awidth_g-1 downto 0);
  signal wrptr, rdptr: integer;
  signal en: std_logic;

begin
  en <= '1';

---fifo bram-------
  process(clk)
  begin
    if rising_edge(clk) then
      if en = '1' then
        if we = '1' then
           fifo_mem(conv_integer(wrcnt)) := wdata;
        end if;
      end if;
    end if;
  end process;

  process(clk)
  begin
    if rising_edge(clk) then
        if reset = '1' or fifo_en = '0' then
           wrcnt <= (others => '0');
           rdcnt <= (others => '0');
        else
           if we = '1' then
             wrcnt <= wrcnt+1;
           end if;
           rd_ack <= '0';
           if rdptr_reset = '1' then
              rdcnt <= (others => '0');
           end if;
           if rd = '1' then
              if rb_mode = '0' then                 
                   rdcnt <= rdcnt+1;
                   rd_ack <= '1';   --- 1 clk read latency
              else 
                if (rdcnt_next /= wrcnt )then
                   rdcnt <= rdcnt+1;
                   rd_ack <= '1';   --- 1 clk read latency
                else
                   rdcnt <= (others => '0');
                end if;
              end if;
           end if;
         end if;
       fifo_size <= (others => '0');
       fifo_size(awidth_g-1 downto 0) <= (wrcnt -rdcnt);
     end if;
  end process;
  rdcnt_next <= rdcnt + 1;
  
  process(clk)
  begin
    if rising_edge(clk) then
       rdata <= fifo_mem(conv_integer(rdcnt));
    end if;
 end process;

 we_ack <= we;
 
 wrptr <= conv_integer(wrcnt);
 rdptr <= conv_integer(rdcnt);
 
 -- make write and read pointers external
 waddr <= wrcnt;
 raddr <= rdcnt;

end architecture rtl;

