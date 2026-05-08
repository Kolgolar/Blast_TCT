import Grid from "./Grid";
import { BaseBooster } from "./boosters/Booster";
import { TeleportBooster } from "./boosters/TeleportBooster";
import { BombBooster } from "./boosters/BombBooster";
import BoosterButton from "./BoosterButton";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoostersContainer extends cc.Component {

    private readonly BUTTON_WIDTH = 340;
    private readonly SPACING = 80;

    @property(cc.Prefab) boosterButtonPrefab: cc.Prefab = null;
    private boosters: BaseBooster[] = [];

    @property(cc.SpriteFrame)
    teleportIcon: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    bombIcon: cc.SpriteFrame = null;

    @property(cc.Node)
    grid: cc.Node = null;

    private boosterUIs: { node: cc.Node, ui: BoosterButton, booster: BaseBooster }[] = [];
    private currentActiveBooster: BaseBooster | null = null;


    public reset() {
        if (this.currentActiveBooster)
            this.cancelCurrentBooster();
        this.boosterUIs = [];
        this.currentActiveBooster = null;
        this.node.removeAllChildren();
    }


    public setupBoosters(boostersData: { type: string, count: number }[]) {
        this.node.removeAllChildren();
        this.boosters = [];
        this.boosterUIs = [];

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

        const count = this.boosters.length;
        const startX = - (count - 1) * (this.BUTTON_WIDTH + this.SPACING) / 2;
        for (let i = 0; i < count; i++) {
            const booster = this.boosters[i];
            const btnNode = cc.instantiate(this.boosterButtonPrefab);
            btnNode.parent = this.node;
            btnNode.setPosition(startX + i * (this.BUTTON_WIDTH + this.SPACING), 0);

            const ui = btnNode.getComponent(BoosterButton);
            ui.setIcon(booster.icon);
            ui.setCount(booster.getCount());

            const button = btnNode.getComponent(cc.Button);
            button.node.on(cc.Node.EventType.TOUCH_END, () => {
                this.onBoosterClick(booster, ui);
            });

            this.boosterUIs.push({
                node: btnNode,
                ui: ui,
                booster: booster
            });
        }
    }


    private setButtonEnabled(booster: BaseBooster, enabled: boolean) {
        const entry = this.boosterUIs.find(b => b.booster === booster);
        if (entry && entry.ui) {
            entry.ui.setInteractable(enabled);
        }
    }


    private onBoosterClick(booster: BaseBooster, ui: BoosterButton) {
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
                this.setButtonEnabled(booster, true);
                this.currentActiveBooster = null;
            },
            () => {
                this.updateBoosterDisplay(booster, ui);
            }
        );
    }


    private cancelCurrentBooster() {
        if (!this.currentActiveBooster) return;
        this.grid.getComponent(Grid).clearBoosterMode();
        this.setButtonEnabled(this.currentActiveBooster, true);
        this.currentActiveBooster = null;
    }


    private updateBoosterDisplay(booster: BaseBooster, ui: BoosterButton) {
        ui.setCount(booster.getCount());
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
}