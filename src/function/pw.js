import {TimeTickedFunction} from "./TimeTickedFunction";

export class Func extends TimeTickedFunction{
  constructor(config) {
    super(config);
    this.geometry = this.config.geometry;
    this.drawingP = true;
  }

  // Override base class
  drawFrame(draw, done) {
    const colors = [... Array(this.config.numberOfLeds)]; // Array del tamaño de las luces

    for (let i = 0; i < this.config.numberOfLeds; i++) {
      const x = this.geometry.x[i]
      const y = this.geometry.y[i]

      const W = !(y < this.geometry.height / 2
      && x > this.geometry.width / 3
      && x < this.geometry.width * 2 / 3)

      const P = i > this.geometry.leds / 3
        && x < this.geometry.width * 2 / 3

      let color = '#000000'
      if (!this.drawingP && W) {
        color = '#ff0000'
      }
      if (this.drawingP && P) {
        color = '#00ff00'
      }
      colors[i] = color
    }

    draw(colors)

    this.drawingP = !this.drawingP;
  }
}