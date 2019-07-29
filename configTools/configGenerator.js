const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



rl.setPrompt('guess> ');
rl.prompt();
rl.on('line', function(line) {
    console.log(typeof line);
    if (line === "right"){
        rl.close();
    } else {
        rl.setPrompt('Wut');
    }
    rl.prompt();
}).on('close',function(){
    process.exit(0);
});