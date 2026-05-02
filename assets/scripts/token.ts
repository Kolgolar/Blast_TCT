// import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
const {ccclass, property} = cc._decorator;

export enum TokenType { NONE = -1, PURPLE, GREEN, RED, YELLOW, BLUE }
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

    private loadTexture(type: TokenType) {
        const path = Token.texturePaths[type];
        cc.resources.load(
            path, cc.SpriteFrame, (err, spriteFrame) => {
                if (!err && this.sprite && this.sprite.isValid) {
                    this.sprite.spriteFrame = spriteFrame;
                }
            }
        );
    }
}
