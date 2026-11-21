# Definitional proc to organize widgets for parameters.
proc init_gui { IPINST } {
  ipgui::add_param $IPINST -name "Component_Name"
  #Adding Page
  set Page_0 [ipgui::add_page $IPINST -name "Page 0"]
  ipgui::add_param $IPINST -name "C_AUDIOFIFO_SIZE" -parent ${Page_0}

  ipgui::add_param $IPINST -name "simulation_g"
  ipgui::add_param $IPINST -name "C_CORE_CLK_FREQUENCY"
  ipgui::add_param $IPINST -name "C_SLV_ADDR_BASE"
  ipgui::add_param $IPINST -name "C_SLV_ADDR_RANGE"
  ipgui::add_param $IPINST -name "C_DMA_DWIDTH"
  ipgui::add_param $IPINST -name "C_VGA_B"
  ipgui::add_param $IPINST -name "C_VGA_G"
  ipgui::add_param $IPINST -name "C_VGA_MODE"
  ipgui::add_param $IPINST -name "C_VGA_R"

}

proc update_PARAM_VALUE.C_AUDIOFIFO_SIZE { PARAM_VALUE.C_AUDIOFIFO_SIZE } {
	# Procedure called to update C_AUDIOFIFO_SIZE when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_AUDIOFIFO_SIZE { PARAM_VALUE.C_AUDIOFIFO_SIZE } {
	# Procedure called to validate C_AUDIOFIFO_SIZE
	return true
}

proc update_PARAM_VALUE.C_CORE_CLK_FREQUENCY { PARAM_VALUE.C_CORE_CLK_FREQUENCY } {
	# Procedure called to update C_CORE_CLK_FREQUENCY when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_CORE_CLK_FREQUENCY { PARAM_VALUE.C_CORE_CLK_FREQUENCY } {
	# Procedure called to validate C_CORE_CLK_FREQUENCY
	return true
}

proc update_PARAM_VALUE.C_DMA_DWIDTH { PARAM_VALUE.C_DMA_DWIDTH } {
	# Procedure called to update C_DMA_DWIDTH when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_DMA_DWIDTH { PARAM_VALUE.C_DMA_DWIDTH } {
	# Procedure called to validate C_DMA_DWIDTH
	return true
}

proc update_PARAM_VALUE.C_SLV_ADDR_BASE { PARAM_VALUE.C_SLV_ADDR_BASE } {
	# Procedure called to update C_SLV_ADDR_BASE when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_SLV_ADDR_BASE { PARAM_VALUE.C_SLV_ADDR_BASE } {
	# Procedure called to validate C_SLV_ADDR_BASE
	return true
}

proc update_PARAM_VALUE.C_SLV_ADDR_RANGE { PARAM_VALUE.C_SLV_ADDR_RANGE } {
	# Procedure called to update C_SLV_ADDR_RANGE when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_SLV_ADDR_RANGE { PARAM_VALUE.C_SLV_ADDR_RANGE } {
	# Procedure called to validate C_SLV_ADDR_RANGE
	return true
}

proc update_PARAM_VALUE.C_VGA_B { PARAM_VALUE.C_VGA_B } {
	# Procedure called to update C_VGA_B when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_VGA_B { PARAM_VALUE.C_VGA_B } {
	# Procedure called to validate C_VGA_B
	return true
}

proc update_PARAM_VALUE.C_VGA_G { PARAM_VALUE.C_VGA_G } {
	# Procedure called to update C_VGA_G when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_VGA_G { PARAM_VALUE.C_VGA_G } {
	# Procedure called to validate C_VGA_G
	return true
}

proc update_PARAM_VALUE.C_VGA_MODE { PARAM_VALUE.C_VGA_MODE } {
	# Procedure called to update C_VGA_MODE when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_VGA_MODE { PARAM_VALUE.C_VGA_MODE } {
	# Procedure called to validate C_VGA_MODE
	return true
}

proc update_PARAM_VALUE.C_VGA_R { PARAM_VALUE.C_VGA_R } {
	# Procedure called to update C_VGA_R when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.C_VGA_R { PARAM_VALUE.C_VGA_R } {
	# Procedure called to validate C_VGA_R
	return true
}

proc update_PARAM_VALUE.simulation_g { PARAM_VALUE.simulation_g } {
	# Procedure called to update simulation_g when any of the dependent parameters in the arguments change
}

proc validate_PARAM_VALUE.simulation_g { PARAM_VALUE.simulation_g } {
	# Procedure called to validate simulation_g
	return true
}


proc update_MODELPARAM_VALUE.simulation_g { MODELPARAM_VALUE.simulation_g PARAM_VALUE.simulation_g } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.simulation_g}] ${MODELPARAM_VALUE.simulation_g}
}

proc update_MODELPARAM_VALUE.C_CORE_CLK_FREQUENCY { MODELPARAM_VALUE.C_CORE_CLK_FREQUENCY PARAM_VALUE.C_CORE_CLK_FREQUENCY } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_CORE_CLK_FREQUENCY}] ${MODELPARAM_VALUE.C_CORE_CLK_FREQUENCY}
}

proc update_MODELPARAM_VALUE.C_SLV_ADDR_BASE { MODELPARAM_VALUE.C_SLV_ADDR_BASE PARAM_VALUE.C_SLV_ADDR_BASE } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_SLV_ADDR_BASE}] ${MODELPARAM_VALUE.C_SLV_ADDR_BASE}
}

proc update_MODELPARAM_VALUE.C_SLV_ADDR_RANGE { MODELPARAM_VALUE.C_SLV_ADDR_RANGE PARAM_VALUE.C_SLV_ADDR_RANGE } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_SLV_ADDR_RANGE}] ${MODELPARAM_VALUE.C_SLV_ADDR_RANGE}
}

proc update_MODELPARAM_VALUE.C_DMA_DWIDTH { MODELPARAM_VALUE.C_DMA_DWIDTH PARAM_VALUE.C_DMA_DWIDTH } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_DMA_DWIDTH}] ${MODELPARAM_VALUE.C_DMA_DWIDTH}
}

proc update_MODELPARAM_VALUE.C_VGA_B { MODELPARAM_VALUE.C_VGA_B PARAM_VALUE.C_VGA_B } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_VGA_B}] ${MODELPARAM_VALUE.C_VGA_B}
}

proc update_MODELPARAM_VALUE.C_VGA_G { MODELPARAM_VALUE.C_VGA_G PARAM_VALUE.C_VGA_G } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_VGA_G}] ${MODELPARAM_VALUE.C_VGA_G}
}

proc update_MODELPARAM_VALUE.C_VGA_MODE { MODELPARAM_VALUE.C_VGA_MODE PARAM_VALUE.C_VGA_MODE } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_VGA_MODE}] ${MODELPARAM_VALUE.C_VGA_MODE}
}

proc update_MODELPARAM_VALUE.C_VGA_R { MODELPARAM_VALUE.C_VGA_R PARAM_VALUE.C_VGA_R } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_VGA_R}] ${MODELPARAM_VALUE.C_VGA_R}
}

proc update_MODELPARAM_VALUE.C_AUDIOFIFO_SIZE { MODELPARAM_VALUE.C_AUDIOFIFO_SIZE PARAM_VALUE.C_AUDIOFIFO_SIZE } {
	# Procedure called to set VHDL generic/Verilog parameter value(s) based on TCL parameter value
	set_property value [get_property value ${PARAM_VALUE.C_AUDIOFIFO_SIZE}] ${MODELPARAM_VALUE.C_AUDIOFIFO_SIZE}
}

