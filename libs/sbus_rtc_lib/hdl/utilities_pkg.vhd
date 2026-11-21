--
-- VHDL Package Header dev_lib.busdef
--
-- Created:
--          by - net.UNKNOWN (KPERSM4268)
--          at - 08:52:37 10.03.2011
--
-- using Mentor Graphics HDL Designer(TM) 2010.2 (Build 21)
-- 
LIBRARY ieee;
USE ieee.std_logic_1164.all;
PACKAGE utilities IS
             
  -------------------------------------------------------------------------------------
  -------multimaster bus definitions---------------------------------------------------
  -------------------------------------------------------------------------------------
  type mbus_o_t is record
    addr: std_logic_vector(15 downto 0);
    wdata: std_logic_vector(31 downto 0);
    be: std_logic_vector(3 downto 0);
    we: std_logic;
    rd: std_logic;
    req: std_logic;
  end record;

  type mbus_i_t is record
    rdata: std_logic_vector(31 downto 0);
    ack: std_logic;
    grant: std_logic;
  end record;

  type sbus_o_t is record
    rdata: std_logic_vector(31 downto 0);
    ack: std_logic;
  end record;

  type sbus_i_t is record
    addr: std_logic_vector(15 downto 0);
    wdata: std_logic_vector(31 downto 0);
    be: std_logic_vector(3 downto 0);
    we: std_logic;
    rd: std_logic;
  end record;

  type s64bus_o_t is record
    rdata: std_logic_vector(63 downto 0);
    ack: std_logic;
  end record;

  type s64bus_i_t is record
    addr: std_logic_vector(31 downto 0);
    wdata: std_logic_vector(63 downto 0);
    be: std_logic_vector(3 downto 0);
    we: std_logic;
    rd: std_logic;
  end record;

 
   constant mbus_null_c: mbus_o_t := ((others => '0'),(others => '0'),(others => '0'),'0','0','0');
   constant sbus_null_c: sbus_o_t := ((others => '0'),'0');
   constant s64bus_null_c: s64bus_o_t := ((others => '0'),'0');
   constant sbus_o_null_c: sbus_o_t := ((others => '0'),'0');
   constant sbus_i_null_c: sbus_i_t := ((others => '0'),(others => '0'),(others => '0'),'0','0');
   constant s64bus_o_null_c: s64bus_o_t := ((others => '0'),'0');
   constant s64bus_i_null_c: s64bus_i_t := ((others => '0'),(others => '0'),(others => '0'),'0','0');
   
 type axis_i_t is record
    aclk: std_logic;
    aresetn: std_logic;
    tdata: std_logic_vector(7 downto 0);
    tlast: std_logic;
    tuser: std_logic;
    tvalid: std_logic;
  end record;  

-------------------------------------------------------------------------------------
--- signal bus definitions 
-------------------------------------------------------------------------------------
  type sigbus_t is record
    val: std_logic_vector(31 downto 0);
    id:  std_logic_vector(7 downto 0);
    en:  std_logic_vector(0 downto 0);
    sync:  std_logic_vector(0 downto 0);
  end record;
  constant sigbus_null_c: sigbus_t := ((others => '0'),(others => '0'),(others => '0'),(others => '0'));
  constant sigsize_c: integer := 32+8+1+1;
  
  type sig_id_list_t is array (0 to 255) of integer range 0 to 255;
  type sig_val_list_t is array (0 to 255) of integer;

constant n_buflines_g: integer := 17; --7;
constant n_bufcolumns_g: integer := 17; --7;
constant cpix_g: integer := 7; --3;
constant dwidth_g: integer := 8;

-------------------------------------------------------------------------------------
--definitions for the pixel buffer to keep pixel values and squared pixel values 
-------------------------------------------------------------------------------------
type lines_t         is array (0 to n_buflines_g-1) of std_logic_vector(7 downto 0);
type qlines_t        is array (0 to n_buflines_g/4) of std_logic_vector(31 downto 0);

type cols_t          is array (0 to n_buflines_g-1) of std_logic_vector(7 downto 0);

type pixel_line_t    is array (0 to n_buflines_g-1) of std_logic_vector(n_bufcolumns_g*8-1 downto 0);

type pixel_col_t     is array (0 to n_bufcolumns_g-1) of std_logic_vector(8*n_buflines_g-1 downto 0);

type pixel_t         is array (0 to n_buflines_g-1) of cols_t; 

type pixel3D_t       is array (0 to 5) of pixel_t;  


-------------------------------------------------------------------------------
-- Function and Procedure Declarations
-------------------------------------------------------------------------------
function log2(x : natural) return integer;

function twosc  (arg: std_logic_vector) return std_logic_vector;

function exps(arg: std_logic_vector; length:integer) return std_logic_vector;
function expu(arg: std_logic_vector; length:integer) return std_logic_vector;

function conv_real(arg: std_logic_vector) return real;

function conv_std_logic_vector(arg: real; size: integer) return std_logic_vector;
   
END utilities;
