const Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
    name:'ColumbiaMOWeatherBot',
    description: 'Posts the weather twice a day for Columbia MO.',
    script: 'C:\\Users\\fly_s_y\\Projects\\ColumbiaMOWeatherBot\\index.js')
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
    svc.start();
});

svc.install();