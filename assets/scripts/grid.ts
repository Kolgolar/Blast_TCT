const { ccclass, property } = cc._decorator;
import Token, { TokenType, DEFAULT_TOKENS } from './token';

@ccclass
export default class Grid extends cc.Component {

    @property({ type: cc.Vec2 })
    gridSize = cc.v2(5, 5);

    @property({ type: cc.Prefab })
    token: cc.Prefab = null;

    @property( {type: cc.Prefab })
    explosionPrefab: cc.Prefab = null;

    @property( {type: cc.Node })
    tokensLayer: cc.Node = null;

    @property( {type: cc.Node })
    particlesLayer: cc.Node = null;

    @property({ type: cc.Integer })
    framePadding: number = 10;

    @property({ type: cc.Integer })
    cellPadding: number = 5;

    @property({ type: cc.Float, tooltip: "Задержка перед началом падения новых токенов" })
    newTokensDelay: number = 0.1;

    @property({ type: cc.Float, tooltip: "Длительность падения на одну клетку"})
    fallDurationPerCell: number = 0.08;

    @property({ type: cc.Float, tooltip: "Задержка между стартом падения соседних новых токенов в столбце" })
    newTokensStaggerDelay: number = 0.03;
    
    @property({ type: cc.Float, tooltip: "Сила пружинного эффекта при приземлении в долях от ячейки" })
    landingBounceFactor: number = 0.05;

    @property({ type: cc.Float, tooltip: "Длительность одной фазы пружинного эффекта" })
    bounceDuration: number = 0.05;

    @property( {type: cc.Integer })
    private maxShuffleAttempts: number = 3;

    @property({ type: cc.Float, tooltip: "Длительность анимации исчезновения/появления при перемешивании" })
    shuffleAnimDuration: number = 0.2;
    
    @property( {type: cc.Integer})
    bonusSpawnThreshold: number = 4;

    private readonly SHAKE_PERIOD = 0.5
    private readonly SHAKE_ANGLE = 12; // градусы

    private readonly MIN_CLUSTER_SIZE = 3;
    private readonly TOKEN_BASE_SIZE = 75;

    private bonusLineDestroyDelay = 0.05;

    private tokens: Token[][] = [];
    private cellSize = cc.Vec2.ZERO;
    private tokenSize = cc.Vec2.ZERO;
    private eventStartPos = cc.Vec2.ZERO;

    private clusters: cc.Vec2[][] = [];
    private clusterId: number[][] = [];

    private isShuffling = false;
    private isAnimating = false
    private gridLocked = false;

    // private highlightedTokens: Map<Token, { scale: cc.Vec3, color: cc.Color }> = new Map
    private highlightedTokens: Map<Token, { originalRotation: number, shakeTween: cc.Tween }> = new Map();
    private boosterSelectCallback: ((pos: cc.Vec2) => void) | null = null;
    private boosterCancelCallback: (() => void) | null = null;

    private startX: number = 0;
    private startY: number = 0;

    private pendingBonuses: { col: number, row: number, type: TokenType }[] = [];
    private isProcessingQueue: boolean = false;

    private shuffleAttempts: number = 0;

    protected onLoad(): void {
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    protected start(): void {
        this.startNewGame();
    }


    public startNewGame() {
        this.isAnimating = false;
        this.gridLocked = false;
        this.isShuffling = false;
        this.shuffleAttempts = 0;
        this.pendingBonuses = [];
        this.isProcessingQueue = false;
        this.clearHighlight();
        this.clearAllTokens();
        this.generateGrid();
        this.recomputeAllClusters();
        this.checkAnyCluster(false);
        this.resetShuffleAttempts();
    }

    public setLocked(lock: boolean) {
        this.gridLocked = lock;
    }


    private getRandomTokenType(): TokenType {
        let type = Math.floor(Math.random() * DEFAULT_TOKENS.length);
        return type;
    }


    private checkAnyCluster(shouldShuffle: boolean = true) {
        if (this.clusters.length == 0) {
            if (shouldShuffle) {
                if (this.shuffleAttempts < this.maxShuffleAttempts) {
                    this.handleNoClusters();
                } else {
                    const event = new cc.Event.EventCustom("no-clusters", true);
                    this.node.dispatchEvent(event);
                }
            }
        }
    }




    //---------------------------
    // Бонусы
    //---------------------------



    private hasAnyBonusOnField(): boolean {
        for (let col = 0; col < this.gridSize.x; col++) {
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token && token.isBonus()) {
                    return true;
                }
            }
        }
        return false;
    }


    private spawnBonusToken(col: number, row: number): void {
        // 50% шанс на строку или столбец
        const isRow = Math.random() < 0.5;
        const bonusType = isRow ? TokenType.BONUS_ROW : TokenType.BONUS_COLUMN;
        
        const newToken = cc.instantiate(this.token);
        const tokenComp = newToken.getComponent(Token);
        tokenComp.type = bonusType;
        
        const sprite = newToken.getComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sprite.node.setContentSize(this.tokenSize.x, this.tokenSize.y);
        
        if (bonusType === TokenType.BONUS_COLUMN) {
            newToken.setRotation(90);
        }
        
        newToken.setPosition(this.getTokenPosition(col, row));
        newToken.parent = this.tokensLayer;
        
        this.tokens[col][row] = tokenComp;
    }



    private handleNoClusters() {
        if (this.isAnimating || this.gridLocked || this.isShuffling) return;

        if (this.hasAnyBonusOnField()) {
            return;
        }

        this.shuffleAttempts++;

        if (this.shuffleAttempts > this.maxShuffleAttempts) {
            const gameOverEvent = new cc.Event.EventCustom("game-over", true);
            this.node.dispatchEvent(gameOverEvent);
            return;
        }

        this.shuffleBoardAnimated(() => {
            this.recomputeAllClusters();
            if (this.clusters.length > 0) {
                this.shuffleAttempts = 0;
            } else {
                this.handleNoClusters();
            }
        });
    }




    //---------------------------
    // Бустеры
    //---------------------------


    public setBoosterMode(selectCallback: (pos: cc.Vec2) => void, cancelCallback?: () => void) {
        this.boosterSelectCallback = selectCallback;
        this.boosterCancelCallback = cancelCallback || null;
    }

    public clearBoosterMode() {
        this.boosterSelectCallback = null;
        this.boosterCancelCallback = null;
        this.clearHighlight();
    }


    public highlightToken(pos: cc.Vec2, effect: string = 'selected') {
        const token = this.tokens[pos.x][pos.y];
        if (!token || !token.node) return;

        if (!this.highlightedTokens.has(token)) {
            // Сохраняем исходное вращение
            this.highlightedTokens.set(token, {
                originalRotation: token.node.rotation,
                shakeTween: null
            });
        }

        const data = this.highlightedTokens.get(token);
        if (data.shakeTween) {
            data.shakeTween.stop();
        }

        const tween = cc.tween(token.node)
            .repeatForever(
                cc.tween()
                    .to(this.SHAKE_PERIOD, { rotation: this.SHAKE_ANGLE }, { easing: 'sineInOut' })
                    .to(this.SHAKE_PERIOD, { rotation: -this.SHAKE_ANGLE }, { easing: 'sineInOut' })
            )
            .start();
        data.shakeTween = tween;
    }


    public clearHighlight(pos?: cc.Vec2) {
        if (pos) {
            const token = this.tokens[pos.x][pos.y];
            if (token && this.highlightedTokens.has(token)) {
                const data = this.highlightedTokens.get(token);
                if (data.shakeTween) {
                    data.shakeTween.stop();
                }
                token.node.rotation = data.originalRotation;
                this.highlightedTokens.delete(token);
            }
        } else {
            this.highlightedTokens.forEach((data, token) => {
                if (token && token.node && token.node.isValid) {
                    if (data.shakeTween) data.shakeTween.stop();
                    token.node.rotation = data.originalRotation;
                }
            });
            this.highlightedTokens.clear();
        }
    }


    public swapTokens(pos1: cc.Vec2, pos2: cc.Vec2, onComplete?: () => void) {
        if (this.isAnimating || this.gridLocked) {
            if (onComplete) onComplete();
            return;
        }
        const token1 = this.tokens[pos1.x][pos1.y];
        const token2 = this.tokens[pos2.x][pos2.y];
        if (!token1 || !token2) {
            if (onComplete) onComplete();
            return;
        }

        this.isAnimating = true;
        const pos1World = token1.node.getPosition();
        const pos2World = token2.node.getPosition();

        cc.tween(token1.node)
            .to(0.15, { position: pos2World })
            .start();
        cc.tween(token2.node)
            .to(0.15, { position: pos1World })
            .call(() => {
                // Обновляем массив токенов
                this.tokens[pos1.x][pos1.y] = token2;
                this.tokens[pos2.x][pos2.y] = token1;

                // Обновляем координаты в компонентах (если методы есть)
                if (token1.setRowCol) token1.setRowCol(pos2.y, pos2.x);
                if (token2.setRowCol) token2.setRowCol(pos1.y, pos1.x);

                // Синхронизируем финальные позиции
                token1.node.setPosition(pos2World);
                token2.node.setPosition(pos1World);

                // Пересчитываем кластеры (обновляем clusterId)
                this.recomputeAllClusters();

                this.isAnimating = false;
                if (onComplete) onComplete();
            })
            .start();
    }

    public async explodeArea(centerCol: number, centerRow: number, radius: number, onComplete?: () => void, explosionDelay: number = 0) {
        if (this.isAnimating || this.gridLocked) {
            if (onComplete) onComplete();
            return;
        }
        this.isAnimating = true;

        const positionsToDestroy: cc.Vec2[] = [];
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const col = centerCol + dx;
                const row = centerRow + dy;
                if (col >= 0 && col < this.gridSize.x && row >= 0 && row < this.gridSize.y) {
                    const token = this.tokens[col][row];
                    if (token) {
                        if (token.isBonus()) {
                            this.pendingBonuses.push({ col, row, type: token.type });
                            this.playExplosionAt(token.node.getPosition());
                            token.node.destroy();
                            this.tokens[col][row] = null;
                        } else {
                            positionsToDestroy.push(cc.v2(col, row));
                        }
                        if (explosionDelay > 0) {
                            await new Promise(resolve => setTimeout(resolve, explosionDelay * 1000));
                        }
                    }
                }
            }
        }

        this.destroyTokensAtPositions(positionsToDestroy, true);
        await this.processBonusQueue();
        await this.applyGravityAndRefillAsync();
        this.isAnimating = false;
        if (onComplete) onComplete();
    }


    public async shuffleBoardAnimated(onComplete?: () => void) {
        if (this.isAnimating || this.gridLocked || this.isShuffling) {
            if (onComplete) onComplete();
            return;
        }
        this.isShuffling = true;
        this.isAnimating = true;

        // Собираем все токены
        const allTokens: Token[] = [];
        for (let col = 0; col < this.gridSize.x; col++) {
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token) allTokens.push(token);
            }
        }
        if (allTokens.length === 0) {
            this.isShuffling = false;
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }

        // Создаём список всех целевых позиций (перемешанный)
        const allPositions: cc.Vec2[] = [];
        for (let col = 0; col < this.gridSize.x; col++) {
            for (let row = 0; row < this.gridSize.y; row++) {
                allPositions.push(cc.v2(col, row));
            }
        }
        // Перемешиваем массив позиций
        for (let i = allPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
        }

        // Назначаем каждому токену целевую позицию и анимируем перемещение
        const animations: Promise<void>[] = [];
        for (let i = 0; i < allTokens.length; i++) {
            const token = allTokens[i];
            const targetPos = allPositions[i];
            const targetWorldPos = this.getTokenPosition(targetPos.x, targetPos.y);
            const promise = new Promise<void>((resolve) => {
                cc.tween(token.node)
                    .to(0.2, { position: targetWorldPos })
                    .call(() => resolve())
                    .start();
            });
            animations.push(promise);
        }
        await Promise.all(animations);

        // Обновляем массив tokens
        // Сначала очищаем весь массив
        for (let col = 0; col < this.gridSize.x; col++) {
            for (let row = 0; row < this.gridSize.y; row++) {
                this.tokens[col][row] = null;
            }
        }
        // Расставляем токены по новым позициям
        for (let i = 0; i < allTokens.length; i++) {
            const token = allTokens[i];
            const targetPos = allPositions[i];
            this.tokens[targetPos.x][targetPos.y] = token;
            // Обновляем внутренние координаты токена, если они хранятся
            if (token.setRowCol) token.setRowCol(targetPos.y, targetPos.x);
        }

        this.recomputeAllClusters();
        this.isShuffling = false;
        this.isAnimating = false;
        if (onComplete) onComplete();
    }


    public resetShuffleAttempts() {
        this.shuffleAttempts = 0;
    }




    //---------------------------
    // Генерация поля
    //---------------------------


    private clearAllTokens(): void {
        if (!this.tokens) {
            return;
        }
        for (let col = 0; col < this.gridSize.x; col++) {
            if (!this.tokens[col]) continue;
            
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token && token.node && token.node.isValid) {
                    token.node.destroy();
                }
                this.tokens[col][row] = null;
            }
        }
        
        this.tokens = [];
    }


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
                newToken.setParent(this.tokensLayer);
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
        const bounceOffsetY = -this.cellSize.y * this.landingBounceFactor;

        // Проходим по всем столбцам
        for (let col = 0; col < this.gridSize.x; col++) {
            // 1. Собираем все обычные токены (не бонусы) в столбце с их исходными рядами
            const items: { token: Token; originalRow: number }[] = [];
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token && !token.isBonus()) {
                    items.push({ token, originalRow: row });
                }
            }
            // 2. Помечаем, какие ряды заняты бонусами (чтобы не ставить туда обычные токены)
            const bonusRows: boolean[] = Array(this.gridSize.y).fill(false);
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token && token.isBonus()) bonusRows[row] = true;
            }

            // 3. Очищаем весь столбец (но бонусы мы потом восстановим)
            //    Временно удаляем обычные токены из массива, бонусы оставляем
            for (let row = 0; row < this.gridSize.y; row++) {
                const token = this.tokens[col][row];
                if (token && !token.isBonus()) {
                    this.tokens[col][row] = null;
                }
            }

            // 4. Расставляем обычные токены снизу вверх, пропуская ряды с бонусами
            let newRow = 0;
            for (let idx = 0; idx < items.length; idx++) {
                // Пропускаем ряды, занятые бонусами
                while (newRow < this.gridSize.y && bonusRows[newRow]) newRow++;
                if (newRow >= this.gridSize.y) break; // нет свободного места

                const { token, originalRow } = items[idx];
                const newPos = this.getTokenPosition(col, newRow);
                this.tokens[col][newRow] = token;

                if (originalRow !== newRow) {
                    // Анимация падения + пружина
                    const distance = Math.abs(originalRow - newRow);
                    const fallDuration = distance * this.fallDurationPerCell;
                    const delay = Math.max(0, originalRow - newRow) * 0.02;
                    const promise = new Promise<void>((resolve) => {
                        let tween = cc.tween(token.node)
                            .delay(delay)
                            .to(fallDuration, { position: newPos });
                        if (this.landingBounceFactor > 0 && bounceOffsetY !== 0) {
                            tween = tween
                                .call(() => {
                                    cc.tween(token.node)
                                        .to(this.bounceDuration, { position: cc.v2(newPos.x, newPos.y + bounceOffsetY) })
                                        .to(this.bounceDuration, { position: newPos })
                                        .start();
                                });
                        }
                        tween.call(() => resolve()).start();
                    });
                    animations.push(promise);
                } else {
                    // синхронизация позиции
                    token.node.setPosition(newPos);
                }
                newRow++;
            }

            // 5. Теперь создаём новые токены для заполнения верхних пустот
            //    Находим все пустые ряды, которые не заняты бонусами и не были заполнены обычными токенами
            const emptyRows: number[] = [];
            for (let row = 0; row < this.gridSize.y; row++) {
                if (this.tokens[col][row] === null && !bonusRows[row]) {
                    emptyRows.push(row);
                }
            }
            // Новые токены будут падать сверху
            const topRowPos = this.getTokenPosition(col, this.gridSize.y - 1);
            const newTokens: Token[] = [];
            for (let idx = 0; idx < emptyRows.length; idx++) {
                const targetRow = emptyRows[idx];
                const targetPos = this.getTokenPosition(col, targetRow);
                const newToken = cc.instantiate(this.token);
                const tokenComp = newToken.getComponent(Token);
                tokenComp.type = DEFAULT_TOKENS[this.getRandomTokenType()];
                const sprite = newToken.getComponent(cc.Sprite);
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                sprite.node.setContentSize(this.tokenSize.x, this.tokenSize.y);
                const startY = topRowPos.y + this.cellSize.y + idx * this.cellSize.y;
                newToken.setPosition(targetPos.x, startY);
                newToken.parent = this.tokensLayer;
                newTokens.push(tokenComp);
            }
            // Анимации для новых токенов
            const fallPromises = newTokens.map((token, idx) => {
                const targetRow = emptyRows[idx];
                const targetPos = this.getTokenPosition(col, targetRow);
                const distance = (token.node.getPosition().y - targetPos.y) / this.cellSize.y;
                const fallDuration = distance * this.fallDurationPerCell;
                const totalDelay = this.newTokensDelay + idx * this.newTokensStaggerDelay;
                return new Promise<void>((resolve) => {
                    let tween = cc.tween(token.node)
                        .delay(totalDelay)
                        .to(fallDuration, { position: targetPos });
                    if (this.landingBounceFactor > 0 && bounceOffsetY !== 0) {
                        tween = tween
                            .call(() => {
                                cc.tween(token.node)
                                    .to(this.bounceDuration, { position: cc.v2(targetPos.x, targetPos.y + bounceOffsetY) })
                                    .to(this.bounceDuration, { position: targetPos })
                                    .start();
                            });
                    }
                    tween.call(() => {
                        this.tokens[col][targetRow] = token;
                        resolve();
                    }).start();
                });
            });
            animations.push(...fallPromises);
        }

        await Promise.all(animations);
        this.isAnimating = false;
        this.recomputeAllClusters();
        this.checkAnyCluster();
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
                            if (nbToken && !visited[nx][ny] && nbToken.type === type && !nbToken.isBonus()) {
                                queue.push(nb);
                            }
                        }
                    }
                }

                if (cluster.length >= this.MIN_CLUSTER_SIZE) {
                    this.clusters.push(cluster);
                    for (const pos of cluster) {
                        this.clusterId[pos.x][pos.y] = nextClusterIndex;
                    }
                    nextClusterIndex++;
                }
            }
        }
    }


    public explodeClusterAt(col: number, row: number): number | null {
        const idx = this.clusterId[col][row];
        if (idx === -1) return null;

        const cluster = this.clusters[idx];
        if (!cluster || cluster.length === 0) return null;

        // Используем универсальный метод
        this.destroyTokensAtPositions(cluster, true);
        return cluster.length;
    }


    playExplosionAt(worldPos: cc.Vec2) {
        if (!this.explosionPrefab) return;
        const explosion = cc.instantiate(this.explosionPrefab);
        explosion.setPosition(worldPos);

        const scale = this.tokenSize.x / this.TOKEN_BASE_SIZE;
        const particle = explosion.getComponent(cc.ParticleSystem);
        if (particle) {
            particle.startSize *= scale;
            particle.endSize *= scale;
            if (particle.posVar) particle.posVar = particle.posVar.mul(scale);
            particle.resetSystem();
            const duration = particle.duration * 3.0;
            this.scheduleOnce(() => explosion.destroy(), duration);
        } else {
            explosion.destroy();
        }
        explosion.parent = this.particlesLayer;
    }


    private async activateBonusToken(col: number, row: number) {
        const token = this.tokens[col][row];
        if (!token || !token.isBonus()) return;
        const bonusType = token.type;
        const isRow = bonusType === TokenType.BONUS_ROW;

        this.playExplosionAt(token.node.getPosition());
        token.node.destroy();
        this.tokens[col][row] = null;

        if (isRow) {
            await this.destroyRowSequentially(row, col);
        } else {
            await this.destroyColumnSequentially(col, row);
        }
        await this.processBonusQueue();
        await this.applyGravityAndRefillAsync();
    }


    private async destroyRowSequentially(row: number, centerCol: number) {
        const delay = this.bonusLineDestroyDelay;
        const destroyedStats: Record<number, number> = {};

        let left = centerCol - 1;
        let right = centerCol + 1;

        while (left >= 0 || right < this.gridSize.x) {
            // Уничтожаем слева
            if (left >= 0) {
                const token = this.tokens[left][row];
                if (token) {
                    if (token.isBonus()) {
                        this.playExplosionAt(token.node.getPosition());
                        this.pendingBonuses.push({ col: left, row: row, type: token.type });
                        token.node.destroy();
                        this.tokens[left][row] = null;
                    } else {
                        this.playExplosionAt(token.node.getPosition());
                        destroyedStats[token.type] = (destroyedStats[token.type] || 0) + 1;
                        token.node.destroy();
                        this.tokens[left][row] = null;
                    }
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
            }

            // Уничтожаем справа
            if (right < this.gridSize.x) {
                const token = this.tokens[right][row];
                if (token) {
                    if (token.isBonus()) {
                        this.playExplosionAt(token.node.getPosition());
                        this.pendingBonuses.push({ col: right, row: row, type: token.type });
                        token.node.destroy();
                        this.tokens[right][row] = null;
                    } else {
                        this.playExplosionAt(token.node.getPosition());
                        destroyedStats[token.type] = (destroyedStats[token.type] || 0) + 1;
                        token.node.destroy();
                        this.tokens[right][row] = null;
                    }
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
            }

            left--;
            right++;
        }

        if (Object.keys(destroyedStats).length > 0) {
            const event = new cc.Event.EventCustom("tokens-destroyed", true);
            event.setUserData({ tokens: destroyedStats });
            this.node.dispatchEvent(event);
        }
    }

    private async destroyColumnSequentially(col: number, centerRow: number) {
        const delay = this.bonusLineDestroyDelay;
        const destroyedStats: Record<number, number> = {};

        let up = centerRow - 1;
        let down = centerRow + 1;

        while (up >= 0 || down < this.gridSize.y) {
            // Вверх
            if (up >= 0) {
                const token = this.tokens[col][up];
                if (token) {
                    if (token.isBonus()) {
                        this.playExplosionAt(token.node.getPosition());
                        this.pendingBonuses.push({ col: col, row: up, type: token.type });
                        token.node.destroy();
                        this.tokens[col][up] = null;
                    } else {
                        this.playExplosionAt(token.node.getPosition());
                        destroyedStats[token.type] = (destroyedStats[token.type] || 0) + 1;
                        token.node.destroy();
                        this.tokens[col][up] = null;
                    }
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
            }

            // Вниз
            if (down < this.gridSize.y) {
                const token = this.tokens[col][down];
                if (token) {
                    if (token.isBonus()) {
                        this.playExplosionAt(token.node.getPosition());
                        this.pendingBonuses.push({ col: col, row: down, type: token.type });
                        token.node.destroy();
                        this.tokens[col][down] = null;
                    } else {
                        this.playExplosionAt(token.node.getPosition());
                        destroyedStats[token.type] = (destroyedStats[token.type] || 0) + 1;
                        token.node.destroy();
                        this.tokens[col][down] = null;
                    }
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
            }

            up--;
            down++;
        }

        if (Object.keys(destroyedStats).length > 0) {
            const event = new cc.Event.EventCustom("tokens-destroyed", true);
            event.setUserData({ tokens: destroyedStats });
            this.node.dispatchEvent(event);
        }
    }


    private destroyTokensAtPositions(positions: cc.Vec2[], playEffects: boolean = true): Record<number, number> {
        const destroyedTokens: Record<number, number> = {};
        for (const pos of positions) {
            const token = this.tokens[pos.x][pos.y];
            if (token && token.node && token.node.isValid) {
                if (playEffects) {
                    this.playExplosionAt(token.node.getPosition());
                }
                destroyedTokens[token.type] = (destroyedTokens[token.type] || 0) + 1;
                token.node.destroy();
                this.tokens[pos.x][pos.y] = null;
            }
        }
        if (Object.keys(destroyedTokens).length > 0) {
            const event = new cc.Event.EventCustom("tokens-destroyed", true);
            event.setUserData({ tokens: destroyedTokens });
            this.node.dispatchEvent(event);
        }
        return destroyedTokens;
    }


    private async processBonusQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.pendingBonuses.length > 0) {
            const bonus = this.pendingBonuses.shift();
            if (!bonus) continue;
            await this.activateBonusByType(bonus.col, bonus.row, bonus.type);
        }

        this.isProcessingQueue = false;
    }

    private async activateBonusByType(col: number, row: number, bonusType: TokenType) {
        const isRow = bonusType === TokenType.BONUS_ROW;
        if (isRow) {
            await this.destroyRowSequentially(row, col);
        } else {
            await this.destroyColumnSequentially(col, row);
        }
    }
    


    //-----------------------------------
    // Ввод
    //-----------------------------------


    onTouchStart(event: cc.Event.EventTouch) {
        this.eventStartPos = event.getLocation();
        if (this.isAnimating || this.gridLocked) return;
    }


   async onTouchEnd(event: cc.Event.EventTouch) {
        if (this.isAnimating || this.gridLocked) return;

        // Режим бустера
        if (this.boosterSelectCallback) {
            const tokenPos = this.posToGrid(event.getLocation());
            if (tokenPos) {
                this.boosterSelectCallback(tokenPos);
            } else if (this.boosterCancelCallback) {
                this.boosterCancelCallback();
                this.clearBoosterMode();
            }
            return;
        }

        const swipeDir = this.checkSwipe(this.eventStartPos, event.getLocation());
        if (!swipeDir.equals(cc.Vec2.ZERO)) return;

        const tokenPos = this.posToGrid(event.getLocation());
        if (!tokenPos) return;
        const token = this.tokens[tokenPos.x][tokenPos.y];
        if (!token) return;

        if (token.isBonus()) {
            this.isAnimating = true;
            await this.activateBonusToken(tokenPos.x, tokenPos.y);
            this.isAnimating = false;
            return;
        }

        const destroyedCount = this.explodeClusterAt(tokenPos.x, tokenPos.y);
        if (destroyedCount === null) return;

        this.isAnimating = true;

        if (destroyedCount >= this.bonusSpawnThreshold) {
            if (this.tokens[tokenPos.x][tokenPos.y] === null) {
                this.spawnBonusToken(tokenPos.x, tokenPos.y);
                this.recomputeAllClusters(); // обновить кластеры после появления бонуса
            }
        }

        await this.applyGravityAndRefillAsync();
        this.isAnimating = false;
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