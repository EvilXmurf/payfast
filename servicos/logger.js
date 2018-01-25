var winston =  require('winston');
var fs = require('fs');

if(!fs.existsSync('logs')){
  fs.mkdirSync('logs');
}

module.exports = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: "info",
      filename: "./logs/payfast.log",
      maxsize: 100000,
      maxFiles: 10,
      colorize: true
    },
    {
      level: "error",
      filename: "./logs/payfast.log",
      maxsize: 100000,
      maxFiles: 10,
      colorize: true
    })
  ]
});