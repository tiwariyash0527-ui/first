const color = ["blue" , "orange" , "purple" , "pink" , "black"]
const size = [70 , 80 , 50 , 100 , 150];
let colorindex = 0;
let sizeindex = 0;
function change(){
    document.getElementById("lol").style.color=color[colorindex];
    colorindex = (colorindex+1)% color.length;
}
function changesize(){
    document.getElementById("lol").style.fontSize=size[sizeindex] + "px";
    sizeindex = (sizeindex+1)% size.length;
}
function add(){
    let p = document.createElement("p");
    p.innerText = "text this is new";
    document.getElementById("container").appendChild(p);
    p.setAttribute('id','p1');
}
function Remove(){
    const r = document.getElementById("p1");
    if (r){
        r.remove();
    }
}
function car(){
    const car = [];
 for(i=0; i < 99; i++){
    console.log("car"+i);
    }
}
function minimum(){
    const arr = [1,2,3,4,5,6,7,8,9];
    let mini = arr[0];
    for (let i = 1 ; i < arr.length ; i++){
        if (arr[i] < mini){
            mini = arr[i];
        }
    }
    document.getElementById("para").innerHTML += "<br>the minimum value is:" + mini;
}
function maximum(){
    let arr = [1,2,3,4,5,6,7,8,9];
    let maxi = arr[0];
    for(let i = 1 ; i < arr.length ; i++){
        if (arr[i] > maxi){
            maxi = arr[i];
        }
    }
    document.getElementById("para").innerHTML += "<br>the maximum value is:" + maxi;
}
function sum(){
    let arr = [1,2,3,4,5,6,7,8,9];
    let sum = 0;
    for(let i = 0 ; i < arr.length ; i++){
        sum += arr[i];
    }
    document.getElementById("para").innerHTML += "<br>the sum of the array is:" + sum;
}
function even(){
    let arr = [1,2,3,4,5,6,7,8,9];
    for(let i = 0 ; i < arr.length ; i++){
        if (arr[i] % 2 == 0){
            document.getElementById("para").innerHTML += "<br>the even numbers are:" + arr[i];
        }
}
}
function Search(){
    let arr = ["java" , "python" , "c++" , "c" , "javascript"];
    let search = prompt("enter the language you want to search");
    let found = false;
    for(let i = 0 ; i < arr.length ; i++){
        if (arr[i] == search){
            found = true;
            break;
        }
}
document.getElementById("para").innerHTML += "<br>the language is found:" + found;
}
function vowel(){
        let str = prompt("Enter a string:");
        let vowels = [];
        for (let i = 0; i < str.length; i++) {
            let char = str[i].toLowerCase();
            if ("aeiou".includes(char)) {
                vowels.push(char);
            }
        }
        document.getElementById("para").innerHTML += "<br>The vowels in the string are: " + vowels.join(", ");
    }