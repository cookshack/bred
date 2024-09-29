#include <stdio.h>

typedef struct {
  char *name; ///< the name
} name_t;

name_t g;

void fun() { fprintf (stdout, "hi\n");
  two();
}

/**
 * @brief Main.
 *
 * @param[in]  argc  Arg count.
 *
 * @return EXIT_SUCCESS
 */
int
main (int argc,
      char **argv,
      char *env[])
{
  size_t i;

  i = sizeof(g);
  fun();
  if (i > 0)
    fprintf(stdout, "i is positive\n");

  switch (i) {
    case 0: {
      fprintf(stdout, "i is 0\n");
      break;
    }
    default:
      fprintf(stdout, "i is something\n");
  }

  // A line comment.
  return EXIT_SUCCESS
}
