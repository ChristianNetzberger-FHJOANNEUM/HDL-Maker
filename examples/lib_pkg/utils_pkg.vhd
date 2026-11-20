library ieee;
use ieee.std_logic_1164.all;

package utils_pkg is
  constant DEMO_WIDTH : positive := 8;
  function is_zero(value : std_logic_vector) return boolean;
end package utils_pkg;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

package body utils_pkg is
  function is_zero(value : std_logic_vector) return boolean is
  begin
    return unsigned(value) = 0;
  end function;
end package body utils_pkg;
