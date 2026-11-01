window.onerror = function (msg, url, line) {
    const log = document.getElementById('error-log');
    log.style.display = 'block';
    log.innerHTML += `Ошибка: ${msg} <br> Строка: ${line}<br><br>`;
    return false;
};

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// Глобальная функция для кнопок переключения этажей
let switchFloor = function () {};

function makeMaterial(scene, hexColor) {
    const mat = new BABYLON.StandardMaterial("mat", scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString(hexColor);
    mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    return mat;
}

const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.09, 0.11, 0.15, 1);

    // КАМЕРА
    const camera = new BABYLON.ArcRotateCamera(
        "camera1",
        -Math.PI / 2,
        Math.PI / 3.4,
        62,
        new BABYLON.Vector3(3, 0, 1),
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 15;
    camera.upperRadiusLimit = 100;
    camera.upperBetaLimit = Math.PI / 2.2;

    // СВЕТ
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 30, -10), scene);
    light.intensity = 1.0;

    // ЦВЕТА КАРТЫ
    const floorMat = makeMaterial(scene, "#1b232e");    // Пол коридора
    const holeMat = makeMaterial(scene, "#11161d");     // Внутренний двор (колодец на 2 этаже)
    const roomMat = makeMaterial(scene, "#2b3d52");     // Обычные кабинеты (синие)
    const specialMat = makeMaterial(scene, "#3b3355");  // Кабинеты со значком шапочки/кадров (фиолетово-синие)
    const foodMat = makeMaterial(scene, "#5c3d2e");     // Еда и магазин (рыже-коричневые)
    const serviceMat = makeMaterial(scene, "#2f4f47");  // Вход, гардероб, лестницы (зеленоватые)
    const selectedMat = makeMaterial(scene, "#e07a24"); // Выбранный кабинет

    // Две группы ("папки") для хранения объектов 1 и 2 этажа
    const floor1Group = new BABYLON.TransformNode("floor1Group", scene);
    const floor2Group = new BABYLON.TransformNode("floor2Group", scene);

    // === ФУНКЦИЯ СОЗДАНИЯ ТЕКСТА НА КРЫШЕ КАБИНЕТА ===
    function addRoofLabel(parentBox, text, w, d, height) {
        const plane = BABYLON.MeshBuilder.CreatePlane("label_" + text, { width: w, height: d }, scene);
        plane.parent = parentBox;
        plane.position.y = (height / 2) + 0.02; // Чуть выше крыши кабинета
        plane.rotation.x = Math.PI / 2;         // Кладем текст горизонтально
        plane.isPickable = false;               // Чтобы клик проходил сквозь текст на сам кабинет

        // Рисуем текст на динамической текстуре
        const tex = new BABYLON.DynamicTexture("tex_" + text, { width: 256, height: 256 }, scene, false);
        tex.hasAlpha = true;
        const ctx = tex.getContext();
        ctx.clearRect(0, 0, 256, 256);

        // Подбираем размер шрифта под длину названия
        const fontSize = text.length > 7 ? 30 : 48;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 128, 128);
        tex.update();

        const labelMat = new BABYLON.StandardMaterial("labelMat_" + text, scene);
        labelMat.diffuseTexture = tex;
        labelMat.emissiveColor = new BABYLON.Color3(1, 1, 1); // Чтобы текст светился и был ярким
        labelMat.useAlphaFromDiffuseTexture = true;
        labelMat.backFaceCulling = false;
        plane.material = labelMat;
    }

    // === ГЛАВНАЯ ФУНКЦИЯ ПОСТРОЙКИ КАБИНЕТА ===
    // gap = 0.25 автоматически уменьшает блок на четверть метра, чтобы они НЕ сливались!
    function createRoom(floorGroup, name, w, d, x, z, customMaterial = roomMat, height = 1.5) {
        const gap = 0.25; 
        const actualW = Math.max(0.5, w - gap);
        const actualD = Math.max(0.5, d - gap);

        const box = BABYLON.MeshBuilder.CreateBox(name, { width: actualW, depth: actualD, height: height }, scene);
        box.parent = floorGroup; // Привязываем к нужному этажу
        box.position.x = x;
        box.position.z = z;
        box.position.y = height / 2;
        box.material = customMaterial;
        box.originalMaterial = customMaterial;

        // Четкая светлая обводка каждого кабинета
        box.enableEdgesRendering();
        box.edgesWidth = 3.5;
        box.edgesColor = new BABYLON.Color4(0.65, 0.78, 0.92, 1);

        // Вешаем постоянную подпись сверху
        addRoofLabel(box, name, actualW, actualD, height);

        return box;
    }

    // =========================================================
    // ЭТАЖ 1 (МИДИС + ШКОЛА)
    // =========================================================
    const f1Ground1 = BABYLON.MeshBuilder.CreateGround("f1_g1", { width: 32, height: 30 }, scene);
    f1Ground1.parent = floor1Group;
    f1Ground1.position.set(-3, 0, 1);
    f1Ground1.material = floorMat;

    const f1Ground2 = BABYLON.MeshBuilder.CreateGround("f1_g2", { width: 14, height: 30 }, scene);
    f1Ground2.parent = floor1Group;
    f1Ground2.position.set(22, 0, 2);
    f1Ground2.material = floorMat;

    // Нижний ряд 1 этажа
    createRoom(floor1Group, "Главный вход", 4.5, 2.5, -2, -12, serviceMat, 0.7);
    createRoom(floor1Group, "Лестница", 3, 2.5, -11, -12, serviceMat, 1.0);
    createRoom(floor1Group, "Холл", 4, 2.5, -7, -12);
    createRoom(floor1Group, "107", 5, 2.5, 4.5, -12);

    // Столовая, Буфет, Гардероб, 122Б
    createRoom(floor1Group, "Столовая", 6.5, 9, -14.5, -3.5, foodMat);
    createRoom(floor1Group, "Буфет", 4.5, 3.5, -6.5, -6, foodMat);
    createRoom(floor1Group, "122Б", 4.5, 3.5, -6.5, -2);
    createRoom(floor1Group, "Гардероб", 5.5, 3.5, 4, -6, serviceMat);

    // Левая верхняя часть 1 этажа
    createRoom(floor1Group, "Зал 1", 6, 4.5, -7, 3);
    createRoom(floor1Group, "Левое крыло", 6.5, 7, -14.5, 5);
    createRoom(floor1Group, "Холл МИДИС", 8, 5, -7, 10);

    // Центр 1 этажа (108 и Магазин)
    createRoom(floor1Group, "108", 3.5, 5, 5, -0.5);
    createRoom(floor1Group, "Магазин", 3.5, 4, 5, 4.5, foodMat);
    createRoom(floor1Group, "Блок А", 3.5, 4, 1, 7.5);
    createRoom(floor1Group, "Блок Б", 3.5, 3.5, 1, 11.5);

    // Правая стена МИДИСа (125 -> 121 -> 117 -> 115 -> 111)
    createRoom(floor1Group, "125", 4.5, 3.5, 10.5, 11.5);
    createRoom(floor1Group, "121", 4.5, 4.5, 10.5, 7);
    createRoom(floor1Group, "117", 4.5, 5, 10.5, 1.8);
    createRoom(floor1Group, "115", 4.5, 4, 10.5, -3.2);
    createRoom(floor1Group, "111", 4.5, 3.5, 10.5, -7.5);
    createRoom(floor1Group, "Угол", 4.5, 2.5, 10.5, -12);

    // ШКОЛА (1 этаж, правее)
    createRoom(floor1Group, "101", 3.5, 2.5, 18, -11);
    createRoom(floor1Group, "Лестница Шк", 3.5, 3, 18, 3, serviceMat, 1.0);
    createRoom(floor1Group, "125 Шк", 3.5, 3.5, 18, 9);
    createRoom(floor1Group, "127", 4.5, 4, 17.5, 13.5);
    createRoom(floor1Group, "108 Шк", 5, 5, 25, -8.5);
    createRoom(floor1Group, "108Б", 5, 3, 25, -4);
    createRoom(floor1Group, "Каб. Шк", 5, 4, 25, 0);
    createRoom(floor1Group, "118", 5, 3.5, 25, 4.2);
    createRoom(floor1Group, "124", 5, 7.5, 25, 10.2);
    createRoom(floor1Group, "Торец Шк", 7, 2.5, 24, 15.8);


    // =========================================================
    // ЭТАЖ 2 (ПО ТВОИМ НОВЫМ СКРИНШОТАМ)
    // =========================================================
    const f2Ground = BABYLON.MeshBuilder.CreateGround("f2_g1", { width: 38, height: 32 }, scene);
    f2Ground.parent = floor2Group;
    f2Ground.position.set(1, 0, 1);
    f2Ground.material = floorMat;

    // Внутренний квадратный колодец/атриум в центре 2 этажа (темная сетка на скрине 2)
    const courtyard = BABYLON.MeshBuilder.CreateBox("Атриум (свет)", { width: 9.5, depth: 9.5, height: 0.1 }, scene);
    courtyard.parent = floor2Group;
    courtyard.position.set(2, 0.05, 0.5);
    courtyard.material = holeMat;
    courtyard.isPickable = false;

    // 1. Левый край 2 этажа (241, 245, 251, 250, 239)
    createRoom(floor2Group, "241", 4, 5.5, -14, 3.5, specialMat);
    createRoom(floor2Group, "245", 4, 4.5, -14, -2);
    createRoom(floor2Group, "251", 3, 3.5, -14.5, -7.5);
    createRoom(floor2Group, "250", 3, 3.5, -11.2, -7.5);
    createRoom(floor2Group, "239", 3, 3.5, -7.9, -7.5);
    createRoom(floor2Group, "Холл 2эт", 3.5, 3.5, -4.3, -7.5);

    // 2. Левый внутренний ряд (243, 249, 248, 246)
    createRoom(floor2Group, "243", 3, 4.5, -9, 7);
    createRoom(floor2Group, "249", 3, 4.5, -5.8, 7);
    createRoom(floor2Group, "248", 5.5, 3.5, -7.5, 2);
    createRoom(floor2Group, "246", 5.5, 3.5, -7.5, -2);

    // 3. Колонка перед атриумом (240, 242, 244)
    createRoom(floor2Group, "240", 5, 2, -1.5, 8.2);
    createRoom(floor2Group, "242", 5, 6, -1.5, 3.8);
    createRoom(floor2Group, "244", 5, 5.5, -1.5, -2.5);

    // 4. Верхний ряд (235, 233, 231, 229, 227, 225, 221)
    createRoom(floor2Group, "235", 3, 4.5, -2.5, 13.5, specialMat);
    createRoom(floor2Group, "233", 3, 4.5, 0.8, 13.5);
    createRoom(floor2Group, "231", 3.2, 4.5, 4.2, 13.5, specialMat);
    createRoom(floor2Group, "229", 3.2, 4.5, 7.7, 13.5);
    createRoom(floor2Group, "227", 3.2, 4.5, 11.2, 13.5);
    createRoom(floor2Group, "225", 2.5, 3.5, 14.5, 14);
    createRoom(floor2Group, "221", 5, 3, 18.8, 13.5);

    // 5. Над атриумом (236, 238, 232, 230)
    createRoom(floor2Group, "236", 3.5, 3, 2, 7.5, specialMat);
    createRoom(floor2Group, "238", 2.2, 3, 5.2, 7.5);
    createRoom(floor2Group, "232", 2.5, 3, 8, 7.5);
    createRoom(floor2Group, "230", 2.2, 3, 10.7, 7.5);

    // 6. Под атриумом (204 Отдел кадров, 206)
    createRoom(floor2Group, "204 Кадры", 6.5, 3.5, -1, -6.8, specialMat);
    createRoom(floor2Group, "206", 6, 3.5, 6.5, -6.8);

    // 7. Самый нижний ряд (201, 203, 207, 208, 209, 211)
    createRoom(floor2Group, "201", 2.5, 3.5, -4, -12.5);
    createRoom(floor2Group, "203", 3, 3.5, -1, -12.5);
    createRoom(floor2Group, "207", 2.8, 3.5, 2.2, -12.5);
    createRoom(floor2Group, "208", 5, 3.5, 6.5, -12.5);
    createRoom(floor2Group, "209", 3.5, 3.5, 11.2, -12.5);
    createRoom(floor2Group, "Лестн. Юг", 2.5, 3.5, 14.5, -12.5, serviceMat, 1.0);
    createRoom(floor2Group, "211", 5, 3.5, 18.8, -12.5);

    // 8. Правый внутренний ряд (228 -> 224 -> 220 -> 218 -> 216 -> 214)
    createRoom(floor2Group, "228", 4, 3, 12, 7.5);
    createRoom(floor2Group, "224", 4, 2.2, 12, 4.5);
    createRoom(floor2Group, "220", 4, 3, 12, 1.5);
    createRoom(floor2Group, "218", 4, 3, 12, -1.8);
    createRoom(floor2Group, "216", 4, 2.8, 12, -5);
    createRoom(floor2Group, "214", 4, 2.2, 12, -7.8);

    // 9. Правая внешняя стена (219 -> 217 -> 215 -> 213 -> 212)
    createRoom(floor2Group, "219", 5, 5.5, 18.8, 6.5);
    createRoom(floor2Group, "217", 5, 3, 18.8, 1.8);
    createRoom(floor2Group, "215", 5, 5.5, 18.8, -2.8);
    createRoom(floor2Group, "213", 5, 3, 18.8, -7.4);
    createRoom(floor2Group, "212", 5, 2.5, 18.8, -10.3);

    // 10. Переход в Школу справа сверху (Скрин 4)
    createRoom(floor2Group, "Переход в Школу", 8, 3.5, 26, 7.5, serviceMat, 1.2);
    createRoom(floor2Group, "Школа (лестн.)", 3.5, 3.5, 28.2, 4, serviceMat, 1.2);

    // По умолчанию при запуске прячем 2 этаж, оставляем 1-й
    floor2Group.setEnabled(false);

    // =========================================================
    // ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ЭТАЖЕЙ И КЛИКОВ
    // =========================================================
    let lastSelectedMesh = null;
    const infoPanel = document.getElementById("info-panel");
    const btn1 = document.getElementById("btn-floor-1");
    const btn2 = document.getElementById("btn-floor-2");

    switchFloor = function (floorNum) {
        // Сбрасываем выделение при смене этажа
        if (lastSelectedMesh && lastSelectedMesh.originalMaterial) {
            lastSelectedMesh.material = lastSelectedMesh.originalMaterial;
            lastSelectedMesh = null;
        }

        if (floorNum === 1) {
            floor1Group.setEnabled(true);
            floor2Group.setEnabled(false);
            btn1.classList.add("active");
            btn2.classList.remove("active");
            infoPanel.innerText = "Этаж 1 — Кликни на любой кабинет";
        } else if (floorNum === 2) {
            floor1Group.setEnabled(false);
            floor2Group.setEnabled(true);
            btn2.classList.add("active");
            btn1.classList.remove("active");
            infoPanel.innerText = "Этаж 2 — Кликни на любой кабинет";
        }
    };

    scene.onPointerDown = function (evt, pickResult) {
        if (pickResult.hit && pickResult.pickedMesh) {
            const clicked = pickResult.pickedMesh;

            // Игнорируем клики по полу
            if (clicked.name.startsWith("f1_") || clicked.name.startsWith("f2_")) {
                return;
            }

            if (lastSelectedMesh && lastSelectedMesh.originalMaterial) {
                lastSelectedMesh.material = lastSelectedMesh.originalMaterial;
            }

            clicked.material = selectedMat;
            lastSelectedMesh = clicked;

            infoPanel.innerText = "Выбрано: Аудитория / Объект «" + clicked.name + "»";
        }
    };

    return scene;
};

const scene = createScene();

engine.runRenderLoop(function () {
    scene.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});