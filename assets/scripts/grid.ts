const { ccclass, property } = cc._decorator;
import Token, { TokenType, DEFAULT_TOKENS } from './token';
import Utility from './utility';

const MIN_CLUSTER_SIZE = 3;

@ccclass
export default class Grid extends cc.Component {

    @property({ type: cc.Vec2 })
    gridSize = cc.v2(5, 5);

    @property({ type: cc.Prefab })
    token: cc.Prefab = null;

    @property({ type: cc.Integer })
    framePadding: number = 10;

    @property({ type: cc.Integer })
    cellPadding: number = 5;

    @property({ type: cc.Float, tooltip: "Задержка перед началом падения новых токенов (сек)" })
    newTokensDelay: number = 0.1;

    @property({ type: cc.Float, tooltip: "Длительность падения на одну клетку (сек)" })
    fallDurationPerCell: number = 0.08;

    @property({ type: cc.Float, tooltip: "Задержка между стартом падения соседних новых токенов в столбце (сек)" })
    newTokensStaggerDelay: number = 0.03;

    private tokens: Token[][] = [];
    private cellSize = cc.Vec2.ZERO;
    private tokenSize = cc.Vec2.ZERO;
    private eventStartPos = cc.Vec2.ZERO;

    private clusters: cc.Vec2[][] = [];
    private clusterId: number[][] = [];

    private isAnimating = false

    // Вспомогательные переменные для расчёта позиций
    private startX: number = 0;
    private startY: number = 0;

    protected onLoad(): void {
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    protected start(): void {
        this.generateGrid();
        this.recomputeAllClusters();
    }


    private getRandomTokenType(): TokenType {
        let type = Math.floor(Math.random() * DEFAULT_TOKENS.length);
        return type;
    }


    private checkGameOver() {
        // В blast игра заканчивается, когда нет ни одного кластера и нет возможных ходов
        // (в классическом blast возможных ходов нет – только взрывы существующих).
        // Поэтому если clusters пуст – игра окончена.
        if (!this.hasAnyCluster()) {
            console.log("Game Over!");
            // Здесь можно показать UI окончания игры
        }
    }




    //---------------------------
    // Генерация поля
    //---------------------------


    private generateGrid() {
        // Расчёт стартовой позиции и размеров ячеек
        this.startX = -this.node.width / 2 + this.framePadding;
        this.startY = -this.node.height / 2 + this.framePadding;

        const availableField = cc.v2(
            this.node.width - this.framePadding * 2,
            this.node.height - this.framePadding * 2
        );
        this.cellSize = cc.v2(
            availableField.x / this.gridSize.x,
            availableField.y / this.gridSize.y
        );
        this.tokenSize = cc.v2(
            this.cellSize.x - this.cellPadding * 2,
            this.cellSize.y - this.cellPadding * 2
        );

        // Создание токенов
        for (let col = 0; col < this.gridSize.x; col++) {
            this.tokens[col] = [];
            for (let row = 0; row < this.gridSize.y; row++) {
                const newToken = cc.instantiate(this.token);
                const tokenComponent = newToken.getComponent(Token);
                // Исправленный случайный выбор типа
                const randomIndex = this.getRandomTokenType()
                tokenComponent.type = DEFAULT_TOKENS[randomIndex];

                this.tokens[col][row] = tokenComponent;
                newToken.setParent(this.node);
                newToken.setPosition(this.getTokenPosition(col, row));
                const sprite = newToken.getComponent(cc.Sprite);
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                sprite.node.setContentSize(this.tokenSize.x, this.tokenSize.y);
            }
        }
    }

    private getTokenPosition(col: number, row: number): cc.Vec2 {
        return cc.v2(
            this.startX + this.cellSize.x / 2 + this.cellSize.x * col,
            this.startY + this.cellSize.y / 2 + this.cellSize.y * row
        );
    }

    // Мгновенно перемещает токен на новую позицию (без анимации)
    private updateTokenPosition(token: Token, col: number, row: number) {
        token.node.setPosition(this.getTokenPosition(col, row));
    }




    //---------------------------
    // Гравитация и заполнение
    //---------------------------


    private async applyGravityAndRefillAsync(): Promise<void> {
        const animations: Promise<void>[] = [];

        // Падение существующих токенов (без изменений)
        for (let col = 0; col < this.gridSize.x; col++) {
            const existingTokens: Token[] = [];
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token) existingTokens.push(token);
            }
            for (let row = 0; row < this.gridSize.y; row++) {
                this.tokens[col][row] = null;
            }

            for (let newRow = 0; newRow < existingTokens.length; newRow++) {
                const token = existingTokens[newRow];
                const oldPos = token.node.getPosition();
                const newPos = this.getTokenPosition(col, newRow);
                const distanceInCells = Math.abs(oldPos.y - newPos.y) / this.cellSize.y;
                const fallDuration = distanceInCells * this.fallDurationPerCell;
                const oldRow = this.getRowFromPosition(oldPos);
                const delay = Math.max(0, oldRow - newRow) * 0.02;

                this.tokens[col][newRow] = token;

                const movePromise = new Promise<void>((resolve) => {
                    cc.tween(token.node)
                        .delay(delay)
                        .to(fallDuration, { position: newPos })
                        .call(() => resolve())
                        .start();
                });
                animations.push(movePromise);
            }
        }

        // Новые токены
        for (let col = 0; col < this.gridSize.x; col++) {
            const emptyRows: number[] = [];
            for (let row = 0; row < this.gridSize.y; row++) {
                if (this.tokens[col][row] === null) emptyRows.push(row);
            }
            if (emptyRows.length === 0) continue;

            const topRowPos = this.getTokenPosition(col, this.gridSize.y - 1);
            const newTokens: Token[] = [];

            // Создаём новые токены колонной над полем
            for (let idx = 0; idx < emptyRows.length; idx++) {
                const targetRow = emptyRows[idx];
                const targetPos = this.getTokenPosition(col, targetRow);
                const newToken = cc.instantiate(this.token);
                const tokenComp = newToken.getComponent(Token);
                const randomIndex = this.getRandomTokenType();
                tokenComp.type = DEFAULT_TOKENS[randomIndex];

                const sprite = newToken.getComponent(cc.Sprite);
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                sprite.node.setContentSize(this.tokenSize.x, this.tokenSize.y);

                // Стартовая позиция: над верхней строкой + смещение по idx
                const startY = topRowPos.y + this.cellSize.y + idx * this.cellSize.y;
                newToken.setPosition(targetPos.x, startY, 0);
                newToken.parent = this.node;

                newTokens.push(tokenComp);
            }

            const fallPromises = newTokens.map((token, idx) => {
                const targetRow = emptyRows[idx];
                const targetPos = this.getTokenPosition(col, targetRow);
                const distanceInCells = (token.node.getPosition().y - targetPos.y) / this.cellSize.y;
                const fallDuration = distanceInCells * this.fallDurationPerCell;

                const totalDelay = this.newTokensDelay + idx * this.newTokensStaggerDelay;

                return new Promise<void>((resolve) => {
                    cc.tween(token.node)
                        .delay(totalDelay)
                        .to(fallDuration, { position: targetPos }, { easing: 'sineOut' })
                        .call(() => {
                            this.tokens[col][targetRow] = token;
                            resolve();
                        })
                        .start();
                });
            });
            animations.push(...fallPromises);
        }

        await Promise.all(animations);
        this.isAnimating = false;
    }

    // Вспомогательный метод: количество существующих токенов в столбце
    private getExistingTokensCountInColumn(col: number): number {
        let count = 0;
        for (let row = 0; row < this.gridSize.y; row++) {
            if (this.tokens[col][row] !== null) count++;
        }
        return count;
    }

    // Вспомогательный метод: получить ряд по позиции (примерно, можно округлить)
    private getRowFromPosition(worldPos: cc.Vec2): number {
        const localPos = this.node.convertToNodeSpaceAR(worldPos);
        const startY = -this.node.height / 2 + this.framePadding;
        let row = Math.floor((localPos.y - startY) / this.cellSize.y);
        return Math.min(Math.max(0, row), this.gridSize.y - 1);
    }




    //---------------------------
    // Работа с кластерами
    //---------------------------


    recomputeAllClusters() {
        this.clusters = [];
        this.clusterId = Array(this.gridSize.x).fill(null).map(() => Array(this.gridSize.y).fill(-1));

        let nextClusterIndex = 0;
        const visited: boolean[][] = Array(this.gridSize.x).fill(null).map(() => Array(this.gridSize.y).fill(false));

        for (let col = 0; col < this.gridSize.x; col++) {
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (!token || visited[col][row]) continue;

                // BFS для сбора кластера
                const cluster: cc.Vec2[] = [];
                const queue: cc.Vec2[] = [cc.v2(col, row)];
                const type = token.type;

                while (queue.length) {
                    const pos = queue.shift()!;
                    const cx = pos.x, cy = pos.y;
                    if (visited[cx][cy]) continue;
                    visited[cx][cy] = true;
                    cluster.push(pos);

                    const neighbors = [
                        cc.v2(cx + 1, cy), cc.v2(cx - 1, cy),
                        cc.v2(cx, cy + 1), cc.v2(cx, cy - 1)
                    ];
                    for (const nb of neighbors) {
                        const nx = nb.x, ny = nb.y;
                        if (nx >= 0 && nx < this.gridSize.x && ny >= 0 && ny < this.gridSize.y) {
                            const nbToken = this.tokens[nx][ny];
                            if (nbToken && !visited[nx][ny] && nbToken.type === type) {
                                queue.push(nb);
                            }
                        }
                    }
                }

                if (cluster.length >= MIN_CLUSTER_SIZE) {
                    this.clusters.push(cluster);
                    for (const pos of cluster) {
                        this.clusterId[pos.x][pos.y] = nextClusterIndex;
                    }
                    nextClusterIndex++;
                }
            }
        }
    }


    hasAnyCluster(): boolean {
        return this.clusters.length > 0;
    }


    explodeClusterAt(col: number, row: number): boolean {
        const idx = this.clusterId[col][row];
        if (idx === -1) return false;

        const cluster = this.clusters[idx];
        for (const pos of cluster) {
            const token = this.tokens[pos.x][pos.y];
            if (token && token.node) {
                token.node.destroy();
            }
            this.tokens[pos.x][pos.y] = null;
        }
        return true;
    }



    //-----------------------------------
    // Ввод
    //-----------------------------------


    onTouchStart(event: cc.Event.EventTouch) {
        this.eventStartPos = event.getLocation();
        if (this.isAnimating) return;
    }


    onTouchEnd(event: cc.Event.EventTouch) {
        if (this.isAnimating) return;
        const swipeDir = this.checkSwipe(this.eventStartPos, event.getLocation());
        if (swipeDir.len() !== 0) return; // для blast свайп можно игнорировать

        const tokenPos = this.posToGrid(event.getLocation());
        if (!tokenPos) return;

        const success = this.explodeClusterAt(tokenPos.x, tokenPos.y);
        if (!success) return;

        this.isAnimating = true;

        this.applyGravityAndRefillAsync();
        this.recomputeAllClusters();
        this.checkGameOver();
    }


    checkSwipe(start: cc.Vec2, end: cc.Vec2): cc.Vec2 {
        const THRESHOLD = 30;
        const diff = end.sub(start);
        if (Math.abs(diff.x) > Math.abs(diff.y)) {
            if (Math.abs(diff.x) > THRESHOLD) {
                return cc.v2(Math.sign(diff.x), 0);
            }
        } else {
            if (Math.abs(diff.y) > THRESHOLD) {
                return cc.v2(0, Math.sign(diff.y));
            }
        }
        return cc.Vec2.ZERO;
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