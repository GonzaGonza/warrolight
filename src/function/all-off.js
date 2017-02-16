import {TimeTickedFunction} from "./TimeTickedFunction";
import {ColorUtils} from "../utils/ColorUtils";

export class Func extends TimeTickedFunction{
  constructor(config) {
    super(config);
  }

  // Override base class
  drawFrame(draw, done){
    let colors = [... Array(this.config.numberOfLeds)]; // Array del tamaño de las luces
    draw(colors.map(() => "#000000"));
  }
}