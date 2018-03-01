const _ = require('lodash')
const SerialPort = require('serialport')
const now = require('performance-now')

const LightDevice = require('./LightDevice')

let reconnectTime = 3000;

const ENCODING_POS_RGB = 1;
const ENCODING_POS_VGA = 2;
const ENCODING_VGA = 3;
const ENCODING_RGB = 4;


module.exports = class LightDeviceSerial extends LightDevice {
  constructor(numberOfLights, devicePortWindows, devicePortUnix) {
    super(numberOfLights, devicePortWindows);

    this.encoding = ENCODING_RGB

    this.devicePort = /^win/.test(process.platform) ? devicePortWindows : devicePortUnix;

    this.freshData = false;
    this.waitingResponse = true;
    this.dataBuffer = []

    this.setupCommunication()
  }

  sendNextFrame() {
    if(this.freshData && !this.waitingResponse) {
      this.initEncoding()

      let dim = 1
      for (let i = 0; i < this.numberOfLights; i++) {
        this.writePixel(i,
          this.state[i][0] / dim,
          this.state[i][1] / dim,
          this.state[i][2] / dim
        )
      }
      this.freshData = false;
      this.waitingResponse = true;
      this.flush()
    }
  }

  handleArduinoData(data) {
    if(data){
      data = data.replace(/[^\w]+/gi, "")

      if(data === 'YEAH'){
        this.logInfo("Reconnected")
        this.updateState(this.STATE_RUNNING);
      } else if (data === 'OK') {
        //this.logInfo(`ACK`)
      } else {
        this.logInfo(`UNEXPECTED MSG'${data}'`)
      }
    } else {
      this.logInfo(`No data received`)
    }

    clearTimeout(this.reconnectTimeout);

    this.reconnectTimeout = setTimeout(() => {
      this.sendInitialKick()
    }, reconnectTime)

    this.framesCount++
    this.waitingResponse = false;
    this.sendNextFrame()
  }


  initEncoding() {
    this.write([this.encoding]);
    if (this.needsHeaderWithNumberOfLights()) {
      this.write([this.numberOfLights]);
    }
  }

  needsHeaderWithNumberOfLights () {
    return this.encoding === ENCODING_POS_RGB
        || this.encoding === ENCODING_POS_VGA
  }

  writePixel(pos, r, g, b) {
    switch (this.encoding) {
      case ENCODING_RGB:
        return this.write([r, g, b])
      case ENCODING_VGA:
        return this.write([rgbToVga(r, g, b)])
      case ENCODING_POS_RGB:
        return this.write([pos, r, g, b])
      case ENCODING_POS_VGA:
        return this.write([pos, rgbToVga(r, g, b)])
      default:
        this.logError('Invalid encoding!')
        return
    }
  }

  write(data) {
    this.dataBuffer = this.dataBuffer.concat(data);
  }

  flush() {
    if(this.port) {
      this.port.write(Buffer.from(this.dataBuffer))
    }
    this.dataBuffer = [];
  }

  sendInitialKick(){
    if(this.port) {
      this.port.write('XXX', (err) => {
          if(err){
            this.handleError(err)
          } else {
            this.logInfo('Initial kick of data sent')
          }
        }
      )

      clearTimeout(this.reconnectTimeout);

      this.reconnectTimeout = setTimeout(() => {
        this.sendInitialKick()
      }, reconnectTime)
    }
  }

  setupCommunication() {
    this.updateState(this.STATE_CONNECTING);
    // const setRetry = function() { setTimeout(tryOpenPort, 2000) };

    const tryOpenPort = () => {
      try {
        this.port = new SerialPort(this.devicePort, {
          baudRate: 1152000 / 2,
          parser: SerialPort.parsers.readline("\n")
        })

        this.port.on('open', () => {
          this.updateState(this.STATE_CONNECTING);
          this.logInfo('Port open. Data rate: ' + this.port.options.baudRate);
          setTimeout(this.sendInitialKick.bind(this), 100)
        })

        this.port.on('error', this.handleError.bind(this))
        this.port.on('data', this.handleArduinoData.bind(this))
        this.port.on('drain', this.handleDrain.bind(this))
        this.port.on('close', this.handleClose.bind(this))
        this.port.on('disconnect', this.handleClose.bind(this))
      } catch (err) {
        this.updateState(this.STATE_ERROR);
        this.logError("Error retrying to open port. ", err)
        setTimeout(() => this.setupCommunication(), 2000);
      }
    };

    if(!this.port) {
      tryOpenPort();
    }
  }
// open errors will be emitted as an error event
  handleError(err) {
    if(this.port) {
      this.updateState(this.STATE_ERROR);
      this.logError('Error: ' + err.message)

      var oldPort = this.port;
      // To prevent reentrancy with handlers
      this.port = null;
      oldPort.close();
      setTimeout(() => this.setupCommunication(), 2000);
    }
  }

  handleClose(err) {
    if(this.port) {
      this.updateState(this.STATE_ERROR);
      this.logError('Port closed.')
      this.port = null;
      setTimeout(() => this.setupCommunication(), 2000);
    }
  }

  handleDrain(err) {
    this.logWarning('Port drained.')
  }
}