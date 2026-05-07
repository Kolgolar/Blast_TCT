import Grid from "../grid";

const {ccclass, property} = cc._decorator;

@ccclass
export abstract class BaseBooster {
    public type: string;
    public icon: cc.SpriteFrame;
    protected count: number = 0;

	
	constructor(type: string, icon: cc.SpriteFrame, initialCount: number) {
        this.type = type;
        this.icon = icon;
        this.count = initialCount;
    }
    public getCount(): number { return this.count; }
    public consume(amount: number = 1): boolean {
        if (this.count >= amount) {
            this.count -= amount;
            return true;
        }
        return false;
    }
    public add(amount: number) { this.count += amount; }

    public abstract activate(grid: Grid, onComplete: () => void, onUpdateUI: () => void): void;
}