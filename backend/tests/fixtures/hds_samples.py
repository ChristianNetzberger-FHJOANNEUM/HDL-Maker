"""A reduced block diagram using only records observed in struct.bd."""

MIN_BD = """
DocumentHdrVersion "1.1"
Header (DocumentHdr
version 2
instances [
(Instance
name "U_0"
duLibraryName "sbus_rtc_lib"
duName "comp_barrelshifter"
elements [
(GiElement
name "nbits_g"
type "integer"
value "24"
)
]
uid 994,0
)
]
)
appVersion "2017.1a (Build 5)"
model (BlockDiag
VExpander (VariableExpander
vvMap [
(vvPair
variable "entity_name"
value "audio_gain"
)
(vvPair
variable "arch_name"
value "struct"
)
]
)
optionalChildren [
*2 (PortIoIn
uid 37,0
shape (CompositeShape
optionalChildren [
(Pentagon
xt "-56000,46625,-54500,47375"
)
]
)
tg (WTG
f (Text
st "audio_in_left_i"
tm "WireNameMgr"
)
)
)
*45 (SaComponent
uid 994,0
optionalChildren [
*46 (CptPort
uid 966,0
shape (Triangle
xt "-41750,46625,-41000,47375"
)
thePort (LogicalPort
decl (Decl
n "sig_i"
t "std_logic_vector"
b "(nbits_g-1 downto 0)"
)
)
)
*51 (CptPort
uid 986,0
shape (Triangle
xt "-22000,47625,-21250,48375"
)
thePort (LogicalPort
m 1
decl (Decl
n "enable_o"
t "std_logic"
)
)
)
]
shape (Rectangle
xt "-41000,46000,-22000,52000"
)
ttg (MlTextGroup
textVec [
(Text
st "sbus_rtc_lib"
tm "BdLibraryNameMgr"
)
(Text
st "comp_barrelshifter"
tm "CptNameMgr"
)
(Text
st "U_0"
tm "InstanceNameMgr"
)
]
)
ga (GenericAssociation
elements [
(GiElement
name "nbits_g"
type "integer"
value "24"
)
]
)
)
*77 (Net
uid 1355,0
decl (Decl
n "audio_in_left_i"
t "std_logic_vector"
b "(23 downto 0)"
)
)
*80 (Wire
uid 43,0
shape (OrthoPolyLine
pts [
"-54000,47000"
"-41750,47000"
]
)
start &2
end &46
on &77
sl "(7 downto 0)"
)
*88 (HdlText
uid 377,0
optionalChildren [
*89 (EmbeddedText
uid 383,0
commentText (CommentText
text (MLText
st "sig_i <= audio_in_left_i;"
tm "HdlTextMgr"
)
)
)
]
shape (Rectangle
xt "-40000,29000,-34000,42000"
)
ttg (MlTextGroup
textVec [
(Text
st "mux"
tm "HdlTextNameMgr"
)
(Text
st "19"
tm "HdlTextNumberMgr"
)
]
)
)
*90 (FutureWidget
name "kept"
)
]
)
"""

MIN_SB = """
DocumentHdrVersion "1.1"
model (Symbol
VExpander (VariableExpander
vvMap [
(vvPair
variable "entity_name"
value "audio_gain"
)
]
)
optionalChildren [
*79 (SymbolBody
optionalChildren [
*80 (CptPort
uid 730,0
shape (Triangle
xt "14250,14625,15000,15375"
)
thePort (LogicalPort
decl (Decl
n "audio_in_scale"
t "std_logic_vector"
b "(3 downto 0)"
)
)
)
]
)
]
)
"""

MIN_SM = """
DocumentHdrVersion "1.1"
Header (DocumentHdr
machine (Machine
name "csm"
children [
(Machine
name "csm"
stateSignalName "current_state"
)
]
)
)
model (StateMachine
VExpander (VariableExpander
vvMap [
(vvPair
variable "entity_name"
value "audio_fifo_ctrl"
)
(vvPair
variable "arch_name"
value "fsm"
)
]
)
optionalChildren [
*1 (State
name "idle"
)
]
)
"""

STRUCT_VHDL = """
entity audio_gain is
end entity audio_gain;

architecture struct of audio_gain is
begin
  U_0 : comp_barrelshifter
    generic map (
      nbits_g => 24
    )
    port map (
      sig_i => audio_in_left_i,
      enable_o => open
    );
end architecture struct;
"""
