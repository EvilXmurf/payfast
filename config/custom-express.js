var express = require('express');
var consign =  require('consign');

module.exports = function(){
  var app =  express();

  //Controllers
  consign().include('controllers').into(app);

  return app;
};
