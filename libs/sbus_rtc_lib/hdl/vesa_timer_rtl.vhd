--
-- VHDL Architecture opb_vga_v1_00_a.vga_timer.rtl
--
-- Created:
--          by - net.UNKNOWN (KPERSM4268)
--          at - 13:32:59 23.01.2009
--
-- using Mentor Graphics HDL Designer(TM) 2007.1 (Build 19)
--
library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity vesa_timer is
   generic( 
      vga_mode_g : string := "VGA_640_480_60"
   );
   port( 
      clk      : in     std_logic;
      reset    : in     std_logic;
      frame_en : out    std_logic;
      h_active : out    std_logic;
      h_cnt    : out    std_logic_vector (10 downto 0);
      hsync    : out    std_logic;
      line_en  : out    std_logic;
      v_active : out    std_logic;
      v_cnt    : out    std_logic_vector (10 downto 0);
      vsync    : out    std_logic
   );

-- Declarations

end vesa_timer ;

--
architecture rtl of vesa_timer is

signal cnt: std_logic_vector(1 downto 0);
signal h_cnt_int: std_logic_vector(h_cnt'range);
signal v_cnt_int: std_logic_vector(v_cnt'range);
signal pixel_en_int: std_logic;
signal line_en_int: std_logic;
signal frame_en_int: std_logic;

--------------------------------------------------------------
constant vga640_480_60_nlines_c: integer := 521;
constant vga640_480_60_npixels_c: integer := 800;
constant vga640_480_60_active_lines_c: integer := 480;
constant vga640_480_60_active_pixels_c: integer := 640;

constant vga640_480_60_h_front_porch_c: integer := 16;
constant vga640_480_60_h_back_porch_c: integer := 48;
constant vga640_480_60_h_sync_c: integer := 96;

constant vga640_480_60_v_front_porch_c: integer := 10;
constant vga640_480_60_v_back_porch_c: integer := 29;
constant vga640_480_60_v_sync_c: integer := 2;

--------------------------------------------------------------
constant vga800_600_72_nlines_c: integer := 666;
constant vga800_600_72_npixels_c: integer := 1040;
constant vga800_600_72_active_lines_c: integer := 600;
constant vga800_600_72_active_pixels_c: integer := 800;

constant vga800_600_72_h_front_porch_c: integer := 56;
constant vga800_600_72_h_back_porch_c: integer := 64;
constant vga800_600_72_h_sync_c: integer := 120;

constant vga800_600_72_v_front_porch_c: integer := 37;
constant vga800_600_72_v_back_porch_c: integer := 23;
constant vga800_600_72_v_sync_c: integer := 6;
--------------------------------------------------------------
constant vga1024_768_70_nlines_c: integer := 806;
constant vga1024_768_70_npixels_c: integer := 1328;
constant vga1024_768_70_active_lines_c: integer := 768;
constant vga1024_768_70_active_pixels_c: integer := 1024;

constant vga1024_768_70_h_front_porch_c: integer := 24;
constant vga1024_768_70_h_back_porch_c: integer := 144;
constant vga1024_768_70_h_sync_c: integer := 136;

constant vga1024_768_70_v_front_porch_c: integer := 6;
constant vga1024_768_70_v_back_porch_c: integer := 29;
constant vga1024_768_70_v_sync_c: integer := 6;
--------------------------------------------------------------

constant vga1280_720_60_nlines_c: integer := 750;
constant vga1280_720_60_npixels_c: integer := 1648;
constant vga1280_720_60_active_lines_c: integer := 720;
constant vga1280_720_60_active_pixels_c: integer := 1280;

constant vga1280_720_60_h_front_porch_c: integer := 72;
constant vga1280_720_60_h_back_porch_c: integer := 216;
constant vga1280_720_60_h_sync_c: integer := 80;

constant vga1280_720_60_v_front_porch_c: integer := 3;
constant vga1280_720_60_v_back_porch_c: integer := 22;
constant vga1280_720_60_v_sync_c: integer := 5;
--------------------------------------------------------------

signal nlines_c: integer := vga640_480_60_nlines_c;
signal npixels_c: integer := vga640_480_60_npixels_c;
signal active_lines_c: integer := vga640_480_60_active_lines_c;
signal active_pixels_c: integer := vga640_480_60_active_pixels_c;

signal h_front_porch_c: integer := vga640_480_60_h_front_porch_c;
signal h_back_porch_c: integer := vga640_480_60_h_back_porch_c;
signal h_sync_c: integer := vga640_480_60_h_sync_c;

signal v_front_porch_c: integer := vga640_480_60_v_front_porch_c;
signal v_back_porch_c: integer := vga640_480_60_v_back_porch_c;
signal v_sync_c: integer := vga640_480_60_v_sync_c;

-----------------------------------------------------------------

signal h0,h1,v0,v1: integer;

begin

------------------------------------------------------------------
g0: if vga_mode_g = "VGA_640_480_60" generate
 nlines_c        <= vga640_480_60_nlines_c;
 npixels_c       <= vga640_480_60_npixels_c;
 active_lines_c  <= vga640_480_60_active_lines_c;
 active_pixels_c <= vga640_480_60_active_pixels_c;

 h_front_porch_c <=  vga640_480_60_h_front_porch_c;
 h_back_porch_c  <=  vga640_480_60_h_back_porch_c;
 h_sync_c        <=  vga640_480_60_h_sync_c;

 v_front_porch_c <=  vga640_480_60_v_front_porch_c;
 v_back_porch_c  <=  vga640_480_60_v_back_porch_c;
 v_sync_c        <=  vga640_480_60_v_sync_c;
end generate g0;

g1: if vga_mode_g = "VGA_800_600_72" generate
 nlines_c        <= vga800_600_72_nlines_c;
 npixels_c       <= vga800_600_72_npixels_c;
 active_lines_c  <= vga800_600_72_active_lines_c;
 active_pixels_c <= vga800_600_72_active_pixels_c;

 h_front_porch_c <=  vga800_600_72_h_front_porch_c;
 h_back_porch_c  <=  vga800_600_72_h_back_porch_c;
 h_sync_c        <=  vga800_600_72_h_sync_c;

 v_front_porch_c <=  vga800_600_72_v_front_porch_c;
 v_back_porch_c  <=  vga800_600_72_v_back_porch_c;
 v_sync_c        <=  vga800_600_72_v_sync_c;
end generate g1;

g2: if vga_mode_g = "VGA_1024_768_70" generate
 nlines_c        <= vga1024_768_70_nlines_c;
 npixels_c       <= vga1024_768_70_npixels_c;
 active_lines_c  <= vga1024_768_70_active_lines_c;
 active_pixels_c <= vga1024_768_70_active_pixels_c;

 h_front_porch_c <=  vga1024_768_70_h_front_porch_c;
 h_back_porch_c  <=  vga1024_768_70_h_back_porch_c;
 h_sync_c        <=  vga1024_768_70_h_sync_c;

 v_front_porch_c <=  vga1024_768_70_v_front_porch_c;
 v_back_porch_c  <=  vga1024_768_70_v_back_porch_c;
 v_sync_c        <=  vga1024_768_70_v_sync_c;
end generate g2;
  
g3: if vga_mode_g = "VGA_1280_720_60" generate
 nlines_c        <= vga1280_720_60_nlines_c;
 npixels_c       <= vga1280_720_60_npixels_c;
 active_lines_c  <= vga1280_720_60_active_lines_c;
 active_pixels_c <= vga1280_720_60_active_pixels_c;

 h_front_porch_c <=  vga1280_720_60_h_front_porch_c;
 h_back_porch_c  <=  vga1280_720_60_h_back_porch_c;
 h_sync_c        <=  vga1280_720_60_h_sync_c;

 v_front_porch_c <=  vga1280_720_60_v_front_porch_c;
 v_back_porch_c  <=  vga1280_720_60_v_back_porch_c;
 v_sync_c        <=  vga1280_720_60_v_sync_c;
end generate g3;
  
       
    
   -- horizontal timing --
   -- a horizontal line duration is 800 pixel clock periods (32us)
   -- modulo-800 counter running at pixel clock speed
   process(clk)
     begin
       if clk='1' and clk'event then
         if reset = '1' then
           h_cnt_int <= (others => '0');
         else
           if h_cnt_int = npixels_c-1 then
              h_cnt_int <= (others => '0');
           else  
              h_cnt_int <= h_cnt_int+1;
           end if;
         end if;
       end if;
     end process;
  
    --generate a strobe line_en for every horizontal line
    h_cnt <= h_cnt_int;
    line_en_int <= '1' when h_cnt_int = npixels_c-1 else '0';
    line_en <= line_en_int;
    
-- vertical timing --
-- a vga-frame consists of 521 horizontal lines
-- modulo-521 counter running at speed of horiz. lines
process(clk)
  begin
    if clk='1' and clk'event then
      if reset = '1' then
        v_cnt_int <= conv_std_logic_vector(nlines_c-20,v_cnt_int'length);
      elsif line_en_int = '1' then
        if v_cnt_int = nlines_c-1 then
           v_cnt_int <= (others => '0');
        else  
           v_cnt_int <= v_cnt_int+1;
        end if;
      end if;
    end if;
  end process;
  
  --generate a strobe "frame_en" for every full video frame 
  v_cnt        <= v_cnt_int;
  frame_en_int <= line_en_int when v_cnt_int = 0 else '0';
  frame_en     <= frame_en_int;

-- active video area ------------------------------------------
  h_active  <= '1' when h_cnt_int < active_pixels_c else '0'; 
  v_active  <= '1' when v_cnt_int < active_lines_c else '0';
  
-- VGA sync signals -------------------------------------------
  hsync  <= '0' when h_cnt_int >= (active_pixels_c+h_front_porch_c) and h_cnt_int < (npixels_c-h_back_porch_c) else '1';
  vsync  <= '0' when v_cnt_int >= (active_lines_c+ v_front_porch_c) and v_cnt_int < (nlines_c-v_back_porch_c) else '1';
--  hsync  <= '0' when h_cnt_int >= 656 and h_cnt_int < 752 else '1';
--  vsync  <= '0' when v_cnt_int >= 490 and v_cnt_int < 492 else '1';

h0  <=  (active_pixels_c+h_front_porch_c);
h1 <=  (npixels_c-h_back_porch_c);

v0 <=  (active_lines_c+ v_front_porch_c);
v1 <= (nlines_c-v_back_porch_c);
      
end architecture rtl;

