import Grid from "../Grid";
import { BaseBooster } from "./Booster";

const {ccclass, property} = cc._decorator;

@ccclass
export class BombBooster extends BaseBooster {
    public radius: number = 1;

	activate(grid: Grid, onComplete: () => void, onUpdateUI: () => void) {
		if (this.count <= 0) {
			onComplete();
			return;
		}
		grid.setBoosterMode(
			(pos) => {
				if (this.count <= 0) {
					grid.clearBoosterMode();
					onComplete();
					return;
				}
				this.count--;
				onUpdateUI();
				grid.explodeArea(pos.x, pos.y, this.radius, () => {
					grid.clearBoosterMode();
					onComplete();
				}, 0);
			},
			() => {
				grid.clearBoosterMode();
				onComplete();
			}
		);
	}
}