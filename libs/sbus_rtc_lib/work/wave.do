onerror {resume}
quietly WaveActivateNextPane {} 0
add wave -noupdate /tb_audio1/U_0/sbus_ack
add wave -noupdate /tb_audio1/U_0/sbus_addr
add wave -noupdate /tb_audio1/U_0/sbus_be
add wave -noupdate /tb_audio1/U_0/sbus_rd
add wave -noupdate /tb_audio1/U_0/sbus_rdata
add wave -noupdate /tb_audio1/U_0/sbus_wdata
add wave -noupdate /tb_audio1/U_0/sbus_we
add wave -noupdate /tb_audio1/U_0/fifo2_en
add wave -noupdate /tb_audio1/U_0/fifo2_rd
add wave -noupdate /tb_audio1/U_0/fifo2_rxtrig
add wave -noupdate /tb_audio1/U_0/fifo2_wdata
add wave -noupdate /tb_audio1/U_0/fifo2_we
add wave -noupdate /tb_audio1/U_0/U_13/clk
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_en
add wave -noupdate /tb_audio1/U_0/fifo2_rxtrig
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_raddr_rx
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_raddr_tx
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_rxtrig
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_waddr_rx
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_waddr_tx
add wave -noupdate /tb_audio1/U_0/U_13/reset
add wave -noupdate /tb_audio1/U_0/U_13/sample_en
add wave -noupdate /tb_audio1/U_0/U_13/fifo2_we_rx
add wave -noupdate /tb_audio1/U_0/U_13/cnt
add wave -noupdate /tb_audio1/U_0/U_13/current_state
add wave -noupdate /tb_audio1/U_0/U_13/trig
add wave -noupdate /tb_audio1/U_0/U_13/trig_reg
add wave -noupdate -divider FIFO-TX
add wave -noupdate /tb_audio1/U_0/U_17/clk
add wave -noupdate /tb_audio1/U_0/U_17/reset
add wave -noupdate /tb_audio1/U_0/U_17/we_ack
add wave -noupdate /tb_audio1/U_0/U_17/wdata
add wave -noupdate /tb_audio1/U_0/U_17/we
add wave -noupdate /tb_audio1/U_0/U_17/fifo_en
add wave -noupdate /tb_audio1/U_0/U_17/rd_ack
add wave -noupdate /tb_audio1/U_0/U_17/fifo_size
add wave -noupdate /tb_audio1/U_0/U_17/rdata
add wave -noupdate /tb_audio1/U_0/U_17/raddr
add wave -noupdate /tb_audio1/U_0/U_17/waddr
add wave -noupdate /tb_audio1/U_0/U_17/rb_mode
add wave -noupdate /tb_audio1/U_0/U_17/rd
add wave -noupdate /tb_audio1/U_0/U_17/wrcnt
add wave -noupdate /tb_audio1/U_0/U_17/rdcnt
add wave -noupdate /tb_audio1/U_0/U_17/rdcnt_next
add wave -noupdate /tb_audio1/U_0/U_17/wrptr
add wave -noupdate /tb_audio1/U_0/U_17/rdptr
add wave -noupdate /tb_audio1/U_0/U_17/en
add wave -noupdate -divider 'FIFO-RX
add wave -noupdate /tb_audio1/U_0/fifo2_we_rx
add wave -noupdate /tb_audio1/U_0/U_19/clk
add wave -noupdate /tb_audio1/U_0/U_19/reset
add wave -noupdate /tb_audio1/U_0/U_19/we_ack
add wave -noupdate /tb_audio1/U_0/U_19/wdata
add wave -noupdate /tb_audio1/U_0/U_19/we
add wave -noupdate /tb_audio1/U_0/U_19/fifo_en
add wave -noupdate /tb_audio1/U_0/U_19/rd_ack
add wave -noupdate /tb_audio1/U_0/U_19/fifo_size
add wave -noupdate /tb_audio1/U_0/U_19/rdata
add wave -noupdate /tb_audio1/U_0/U_19/raddr
add wave -noupdate /tb_audio1/U_0/U_19/waddr
add wave -noupdate /tb_audio1/U_0/U_19/rb_mode
add wave -noupdate /tb_audio1/U_0/U_19/rd
add wave -noupdate /tb_audio1/U_0/U_19/wrcnt
add wave -noupdate /tb_audio1/U_0/U_19/rdcnt
add wave -noupdate /tb_audio1/U_0/U_19/rdcnt_next
add wave -noupdate /tb_audio1/U_0/U_19/wrptr
add wave -noupdate /tb_audio1/U_0/U_19/rdptr
add wave -noupdate /tb_audio1/U_0/U_19/en
TreeUpdate [SetDefaultTree]
WaveRestoreCursors {{Cursor 1} {25126558 ns} 0} {{Cursor 2} {26528515 ns} 0}
quietly wave cursor active 1
configure wave -namecolwidth 259
configure wave -valuecolwidth 100
configure wave -justifyvalue left
configure wave -signalnamewidth 0
configure wave -snapdistance 10
configure wave -datasetprefix 0
configure wave -rowmargin 4
configure wave -childrowmargin 2
configure wave -gridoffset 0
configure wave -gridperiod 1
configure wave -griddelta 40
configure wave -timeline 0
configure wave -timelineunits ns
update
WaveRestoreZoom {24766483 ns} {26276371 ns}
