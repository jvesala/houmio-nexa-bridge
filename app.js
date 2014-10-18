var telldus = require('telldus');
var fs = require('fs');
var winston = require('winston');
var conf = JSON.parse(fs.readFileSync('./config.json'));
var WebSocket = require('ws');
var ws = new WebSocket(conf.serverAddress);
var _ = require('lodash');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({ filename: 'logs/nexa-bridge.log', level: conf.logLevel })
    ]
  });
var devices = telldus.getDevicesSync(function(err, devices) {
                if ( err ) {
                   console.log('Failed to read TellStick devices!', err);
                   process.exit(1);
                 } else {
                   return JSON.stringify(devices);
                 }
               });

ws.on('open', function() {
  logger.info('Connected to ' + conf.serverAddress);
  publish = JSON.stringify({ command: "publish", data: { sitekey: conf.siteKey, vendor: "knx" } });
  ws.send(publish);
  logger.debug('sent publish', publish);
});

ws.on('message', function(msg) {
  logger.debug('received message %s', msg);
  message = JSON.parse(msg);
  if (message.command === 'set') {
    handleSetCommand(message);
  }
})

// todo: proper way method to separate switches, dimmers and buttons
function isSwitch(deviceId) {
  return _.some(devices, function(device) {
    return (device.id == deviceId) && device.name.indexOf("Nexa") >= 0;
  });
}

function isDimmer(deviceId) {
  return _.some(devices, function(device) {
    return (device.id == deviceId) && device.model.indexOf("dimmer") >= 0;
  });
}

function isButton(deviceId) {
  return _.some(devices, function(device) {
    return (device.id == deviceId) && device.name.indexOf("Button") >= 0;
  });
}

function switchData(deviceId, eventName) {
  return deviceId + " " + (eventName === 'ON' ? 1 : 0);
}

function dimmerData(deviceId, eventName) {
  if (eventName == 'ON' || eventName == 'OFF') {
    return deviceId + " " + (eventName === 'ON' ? "ff" : 0);
  } else {
    // TODO: throttle dimmer result values to prevent premature feedback during dimming
    return undefined
  }
}

function buttonData(deviceId, eventName) {
  return "6/6/" + deviceId + " " + (eventName === 'ON' ? 1 : 0);
}

function handleSetCommand(message) {
  var deviceId = parseInt(message.data.groupaddress);
  var dimmer = isDimmer(deviceId);
  var value = dimmer ? parseInt(message.data.value, 16) : parseInt(message.data.value);
  if (dimmer && value > 0 && value < 255) {
    telldus.dimSync(deviceId, value);
  } else if (value === 0) {
    telldus.turnOffSync(deviceId);
  } else {
    telldus.turnOnSync(deviceId);
  }
}
var deviceEventListener = telldus.addDeviceEventListener(function(deviceId, status) {
  logger.debug('received event for device ' + deviceId + ' status: ' + status.name  +
      (status.level != undefined ? ' level: ' + status.level : ""));
  var data = undefined;
  if (isSwitch(deviceId)) data = switchData(deviceId, status.name);
  if (isButton(deviceId)) data = buttonData(deviceId, status.name);
  if (isDimmer(deviceId)) data = dimmerData(deviceId, status.name);
  if (data != undefined) {
    var message = JSON.stringify({ command: "knxbusdata", data: data });
    ws.send(message);
    logger.debug('sent knxbusdata', message);
  }
});

ws.on('ping', function(ping) {
  logger.debug('ping received');
  ws.pong();
});

ws.on('error', function(error) {
  logger.info('Error received: %s -> exiting', error);
  process.exit(1);
});

ws.on('close', function() {
  logger.info('Connection closed -> exiting');
  process.exit(1);
});
