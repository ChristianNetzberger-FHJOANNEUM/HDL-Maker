# Diagram transaction architecture

D4c and D4d keep two histories. That was a deliberate choice so a sheet undo could not write an old document over the other instances of a component. It is also the reason a later sheet edit can disappear. D5a records the rule and the cases. D5b is the replacement.

D5a is complete. D5b is released. The binding D5b.1 specification is [d5b-transactional-undo-architecture.md](d5b-transactional-undo-architecture.md). This file remains as the record of the two-stack rule and the loss cases that D5b must remove. D5b is not implemented yet; D5b.1 is architecture only.

## The rule that is in the lab today

A sheet edit goes through `EditSession` for the open document id. U1 and U2 share that session, because they share the document. Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, **Undo**, and **Redo** use only that session.

A component command goes through `ProjectSession.transact`. The snapshot is the whole project, taken when the command starts. The command is recorded only when it returns a new project object. A refused command returns the same object and adds no step. Before the snapshot, an in-progress gesture is cancelled, and an unfinished wire is dropped.

Because a sheet edit writes into the document that already lives in the project, the next project snapshot contains every sheet edit that happened before the command. The editor then discards every `DocumentSession`. The sheet **Undo** button stays disabled until a new sheet edit. The hint in the component panel is “A project change clears sheet undo. Project undo restores every document.”

A sheet edit that happens after the command is in the live project and is not in the snapshot. **Project undo** restores the snapshot, so that later edit is gone. **Project redo** restores the project that was current at the moment of the undo, and that copy includes the later edit, because undo pushes the current project onto the future stack.

**New project**, **Digital**, **Signal**, **General**, **Project**, **Reload**, **Load file**, and leaving the project call `ProjectSession.clear()`. Both stacks are dropped. View memory is also dropped, and it is not saved in the file.

## Cases

Each case can be tried on **Digital**. None of them is fixed here.

1. **A sheet edit, then a project command.** Move SW1. Then add a logical port, or extract a selection. The move is inside the snapshot, so **Project undo** keeps the move and removes the command. **Undo** and Ctrl+Z cannot remove the move, because the sheet stack was discarded. The move is stuck. It can be dragged back by hand, and that new drag is a new sheet edit.

2. **A project command, then a sheet edit.** Make one counter unique, or extract a selection. Then move a block or rename a net. **Undo** removes that later edit and leaves the project command. **Project undo**, if it is used while the later edit is still present, restores the snapshot from before the command and the later edit is gone. **Project redo** brings the later edit back, because it was part of the project at undo time. The user who presses **Project undo** to undo the extract also loses the rename they made afterwards.

3. **One sheet stack for every path.** Open U1, move Stage, then open U2. It is the same document and the same **Undo**. That part is right: there is one Counter diagram. It is surprising if the two paths feel like two copies. A project command then discards that stack for both paths, not only for the path that was on screen.

4. **The shortcut and the button disagree.** After a project command, Ctrl+Z does nothing useful: sheet undo is empty. The command is undone only by **Project undo**, which has no shortcut. The two buttons sit apart on a wrapping toolbar.

5. **A cancelled gesture and a refused command add nothing.** Escape during a drag restores the document and does not push a step. An extract of one block, or an expand of a component that has no diagram, returns the same project and does not push a project step. The unfinished wire that was on screen when the command started is dropped before the snapshot, so it is not part of the undo either.

6. **Opening another project clears both stacks.** Edit the Digital sheet, then click **Signal**, or **Reload**, or **New project**. **Undo** and **Project undo** are both disabled. The edit is gone unless **Save** was used first.

Case 2 is the one that loses work. Case 1 loses the ability to undo the earlier edit without also undoing the project command. Both are unacceptable in an editor that other applications will build on.

## D5b — one chronological history

Not implemented. The shape to build, after the keyboard session confirms the priority:

One project owns one undo stack and one redo stack whenever a project is open. Every completed user action is one entry, in the order it happened. A block move is an entry. An extract is an entry. Undo always pops the latest entry, whether it was a drag or a component command. Redo pushes it back. There is one **Undo** button and Ctrl+Z calls it. The separate **Project undo** button goes away.

An entry is one of two kinds.

- A sheet entry names one document id and stores that document before and after the edit. Undo and redo replace that document inside the current project and leave every other document and the component list as they are.
- A project entry stores the whole project before and after the command. Undo and redo replace the project. This is still required for extract, expand, make unique, and an interface edit, because those commands change several documents and the component list together.

The order is what removes the loss. If the user extracts and then renames a net, the rename is a later sheet entry. The first undo restores the name and leaves the extract. The second undo restores the sheet from before the extract. The rename is undone explicitly, not discarded as a side effect.

A refused command adds no entry. Escape during a drag adds no entry: the gesture is still cancelled before commit, as it is today. A drag commits one entry on pointer up, not one entry per move event. The cap can stay 40 entries until a longer session shows that it is too small.

While a project is open, `EditSession` is no longer a second history. It can remain the history of a sheet that was opened with **New**, **Example**, or **Load file** without a project. Those sheets have no component commands, so one document stack is enough.

Opening U1 and U2 still edits one document. A sheet entry for that document is one entry, and both paths show the result. That is the same sharing as today, expressed as one log instead of a hidden second stack.

After a project entry is undone, any view that was showing a document the command created must resolve again, the way navigation already resolves a missing step to the last ancestor. The entry does not try to keep a path that no longer exists.

### Open questions for the implementation

- Whether a sheet entry stores two document snapshots or stores the command and its inverse. Snapshots match the current code and make a refused command easy to exclude. Commands use less memory on a large sheet. D5d should be allowed to change the representation without changing the order of the entries.
- Whether the stack is saved in the project file. Today neither stack is saved. A saved stack would redo on another machine and would have to be versioned. The first D5b can keep the stack in the session.
- How a download written by **Save** relates to an unsaved entry. Save already writes the live project. The stack can stay in memory.
- The exact moment a gesture that started on U1 is committed if the user navigates to U2 before pointer up. The safe rule is the rule already used: cancel the gesture before the location changes, and add no entry.

Until D5b is built, the lab keeps the two stacks and the discard of `DocumentSessions` after every project command and after project undo and redo.
