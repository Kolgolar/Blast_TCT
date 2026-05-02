const {ccclass, property} = cc._decorator;
import Token, { TokenType, DEFAULT_TOKENS } from './token';
import Utility, { Gesture } from './utility';

@ccclass
export default class Grid extends cc.Component {

    @property({ type: cc.Vec2})
    gridSize = cc.v2(5, 5);

    @property({type: cc.Prefab})
    token: cc.Prefab = null;

    @property({type: cc.Integer})
    framePadding: number = 10;

    @property({type: cc.Integer})
    cellPadding: number = 5;

    private tokens: Token[][] = [];
    private cellSize = cc.Vec2.ZERO;
    private tokenSize = cc.Vec2.ZERO;
    private eventStartPos = cc.Vec2.ZERO;


    protected onLoad(): void {
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    

    protected start(): void {
        this.generateGrid();
    }

    private generateGrid() {
        let start = cc.v2(
            this.framePadding - this.node.width / 2,
            this.framePadding - this.node.height / 2
        );
        let avaliableField = cc.v2(
            this.node.width - this.framePadding * 2,
            this.node.height - this.framePadding * 2,
        );
        this.cellSize = cc.v2(
            avaliableField.x / this.gridSize.x,
            avaliableField.y / this.gridSize.y
        );
        this.tokenSize = cc.v2(
            this.cellSize.x - this.cellPadding * 2,
            this.cellSize.y - this.cellPadding * 2,
        )

        for (let i = 0; i < this.gridSize.x; i++) {
            this.tokens[i] = [];
            for (let j = 0; j < this.gridSize.y; j++) {
                let newToken = cc.instantiate(this.token);
                const tokenComponent = newToken.getComponent(Token);
                let rnd = DEFAULT_TOKENS[Math.floor(Math.random() * DEFAULT_TOKENS.length)]
                tokenComponent.type = DEFAULT_TOKENS[rnd];
                this.tokens[i][j] = tokenComponent;
                newToken.setParent(this.node);
                newToken.setPosition(
                    start.x + this.cellSize.x / 2 + this.cellSize.x * i,
                    start.y + this.cellSize.y / 2 + this.cellSize.y * j,
                );
                let sprite = newToken.getComponent(cc.Sprite);
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                sprite.node.setContentSize(this.tokenSize.x, this.tokenSize.y);
            }
        }    
    }

    
    onTouchStart(event: cc.Event.EventTouch) {
        this.eventStartPos = event.getLocation();
    }


    onTouchEnd(event: cc.Event.EventTouch) {
        const swipeDir = this.checkSwipe(this.eventStartPos, event.getLocation());
        if (swipeDir.len() != 0)
            return;

        const tokenIdx = this.posToGrid(event.getLocation());
        if (tokenIdx.x >= 0 && tokenIdx.x < this.gridSize.x) {
            if (tokenIdx.y >= 0 && tokenIdx.y < this.gridSize.y) {
                const token = this.tokens[tokenIdx.x][tokenIdx.y];
                token.node.destroy();
                this.tokens[tokenIdx.x][tokenIdx.y] = null;
            }
        }

        // let swipeDir = this.checkSwipe(this.eventStartPos, event.getLocation());
        // if (swipeDir.len() == 0)
        //     return;
        // let fromTokenIdx = this.posToGrid(this.eventStartPos);
        // let toTokenIdx = fromTokenIdx.add(swipeDir);
        // if (toTokenIdx.x >= 0 && toTokenIdx.x < this.gridSize.x) {
        //     if (toTokenIdx.y >= 0 && toTokenIdx.y < this.gridSize.y) {
        //         let fromToken = this.tokens[fromTokenIdx.x][fromTokenIdx.y];
        //         let toToken = this.tokens[toTokenIdx.x][toTokenIdx.y];
        //         if (fromToken.type != toToken.type)
        //             return;
        //         // fromToken.node.destroy();
        //         // toToken.node.destroy();
        //         this.tokens[fromTokenIdx.x][fromTokenIdx.y] = null;
        //         this.tokens[toTokenIdx.x][toTokenIdx.y] = null;
        //     }
        //     else
        //         console.log("No neighbour token was found!");
        // }
    }


    checkSwipe(start: cc.Vec2, end: cc.Vec2): cc.Vec2 {
        const THRESHOLD = 30;
        let swipeDir = cc.Vec2.ZERO;
        let diff = end.sub(start);
        if (Math.abs(diff.x) > Math.abs(diff.y)) {
            if (Math.abs(diff.x) > THRESHOLD) {
                swipeDir = cc.v2(Math.sign(diff.x), 0);
            }
        } else {
            if (Math.abs(diff.y) > THRESHOLD) {
                swipeDir = cc.v2(0, Math.sign(diff.y));
            }
        }
        return swipeDir;
    }

    posToGrid(worldPos: cc.Vec2): cc.Vec2 | null {
        const localPos = this.node.convertToNodeSpaceAR(worldPos);

        const startX = -this.node.width / 2 + this.framePadding;
        const startY = -this.node.height / 2 + this.framePadding;

        let col = Math.floor((localPos.x - startX) / this.cellSize.x);
        let row = Math.floor((localPos.y - startY) / this.cellSize.y);

        if (col < 0 || col >= this.gridSize.x || row < 0 || row >= this.gridSize.y) {
            return null;
        }

        return cc.v2(col, row); 
    }
    
}
