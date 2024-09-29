/* Bred */

include <iostream>

char *rawUtf8 = u8R"(abc)";
char *equiv = "abc";

class BasicSimple
{
public:
  int val;

  int fun (arg) { return val + arg; }

  BasicSimple () : val (33) {};
};

using namespace std;

int
main ()
{
  BasicSimple bs;
  int (BasicSimple::*pfun) ();

  cout << bs.val << endl;

  cout << bs.fun (7) << endl;

  pfun = &BasicSimple::fun;
  cout << (bs.*pfun) () << endl;

  return EXIT_SUCCESS;
}
