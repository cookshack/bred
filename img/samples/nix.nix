# Bred
#
# nix-instantiate --eval nix.nix

let
  f = x : x + 7;
  x = 1;
  y = 2;

  z = rec { a = "abc";
    b = f 4; # 4 + 7 = 11
    c = [ 9 10 11];
    d = a;
  };

in "Hello ${z.d} number ${toString (x + z.b)}"
