export const SECTION_SIZE = 4096;
export var Priority;
(function (Priority) {
    Priority[Priority["LOW"] = 0] = "LOW";
    Priority[Priority["NORMAL"] = 1] = "NORMAL";
    Priority[Priority["HIGH"] = 2] = "HIGH";
    Priority[Priority["MONITOR"] = 3] = "MONITOR";
})(Priority || (Priority = {}));
class PriorityListener {
    listener;
    priority;
    constructor(listener, priority) {
        this.listener = listener;
        this.priority = priority;
    }
    getPriority() {
        return this.priority;
    }
    call(event) {
        this.listener(event);
    }
}
export class BaseEvent {
    static listeners = new Map();
    static addListener(listener, priority = Priority.NORMAL) {
        const listeners = BaseEvent.listeners.get(this.name);
        if (!listeners) {
            BaseEvent.listeners.set(this.name, [new PriorityListener(listener, priority)]);
            return;
        }
        for (let i = 0; i < listeners.length; i++) {
            if (listeners[i].getPriority() > priority) {
                listeners.splice(i, 0, new PriorityListener(listener, priority));
                return;
            }
        }
        listeners.push(new PriorityListener(listener, priority));
    }
    static dispatch(event) {
        BaseEvent.listeners.get(this.name)?.forEach((listener) => listener.call(event));
    }
}
export class MapEvent extends BaseEvent {
    map;
    constructor(map) {
        super();
        this.map = map;
        MapEvent.dispatch(this);
    }
}
export class MoveEvent extends MapEvent {
    canceled = false;
    position;
    constructor(map, position) {
        super(map);
        this.position = position;
        MoveEvent.dispatch(this);
    }
    cancel() {
        this.canceled = true;
    }
    isCanceled() {
        return this.canceled;
    }
}
export class ResizeEvent extends MapEvent {
    canceled = false;
    size;
    constructor(map, size) {
        super(map);
        this.size = size;
        ResizeEvent.dispatch(this);
    }
    cancel() {
        this.canceled = true;
    }
    isCanceled() {
        return this.canceled;
    }
}
export class ZoomEvent extends MapEvent {
    canceled = false;
    magnification;
    constructor(map, magnification) {
        super(map);
        this.magnification = magnification;
        ZoomEvent.dispatch(this);
    }
    cancel() {
        this.canceled = true;
    }
    isCanceled() {
        return this.canceled;
    }
}
export class PointerEvent extends MapEvent {
    position;
    constructor(map, position) {
        super(map);
        this.position = position;
        PointerEvent.dispatch(this);
    }
}
export class SmoothEvent extends MapEvent {
    canceled = false;
    smooth;
    constructor(map, smooth) {
        super(map);
        this.smooth = smooth;
        SmoothEvent.dispatch(this);
    }
    cancel() {
        this.canceled = true;
    }
    isCanceled() {
        return this.canceled;
    }
}
export class Vector2 {
    x;
    y;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    set(x, y) {
        this.x = x;
        this.y = y;
    }
    multiply(value) {
        this.x *= value;
        this.y *= value;
        return this;
    }
    divide(value) {
        this.x /= value;
        this.y /= value;
        return this;
    }
    add(value) {
        this.x += value;
        this.y += value;
        return this;
    }
    subtract(value) {
        this.x -= value;
        this.y -= value;
        return this;
    }
    multiplyVector(vector) {
        this.x *= vector.x;
        this.y *= vector.y;
        return this;
    }
    divideVector(vector) {
        this.x /= vector.x;
        this.y /= vector.y;
        return this;
    }
    addVector(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    }
    subtractVector(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
    }
    clone() {
        return new Vector2(this.x, this.y);
    }
    static fromJson(json) {
        if (!json.hasOwnProperty("x") || !json.hasOwnProperty("y")) {
            return null;
        }
        return new Vector2(json["x"], json["y"]);
    }
}
export class Canvas {
    canvas;
    ctx;
    constructor(canvas) {
        this.canvas = canvas;
        let ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx === null) {
            throw new Error('Failed to get 2d context');
        }
        this.ctx = ctx;
    }
}
export class CanvasMap {
    main;
    sections = new Map();
    position = new Vector2();
    magnification = 1;
    pointerPosition = new Vector2();
    pointerDistance = 0;
    smooth;
    excluded;
    minMagnification;
    maxMagnification;
    constructor(canvas, exclude = [], smooth = true, minMagnification = 1, maxMagnification = 800) {
        this.main = new Canvas(canvas);
        this.excluded = exclude;
        this.smooth = smooth;
        this.minMagnification = minMagnification;
        this.maxMagnification = maxMagnification;
        this.main.ctx.imageSmoothingEnabled = this.smooth;
        this.setSize(new Vector2(window.innerWidth, window.innerHeight));
        window.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.setPointerPosition(new Vector2(event.touches[0].clientX, event.touches[0].clientY));
            }
            else {
                this.pointerDistance = Math.sqrt((event.touches[0].clientX - event.touches[1].clientX) ** 2 +
                    (event.touches[0].clientY - event.touches[1].clientY) ** 2);
            }
        });
        window.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1 && event.touches[0].target instanceof Node) {
                for (let exclude of this.excluded) {
                    if (exclude.contains(event.touches[0].target)) {
                        return;
                    }
                }
            }
            event.preventDefault();
            this.setPosition(new Vector2(this.position.x - (event.touches[0].clientX - this.pointerPosition.x) / this.magnification, this.position.y - (event.touches[0].clientY - this.pointerPosition.y) / this.magnification));
            this.setPointerPosition(new Vector2(event.touches[0].clientX, event.touches[0].clientY));
            if (event.touches.length > 1) {
                let distance = Math.sqrt((event.touches[0].clientX - event.touches[1].clientX) ** 2 +
                    (event.touches[0].clientY - event.touches[1].clientY) ** 2);
                let position = new Vector2((event.touches[0].clientX + event.touches[1].clientX) / 2, (event.touches[0].clientY + event.touches[1].clientY) / 2);
                this.zoom(distance / this.pointerDistance, position);
                this.pointerDistance = distance;
            }
        });
        window.addEventListener("mousemove", (event) => {
            if (event.target instanceof Node) {
                for (let exclude of this.excluded) {
                    if (exclude.contains(event.target)) {
                        return;
                    }
                }
            }
            event.preventDefault();
            if (event.buttons > 0) {
                this.setPosition(new Vector2(this.position.x - (event.clientX - this.pointerPosition.x) / this.magnification, this.position.y - (event.clientY - this.pointerPosition.y) / this.magnification));
            }
            this.setPointerPosition(new Vector2(event.clientX, event.clientY));
        });
        this.main.canvas.addEventListener("wheel", (event) => {
            event.preventDefault();
            if (event.deltaY > 0) {
                this.zoomOut(new Vector2(event.clientX, event.clientY));
            }
            else {
                this.zoomIn(new Vector2(event.clientX, event.clientY));
            }
        });
        window.addEventListener("resize", () => {
            this.setSize(new Vector2(window.innerWidth, window.innerHeight));
        });
    }
    render() {
        this.main.ctx.clearRect(0, 0, this.main.canvas.width, this.main.canvas.height);
        for (let x = this.position.x - (this.position.x % SECTION_SIZE); x <= this.position.x + this.main.canvas.width / this.magnification; x += SECTION_SIZE) {
            for (let y = this.position.y - (this.position.y % SECTION_SIZE); y <= this.position.y + this.main.canvas.height / this.magnification; y += SECTION_SIZE) {
                const canvas = this.sections.get(x + "," + y);
                if (!canvas)
                    continue;
                this.main.ctx.drawImage(canvas.canvas, 0, 0, SECTION_SIZE, SECTION_SIZE, (x - this.position.x) * this.magnification, (y - this.position.y) * this.magnification, SECTION_SIZE * this.magnification, SECTION_SIZE * this.magnification);
            }
        }
    }
    zoomIn(position = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)) {
        this.zoom(2, position);
    }
    zoomOut(position = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)) {
        this.zoom(0.5, position);
    }
    zoom(level, position = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)) {
        this.setMagnification(this.magnification * 100 * level, position);
    }
    setMagnification(magnification, position = new Vector2(this.main.canvas.width / 2, this.main.canvas.height / 2)) {
        if (!Number.isInteger(magnification))
            magnification = Math.round(magnification);
        if (magnification === this.magnification)
            return;
        if (magnification < this.minMagnification)
            magnification = this.minMagnification;
        else if (magnification > this.maxMagnification)
            magnification = this.maxMagnification;
        if (new ZoomEvent(this, magnification).isCanceled())
            return;
        magnification /= 100;
        position.divide(this.magnification);
        const amount = magnification / this.magnification;
        this.setPosition(new Vector2(position.x - (position.x / amount) + this.position.x, position.y - (position.y / amount) + this.position.y));
        this.magnification = magnification;
        this.render();
    }
    getMagnification() {
        return this.magnification;
    }
    setPosition(position) {
        if ((new MoveEvent(this, position)).isCanceled())
            return;
        this.position = position;
        this.render();
    }
    getPosition() {
        return this.position.clone();
    }
    setPointerPosition(position) {
        new PointerEvent(this, position);
        this.pointerPosition = position;
    }
    getPointerPosition() {
        return this.pointerPosition.clone();
    }
    setSmooth(smooth) {
        if ((new SmoothEvent(this, smooth)).isCanceled())
            return;
        this.smooth = smooth;
        this.main.ctx.imageSmoothingEnabled = this.smooth;
        this.render();
    }
    getSmooth() {
        return this.smooth;
    }
    setSize(size) {
        if ((new ResizeEvent(this, size)).isCanceled())
            return;
        this.main.canvas.width = size.x;
        this.main.canvas.height = size.y;
        this.main.ctx.imageSmoothingEnabled = this.smooth;
        this.render();
    }
    getSize() {
        return new Vector2(this.main.canvas.width, this.main.canvas.height);
    }
    addExcluded(exclude) {
        this.excluded.push(exclude);
    }
    getExcluded() {
        return this.excluded;
    }
}
