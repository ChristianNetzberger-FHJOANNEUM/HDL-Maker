--
-- VHDL Architecture proj_audio_lib.i2s_slave.bhv
--
-- Created:
--          by - net.UNKNOWN (KPERSM7467)
--          at - 22:04:36 03.11.2017
--
-- using Mentor Graphics HDL Designer(TM) 2016.2 (Build 5)
--
LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.std_logic_arith.all;

entity i2s_slave is
   port( 
      audio_left_i : in     std_logic_vector (23 downto 0);
      audio_right_i: in     std_logic_vector (23 downto 0);
      bclk        : in     std_logic;
      pblrc       : in     std_logic;
      pbdat       : in     std_logic;
      reclrc      : in     std_logic;
      recdat      : out    std_logic;
      audio_left_o : out     std_logic_vector (23 downto 0);
      audio_right_o: out     std_logic_vector (23 downto 0);
      next_frame_tx  : out    std_logic; 
      next_frame_rx  : out    std_logic 
   );

-- Declarations

end i2s_slave ;

--
architecture bhv of i2s_slave is
  signal tx_shreg: std_logic_vector(31 downto 0) := (others => '0');
  signal reclrc_q: std_logic := '0';
  signal next_sample_left, next_sample_right: std_logic := '0';
  signal rx_shreg: std_logic_vector(23 downto 0) := (others => '0');
  signal pblrc_q: std_logic := '0';
  signal rx_sample_left, rx_sample_right: std_logic := '0';
  signal rx_cnt: integer := 0;
begin
  
  --record shift register --------------------------------
  process(bclk)
  begin
    if rising_edge(bclk) then
      reclrc_q <= reclrc;
      if next_sample_left = '1' then
        tx_shreg <=  audio_left_i & X"00";
      elsif next_sample_right = '1' then
        tx_shreg <= audio_right_i & X"00";
      else
        tx_shreg <= tx_shreg(tx_shreg'left-1 downto 0) & '0';
      end if;        
    end if;
  end process; 
  
  next_sample_left <= not reclrc and (reclrc xor reclrc_q);
  next_sample_right <=  reclrc and (reclrc xor reclrc_q);
  recdat <= tx_shreg(tx_shreg'left);
  next_frame_tx <=  next_sample_right;
  
    --replay shift register --------------------------------
  process(bclk)
  begin
    if rising_edge(bclk) then
      pblrc_q <= pblrc;
      rx_shreg <= rx_shreg(rx_shreg'left-1 downto 0) & pbdat;
    end if;
  end process; 
  
  rx_sample_left <= not pblrc and (pblrc xor pblrc_q);
  rx_sample_right <=  pblrc and (pblrc xor pblrc_q);
  
  --replay bitcounter--------------
  --to receive 24-bits after edge of pblrc
  process(bclk)
  begin
    if rising_edge(bclk) then
      if (pblrc xor pblrc_q) = '1' then
        rx_cnt <= 0;
      else
        rx_cnt <= rx_cnt+1;
      end if;
    end if;
  end process;

--register received audio samples----------
  process(bclk)
  begin
    if rising_edge(bclk) then
      if rx_cnt = 23 then
        if pblrc = '0' then
          audio_left_o <= rx_shreg;
        else
          audio_right_o <= rx_shreg;
        end if;
      end if;
    end if;
  end process;

  next_frame_rx <=  rx_sample_right;

end architecture bhv;

