export const SECTION_SIZE = 4096;

export type Listener<E extends BaseEvent> = (event: E) => void;

export enum Priority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    MONITOR = 3
}

class PriorityListener<E extends BaseEvent> {
    private readonly listener: Listener<E>;
    private readonly priority: Priority;

    constructor(listener: Listener<E>, priority: Priority) {
        this.listener = listener;
        this.priority = priority;
    }

    getPriority(): Priority {
        return this.priority;
    }

    call(event: E): void {
        this.listener(event);
    }
}

export abstract class BaseEvent {
    private static listeners: Map<string, PriorityListener<any>[]> = new Map();

    public static addListener<E extends BaseEvent>(this: new (...args: any[]) => E, listener: Listener<E>, priority: Priority = Priority.NORMAL): void {
        const listeners: PriorityListener<E>[] | undefined = BaseEvent.listeners.get(this.name);
        if (!listeners) {
            BaseEvent.listeners.set(this.name, [new PriorityListener(listener, priority)]);
            return;
        }
        for (let i: number = 0; i < listeners.length; i++) {
            if (listeners[i].getPriority() > priority) {
                listeners.splice(i, 0, new PriorityListener(listener, priority));
                return;
            }
        }
        listeners.push(new PriorityListener(listener, priority));
    }

    protected static dispatch<E extends BaseEvent>(this: new (...args: any[]) => E, event: E): void {
        BaseEvent.listeners.get(this.name)?.forEach((listener: PriorityListener<any>): void => listener.call(event));
    }
}

export class MapEvent extends BaseEvent {
    public readonly map: CanvasMap;

    constructor(map: CanvasMap) {
        super();
        this.map = map;
        MapEvent.dispatch(this);
    }
}

export class MoveEvent extends MapEvent {
    private canceled: boolean = false;
    public readonly position: Vector2;

    constructor(map: CanvasMap, position: Vector2) {
        super(map);
        this.position = position;
        MoveEvent.dispatch(this);
    }

    cancel(): void {
        this.canceled = true;
    }

    isCanceled(): boolean {
        return this.canceled;
    }
}

export class ResizeEvent extends MapEvent {
    private canceled: boolean = false;
    public readonly size: Vector2;

    constructor(map: CanvasMap, size: Vector2) {
        super(map);
        this.size = size;
        ResizeEvent.dispatch(this);
    }

    cancel(): void {
        this.canceled = true;
    }

    isCanceled(): boolean {
        return this.canceled;
    }
}

export class ZoomEvent extends MapEvent {
    private canceled: boolean = false;
    public readonly magnification: number;

    constructor(map: CanvasMap, magnification: number) {
        super(map);
        this.magnification = magnification;
        ZoomEvent.dispatch(this);
    }

    cancel(): void {
        this.canceled = true;
    }

    isCanceled(): boolean {
        return this.canceled;
    }
}

export class PointerEvent extends MapEvent {
    public readonly position: Vector2;

    constructor(map: CanvasMap, position: Vector2) {
        super(map);
        this.position = position;
        PointerEvent.dispatch(this);
    }
}

export class SmoothEvent extends MapEvent {
    private canceled: boolean = false;
    public readonly smooth: boolean;

    constructor(map: CanvasMap, smooth: boolean) {
        super(map);
        this.smooth = smooth;
        SmoothEvent.dispatch(this);
    }

    cancel(): void {
        this.canceled = true;
    }

    isCanceled(): boolean {
        return this.canceled;
    }
}

export class Vector2 {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    set(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    multiply(value: number): Vector2 {
        this.x *= value;
        this.y *= value;
        return this;
    }

    divide(value: number): Vector2 {
        this.x /= value;
        this.y /= value;
        return this;
    }

    add(value: number): Vector2 {
        this.x += value;
        this.y += value;
        return this;
    }

    subtract(value: number): Vector2 {
        this.x -= value;
        this.y -= value;
        return this;
    }

    multiplyVector(vector: Vector2): Vector2 {
        this.x *= vector.x;
        this.y *= vector.y;
        return this;
    }

    divideVector(vector: Vector2): Vector2 {
        this.x /= vector.x;
        this.y /= vector.y;
        return this;
    }

    addVector(vector: Vector2): Vector2 {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    }

    subtractVector(vector: Vector2): Vector2 {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
    }

    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    static fromJson(json: any): Vector2 | null {
        if (!json.hasOwnProperty("x") || !json.hasOwnProperty("y")) {
            return null;
        }
        return new Vector2(json["x"], json["y"]);
    }
}

export class Canvas {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        let ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', {willReadFrequently: true});
        if (ctx === null) {
            throw new Error('Failed to get 2d context');
        }
        this.ctx = ctx;
    }
}

export class CanvasMap {
    public main: Canvas;
    public sections: Map<string, Canvas> = new Map();

    private position: Vector2 = new Vector2();
    private magnification: number = 1;

    private pointerPosition: Vector2 = new Vector2();
    private pointerDistance: number = 0;

    private smooth: boolean;

    private readonly excluded: HTMLElement[];

    private readonly minMagnification: number;
    private readonly maxMagnification: number;

    constructor(
        canvas: HTMLCanvasElement,
        exclude: HTMLElement[] = [],
        smooth: boolean = true,
        minMagnification: number = 1,
        maxMagnification: number = 800
    ) {
        this.main = new Canvas(canvas);
        this.excluded = exclude;
        this.smooth = smooth;
        this.minMagnification = minMagnification;
        this.maxMagnification = maxMagnification;

        this.main.ctx.imageSmoothingEnabled = this.smooth;
        this.setSize(new Vector2(window.innerWidth, window.innerHeight));

        window.addEventListener("touchstart", (event: TouchEvent): void => {
            if (event.touches.length === 1) {
                this.setPointerPosition(new Vector2(
                    event.touches[0].clientX,
                    event.touches[0].clientY,
                ));
            } else {
                this.pointerDistance = Math.sqrt(
                    (event.touches[0].clientX - event.touches[1].clientX) ** 2 +
                    (event.touches[0].clientY - event.touches[1].clientY) ** 2
                );
            }
        });

        window.addEventListener("touchmove", (event: TouchEvent): void => {
            if (event.touches.length === 1 && event.touches[0].target instanceof Node) {
                for (let exclude of this.excluded) {
                    if (exclude.contains(event.touches[0].target)) {
                        return;
                    }
                }
            }
            event.preventDefault();
            this.setPosition(new Vector2(
                this.position.x - (event.touches[0].clientX - this.pointerPosition.x) / this.magnification,
                this.position.y - (event.touches[0].clientY - this.pointerPosition.y) / this.magnification,
            ));
            this.setPointerPosition(new Vector2(
                event.touches[0].clientX,
                event.touches[0].clientY,
            ));
            if (event.touches.length > 1) {
                let distance: number = Math.sqrt(
                    (event.touches[0].clientX - event.touches[1].clientX) ** 2 +
                    (event.touches[0].clientY - event.touches[1].clientY) ** 2
                );
                let position: Vector2 = new Vector2(
                    (event.touches[0].clientX + event.touches[1].clientX) / 2,
                    (event.touches[0].clientY + event.touches[1].clientY) / 2,
                );
                this.zoom(distance / this.pointerDistance, position);
                this.pointerDistance = distance;
            }
        });

        window.addEventListener("mousemove", (event: MouseEvent): void => {
            if (event.target instanceof Node) {
                for (let exclude of this.excluded) {
                    if (exclude.contains(event.target)) {
                        return;
                    }
                }
            }
            event.preventDefault();
            if (event.buttons > 0) {
                this.setPosition(new Vector2(
                    this.position.x - (event.clientX - this.pointerPosition.x) / this.magnification,
                    this.position.y - (event.clientY - this.pointerPosition.y) / this.magnification,
                ));
            }
            this.setPointerPosition(new Vector2(
                event.clientX,
                event.clientY,
            ));
        });

        this.main.canvas.addEventListener("wheel", (event: WheelEvent): void => {
            event.preventDefault();
            if (event.deltaY > 0) {
                this.zoomOut(new Vector2(event.clientX, event.clientY));
            } else {
                this.zoomIn(new Vector2(event.clientX, event.clientY));
            }
        });

        window.addEventListener("resize", (): void => {
            this.setSize(new Vector2(window.innerWidth, window.innerHeight));
        });
    }

    render(): void {
        this.main.ctx.clearRect(0, 0, this.main.canvas.width, this.main.canvas.height);
        for (let x: number = this.position.x - (this.position.x % SECTION_SIZE); x <= this.position.x + this.main.canvas.width / this.magnification; x += SECTION_SIZE) {
            for (let y: number = this.position.y - (this.position.y % SECTION_SIZE); y <= this.position.y + this.main.canvas.height / this.magnification; y += SECTION_SIZE) {
                const canvas: Canvas | undefined = this.sections.get(x + "," + y);
                if (!canvas) continue;
                this.main.ctx.drawImage(
                    canvas.canvas,
                    0,
                    0,
                    SECTION_SIZE,
                    SECTION_SIZE,
                    (x - this.position.x) * this.magnification,
                    (y - this.position.y) * this.magnification,
                    SECTION_SIZE * this.magnification,
                    SECTION_SIZE * this.magnification
                );
            }
        }
    }

    zoomIn(position: Vector2 = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)): void {
        this.zoom(2, position);
    }

    zoomOut(position: Vector2 = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)): void {
        this.zoom(0.5, position);
    }

    zoom(level: number, position: Vector2 = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)): void {
        this.setMagnification(this.magnification * 100 * level, position);
    }

    setMagnification(magnification: number, position: Vector2 = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)): void {
        if (!Number.isInteger(magnification)) magnification = Math.round(magnification);
        if (magnification === this.magnification) return;
        if (magnification < this.minMagnification) magnification = this.minMagnification;
        else if (magnification > this.maxMagnification) magnification = this.maxMagnification;
        if (new ZoomEvent(this, magnification).isCanceled()) return;
        magnification /= 100;
        position.divide(this.magnification);
        const amount: number = magnification / this.magnification;
        this.setPosition(new Vector2(
            position.x - (position.x / amount) + this.position.x,
            position.y - (position.y / amount) + this.position.y,
        ));
        this.magnification = magnification;
        this.render();
    }

    getMagnification(): number {
        return this.magnification;
    }

    setPosition(position: Vector2): void {
        if ((new MoveEvent(this, position)).isCanceled()) return;
        this.position = position;
        this.render();
    }

    getPosition(): Vector2 {
        return this.position.clone();
    }

    private setPointerPosition(position: Vector2): void {
        new PointerEvent(this, position);
        this.pointerPosition = position;
    }

    getPointerPosition(): Vector2 {
        return this.pointerPosition.clone();
    }

    setSmooth(smooth: boolean): void {
        if ((new SmoothEvent(this, smooth)).isCanceled()) return;
        this.smooth = smooth;
        this.main.ctx.imageSmoothingEnabled = this.smooth;
        this.render();
    }

    getSmooth(): boolean {
        return this.smooth;
    }

    setSize(size: Vector2): void {
        if ((new ResizeEvent(this, size)).isCanceled()) return;
        this.main.canvas.width = size.x;
        this.main.canvas.height = size.y;
        this.main.ctx.imageSmoothingEnabled = this.smooth;
        this.render();
    }

    getSize(): Vector2 {
        return new Vector2(this.main.canvas.width, this.main.canvas.height);
    }

    addExcluded(exclude: HTMLElement): void {
        this.excluded.push(exclude);
    }

    getExcluded(): HTMLElement[] {
        return this.excluded;
    }
}