--
-- VHDL Architecture interfaces_lib.i2c_table.rtl
--
-- Created:
--          by - Net.UNKNOWN (M00443)
--          at - 15:53:41 18.02.2022
--
-- using Mentor Graphics HDL Designer(TM) 2017.1a (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;
library work;
use work.utilities.all;

entity i2c_table4 is
   generic( 
      addr_base_g   : std_logic_vector := X"0000";
      addr_range_g  : std_logic_vector := X"0040";
      addr_offset_g : std_logic_vector := X"0040"
   );
   port( 
      sbus_i     : in     sbus_i_t;
      mem2_wdata : in     std_logic_vector (31 downto 0);
      mem1_rdata : out    std_logic_vector (31 downto 0);
      mem1_raddr : in     std_logic_vector (7 downto 0);
      mem2_we    : in     std_logic;
      mem2_addr  : in     std_logic_vector (7 downto 0);
      reg_rd     : out    std_logic_vector (31 downto 0);
      sbus_o     : out    sbus_o_t;
      clk        : in     std_logic;
      reset      : in     std_logic
   );

-- Declarations

end i2c_table4 ;

--
architecture rtl of i2c_table4 is
-- bus interface--------------------------------------------
constant addr_range_c: std_logic_vector(31 downto 0) := X"00000100";
signal bus_we, bus_rd, bus_cs,bus_ack: std_logic;
signal bus_addr: std_logic_vector(15 downto 0);
signal bus_din, bus_dout: std_logic_vector(31 downto 0);

signal busreg_cs: std_logic_vector(31 downto 0);

--Opcodes:
--_____________________________
--00   nop
--01   write bytes
--02   read bytes
--03   write/read bytes
--04   wait for operand usec
--05   jump back rel.

   type mem_t is array ( 0 to 63 ) of std_logic_vector(31 downto 0);
   signal mem1: mem_t := (  
                            --TABLE SECTION0: reserved-------------
                            X"0000" & X"0001", 
                            --TABLE SECTION1: main entry point ----
                            X"8041" & X"0400",                -- wait cmd
                            X"8010" & X"23"&"00"&"000"&"000", -- i2c write frame
                            X"0000" & X"0001",                -- write payload
                            --TABLE SECTION2: ------------
                            X"8041" & X"0400",                -- wait cmd  
                            X"8010" & X"23"&"00"&"000"&"000", -- i2c write frame
                            X"0000" & X"0010",                -- write payload
                            --TABLE SECTION3: ------------
                            X"8041" & X"0800",                -- wait cmd
                            X"8020" & X"23"&"00"&"001"&"000", -- i2c read frame
                            X"8050" & X"0003",                --jump cmd
                            --TABLE SECTION4: -------------
                           others => (others => '0'));        --empty section
   
   signal mem2: mem_t := (others => (others => '0'));
   signal mem1_we: std_logic;
   
   type reg_t is array (0 to 3) of std_logic_vector(15 downto 0);
   signal regw,regr: reg_t;
   
   signal bus_ptr,reg_rdptr,reg_wrptr: integer := 0;
   
   signal reg_tmp: std_logic_vector(7 downto 0);
   signal reg_mux: std_logic;

begin
   bus_addr <=sbus_i.addr;
   bus_we <= sbus_i.we;
   bus_rd <= sbus_i.rd;
   bus_din <= sbus_i.wdata;
   
   process(clk)
   begin
      if clk='1' and clk'event then  
         sbus_o.ack <= bus_ack;
         sbus_o.rdata <=  (others => '0');   
         if bus_cs = '1' and bus_rd = '1' then 
              sbus_o.rdata <= bus_dout ;
          end if;
        end if;
   end process;
   
   -- addr decoder
     bus_cs <= '1' when bus_addr >= (addr_base_g + addr_offset_g) and bus_addr < (addr_base_g + addr_range_c+ addr_offset_g) else '0';
     bus_ack <= bus_cs and (bus_rd or bus_we);
   
   --dual port memory------------------------------------
   mem1_we <= bus_cs and bus_we;
   bus_ptr <= conv_integer(bus_addr(5 downto 0));
   --reg_ptr <= conv_integer(reg_addr_int(4 downto 0));
   
   --memory bus->registers-----
   process(clk)
   begin
      if clk='1' and clk'event then  
         if mem1_we = '1'  then
            mem1(bus_ptr) <= bus_din;
          end if;
        end if;
   end process;
   
   --memory registers--> bus -----
   process(clk)
   begin
      if clk='1' and clk'event then  
         if mem2_we = '1'  then
            mem2(conv_integer(mem2_addr)) <= mem2_wdata;
            reg_rd <= mem2_wdata;
          end if;
        end if;
   end process;
     
   bus_dout <= mem1(bus_ptr); -- when bus_addr(6) = '0' else mem2(bus_ptr)  ;
   mem1_rdata <= mem1(conv_integer(mem1_raddr));
 
end architecture rtl;

