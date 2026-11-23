# E1 — Readable block diagrams

E1 changes the picture of a block diagram. Opening that diagram edits the workspace model. The HDL Designer file is not written. Wires, port ids, and instance ids stay as they were.

A label shows the port name. Preferences choose the short or long form. Short form is `clk` and `guard_time(15:0)`. Long form is `clk: std_logic` and `guard_time: std_logic_vector(15 downto 0)`. Direction is included in the long form when the port has one. A range that is not a recorded `downto` or `to` bound is left out of the short form. No width is invented. The long form stays available as the label tooltip.

Port names are drawn on the component, on the pin they belong to. The font height follows the vertical distance between those signal lines, and it scales with the diagram. The instance name stays in the middle of the component. The full recorded text remains the tooltip.

A signal name is the text box stored on that wire. A hidden box stays hidden. A wire with no stored box gets no invented name. The name is drawn above the wire, along the edge of that rectangle. A net with a recorded range is drawn as a bus, thicker than a scalar net. Both strokes are thinner than the earlier uniform line. A click draws the box. Dragging moves only that rectangle. Editing the text renames the net, so every label of that net shows the new name. The polyline points stay where they were.

E2 through E6 are not in this step. A double-click does not open a child diagram yet.

Checked on `hds/top_rtc_app/struct.bd`. Every port of `U_7` / `registers` is labeled on the symbol, and the type stays smaller than the pin pitch. `U_9` reads `morse_transmitter`. No label contains a guessed value.
