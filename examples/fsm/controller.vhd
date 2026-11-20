library ieee;
use ieee.std_logic_1164.all;

entity controller is
  port (
    clk : in std_logic;
    rst : in std_logic;
    equal : in std_logic;
    enable : out std_logic;
    done : out std_logic
  );
end entity controller;

library ieee;
use ieee.std_logic_1164.all;

architecture fsm of controller is
  type state_t is (idle, count, finish);
  signal state : state_t;
begin
  process (clk)
  begin
    if rising_edge(clk) then
      if rst = '1' then
        state <= idle;
      else
        case state is
          when idle =>
            if equal = '1' then
              state <= finish;
            else
              state <= count;
            end if;
          when count =>
            state <= count;
          when finish =>
            state <= idle;
        end case;
      end if;
    end if;
  end process;

  enable <= '1' when state = count else '0';
  done <= '1' when state = finish else '0';
end architecture fsm;
