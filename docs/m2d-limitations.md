# M2d limitations

M2d draws the text rectangles HDL Designer stored for state actions and for transition conditions and actions. The words stay on the state or transition. The rectangle is only geometry. Moving or resizing a rectangle leaves the condition, the actions, and the spline unchanged.

## What is drawn

A visible `MLText` with text and a rectangle of positive area becomes a text box anchored at that rectangle. `morse_transmitter` uses these boxes for during-actions such as `s_fetch` and `s_code0`, and for conditions and actions such as `opcode = op_morsecode_c`. The text keeps its line breaks. HDL Designer records one text line as about 1000 drawing units, so the imported rectangle is only a few pixels tall once the sheet fits the window. The drawn box grows, wrapping near 36 characters, until the full text is readable at that fitted view. The stored rectangle stays the imported one until the user resizes it. The Preferences tab sets the on-screen size for that fitted view, from 8 px to 16 px, and stores it in `workspace/ui.json` as `state_text_px`. Vue Flow scales the whole pane with a CSS transform, so the font and the drawn box stay in the same coordinates and later zoom scales them together. Changing the slider does not write the diagram file. The box can be moved and resized on the workspace copy. Undo, redo, save, and reload keep the words and the stored rectangle.

## What is reported

- A hidden rectangle, including a hidden `< Automatic >` action, stays on the state or transition as text and is not drawn. The diagnostic is `text_box_hidden`.
- A text whose own rectangle and whose enclosing block rectangle have no area is `text_box_extent_missing`. No position is invented.
- An editable copy saved before M2d has an empty text-box list. A new copy from the import picks up the rectangles.
- The editor still does not add a state or a transition, and it does not generate VHDL.
