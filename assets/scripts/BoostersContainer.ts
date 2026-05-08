import Grid from "./Grid";
import { BaseBooster } from "./boosters/Booster";
import { TeleportBooster } from "./boosters/TeleportBooster";
import { BombBooster } from "./boosters/BombBooster";

const {ccclass, property} = cc._decorator;

@ccclass
export default class BoostersContainer extends cc.Component {

    private readonly BUTTON_WIDTH = 340;
    private readonly SPACING = 80;

    @property(cc.Prefab) boosterButtonPrefab: cc.Prefab = null;
    private boosters: BaseBooster[] = [];
    private buttons: cc.Node[] = [];

    @property(cc.SpriteFrame)
    teleportIcon: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    bombIcon: cc.SpriteFrame = null;

    @property(cc.Node)
    grid: cc.Node = null;

    private boosterButtons: { node: cc.Node, button: cc.Button, booster: BaseBooster }[] = [];
    private currentActiveBooster: BaseBooster | null = null;


    public reset() {
        if (this.currentActiveBooster)
            this.cancelCurrentBooster();
        this.boosterButtons = [];
        this.currentActiveBooster = null;
        this.node.removeAllChildren();
        this.setButtonsEnabled(true);
    }


    public setupBoosters(boostersData: { type: string, count: number }[]) {
        // Очистить старые
        this.buttons.forEach(btn => btn.destroy());
        this.buttons = [];
        this.boosters = [];

        // Создать экземпляры бустеров
        for (let data of boostersData) {
            let booster: BaseBooster;
            let icon: cc.SpriteFrame = null;
            switch (data.type) {
                case 'teleport':
                    icon = this.teleportIcon;
                    booster = new TeleportBooster(data.type, icon, data.count);
                    break;
                case 'bomb':
                    icon = this.bombIcon;
                    booster = new BombBooster(data.type, icon, data.count);
                    break;
                default: continue;
            }
            this.boosters.push(booster);
        }

        // Создать UI кнопки
        const count = this.boosters.length;
        const startX = - (count - 1) * (this.BUTTON_WIDTH + this.SPACING) / 2;
        for (let i = 0; i < count; i++) {
            const btnNode = cc.instantiate(this.boosterButtonPrefab);
            btnNode.parent = this.node;
            btnNode.setPosition(startX + i * (this.BUTTON_WIDTH + this.SPACING), 0);
            const booster = this.boosters[i];
            const iconSprite = btnNode.getChildByName('Icon').getComponent(cc.Sprite);
            iconSprite.spriteFrame = booster.icon;
            const countLabel = btnNode.getChildByName('Slot').getChildByName('Quantity').getComponent(cc.Label);
            countLabel.string = booster.getCount().toString();

            const button = btnNode.getComponent(cc.Button);
            button.node.on(cc.Node.EventType.TOUCH_END, () => {
                this.onBoosterClick(booster, button.node);
            });
            this.buttons.push(btnNode);
            this.boosterButtons.push({
                node: btnNode,
                button: button,
                booster: booster
            });
        }
    }

    private setButtonEnabled(booster: BaseBooster, enabled: boolean) {
        const entry = this.boosterButtons.find(b => b.booster === booster);
        if (entry && entry.button) {
            entry.button.interactable = enabled;
        }
    }


    private onBoosterClick(booster: BaseBooster, btnNode: cc.Node) {
        // Если нажали на уже активный бустер – отменяем его
        if (this.currentActiveBooster === booster) {
            this.cancelCurrentBooster();
            return;
        }

        if (this.currentActiveBooster)
            this.cancelCurrentBooster();

        if (booster.getCount() <= 0) return;

        this.setButtonEnabled(booster, false);
        this.currentActiveBooster = booster;

        booster.activate(
            this.grid.getComponent(Grid),
            () => {
                // Полное завершение после анимаций. Разблокируем кнопку и сбрасываем активный
                this.setButtonEnabled(booster, true);
                this.currentActiveBooster = null;
            },
            () => {
                this.updateBoosterDisplay(booster, btnNode);
            }
        );
    }

    private cancelCurrentBooster() {
        if (!this.currentActiveBooster) return;
        this.grid.getComponent(Grid).clearBoosterMode();
        this.setButtonEnabled(this.currentActiveBooster, true);
        this.currentActiveBooster = null;
    }

    private updateBoosterDisplay(booster: BaseBooster, btnNode: cc.Node) {
        const labelNode = btnNode.getChildByName('Slot').getChildByName('Quantity');
        if (labelNode) {
            const label = labelNode.getComponent(cc.Label);
            if (label) label.string = booster.getCount().toString();
        }
        if (booster.getCount() === 0) {
            this.setButtonEnabled(booster, false);
            if (this.currentActiveBooster === booster) {
                this.cancelCurrentBooster();
            }
        } else {
            if (this.currentActiveBooster !== booster) {
                this.setButtonEnabled(booster, true);
            }
        }
    }

    private setButtonsEnabled(enabled: boolean) {
        this.buttons.forEach(btn => btn.getComponent(cc.Button).interactable = enabled);
    }
}