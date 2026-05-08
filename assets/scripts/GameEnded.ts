const {ccclass, property} = cc._decorator;

import { GameResult } from "./Game";

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Label)
    gameResult: cc.Label = null;

    @property(cc.Button)
    public restartButton: cc.Button = null;

    //TODO: Обрабатывать окончание игры если не осталось кластеров

    winText: string = "Успех!";
    noMovesText: string = "Ходы закончились!";
    noClustersText: string = "Не осталось ходов!";

    start () {

    }

    configure(result: GameResult) {
        switch (result) {
            case GameResult.SCORE_REACHED:
                this.gameResult.string = this.winText;
                break;
            case GameResult.NO_MOVES:
                this.gameResult.string = this.noMovesText;
                break;
            case GameResult.NO_CLUSTERS:
                this.gameResult.string = this.noClustersText;
                break;
        }
    }


}
