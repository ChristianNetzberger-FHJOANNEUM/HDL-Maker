--
-- VHDL Architecture vga_lib.address_gen.rtl
--
-- Created:
--          by - Net.UNKNOWN (KPERSM7467)
--          at - 15:42:56 27.12.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

library work;
use work.utilities.all;

entity rom_address_gen is
   port( 
      -- Users to add ports here
      clk           : in     std_logic;
      cursor_x      : in     std_logic_vector (6 downto 0);
      cursor_y      : in     std_logic_vector (5 downto 0);
      h_cnt         : in     std_logic_vector (10 downto 0);
      reset         : in     std_logic;
      sbus_o        : in     sbus_o_t;
      scroll_index  : in     std_logic_vector (5 downto 0);
      v_cnt         : in     std_logic_vector (10 downto 0);
      char_rom_addr : out    std_logic_vector (9 downto 0);
      cursor_state  : out    std_logic;
      sbus_i        : out    sbus_i_t
   );

-- Declarations

end rom_address_gen ;

--
architecture rtl of rom_address_gen is
  signal cursor_match: std_logic;
  signal col_x: std_logic_vector(7 downto 0);
  signal line_y: std_logic_vector(6 downto 0);
  signal line_addr: std_logic_vector(6 downto 0);
  signal text_addr: std_logic_vector(14 downto 0);
  signal text_data: std_logic_vector(31 downto 0);
  signal text_byte: std_logic_vector(7 downto 0);
  signal cursor_tmp: std_logic;
  signal cursor_cnt: std_logic_vector(31 downto 0);
  signal cursor_cnt_tc: std_logic;
begin

--- line number in text buffer
line_addr <= v_cnt(9 downto 3) + scroll_index; 

---address for 4byte text in text buffer  
text_addr <= line_addr & h_cnt(10 downto 3); --is a byte address

--sbus attachment to textbuffer dpram----------------------
sbus_i.addr  <= "000" & text_addr(14 downto 2); --is a dword address
sbus_i.wdata <= (others => '0');
sbus_i.rd <= '1';
sbus_i.we <= '0';
sbus_i.be <= (others => '0');
text_data <= sbus_o.rdata;

--multiplexer to select text byte from text dword
with text_addr(1 downto 0) select
  text_byte <= text_data(31 downto 24) when "11",
               text_data(23 downto 16) when "10",  
               text_data(15 downto  8) when "01",
               text_data( 7 downto  0) when others; 

--select one of 8 lines for the text font                  
char_rom_addr <= text_byte(6 downto 0) & v_cnt(2 downto 0);

--detect the cursor location---- 
col_x    <= h_cnt(10 downto 3);
line_y   <= v_cnt(9 downto 3);
cursor_match <= '1' when (col_x=cursor_x) and ( line_addr = cursor_y) else '0';     

--generate a toggling signal if cursor location was detected
cursor_state <= cursor_tmp and cursor_match;

--modulo-25Mio counter to generate a 4Hz cursor toggling signal "cursor_tmp"-------
process(clk)
begin
   if rising_edge(clk) then
      if reset = '1' then
           cursor_cnt <= (others => '0');
           cursor_tmp <='0';
      elsif cursor_cnt_tc = '1' then
           cursor_cnt <= (others => '0');
           cursor_tmp <= not cursor_tmp;
      else
           cursor_cnt <= cursor_cnt+1;
      end if;
   end if;
end process;      
cursor_cnt_tc <= '1' when cursor_cnt = 25000000-1 else '0';     
 
end architecture rtl;

