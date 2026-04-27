// let spade1 = (spade,1)
// let spade2 = (spade,2)
// let spade3 = (spade,3)

// let clover1 = (clover,1)
// let clover2 = (clover,2)
// let clover3 = (clover,3)

let spade = "spade"
let clover = "clover"


let shapelist = [spade, clover]
let numlist = [1,2,3]

function hello() {
  let shape = Math.floor(Math.random() * 2);
  let num = Math.floor(Math.random() * 3);
  console.log(shapelist[shape],numlist[num])
  //console.log(num,shape);
}
