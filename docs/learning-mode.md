# Learning Mode — architecture only

Learning Mode is not implemented. This note records the shape it has to keep so a later course does not become a second HDL-Maker.

## Local and offline

HDL-Maker stays an application on the student's computer. Courses run without an account and without a network call. A missing network does not block a lesson that is already installed. The API keeps the existing bind to `127.0.0.1`.

## Content packages

A course is a separate package, not a change to the HDL-Maker program. Each package has its own version. Installing or removing a course does not replace the design libraries, the FPGA builds, or another course. A package can hold readings, exercises, and example projects. It does not vendor a toolchain and it does not modify `libs/`.

## One core

Design Mode and Learning Mode use the same HDL-Maker core: the project model, VHDL generation, simulation, and the FPGA backends. Learning Mode adds a way to open a lesson and to check the work the lesson asks for. It does not grow a second generator, a second simulator, or a second FPGA build path.

The next teaching work is L0, the architecture of that local course, and SV0, a language-neutral place for VHDL and SystemVerilog. Neither has started.
