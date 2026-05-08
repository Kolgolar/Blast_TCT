import Grid from './Grid';
import GameEnded from './GameEnded';
import BoostersContainer from './BoostersContainer';

const {ccclass, property} = cc._decorator;
export enum GameResult { SCORE_REACHED, NO_MOVES, NO_CLUSTERS }

@ccclass("Game")
export default class Game extends cc.Component {

    @property(cc.Prefab)
    resultsPanel: cc.Prefab = null;

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

    @property(cc.Node)
    boostersContainer: cc.Node = null;

    @property(cc.Integer)
    boosterBombStartCount = 3;

    @property(cc.Integer)
    boosterSwapStartCount = 5;

    private gameEnded = false;
    private resultsPanelInstance: cc.Node = null;
    private score: number = 0;
    private movesLeft: number = 0;
    

    onLoad () {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        this.grid.on("tokens-destroyed", this.onTokensDestroyed, this);
        this.grid.on("no-clusters", this.onNoClusters, this);
        this.grid.on("game-stable", this.onGameStable, this);
    }

    start () {
        this.restartGame();
    }


    onTokensDestroyed(event: cc.Event.EventCustom) {
        const data = event.getUserData();
        const tokens = data.tokens;
        let pointsAdd = 0;
        for (const [type, count] of Object.entries(tokens)) {
            pointsAdd += 10 * (count as number);
        }
        this.setScore(this.score + pointsAdd);

        this.setMoves(this.movesLeft - 1);
    }
    

    onNoClusters(event: cc.Event.EventCustom) {
        this.gameEnd(GameResult.NO_CLUSTERS);
    }

    onGameStable() {
        if (this.score >= this.scoreTarget)
            this.gameEnd(GameResult.SCORE_REACHED);
        else if (this.movesLeft <= 0)
            this.gameEnd(GameResult.NO_MOVES);
    }


    public setScore(points: number) {
        this.score = points
        this.scoreLabel.string = `${this.score}/${this.scoreTarget}`;
    }

    public setMoves(moves: number) {
        this.movesLeft = moves;
        this.movesLabel.string = `${this.movesLeft}`;
    }

    public gameEnd(result: GameResult) {
        if (this.gameEnded) return;
        this.gameEnded = true;
        this.grid.getComponent(Grid).setLocked(true);
        const endPanel = cc.instantiate(this.resultsPanel);
        const endPanelScript = endPanel.getComponent(GameEnded);
        endPanelScript.configure(result);
        this.node.addChild(endPanel);
        this.resultsPanelInstance = endPanel;

        const restartButton = endPanelScript.restartButton;
        restartButton.clickEvents = [];
        const handler = new cc.Component.EventHandler();
        handler.target = this.node;
        handler.component = "Game";
        handler.handler = "restartGame";
        restartButton.clickEvents.push(handler);
    }


    restartGame() {
        this.setMoves(this.maxMoves)
        this.setScore(0);
        let gridScript = this.grid.getComponent(Grid);
        gridScript.startNewGame();
        this.freeResultsPanel();
        this.gameEnded = false;
        this.boostersContainer.getComponent(BoostersContainer).reset();
        this.boostersContainer.getComponent(BoostersContainer).setupBoosters([
            {"type": "teleport", "count": this.boosterSwapStartCount},
            {"type": "bomb", "count": this.boosterBombStartCount}
        ]);
    }

    freeResultsPanel() {
        if (this.resultsPanelInstance) {
            this.resultsPanelInstance.destroy();
            this.resultsPanelInstance = null;
        }
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (event.keyCode === cc.macro.KEY.r) {
            this.restartGame();    
        }
    }
}
