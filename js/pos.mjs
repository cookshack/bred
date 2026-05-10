export
function make
(row, // 0 indexed (Mon is 1 indexed)
 col) { // 0 indexed (Mon is 1 indexed)
  return { get row
           () {
             return row
           },
           get col
           () {
             return col
           },
           // Mon style
           get lineNumber
           () {
             return row + 1
           },
           get column
           () {
             return col
           },
           //
           set row
           (val) {
             return row = val
           },
           set col
           (val) {
             return col = val
           },
           //
           set lineNumber
           (val) {
             if (val < 0)
               row = 0
             else
               row = val - 1
             return row
           },
           set column
           (val) {
             return col = val
           } }
}
