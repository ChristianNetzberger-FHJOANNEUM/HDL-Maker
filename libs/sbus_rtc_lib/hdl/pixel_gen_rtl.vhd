--
-- VHDL Architecture vga_lib.pixel_gen.rtl
--
-- Created:
--          by - Net.UNKNOWN (KPERSM7467)
--          at - 16:22:54 27.12.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
library work;
use work.utilities.all;

entity pixel_gen is
   port( 
      char_rom_line: in     std_logic_vector (7 downto 0);
      clk          : in     std_logic;
      cursor_state : in     std_logic;
      font_column  : in     std_logic_vector (2 downto 0);
      reset        : in     std_logic;
      char_rgb     : out    std_logic_vector (23 downto 0) 
   );

-- Declarations

end pixel_gen ;

--
architecture rtl of pixel_gen is
  signal char_pixel: std_logic;
  signal char_pixel_cursor: std_logic;
begin
  
  --demultiplex individual pixel values from character font line
  process(clk)
  begin
   if  rising_edge(clk)  then
       case font_column is
            when "000" =>  char_pixel <= char_rom_line(7);
            when "001" =>  char_pixel <= char_rom_line(6);
            when "010" =>  char_pixel <= char_rom_line(5);
            when "011" =>  char_pixel <= char_rom_line(4);
            when "100" =>  char_pixel <= char_rom_line(3);
            when "101" =>  char_pixel <= char_rom_line(2);
            when "110" =>  char_pixel <= char_rom_line(1);
            when "111" =>  char_pixel <= char_rom_line(0);
            when others => null;
       end case;
   end if;
end process;

--apply toggling the pixel values to show cursor
char_pixel_cursor <= char_pixel  xor cursor_state ;

--map pure black and white colors to binary pixel values
char_rgb <= X"FFFFFF" when char_pixel_cursor= '1' else
            X"000000"; 

end architecture rtl;

