// Javascript

let x = 0

function add
(a,
 b,
 caches) {
  return a + b
}

/* block
   comment */
const incr = n => n + 1

console.log(incr(add(3, 4)))

{
  // block will fold
  let word$test
  word$test = 1
}

switch (x) {
  case 0: {
    console.log('0')
    break;
  }
  default:
    console.log(x)
}
