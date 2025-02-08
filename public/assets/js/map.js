import { Canvas, CanvasMap, MoveEvent, PointerEvent, SECTION_SIZE, Vector2, ZoomEvent } from "./lib/CanvasMap.js";
const path = "/assets/maps/" + window.location.pathname.replace("/map/", "") + "/";
class Config {
    name;
    color;
    size;
    spawn;
    image;
    chunks;
    constructor(name, color, size, spawn, image, chunks) {
        this.name = name;
        this.color = color;
        this.size = size;
        this.spawn = spawn;
        this.image = image;
        this.chunks = chunks;
    }
    static async fromUrl(url) {
        const response = await fetch(url + "config.json");
        const json = await response.json();
        return new Config(json["name"] ?? "Map", json["color"] ?? "#113322", Vector2.fromJson(json["size"]) ?? new Vector2(), Vector2.fromJson(json["spawn"]) ?? new Vector2(), json["image"] ?? false, json["chunks"] ?? false);
    }
}
class Chunks {
    pixelsPerChunk;
    locations;
    constructor(pixelsPerChunk, locations) {
        this.pixelsPerChunk = pixelsPerChunk;
        this.locations = locations;
    }
    static async fromUrl(url) {
        const response = await fetch(url + "chunks.json");
        const json = await response.json();
        const pixelsPerChunk = json["pixelsPerChunk"] ?? 1;
        const locations = new Map();
        const types = new Map(Object.entries(json["types"] ?? {}));
        const colors = new Map(Object.entries(json["colors"] ?? {}));
        (new Map(Object.entries(json["locations"] ?? {}))).forEach((name, position) => {
            const type = types.get(name);
            const coords = position.split(",").map(Number);
            locations.set(position, new Chunk(name, type ?? "???", (type === undefined ? undefined : colors.get(type)) ?? "#FFFFFF", new Vector2(coords[0], coords[1]).multiply(pixelsPerChunk)));
        });
        return new Chunks(pixelsPerChunk, locations);
    }
}
class Chunk {
    name;
    type;
    color;
    location;
    constructor(name, type, color, location) {
        this.name = name;
        this.type = type;
        this.color = color;
        this.location = location;
    }
}
async function start() {
    const canvas = document.querySelector("#canvas") ?? document.createElement("canvas");
    const mouse = document.querySelector("#mouse") ?? document.createElement("div");
    const chunkName = document.querySelector("#chunk-name") ?? document.createElement("span");
    const chunkType = document.querySelector("#chunk-type") ?? document.createElement("span");
    const waypoints = document.querySelector("#waypoints") ?? document.createElement("div");
    const spawn = document.querySelector("#spawn") ?? document.createElement("a");
    const coordinates = document.querySelector("#coordinates") ?? document.createElement("span");
    const smooth = document.querySelector("#smooth") ?? document.createElement("input");
    const zoom = document.querySelector("#zoom") ?? document.createElement("input");
    const zoomLabel = document.querySelector("#zoom-label") ?? document.createElement("span");
    let map = new CanvasMap(canvas, [zoom]);
    map.setSmooth(false);
    toSpawn();
    spawn.addEventListener("click", toSpawn);
    zoom.addEventListener("input", function () {
        let value = parseFloat(this.value);
        if (value < 0) {
            map.setMagnification((value + 1) * (100 - map.minMagnification) + map.minMagnification);
        }
        else {
            map.setMagnification(value * (map.maxMagnification - 100) + 100);
        }
    });
    smooth.addEventListener("change", function () {
        map.setSmooth(this.checked);
    });
    ZoomEvent.addListener((event) => {
        zoomLabel.innerText = event.magnification + "%";
        if (event.magnification < 100) {
            zoom.value = String((event.magnification - map.minMagnification) / (100 - map.minMagnification) - 1);
        }
        else {
            zoom.value = String((event.magnification - 100) / (map.maxMagnification - 100));
        }
    });
    // Load sections
    for (let x = 0; x < config.size.x; x += SECTION_SIZE) {
        for (let y = 0; y < config.size.y; y += SECTION_SIZE) {
            if (config.image) {
                let image = new Image();
                image.onload = () => {
                    let canvas = new Canvas(document.createElement("canvas"));
                    canvas.canvas.width = SECTION_SIZE;
                    canvas.canvas.height = SECTION_SIZE;
                    canvas.ctx.drawImage(image, 0, 0, SECTION_SIZE, SECTION_SIZE, 0, 0, SECTION_SIZE, SECTION_SIZE);
                    map.sections.set(x + "," + y, canvas);
                    map.render();
                };
                image.src = path + "map/" + x + "," + y + ".png";
            }
            else {
                let canvas = new Canvas(document.createElement("canvas"));
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
        const chunks = await Chunks.fromUrl(path);
        const searchOpen = document.querySelector("#search-open") ?? document.createElement("a");
        const searchWindow = document.querySelector("#search-window") ?? document.createElement("div");
        const searchInput = document.querySelector("#search-input") ?? document.createElement("input");
        const searchResults = document.querySelector("#search-results") ?? document.createElement("tbody");
        const searchClose = document.querySelector("#search-close") ?? document.createElement("a");
        searchOpen.style.display = "inherit";
        map.addExcluded(searchWindow);
        searchOpen.addEventListener("click", function () {
            if (searchWindow.style.display === "none") {
                searchWindow.style.display = "flex";
            }
            else {
                searchWindow.style.display = "none";
            }
        });
        searchClose.addEventListener("click", function () {
            searchWindow.style.display = "none";
        });
        // Close the center window when clicking outside of it
        window.addEventListener("pointerdown", (event) => {
            if (searchWindow.style.display !== "none") {
                if (event.target instanceof Node) {
                    if (searchOpen.contains(event.target) || searchWindow.contains(event.target)) {
                        return;
                    }
                    searchWindow.style.display = "none";
                }
            }
        });
        // Close the center window when moving the canvas
        MoveEvent.addListener(() => {
            if (searchWindow.style.display !== "none") {
                searchWindow.style.display = "none";
            }
        });
        function search(text) {
            searchResults.innerHTML = "";
            chunks.locations.forEach((chunk) => {
                if (chunk.name.toLowerCase().includes(text.toLowerCase()) || chunk.type.toLowerCase().includes(text.toLowerCase())) {
                    let result = document.createElement("tr");
                    result.innerHTML = "<td>" + chunk.location.x + ", " + chunk.location.y + "</td><td>" + chunk.name + "</td><td style='color:" + (chunk.color) + "'>" + (chunk.type) + "</td>";
                    result.addEventListener("click", function () {
                        map.setPosition(new Vector2(chunk.location.x + config.spawn.x - (window.innerWidth / (map.getMagnification() * 2)) + chunks.pixelsPerChunk / 2, chunk.location.y + config.spawn.y - (window.innerHeight / (map.getMagnification() * 2)) + chunks.pixelsPerChunk / 2));
                        map.setMagnification(map.maxMagnification);
                    });
                    searchResults.appendChild(result);
                }
            });
        }
        search("");
        searchInput.addEventListener("input", function () {
            search(searchInput.value);
        });
        // Load chunks
        chunks.locations.forEach((chunk) => {
            const location = chunk.location.clone().addVector(config.spawn);
            const section = new Vector2(location.x - location.x % SECTION_SIZE, location.y - location.y % SECTION_SIZE);
            const canvas = map.sections.get(section.x + "," + section.y);
            if (canvas) {
                canvas.ctx.fillStyle = chunk.color;
                canvas.ctx.fillRect(location.x - section.x, location.y - section.y, chunks.pixelsPerChunk, chunks.pixelsPerChunk);
            }
            map.render();
        });
        PointerEvent.addListener((event) => {
            const position = map.getPosition();
            let x = Math.floor(position.x + event.position.x / map.getMagnification()) - config.spawn.x;
            let y = Math.floor(position.y + event.position.y / map.getMagnification()) - config.spawn.y;
            coordinates.innerText = String(x) + ", " + String(y);
            const chunk = chunks.locations.get(Math.floor(x / chunks.pixelsPerChunk) + "," + Math.floor(y / chunks.pixelsPerChunk));
            if (chunk) {
                chunkName.innerText = chunk.name;
                chunkType.innerText = chunk.type;
                chunkType.style.color = chunk.color;
                mouse.style.display = "flex";
                if (event.position.x >= window.innerWidth - mouse.offsetWidth - 20) {
                    x = event.position.x - mouse.offsetWidth - 20;
                }
                else {
                    x = event.position.x + 20;
                }
                mouse.style.left = String(x) + "px";
                mouse.style.top = String(event.position.y - mouse.offsetHeight / 2) + "px";
            }
            else {
                mouse.style.display = "none";
            }
        });
        let longPress;
        map.main.canvas.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                longPress = setTimeout(() => {
                    promptWaypoint(map.getPointerPosition());
                }, 500);
            }
            else {
                if (longPress)
                    clearTimeout(longPress);
            }
        });
        map.main.canvas.addEventListener("touchmove", () => {
            if (longPress)
                clearTimeout(longPress);
        });
        map.main.canvas.addEventListener("touchend", () => {
            if (longPress)
                clearTimeout(longPress);
        });
    }
    else {
        PointerEvent.addListener((event) => {
            const position = map.getPosition();
            coordinates.innerText =
                String(Math.floor(position.x + event.position.x / map.getMagnification()) - config.spawn.x)
                    + ", " +
                    String(Math.floor(position.y + event.position.y / map.getMagnification()) - config.spawn.y);
        });
    }
    map.main.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        promptWaypoint(new Vector2(event.x, event.y));
    });
    // Load waypoints
    for (const [key, value] of Object.entries(localStorage)) {
        if (key.startsWith(window.location.pathname + ":")) {
            addWaypoint(key.replace(window.location.pathname + ":", ""), Vector2.fromJson(JSON.parse(value)) ?? new Vector2());
        }
    }
    function addWaypoint(name, position) {
        let div = document.createElement("div");
        div.className = "waypoint";
        let waypoint = document.createElement("a");
        waypoint.className = "button teleport";
        waypoint.innerText = name + " (" + position.x + ", " + position.y + ")";
        waypoint.addEventListener("click", function () {
            map.setPosition(new Vector2(config.spawn.x + position.x - window.innerWidth / (map.getMagnification() * 2), config.spawn.y + position.y - window.innerHeight / (map.getMagnification() * 2)));
        });
        div.appendChild(waypoint);
        let deleteWaypoint = document.createElement("a");
        deleteWaypoint.className = "button delete";
        deleteWaypoint.innerHTML = "&#10006;";
        deleteWaypoint.addEventListener("click", function () {
            localStorage.removeItem(window.location.pathname + ":" + name);
            waypoints.removeChild(div);
        });
        div.appendChild(deleteWaypoint);
        waypoints.appendChild(div);
    }
    function promptWaypoint(pointerPosition) {
        let name = prompt("Add a waypoint.", "New Waypoint");
        if (name) {
            const mapPosition = map.getPosition();
            const position = new Vector2(Math.round(mapPosition.x + (pointerPosition.x / map.getMagnification()) - config.spawn.x), Math.round(mapPosition.y + (pointerPosition.y / map.getMagnification()) - config.spawn.y));
            addWaypoint(name, position);
            localStorage.setItem(window.location.pathname + ":" + name, JSON.stringify(position));
        }
    }
    function toSpawn() {
        map.setPosition(new Vector2(config.spawn.x - (window.innerWidth / 2) / map.getMagnification(), config.spawn.y - (window.innerHeight / 2) / map.getMagnification()));
    }
}
const config = await Config.fromUrl(path);
document.title = config.name + " Map";
if (document.readyState === "complete") {
    await start();
}
else {
    document.body.onload = start;
}
