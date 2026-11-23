-- Reference design for the Zybo Z7-10 build check.
-- The clock and LED pins are not described here. They live in the XDC file.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity zybo_counter is
  port (
    clk : in std_logic;
    led : out std_logic
  );
end entity zybo_counter;

architecture rtl of zybo_counter is
  signal count : unsigned(26 downto 0) := (others => '0');
begin
  process (clk)
  begin
    if rising_edge(clk) then
      count <= count + 1;
    end if;
  end process;
  led <= count(count'high);
end architecture rtl;
