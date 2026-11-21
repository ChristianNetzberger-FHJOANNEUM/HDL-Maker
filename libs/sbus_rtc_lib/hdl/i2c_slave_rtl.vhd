--
-- VHDL Architecture i2c_lib.i2c_slave.rtl
--
-- Created:
--          by - net.UNKNOWN (KPERSM4268)
--          at - 16:35:40 16.07.2009
--
-- using Mentor Graphics HDL Designer(TM) 2007.1 (Build 19)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

entity i2c_slave is
   generic( 
      i2c_address_g : std_logic_vector(7 downto 0) := X"00"
   );
   port( 
      reg_i        : in     std_logic_vector ( 15 downto 0 );
      reset        : in     std_logic;
      scl_i        : in     std_logic;
      sda_i        : in     std_logic;
      i2c_addr_lsb : in     std_logic_vector ( 2 downto 0);
      reg_o        : out    std_logic_vector ( 15 downto 0 );
      scl_o        : out    std_logic;
      sda_o        : out    std_logic
   );

-- Declarations

end entity i2c_slave ;

--
architecture rtl of i2c_slave is

  signal start_flag, stop_flag: std_logic;
  signal start_flag_q0,start_flag_q1: std_logic;
  signal start_condition: std_logic;
  signal bit_cnt: std_logic_vector(3 downto 0);
  signal byte_cnt: std_logic_vector(1 downto 0);
  signal rxreg: std_logic_vector(7 downto 0);
  signal txreg: std_logic_vector(7 downto 0);
  signal reg0: std_logic_vector(7 downto 0);
  signal reg0q: std_logic_vector(7 downto 0);
  signal reg1: std_logic_vector(7 downto 0);
  signal reg1q: std_logic_vector(7 downto 0);
  signal wr_flag, rd_flag: std_logic;
  signal address_match: std_logic;
  signal local_address: std_logic_vector(6 downto 0);
  signal check: integer := 0;

begin
  
    local_address <= i2c_address_g(6 downto 3) & i2c_addr_lsb;

    -- detect start condition on falling data edge ----------------
    process(sda_i,reset)
    begin
      if reset = '1' then
          start_flag <= '0';
       elsif sda_i='0' and sda_i'event then
          start_flag <= scl_i;
       end if;
    end process;
    
    -- synchronize start condition to falling clk edge -----------
    process(scl_i,reset,stop_flag)
    begin
      if reset = '1' or stop_flag = '1' then
          start_flag_q0 <= '0';
          start_flag_q1 <= '0';
      elsif scl_i = '0' and scl_i'event then
          start_flag_q0 <= start_flag;
          start_flag_q1 <= start_flag_q0;
       end if;
    end process;
    
    start_condition <= not start_flag_q1 and start_flag_q0;

    -- detect stop condition on rising data edge ----------------
    process(sda_i,reset,start_flag)
    begin
      if reset = '1' or start_flag = '1' then
          stop_flag <= '0';
      elsif sda_i = '1' and sda_i'event then
          stop_flag <= scl_i;
       end if;
    end process;
    
    -- bit and byte timing counter -------------------------------------
    process(scl_i,start_condition,reset)
    begin
      if reset = '1' or start_condition = '1' then
         bit_cnt <= "0001";
         byte_cnt <= "00";
      elsif scl_i='0' and scl_i'event then
          if bit_cnt = 8 then
              bit_cnt <= (others => '0');
              if byte_cnt = "10" then
                  byte_cnt <= "01";
              else
                  byte_cnt <= byte_cnt+1;
              end if;
          else
              bit_cnt <= bit_cnt+1;
          end if;
       end if;
    end process;
    
   
    -- receive and transmit shift register ------------------------------
    process(scl_i,reset)
    begin
       if reset = '1'  then
          rxreg <=(others => '1');
          txreg <=(others => '1');
          reg0  <= (others => '0');
          reg0q <= (others => '0');
          reg1  <= (others => '0');
          wr_flag <= '0';
          rd_flag <= '0';
          address_match <= '1' ;
       elsif start_condition = '1' then
          address_match <= '1' ;
          txreg <= X"FE";
       elsif scl_i = '0' and scl_i'event then
          rxreg <= rxreg(rxreg'left-1 downto 0) & sda_i;
          txreg <= txreg(txreg'left-1 downto 0) & (rd_flag or not address_match);
          -- check if i2c address matches ------------
          if  byte_cnt = "00" and bit_cnt = 7  then
            if local_address = rxreg(6 downto 0) then  -- i2c address match
               address_match <= '1' ;
               wr_flag <= not sda_i;
               rd_flag <= sda_i;
            else
               txreg <= X"FF";
               wr_flag <= '0';
               rd_flag <= '0';
               address_match <= '0' ;
            end if;   
          end if;
          -- ack position --------------------------           
          if bit_cnt = 8 then
            check <= 1;
            if byte_cnt = "00" then
               if rd_flag = '1' then --and sda_i = '0' then  -- load tx register only if acked by the master
                   txreg <= reg_i (15 downto 8);
                   reg1q <= reg_i ( 7 downto 0);
                   check <= 2;
               else
                   txreg <= X"FF";
                   check <= 3;
               end if;
            elsif byte_cnt = "01" then
              check <= 10;
               reg0q <= rxreg;  -- reg0 is double buffered
               if rd_flag = '1' and sda_i = '0' then -- only if acked by the master
                   txreg <= reg1q;
                   check <= 11;
               else
                   txreg <= X"FF";
                   check <= 12;
               end if;
            elsif byte_cnt = "10" then
              check <= 20;
               if wr_flag = '1' then
                   reg1 <= rxreg;
                   reg0 <= reg0q;
                   check <= 21;
               end if;
               if rd_flag = '1' and sda_i = '0' then  -- only if acked by the master
                   txreg <= reg_i (15 downto 8);
                   reg1q <= reg_i ( 7 downto 0);
                   check <= 22;
               else
                   txreg <= X"FF";
                   check <= 23;
               end if;
           elsif byte_cnt = "11" then
               txreg <= X"FF";
               check <= 30;
           end if;
        end if;
    end if;
    end process;

    -- i2c bus output signals -----
    scl_o <= '1';
    sda_o <= txreg(7);
    
    -- output registers ----
    reg_o <= reg0 & reg1;

end architecture rtl;

