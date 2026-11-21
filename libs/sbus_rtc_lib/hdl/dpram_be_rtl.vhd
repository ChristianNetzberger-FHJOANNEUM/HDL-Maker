--
-- VHDL Architecture vga_lib.dpr.rtl
--
-- Created:
--          by - Net.UNKNOWN (KPERSM7467)
--          at - 20:32:52 26.12.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

library work;
use work.utilities.all;

entity dpram_be is
   generic( 
      addr_base_a_g : std_logic_vector;
      addr_base_b_g : std_logic_vector;
      addr_range_g  : std_logic_vector;
      addr_offset_g : std_logic_vector;
      addr_width_g  : integer := 14;
      data_width_g  : integer := 32
   );
   port( 
      clka     : in     std_logic;
      sbus_i_a : in     sbus_i_t;
      sbus_i_b : in     sbus_i_t;
      sbus_o_a : out    sbus_o_t;
      sbus_o_b : out    sbus_o_t
   );

-- Declarations

end dpram_be ;

--
architecture rtl of dpram_be is
  type byte_ram_type is array (0 to 2**addr_width_g-1) of std_logic_vector(7 downto 0);
--  shared variable RAM : ram_type:= ( others => X"12345678");

  signal ena   :    std_logic;
  signal enb   :    std_logic;
  signal wea   :    std_logic;
  signal bea   :    std_logic_vector (data_width_g/8-1 downto 0);
  signal addra :    std_logic_vector (addr_width_g-1 downto 0);
  signal addrb :    std_logic_vector (addr_width_g-1 downto 0);
  signal dia   :    std_logic_vector (data_width_g-1 downto 0);
  signal dib   :    std_logic_vector (data_width_g-1 downto 0);
  signal doa   :    std_logic_vector (data_width_g-1 downto 0);
  signal dob   :    std_logic_vector (data_width_g-1 downto 0);
  signal addrb_int: integer;

  signal mem_rden : std_logic;
  signal mem_wren : std_logic;

begin

  -- bus attachment --------------------------
  addra <= sbus_i_a.addr(addra'range);
  ena <= '1' when (sbus_i_a.addr >= addr_base_a_g+addr_offset_g) and sbus_i_a.addr < (addr_base_a_g  + addr_offset_g + addr_range_g) else '0';
  wea <= sbus_i_a.we;
  bea <= sbus_i_a.be;
  dia <= sbus_i_a.wdata;
  sbus_o_a.rdata <= doa when ena = '1' else (others => '0');
  sbus_o_a.ack <= ena;
 
  addrb <= sbus_i_b.addr(addrb'range);
  enb <= '1' when (sbus_i_b.addr >= addr_base_b_g) and sbus_i_b.addr < (addr_base_b_g + addr_range_g) else '0';
  dib <= sbus_i_b.wdata;
  sbus_o_b.rdata <= dob when enb = '1' else (others => '0');
  sbus_o_b.ack <= enb;
	 
	-- implement Block RAM(s)
	
	 BYTE_BRAM_GEN : for mem_byte_index in 0 to (data_width_g/8-1) generate
	   shared variable byte_ram   : byte_ram_type:= ( others => X"AB");
	   signal data_in    : std_logic_vector(8-1 downto 0);
	   signal data_out_a : std_logic_vector(8-1 downto 0);
	   signal data_out_b : std_logic_vector(8-1 downto 0);
	 begin
	   --assigning 8 bit data
	   data_in    <= dia((mem_byte_index*8+7) downto mem_byte_index*8);
	   data_out_a <= byte_ram(to_integer(unsigned(addra)));
	   data_out_b <= byte_ram(to_integer(unsigned(addrb)));
   
	   process (clka)
     begin
       if clka'event and clka = '1' then
         if ena = '1' then
           doa((mem_byte_index*8+7) downto mem_byte_index*8) <= data_out_a;
           if wea = '1' and (bea(mem_byte_index) = '1' ) then
             byte_ram(to_integer(unsigned(addra))) := data_in;
           end if;
         end if;
       end if;
     end process;

	   process(clka) is
	     begin
	       if rising_edge(clka)then
	         if enb='1' then 
	           dob((mem_byte_index*8+7) downto mem_byte_index*8) <= data_out_b;
	         end if;
	       end if;
	   end process;
	   
	 end generate BYTE_BRAM_GEN;



end architecture rtl;

