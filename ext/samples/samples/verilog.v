// Bred

// if in1 is 0 then in2 else in3
module plexer(in1, in2, in3, out1);
   input in1, in2, in3;
   output out1;

   // wires
   wire   out_not1, out_and1, out_and2;

   // gates
   not not1(out_not1, in1);
   and and1(out_and1, out_not1, in2);
   and and2(out_and2, in1, in3);
   or or1(out_and1, out_and2);
endmodule; // plexer
