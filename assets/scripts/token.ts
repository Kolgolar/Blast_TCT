// import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
const {ccclass, property} = cc._decorator;

export enum TokenType { NONE = -1, PURPLE, GREEN, RED, YELLOW, BLUE, BONUS_ROW, BONUS_COLUMN }
export const DEFAULT_TOKENS = [TokenType.PURPLE, TokenType.GREEN, TokenType.RED, TokenType.YELLOW, TokenType.BLUE]

@ccclass
export default class Token extends cc.Component {
    private sprite: cc.Sprite = null;
    private _type: TokenType = TokenType.NONE;

    private static readonly texturePaths: Record<TokenType, string> = {
        [TokenType.NONE]: '',
        [TokenType.PURPLE]: 'textures/tokens/token_purple',
        [TokenType.GREEN]: 'textures/tokens/token_green',
        [TokenType.RED]: 'textures/tokens/token_red',
        [TokenType.YELLOW]: 'textures/tokens/token_yellow',
        [TokenType.BLUE]: 'textures/tokens/token_blue',
        [TokenType.BONUS_ROW]: 'textures/bonuses/bonus_rockets_horisontal',
        [TokenType.BONUS_COLUMN]: 'textures/bonuses/bonus_rockets_horisontal',
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
