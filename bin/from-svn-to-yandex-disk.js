#!/usr/bin/env node
var fromSvnToYaDisk = require('../lib');
var program = require('commander');

program
  .option('-c, --config <path>', 'Путь конфигурационного файла')
  .parse(process.argv);

var config = require(program.config);
var copyingData = new fromSvnToYaDisk.InitMod(config);

copyingData.run();
