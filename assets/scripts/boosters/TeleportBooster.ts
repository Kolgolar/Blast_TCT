import Grid from "../Grid";
import { BaseBooster } from "./Booster";

const {ccclass, property} = cc._decorator;

@ccclass
export class TeleportBooster extends BaseBooster {

	activate(grid: Grid, onComplete: () => void, onUpdateUI: () => void) {
		if (this.count <= 0) {
			onComplete();
			return;
		}
		let pendingPos: cc.Vec2 | null = null;
		grid.setBoosterMode(
			(pos) => {
				if (pendingPos === null) {
					pendingPos = pos;
					// Подсвечиваем выбранный токен
					grid.highlightToken(pos, 'selected');
				} else {
					// Убираем подсветку перед обменом
					grid.clearHighlight(pendingPos);
					if (this.count <= 0) {
						grid.clearBoosterMode();
						onComplete();
						return;
					}
					this.count--;
					onUpdateUI();
					grid.swapTokens(pendingPos, pos, () => {
						grid.clearBoosterMode();
						onComplete();
					});
				}
			},
			() => {
				// Убираем выделение, если был выбран первый токен
				if (pendingPos) {
					grid.clearHighlight(pendingPos);
				}
				grid.clearBoosterMode();
				onComplete();
			}
		);
	}
}