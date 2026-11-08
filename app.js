window.onerror = function (msg, url, line) {
    const log = document.getElementById('error-log');
    log.style.display = 'block';
    log.innerHTML += `Ошибка: ${msg} <br> Строка: ${line}<br><br>`;
    return false;
};

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let switchFloor = function () {};
let searchRoom = function () {};

function makeMaterial(scene, hexColor) {
    const mat = new BABYLON.StandardMaterial("mat_" + hexColor, scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString(hexColor);
    mat.specularColor = new BABYLON.Color3(0.06, 0.06, 0.06);
    return mat;
}

const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.08, 0.095, 0.13, 1);
    scene.collisionsEnabled = true;

    // КАМЕРА (Изометрический ракурс как на скриншотах)
    const camera = new BABYLON.ArcRotateCamera(
        "camera1",
        -Math.PI / 2.3,
        Math.PI / 3.3,
        58,
        new BABYLON.Vector3(1, 0, 0),
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 100;
    camera.upperBetaLimit = Math.PI / 2.15;

    // СВЕТ
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(10, 35, -15), scene);
    light.intensity = 1.0;

    // МАТЕРИАЛЫ (Цвета точно в стиле карты МИДиС)
    const floorMat    = makeMaterial(scene, "#1c232e"); // Пол коридоров
    const holeMat     = makeMaterial(scene, "#12161f"); // Внутренний двор (колодец)
    const roomMat     = makeMaterial(scene, "#2b3b4e"); // Стандартный кабинет
    const specialMat  = makeMaterial(scene, "#353352"); // Кафедра / деканат / библиотека
    const foodMat     = makeMaterial(scene, "#4e3629"); // Столовая / буфет / магазин
    const serviceMat  = makeMaterial(scene, "#2b4743"); // Гардероб / вход / переход
    const wcMat       = makeMaterial(scene, "#253142"); // Туалеты
    const accentMat   = makeMaterial(scene, "#1da1f2"); // Голубой ориентир в холле 1 этажа
    const selectedMat = makeMaterial(scene, "#ff7a29"); // Подсветка выбранного кабинета

    // Группы для всех 5 этажей
    const floorGroups = {
        "1": new BABYLON.TransformNode("floor_1", scene),
        "2": new BABYLON.TransformNode("floor_2", scene),
        "2.5": new BABYLON.TransformNode("floor_2.5", scene),
        "3": new BABYLON.TransformNode("floor_3", scene),
        "4": new BABYLON.TransformNode("floor_4", scene)
    };

    const allRooms = []; // Список всех кабинетов для поиска и кликов

    // === 1. НАДПИСЬ НА КРЫШЕ КАБИНЕТА ===
    function addRoofLabel(parentBox, text, w, d, height, textColor = "#e6eef8") {
        if (!text) return;
        const plane = BABYLON.MeshBuilder.CreatePlane("lbl_" + text, { width: w, height: d }, scene);
        plane.parent = parentBox;
        plane.position.y = (height / 2) + 0.02;
        plane.rotation.x = Math.PI / 2;
        plane.isPickable = false;

        const texW = Math.round(Math.max(128, w * 70));
        const texH = Math.round(Math.max(128, d * 70));

        const tex = new BABYLON.DynamicTexture("tex_" + text, { width: texW, height: texH }, scene, false);
        tex.hasAlpha = true;
        const ctx = tex.getContext();
        ctx.clearRect(0, 0, texW, texH);

        const fontSize = text.length > 9 ? 28 : (text.length > 5 ? 36 : 46);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, texW / 2, texH / 2);
        tex.update();

        const labelMat = new BABYLON.StandardMaterial("lMat_" + text, scene);
        labelMat.diffuseTexture = tex;
        labelMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        labelMat.useAlphaFromDiffuseTexture = true;
        labelMat.backFaceCulling = false;
        plane.material = labelMat;
    }

    // === 2. ПОСТРОЕНИЕ КАБИНЕТА ПО ТОЧНЫМ ГРАНИЦАМ (x1, x2, z1, z2) ===
    // Гарантирует 0% наложений: каждый блок строится строго от x1 до x2 и от z1 до z2
    function addRect(floorKey, name, x1, x2, z1, z2, mat = roomMat, height = 1.35, textColor = "#ffffff") {
        const gap = 0.16; // Аккуратный зазор между стенами
        const w = Math.max(0.4, (x2 - x1) - gap);
        const d = Math.max(0.4, (z2 - z1) - gap);
        const centerX = (x1 + x2) / 2;
        const centerZ = (z1 + z2) / 2;

        const box = BABYLON.MeshBuilder.CreateBox(name || "Блок", { width: w, depth: d, height: height }, scene);
        box.parent = floorGroups[floorKey];
        box.position.set(centerX, height / 2, centerZ);
        box.material = mat;
        box.originalMaterial = mat;
        box.floorKey = floorKey;
        box.roomName = name;
        box.checkCollisions = true;

        // Светло-голубая подсветка ребер как на референсе
        box.enableEdgesRendering();
        box.edgesWidth = 3.2;
        box.edgesColor = new BABYLON.Color4(0.62, 0.76, 0.94, 1);

        if (name) {
            addRoofLabel(box, name, w, d, height, textColor);
            allRooms.push(box);
        }
        return box;
    }

    // === 3. ПЛИТА ПОЛА ДЛЯ ЭТАЖА ===
    function addFloorSlab(floorKey, x1, x2, z1, z2, isHole = false) {
        const w = x2 - x1;
        const d = z2 - z1;
        const slab = BABYLON.MeshBuilder.CreateBox("floor_slab", { width: w, depth: d, height: 0.12 }, scene);
        slab.parent = floorGroups[floorKey];
        slab.position.set((x1 + x2) / 2, isHole ? 0.02 : -0.06, (z1 + z2) / 2);
        slab.material = isHole ? holeMat : floorMat;
        slab.isPickable = false;
        if (!isHole) {
            slab.enableEdgesRendering();
            slab.edgesWidth = 2.5;
            slab.edgesColor = new BABYLON.Color4(0.45, 0.58, 0.75, 1);
        }
    }

    // === 4. ИКОНКА ЛЕСТНИЦЫ НА ПОЛУ ===
    function addStair(floorKey, x, z) {
        const disc = BABYLON.MeshBuilder.CreateGround("Лестница", { width: 1.8, height: 1.8 }, scene);
        disc.parent = floorGroups[floorKey];
        disc.position.set(x, 0.04, z);
        disc.floorKey = floorKey;
        disc.roomName = "Лестница";

        const tex = new BABYLON.DynamicTexture("stairTex", { width: 128, height: 128 }, scene, false);
        tex.hasAlpha = true;
        const ctx = tex.getContext();
        ctx.clearRect(0, 0, 128, 128);

        ctx.beginPath();
        ctx.arc(64, 64, 54, 0, Math.PI * 2);
        ctx.fillStyle = "#253346";
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#7a9ec2";
        ctx.stroke();

        // Ступеньки
        ctx.beginPath();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(36, 84);
        ctx.lineTo(50, 84);
        ctx.lineTo(50, 70);
        ctx.lineTo(64, 70);
        ctx.lineTo(64, 56);
        ctx.lineTo(78, 56);
        ctx.lineTo(78, 42);
        ctx.lineTo(92, 42);
        ctx.stroke();
        tex.update();

        const mat = new BABYLON.StandardMaterial("stairMat", scene);
        mat.diffuseTexture = tex;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.useAlphaFromDiffuseTexture = true;
        disc.material = mat;
    }

    // =========================================================================
    // ЭТАЖ 1 (БЕЗ ШКОЛЫ — ТОЛЬКО ЗДАНИЕ МИДИС)
    // =========================================================================
    addFloorSlab("1", -16.5, 16.5, -15.0, 15.0);

    // Столовая, Буфет, Туалеты, Библиотека 122 и левое крыло
    addRect("1", "Столовая", -16.0, -10.5, -8.0, 2.0, foodMat);
    addRect("1", "WC (Ж)", -10.5, -8.3, -8.0, -5.2, wcMat, 1.2, "#ff7eb6");
    addRect("1", "WC (М)", -7.6, -5.8, -8.0, -5.2, wcMat, 1.2, "#5cc8ff");
    addRect("1", "Буфет", -5.8, -1.8, -8.0, -5.0, foodMat);
    addRect("1", "122А", -5.8, -1.8, -5.0, -2.5);
    addRect("1", "122Б", -5.8, -1.8, -2.5, 0.0);
    addRect("1", "", -10.2, -7.0, -3.8, 0.0); // Подсобный блок слева от 122А/Б
    addRect("1", "122", -7.0, -0.5, 0.0, 5.2, specialMat);

    // Верхние залы левого крыла 1 этажа
    addRect("1", "Зал 1", -14.5, -6.5, 2.0, 10.0);
    addRect("1", "Зал 2", -6.5, 0.5, 5.2, 13.8);

    // Нижний ряд у Главного входа (104, 103, Вход, 105, 107, 109)
    addRect("1", "104", -9.0, -7.0, -14.5, -11.2);
    addRect("1", "103", -7.0, -3.0, -14.5, -11.2);
    addRect("1", "Главный вход", -2.8, 1.2, -14.5, -12.8, serviceMat, 0.45);
    addRect("1", "Холл", -1.4, -0.2, -10.2, -9.0, accentMat, 0.35); // Голубой квадрат на карте
    addRect("1", "105", 1.5, 5.5, -14.5, -11.2);
    addRect("1", "107", 5.5, 7.5, -14.5, -11.2);
    addRect("1", "109", 9.0, 16.0, -14.8, -12.0);

    // Центральный блок (Гардероб, 108, 110, Магазин, 118, 120, 127, WC)
    addRect("1", "Гардероб", 1.8, 8.5, -8.2, -4.8, serviceMat);
    addRect("1", "", 5.2, 8.5, -4.8, -1.2);
    addRect("1", "108", 5.2, 8.5, -1.2, 2.5);
    addRect("1", "110", 5.2, 8.5, 2.5, 5.8);
    addRect("1", "Магазин", 6.5, 8.5, 5.8, 8.5, foodMat);
    addRect("1", "118", 4.2, 6.5, 5.8, 8.8);
    addRect("1", "120", 1.8, 4.2, 5.8, 8.8);
    addRect("1", "127", 1.8, 5.2, 10.2, 14.5);
    addRect("1", "WC", 5.2, 8.5, 10.2, 14.5, wcMat, 1.2, "#c49bff");

    // Правый ряд (125 -> 123 -> 121 -> 119 -> 117 -> 115 -> 113 -> 111)
    addRect("1", "125", 10.2, 16.0, 11.0, 14.5);
    addRect("1", "123", 11.2, 16.0, 8.0, 11.0);
    addRect("1", "121", 11.2, 16.0, 5.0, 8.0);
    addRect("1", "119", 11.2, 16.0, 2.0, 5.0);
    addRect("1", "117", 11.2, 16.0, -3.2, 2.0);
    addRect("1", "115", 11.2, 16.0, -6.2, -3.2);
    addRect("1", "113", 11.2, 16.0, -9.2, -6.2);
    addRect("1", "111", 11.8, 16.0, -12.0, -9.2);

    // Лестницы 1 этажа
    addStair("1", -10.3, -12.5);
    addStair("1", -0.8, -6.2);
    addStair("1", 8.2, -13.0);
    addStair("1", 9.6, 12.2);


    // =========================================================================
    // ЭТАЖ 2 (ЗДАНИЕ МИДИС + ПЕРЕХОД В ШКОЛУ СПРАВА)
    // =========================================================================
    addFloorSlab("2", -17.0, 20.5, -14.8, 15.2);
    addFloorSlab("2", -0.5, 9.0, -4.5, 5.2, true); // Внутренний двор (Атриум)
    addFloorSlab("2", 20.5, 27.5, 3.0, 8.5);       // Пол перехода в школу

    // Левый внешний ряд (247, 241, 245, 251, 250, 239)
    addRect("2", "247", -16.5, -12.5, 8.5, 12.5);
    addRect("2", "241", -16.5, -12.5, 3.5, 8.5, specialMat);
    addRect("2", "245", -16.5, -12.5, -1.5, 3.5);
    addRect("2", "251", -16.5, -14.0, -7.5, -4.0);
    addRect("2", "250", -14.0, -11.5, -7.5, -4.0);
    addRect("2", "239", -11.5, -9.0, -7.5, -4.0);
    addRect("2", "", -9.0, -6.0, -7.5, -4.0);

    // Левый внутренний ряд (243, 249, 248, 246)
    addRect("2", "243", -11.0, -8.5, 6.0, 10.5);
    addRect("2", "249", -8.5, -6.0, 6.0, 10.5);
    addRect("2", "248", -11.0, -6.0, 1.5, 5.2);
    addRect("2", "246", -11.0, -6.0, -2.5, 1.5);

    // Ряд слева от атриума (240, 242, 244)
    addRect("2", "240", -4.5, -0.5, 6.5, 8.5);
    addRect("2", "242", -4.5, -0.5, 0.8, 6.5);
    addRect("2", "244", -4.5, -0.5, -4.5, 0.8);

    // Верхний ряд (235, 233, 231, 229, 227, WC, 225, 223, 221)
    addRect("2", "235", -2.5, 0.2, 10.2, 14.8, specialMat);
    addRect("2", "233", 0.2, 2.8, 10.2, 14.8);
    addRect("2", "231", 2.8, 5.8, 10.2, 14.8, specialMat);
    addRect("2", "229", 5.8, 8.8, 10.2, 14.8);
    addRect("2", "227", 8.8, 11.8, 10.2, 14.8);
    addRect("2", "WC", 11.8, 14.8, 10.2, 14.8, wcMat, 1.2, "#c49bff");
    addRect("2", "225", 16.6, 19.0, 11.0, 14.8);
    addRect("2", "223", 19.2, 23.5, 12.0, 14.2);
    addRect("2", "221", 19.2, 23.5, 9.8, 12.0);

    // Ряд над атриумом (236, 238, 232, 230)
    addRect("2", "236", -0.5, 2.5, 5.5, 8.5, specialMat);
    addRect("2", "238", 2.5, 4.4, 5.5, 8.5);
    addRect("2", "", 4.4, 5.8, 5.5, 8.5);
    addRect("2", "232", 5.8, 7.8, 5.5, 8.5);
    addRect("2", "230", 7.8, 9.5, 5.5, 8.5);

    // Ряд под атриумом (204 Отдел кадров, 206)
    addRect("2", "204 Отдел кадров", -4.5, 1.5, -8.0, -4.8, specialMat);
    addRect("2", "206", 3.5, 9.0, -8.0, -4.8);

    // Нижний ряд (201, 203, 207, 208, 209, 211)
    addRect("2", "201", -6.0, -3.8, -14.2, -10.5);
    addRect("2", "203", -3.8, -1.0, -14.2, -10.5);
    addRect("2", "207", -1.0, 1.5, -14.2, -10.5);
    addRect("2", "208", 1.5, 6.2, -14.2, -10.5);
    addRect("2", "209", 6.2, 9.2, -14.2, -10.5);
    addRect("2", "", 9.2, 11.2, -14.2, -10.5);
    addRect("2", "211", 15.0, 20.0, -14.2, -11.0);

    // Правый внутренний ряд (228, 224, 220, 218, 216, 214)
    addRect("2", "228", 9.5, 13.2, 4.2, 7.2);
    addRect("2", "224", 9.5, 13.2, 2.2, 4.2);
    addRect("2", "", 9.5, 13.2, 0.5, 2.2);
    addRect("2", "220", 9.5, 13.2, -2.2, 0.5);
    addRect("2", "218", 9.5, 13.2, -4.8, -2.2);
    addRect("2", "216", 9.5, 13.2, -7.2, -4.8);
    addRect("2", "214", 9.5, 13.2, -9.0, -7.2);

    // Правая внешняя стена (219, 217, 215, 213, 212)
    addRect("2", "219", 15.0, 20.0, 3.0, 8.2);
    addRect("2", "217", 15.0, 20.0, 0.2, 3.0);
    addRect("2", "215", 15.0, 20.0, -5.0, 0.2);
    addRect("2", "213", 15.0, 20.0, -8.0, -5.0);
    addRect("2", "212", 15.0, 20.0, -11.0, -8.0);

    // Переход в Школу (только на 2 этаже)
    addRect("2", "Переход в Школу", 20.2, 27.0, 6.0, 8.2, serviceMat, 0.9);

    // Лестницы 2 этажа
    addStair("2", -3.8, 12.5);
    addStair("2", -15.0, -2.8);
    addStair("2", -7.5, -12.2);
    addStair("2", 2.5, -6.4);
    addStair("2", 12.6, -12.5);
    addStair("2", 15.6, 12.5);
    addStair("2", 25.5, 4.5);


    // =========================================================================
    // ЭТАЖ 2.5 (КОМПАКТНЫЙ БЛОК 338–348)
    // =========================================================================
    addFloorSlab("2.5", -6.5, 8.0, -14.5, 14.5);

    addRect("2.5", "348", -3.5, 4.5, 6.5, 10.5);
    addRect("2.5", "346", -3.5, 2.0, 1.5, 6.5);
    addRect("2.5", "347", 2.0, 4.5, 1.5, 5.0);
    addRect("2.5", "344", -3.5, 4.5, -3.0, 1.5);

    addRect("2.5", "338", -3.5, -0.8, -7.5, -3.0);
    addRect("2.5", "340", -0.8, 1.8, -7.5, -3.0);
    addRect("2.5", "342", 1.8, 4.5, -7.5, -3.0);

    addRect("2.5", "341", -3.5, -0.8, -11.8, -9.5);
    addRect("2.5", "343", -3.5, -0.8, -14.0, -11.8, specialMat);
    addRect("2.5", "345", -0.8, 2.2, -14.0, -9.5, specialMat);
    addRect("2.5", "WC", 2.2, 6.2, -14.0, -9.5, wcMat, 1.2, "#c49bff");

    // Лестницы этажа 2.5
    addStair("2.5", -5.0, -8.5);
    addStair("2.5", 6.2, 13.0);


    // =========================================================================
    // ЭТАЖ 3 (ТОЛЬКО ЗДАНИЕ МИДИС, БЕЗ ШКОЛЫ)
    // =========================================================================
    addFloorSlab("3", -10.5, 17.0, -13.8, 14.2);
    addFloorSlab("3", -1.5, 6.5, -4.0, 4.8, true); // Внутренний двор (Атриум)

    // Верхний ряд (333, 331А, 331, 329, WC)
    addRect("3", "333", -4.5, -2.2, 9.5, 13.5);
    addRect("3", "331А", -2.2, 0.2, 9.5, 13.5);
    addRect("3", "331", 0.2, 2.5, 9.5, 13.5);
    addRect("3", "329", 2.5, 4.8, 9.5, 13.5);
    addRect("3", "WC", 4.8, 8.8, 9.5, 13.5, wcMat, 1.2, "#c49bff");

    // Левый внешний ряд (335, 337, 339)
    addRect("3", "", -8.5, -5.5, 6.5, 9.0);
    addRect("3", "335", -8.5, -5.5, 4.0, 6.5);
    addRect("3", "337", -8.5, -5.5, 1.5, 4.0);
    addRect("3", "339", -8.5, -5.5, -1.0, 1.5);

    // Ряд слева от атриума (328, 330, 332, 334)
    addRect("3", "", -4.0, -1.5, 5.5, 8.0);
    addRect("3", "328", -4.0, -1.5, 3.2, 5.5);
    addRect("3", "330", -4.0, -1.5, 0.8, 3.2);
    addRect("3", "332", -4.0, -1.5, -1.5, 0.8);
    addRect("3", "334", -4.0, -1.5, -3.8, -1.5);

    // Ряд над атриумом (326, 324, 322, 320, 318)
    addRect("3", "326", -1.5, 0.5, 5.0, 8.0);
    addRect("3", "324", 0.5, 2.3, 5.0, 8.0);
    addRect("3", "322", 2.3, 4.1, 5.0, 8.0);
    addRect("3", "320", 4.1, 6.0, 5.0, 8.0);
    addRect("3", "318", 6.0, 7.5, 5.0, 8.0);

    // Ряд справа от атриума (316, 312, 310, 308)
    addRect("3", "", 7.5, 10.2, 5.8, 7.8);
    addRect("3", "316", 6.5, 10.2, 3.0, 5.8);
    addRect("3", "", 6.5, 10.2, 1.2, 3.0);
    addRect("3", "312", 6.5, 10.2, -0.6, 1.2);
    addRect("3", "310", 6.5, 10.2, -3.8, -0.6);
    addRect("3", "308", 6.5, 10.2, -5.5, -3.8);

    // Ряд под атриумом (302, 304, 306)
    addRect("3", "", -5.8, -4.2, -6.8, -3.8);
    addRect("3", "302", -4.2, -2.2, -6.8, -3.8);
    addRect("3", "304", -2.2, -0.2, -6.8, -3.8, specialMat);
    addRect("3", "306", 1.5, 7.8, -7.5, -4.8);

    // Нижний ряд (301, 303, 305, 307, 309, 311)
    addRect("3", "301", -6.5, -4.8, -12.5, -9.0);
    addRect("3", "303", -4.8, -2.8, -12.5, -9.0);
    addRect("3", "305", -2.8, -0.8, -12.5, -9.0);
    addRect("3", "307", -0.8, 2.2, -12.5, -9.0, specialMat);
    addRect("3", "309", 2.2, 4.2, -12.5, -9.0);
    addRect("3", "311", 4.2, 7.2, -12.5, -9.0);

    // Правая внешняя стена (327 -> 325 -> 323 -> 321 -> 319 -> 317 -> 315 -> 313)
    addRect("3", "327", 12.0, 16.5, 7.5, 10.5);
    addRect("3", "325", 12.0, 16.5, 5.0, 7.5);
    addRect("3", "323", 12.0, 16.5, 2.5, 5.0);
    addRect("3", "321", 12.0, 16.5, 0.0, 2.5);
    addRect("3", "319", 12.0, 16.5, -4.2, 0.0);
    addRect("3", "317", 12.0, 16.5, -6.8, -4.2);
    addRect("3", "315", 12.0, 16.5, -10.8, -6.8);
    addRect("3", "313", 11.0, 16.5, -13.2, -10.8);

    // Лестницы 3 этажа
    addStair("3", -5.8, 11.5);
    addStair("3", -9.2, -7.5);
    addStair("3", 0.6, -5.5);
    addStair("3", 8.2, -11.0);
    addStair("3", 9.8, 11.0);


    // =========================================================================
    // ЭТАЖ 4 (КАБИНЕТЫ 401–408)
    // =========================================================================
    addFloorSlab("4", -6.0, 10.2, -6.8, 7.2);

    addRect("4", "402", -5.2, -1.5, 2.0, 4.5);
    addRect("4", "401", -5.2, -1.5, -2.0, 0.5);
    addRect("4", "403", -1.2, 3.2, 3.8, 6.8);

    addRect("4", "404", 2.5, 9.5, 1.5, 3.5);
    addRect("4", "", 2.5, 9.5, 0.2, 1.5);
    addRect("4", "406", 2.5, 9.5, -2.2, 0.2);
    addRect("4", "407", 2.5, 9.5, -4.5, -2.2);
    addRect("4", "408", 3.5, 9.5, -6.2, -4.5);

    // Лестница 4 этажа
    addStair("4", 0.5, -4.5);


    // =========================================================================
    // УПРАВЛЕНИЕ ЭТАЖАМИ, КЛИКАМИ И ПОИСКОМ
    // =========================================================================
    let lastSelectedMesh = null;
    const infoPanel = document.getElementById("info-panel");

    function clearSelection() {
        if (lastSelectedMesh && lastSelectedMesh.originalMaterial) {
            lastSelectedMesh.material = lastSelectedMesh.originalMaterial;
            lastSelectedMesh = null;
        }
    }

    switchFloor = function (targetFloor) {
        clearSelection();
        const keys = ["1", "2", "2.5", "3", "4"];

        keys.forEach(k => {
            const isTarget = (k === String(targetFloor));
            floorGroups[k].setEnabled(isTarget);
            const btn = document.getElementById("btn-floor-" + k);
            if (btn) {
                if (isTarget) btn.classList.add("active");
                else btn.classList.remove("active");
            }
        });

        infoPanel.innerText = `МИДиС — Этаж ${targetFloor}`;
    };

    // Поиск кабинета по номеру или названию
    searchRoom = function (query) {
        const clean = query.trim().toLowerCase();
        if (!clean) return;

        const found = allRooms.find(r => r.roomName && r.roomName.toLowerCase() === clean) ||
                      allRooms.find(r => r.roomName && r.roomName.toLowerCase().includes(clean));

        if (found) {
            switchFloor(found.floorKey);
            found.material = selectedMat;
            lastSelectedMesh = found;
            infoPanel.innerText = `Найдено: ${found.roomName} (Этаж ${found.floorKey})`;
        }
    };

    // Клик мышкой по любому кабинету
    scene.onPointerDown = function (evt, pickResult) {
        if (pickResult.hit && pickResult.pickedMesh) {
            const clicked = pickResult.pickedMesh;
            if (!clicked.roomName) return;

            clearSelection();

            if (clicked.originalMaterial) {
                clicked.material = selectedMat;
                lastSelectedMesh = clicked;
            }
            infoPanel.innerText = `Этаж ${clicked.floorKey} — Аудитория / Объект: «${clicked.roomName}»`;
        }
    };

    // Запускаем с 1 этажа
    switchFloor("1");

    return scene;
};

const scene = createScene();

engine.runRenderLoop(function () {
    scene.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});