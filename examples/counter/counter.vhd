library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- 8-bit counter used by the first studio demonstration.
entity counter is
  generic (
    WIDTH : positive := 8
  );
  port (
    clk : in std_logic;
    rst : in std_logic;
    en : in std_logic;
    count : out std_logic_vector(7 downto 0)
  );
end entity counter;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

architecture rtl of counter is
  signal value : unsigned(WIDTH - 1 downto 0);
begin
  process (clk)
  begin
    if rising_edge(clk) then
      if rst = '1' then
        value <= (others => '0');
      elsif en = '1' then
        value <= value + 1;
      end if;
    end if;
  end process;

  count <= std_logic_vector(value);
end architecture rtl;

library ieee;
use ieee.std_logic_1164.all;

architecture behavioral of counter is
begin
  count <= (others => '0');
end architecture behavioral;
