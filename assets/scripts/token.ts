const {ccclass, property} = cc._decorator;

export enum TokenType { NONE = -1, PURPLE, GREEN, RED, YELLOW, BLUE, BONUS_ROW, BONUS_COLUMN }
export const DEFAULT_TOKENS = [TokenType.PURPLE, TokenType.GREEN, TokenType.RED, TokenType.YELLOW, TokenType.BLUE]

@ccclass
export default class Token extends cc.Component {
    private sprite: cc.Sprite = null;
    private _type: TokenType = TokenType.NONE;

    private static readonly texturePaths: Record<TokenType, string> = {
        [TokenType.NONE]: '',
        [TokenType.PURPLE]: 'textures/tokens/token-purple',
        [TokenType.GREEN]: 'textures/tokens/token-green',
        [TokenType.RED]: 'textures/tokens/token-red',
        [TokenType.YELLOW]: 'textures/tokens/token-yellow',
        [TokenType.BLUE]: 'textures/tokens/token-blue',
        [TokenType.BONUS_ROW]: 'textures/bonuses/bonus-rockets-horisontal',
        [TokenType.BONUS_COLUMN]: 'textures/bonuses/bonus-rockets-horisontal',
    };

    onLoad() {
        this.sprite = this.getComponent(cc.Sprite);
    }

    public set type(v: TokenType) {
        this._type = v;
        this.loadTexture(v);
    }

    public get type(): TokenType {
        return this._type;
    }

    public isBonus(): boolean {
        return this.type === TokenType.BONUS_ROW || this.type === TokenType.BONUS_COLUMN;
    }

    private loadTexture(type: TokenType) {
        const path = Token.texturePaths[type];
        cc.resources.load(
            path, cc.SpriteFrame, (err, spriteFrame) => {
                if (!err && this.sprite && this.sprite.isValid) {
                    this.sprite.spriteFrame = spriteFrame;
                }
            }
        );
        if (type === TokenType.BONUS_COLUMN)
            this.node.setRotation(90);
    }
}
