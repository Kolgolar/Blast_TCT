import Grid from './grid';

const {ccclass, property} = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Label)
    scoreLabel: cc.Label = null;

    @property(cc.Label)
    movesLabel: cc.Label = null;

    @property(cc.Integer)
    maxMoves: number = 30;

    @property(cc.Integer)
    scoreTarget: number = 500;

    @property(cc.Node)
    grid: cc.Node = null;

    score: number = 0;
    movesLeft: number = 0;
    // @property
    // text: string = 'hello';

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        this.grid.on("tokens-destroyed", this.onTokensDestroyed, this);
        this.grid.on("move-made", this.onMoveMade, this);
        this.grid.on("game-over", this.onGameOver, this);
    }

    protected onDestroy(): void {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    start () {
        this.restartGame();
    }

    update (dt) {
        // this.addScore(1);
    }

    onMoveMade(event: cc.Event.EventCustom) {
        this.setMoves(this.movesLeft - 1);
        
        if (this.movesLeft <= 0) {
            this.gameOver();
        }
    }


    onTokensDestroyed(event: cc.Event.EventCustom) {
        const data = event.getUserData();
        const tokens = data.tokens;
        let pointsAdd = 0;
        for (const [type, count] of Object.entries(tokens)) {
            console.log(count);
            pointsAdd += 10 * (count as number);
        }
        this.setScore(this.score + pointsAdd);
    }
    

    onGameOver(event: cc.Event.EventCustom) {
        this.gameOver();
    }


    public setScore(points: number) {
        this.score = points
        this.scoreLabel.string = `${this.score}/${this.scoreTarget}`;
    }

    public setMoves(moves: number) {
        this.movesLeft = moves;
        this.movesLabel.string = `${this.movesLeft}`;
    }

    public gameOver() {
        console.log("Game Over!");
    }


    restartGame() {
        this.setMoves(this.maxMoves)
        this.setScore(0);
        let gridScript = this.grid.getComponent(Grid);
        gridScript.startNewGame();
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (event.keyCode === cc.macro.KEY.r) {
            this.restartGame();    
        }
    }
}
