import {Canvas, CanvasMap, MoveEvent, PointerEvent, SECTION_SIZE, Vector2, ZoomEvent} from "./lib/CanvasMap.js";

const path: string = "/assets/maps/" + window.location.pathname.replace("/map/", "") + "/";

class Config {
    public readonly name: string;
    public readonly color: string;
    public readonly size: Vector2;
    public readonly spawn: Vector2;
    public readonly image: boolean;
    public readonly chunks: boolean;

    constructor(name: string, color: string, size: Vector2, spawn: Vector2, image: boolean, chunks: boolean) {
        this.name = name;
        this.color = color;
        this.size = size;
        this.spawn = spawn;
        this.image = image;
        this.chunks = chunks;
    }

    public static async fromUrl(url: string): Promise<Config> {
        const response: Response = await fetch(url + "config.json");
        const json: any = await response.json();
        return new Config(
            json["name"] ?? "Map",
            json["color"] ?? "#113322",
            Vector2.fromJson(json["size"]) ?? new Vector2(),
            Vector2.fromJson(json["spawn"]) ?? new Vector2(),
            json["image"] ?? false,
            json["chunks"] ?? false
        );
    }
}

class Chunks {
    public readonly pixelsPerChunk: number;
    public readonly locations: Map<string, Chunk>;

    constructor(pixelsPerChunk: number, locations: Map<string, Chunk>) {
        this.pixelsPerChunk = pixelsPerChunk;
        this.locations = locations;
    }

    public static async fromUrl(url: string): Promise<Chunks> {
        const response: Response = await fetch(url + "chunks.json");
        const json: any = await response.json();
        const pixelsPerChunk: number = json["pixelsPerChunk"] ?? 1;
        const locations: Map<string, Chunk> = new Map<string, Chunk>();
        const types: Map<string, string> = new Map<string, string>(Object.entries(json["types"] ?? {}));
        const colors: Map<string, string> = new Map<string, string>(Object.entries(json["colors"] ?? {}));
        (new Map<string, string>(Object.entries(json["locations"] ?? {}))).forEach((name: string, position: string): void => {
            const type: string | undefined = types.get(name);
            const coords: number[] = position.split(",").map(Number);
            locations.set(position, new Chunk(
                name,
                type ?? "???",
                (type === undefined ? undefined : colors.get(type)) ?? "#FFFFFF",
                new Vector2(coords[0], coords[1]).multiply(pixelsPerChunk)
            ));
        });
        return new Chunks(
            pixelsPerChunk,
            locations
        );
    }
}

class Chunk {
    public readonly name: string;
    public readonly type: string;
    public readonly color: string;
    public readonly location: Vector2;

    constructor(name: string, type: string, color: string, location: Vector2) {
        this.name = name;
        this.type = type;
        this.color = color;
        this.location = location;
    }
}

async function start(): Promise<void> {
    const canvas: HTMLCanvasElement = document.querySelector("#canvas") ?? document.createElement("canvas");

    const followMouse: HTMLDivElement = document.querySelector("#follow-mouse") ?? document.createElement("div");
    const chunkName: HTMLSpanElement = document.querySelector("#chunkName") ?? document.createElement("span");
    const chunkType: HTMLSpanElement = document.querySelector("#chunkType") ?? document.createElement("span");

    const waypoints: HTMLDivElement = document.querySelector("#top-right") ?? document.createElement("div");
    const spawnWaypoint: HTMLAnchorElement = document.querySelector("#spawn-waypoint") ?? document.createElement("a");

    const labelX: HTMLSpanElement = document.querySelector("#x") ?? document.createElement("span");
    const labelY: HTMLSpanElement = document.querySelector("#y") ?? document.createElement("span");
    const checkbox: HTMLInputElement = document.querySelector("#smooth") ?? document.createElement("input");
    const zoom: HTMLInputElement = document.querySelector("#zoom") ?? document.createElement("input");
    const zoomLabel: HTMLLabelElement = document.querySelector("#zoom-label") ?? document.createElement("label");

    let map: CanvasMap = new CanvasMap(canvas, [zoom]);
    map.setSmooth(false);

    toSpawn();

    spawnWaypoint.addEventListener("click", toSpawn);

    zoom.addEventListener("input", function (): void {
        let value: number = parseFloat(this.value);
        if (value < 0) {
            map.setMagnification((value + 1) * (100 - map.minMagnification) + map.minMagnification);
        } else {
            map.setMagnification(value * (map.maxMagnification - 100) + 100);
        }
    });

    checkbox.addEventListener("change", function (): void {
        map.setSmooth(this.checked);
    });

    ZoomEvent.addListener((event: ZoomEvent): void => {
        zoomLabel.innerText = event.magnification + "%";
        if (event.magnification < 100) {
            zoom.value = String((event.magnification - map.minMagnification) / (100 - map.minMagnification) - 1);
        } else {
            zoom.value = String((event.magnification - 100) / (map.maxMagnification - 100));
        }
    });

    // Load sections
    for (let x: number = 0; x < config.size.x; x += SECTION_SIZE) {
        for (let y: number = 0; y < config.size.y; y += SECTION_SIZE) {
            if (config.image) {
                let image: HTMLImageElement = new Image();
                image.onload = (): void => {
                    let canvas: Canvas = new Canvas(document.createElement("canvas"));
                    canvas.canvas.width = SECTION_SIZE;
                    canvas.canvas.height = SECTION_SIZE;
                    canvas.ctx.drawImage(image, 0, 0, SECTION_SIZE, SECTION_SIZE, 0, 0, SECTION_SIZE, SECTION_SIZE);
                    map.sections.set(x + "," + y, canvas);
                    map.render();
                };
                image.src = path + "map/" + x + "," + y + ".png";
            } else {
                let canvas: Canvas = new Canvas(document.createElement("canvas"));
                canvas.canvas.width = SECTION_SIZE;
                canvas.canvas.height = SECTION_SIZE;
                canvas.ctx.fillStyle = config.color;
                canvas.ctx.fillRect(0, 0, config.size.x - x, config.size.y - y);
                map.sections.set(x + "," + y, canvas);
                map.render();
            }
        }
    }

    if (config.chunks) {
        const chunks: Chunks = await Chunks.fromUrl(path);

        const searchOpen: HTMLAnchorElement = document.querySelector("#search-open") ?? document.createElement("a");
        const center: HTMLDivElement = document.querySelector("#center") ?? document.createElement("div");
        const searchInput: HTMLInputElement = document.querySelector("#search-input") ?? document.createElement("input");
        const searchTable: HTMLTableElement = document.querySelector("#search-table") ?? document.createElement("table");
        const searchClose: HTMLAnchorElement = document.querySelector("#search-close") ?? document.createElement("a");

        searchOpen.style.display = "block";

        map.addExcluded(center);

        searchOpen.addEventListener("click", function (): void {
            if (center.style.display === "none") {
                center.style.display = "flex";
            } else {
                center.style.display = "none";
            }
        });

        searchClose.addEventListener("click", function (): void {
            center.style.display = "none";
        });

        // Close the center window when clicking outside of it
        window.addEventListener("pointerdown", (event: globalThis.PointerEvent): void => {
            if (center.style.display !== "none") {
                if (event.target instanceof Node) {
                    if (searchOpen.contains(event.target) || center.contains(event.target)) {
                        return;
                    }
                    center.style.display = "none";
                }
            }
        });

        // Close the center window when moving the canvas
        MoveEvent.addListener((): void => {
            if (center.style.display !== "none") {
                center.style.display = "none";
            }
        });

        function search(text: string): void {
            searchTable.innerHTML = "";
            chunks.locations.forEach((chunk: Chunk): void => {
                if (chunk.name.toLowerCase().includes(text.toLowerCase()) || chunk.type.toLowerCase().includes(text.toLowerCase())) {
                    let result: HTMLTableRowElement = document.createElement("tr");
                    result.innerHTML = "<td>" + chunk.location.x + ", " + chunk.location.y + "</td><td>" + chunk.name + "</td><td style='color:" + (chunk.color) + "'>" + (chunk.type) + "</td>";
                    result.addEventListener("click", function (): void {
                        map.setPosition(new Vector2(
                            chunk.location.x + config.spawn.x - (window.innerWidth / (map.getMagnification() * 2)) + chunks.pixelsPerChunk / 2,
                            chunk.location.y + config.spawn.y - (window.innerHeight / (map.getMagnification() * 2)) + chunks.pixelsPerChunk / 2
                        ));
                        map.setMagnification(map.maxMagnification);
                    });
                    searchTable.appendChild(result);
                }
            });
        }

        search("");

        searchInput.addEventListener("input", function (): void {
            search(searchInput.value);
        });

        // Load chunks
        chunks.locations.forEach((chunk: Chunk): void => {
            const location: Vector2 = chunk.location.clone().addVector(config.spawn);
            const section: Vector2 = new Vector2(
                location.x - location.x % SECTION_SIZE,
                location.y - location.y % SECTION_SIZE
            );
            const canvas: Canvas | undefined = map.sections.get(section.x + "," + section.y);
            if (canvas) {
                canvas.ctx.fillStyle = chunk.color;
                canvas.ctx.fillRect(location.x - section.x, location.y - section.y, chunks.pixelsPerChunk, chunks.pixelsPerChunk);
            }
            map.render();
        });

        PointerEvent.addListener((event: PointerEvent): void => {
            const position: Vector2 = map.getPosition();
            let x: number = Math.floor(position.x + event.position.x / map.getMagnification()) - config.spawn.x;
            let y: number = Math.floor(position.y + event.position.y / map.getMagnification()) - config.spawn.y;
            labelX.innerText = String(x);
            labelY.innerText = String(y);
            const chunk: Chunk | undefined = chunks.locations.get(Math.floor(x / chunks.pixelsPerChunk) + "," + Math.floor(y / chunks.pixelsPerChunk));
            if (chunk) {
                chunkName.innerText = chunk.name;
                chunkType.innerText = chunk.type;
                chunkType.style.color = chunk.color;
                followMouse.style.display = "flex";
                if (event.position.x > window.innerWidth - followMouse.offsetWidth - 20) {
                    x = event.position.x - followMouse.offsetWidth - 20;
                } else {
                    x = event.position.x + 20;
                }
                followMouse.style.left = String(x) + "px";
                followMouse.style.top = String(event.position.y - followMouse.offsetHeight / 2) + "px";
            } else {
                followMouse.style.display = "none";
            }
        });

        let longPress: number | null;
        map.main.canvas.addEventListener("touchstart", (event: TouchEvent): void => {
            if (event.touches.length === 1) {
                longPress = setTimeout((): void => {
                    promptWaypoint(map.getPointerPosition());
                }, 500);
            } else {
                if (longPress) clearTimeout(longPress);
            }
        });

        map.main.canvas.addEventListener("touchmove", (): void => {
            if (longPress) clearTimeout(longPress);
        });

        map.main.canvas.addEventListener("touchend", (): void => {
            if (longPress) clearTimeout(longPress);
        });
    } else {
        PointerEvent.addListener((event: PointerEvent): void => {
            const position: Vector2 = map.getPosition();
            labelX.innerText = String(Math.floor(position.x + event.position.x / map.getMagnification()) - config.spawn.x);
            labelY.innerText = String(Math.floor(position.y + event.position.y / map.getMagnification()) - config.spawn.y);
        });
    }

    map.main.canvas.addEventListener("contextmenu", (event: MouseEvent): void => {
        event.preventDefault();
        promptWaypoint(new Vector2(event.x, event.y));
    });

    // Load waypoints
    for (const [key, value] of Object.entries(localStorage)) {
        if (key.startsWith(window.location.pathname + ":")) {
            addWaypoint(key.replace(window.location.pathname + ":", ""), Vector2.fromJson(JSON.parse(value)) ?? new Vector2());
        }
    }

    function addWaypoint(name: string, position: Vector2): void {
        let div: HTMLDivElement = document.createElement("div");
        div.className = "waypoint";
        let waypoint: HTMLAnchorElement = document.createElement("a");
        waypoint.className = "section";
        waypoint.innerText = name + " (" + position.x + ", " + position.y + ")";
        waypoint.addEventListener("click", function (): void {
            map.setPosition(new Vector2(
                config.spawn.x + position.x - window.innerWidth / (map.getMagnification() * 2),
                config.spawn.y + position.y - window.innerHeight / (map.getMagnification() * 2)
            ));
        });
        div.appendChild(waypoint);
        let deleteWaypoint: HTMLAnchorElement = document.createElement("a");
        deleteWaypoint.className = "delete";
        deleteWaypoint.innerText = "X";
        deleteWaypoint.addEventListener("click", function (): void {
            localStorage.removeItem(window.location.pathname + ":" + name);
            waypoints.removeChild(div);
        });
        div.appendChild(deleteWaypoint);
        waypoints.appendChild(div);
    }

    function promptWaypoint(pointerPosition: Vector2): void {
        let name: string | null = prompt("Add a waypoint.", "New Waypoint");
        if (name) {
            const mapPosition: Vector2 = map.getPosition();
            const position: Vector2 = new Vector2(
                Math.round(mapPosition.x + (pointerPosition.x / map.getMagnification()) - config.spawn.x),
                Math.round(mapPosition.y + (pointerPosition.y / map.getMagnification()) - config.spawn.y)
            );
            addWaypoint(name, position);
            localStorage.setItem(window.location.pathname + ":" + name, JSON.stringify(position));
        }
    }

    function toSpawn(): void {
        map.setPosition(new Vector2(
            config.spawn.x - (window.innerWidth / 2) / map.getMagnification(),
            config.spawn.y - (window.innerHeight / 2) / map.getMagnification()
        ));
    }
}

const config: Config = await Config.fromUrl(path);
document.title = config.name + " Map";

if (document.readyState === "complete") {
    await start();
} else {
    document.body.onload = start;
}