// Peggy

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
