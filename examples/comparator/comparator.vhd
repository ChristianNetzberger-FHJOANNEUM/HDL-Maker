library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity comparator is
  generic (
    WIDTH : positive := 8
  );
  port (
    a : in std_logic_vector(WIDTH - 1 downto 0);
    b : in std_logic_vector(WIDTH - 1 downto 0);
    equal : out std_logic;
    greater : out std_logic
  );
end entity comparator;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

architecture rtl of comparator is
begin
  equal <= '1' when unsigned(a) = unsigned(b) else '0';
  greater <= '1' when unsigned(a) > unsigned(b) else '0';
end architecture rtl;
