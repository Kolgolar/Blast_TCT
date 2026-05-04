const {ccclass, property} = cc._decorator;

export enum Gesture {NONE = -1, SWIPE_LEFT, SWIPE_RIGHT, SWIPE_UP, SWIPE_DOWN};

@ccclass
export default class Utility extends cc.Component {

    static waitFor(seconds: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => resolve(), seconds * 1000);
        });
    }

}
