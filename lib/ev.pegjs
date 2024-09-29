// Bred
//
// To the extent possible under law, the author(s) have dedicated all
// copyright and related and neighboring rights to this software to
// the public domain worldwide. This software is distributed without
// any warranty.
//
// You should have received a copy of the CC0 Public Domain Dedication
// along with this software. If not, see
// <http://creativecommons.org/publicdomain/zero/1.0/>.

start = event|0.., " "|

event = prefix:prefix key:key {
  if ((typeof key == 'string') || key instanceof String)
    return prefix + key
  return prefix + key.join('')
}

prefix = "C-A-" / "C-" / "A-" / ""

key = " " / "-" / [^- \t\n\r]+

/*
start = event (space event)*

event = prefix? key

prefix = (CA / C / A)

CA = "C-A-"

C = "C-"

A = "A-"

key = space / word

space = " "

word = char+

char = [^ \t\n\r]
*/
