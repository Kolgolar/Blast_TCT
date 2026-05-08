const {ccclass, property} = cc._decorator;

@ccclass
export default class BoosterButton extends cc.Component {
    @property(cc.Sprite) iconSprite: cc.Sprite = null;
    @property(cc.Label) countLabel: cc.Label = null;

    public setIcon(spriteFrame: cc.SpriteFrame) {
        this.iconSprite.spriteFrame = spriteFrame;
    }

    public setCount(count: number) {
        this.countLabel.string = count.toString();
    }

    public setInteractable(interactable: boolean) {
        this.node.getComponent(cc.Button).interactable = interactable;
    }
}