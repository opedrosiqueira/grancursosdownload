let database, curso, disciplina, conteudo, aula;

const DB_STORE = "aula";

function openDatabase(name, version) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);

        request.onerror = event => reject(new Error(event.target.error?.message));
        request.onsuccess = event => resolve(event.target.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            const store = db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
            store.createIndex('materia', ['curso', 'disciplina', 'conteudo', 'aula']);
            store.createIndex("curso", "curso");
            store.createIndex("disciplina", "disciplina");
            store.createIndex("conteudo", "conteudo");
            store.createIndex("aula", "aula");
            store.createIndex("slide", "slide");
            store.createIndex("resumo", "resumo");
            store.createIndex("video", "video");
            store.createIndex("slideURL", "slideURL");
            store.createIndex("resumoURL", "resumoURL");
            store.createIndex("videoURL", "videoURL");
        };
    });
}

async function loadDatabase() {
    curso = sanitizeText(document.querySelector('h1').textContent);
    disciplina = sanitizeText(getElementByContent(/^disciplina$/).nextElementSibling.textContent);
    conteudo = sanitizeText(getElementByContent(/^conteúdo$/).nextElementSibling.textContent);
    aula = sanitizeText(document.querySelector('h2').textContent.replace(/\s*\(código.*/i, ''));

    if (!curso || !disciplina || !conteudo || !aula) throw new Error("Missing data " + { curso, disciplina, conteudo, aula });

    return openDatabase("grancursos", 1);
}

function getElementByContent(regex) {
    const divs = document.querySelectorAll('div');
    return Array.from(divs).find(div => div.textContent.match(regex));
}

function sanitizeText(text) {
    return text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').replace(/^-+|-+$/g, '').trim();
}

function withObjectStore(mode, callback) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([DB_STORE], mode);
        const store = transaction.objectStore(DB_STORE);

        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function queryDB(key, value) {
    console.log("Querying", key, value);
    return withObjectStore("readonly", store => {
        const index = store.index(key);
        return index.getAll(value);
    });
}

function addToDB(data) {
    console.log("Adding", data);
    return withObjectStore("readwrite", store => store.add(data));
}

function putToDB(data) {
    if (!data.id) throw new Error("{id} is required");

    console.log("Updating", data.id, data);
    return withObjectStore("readwrite", store =>
        store.get(data.id).onsuccess = event => {
            if (!event.target.result) throw new Error("No data with id", data.id);
            return store.put({ ...event.target.result, ...data });
        }
    );
}

async function updateDatabase(tipo, filename, url, aula = sanitizeText(document.querySelector('h2').textContent.replace(/\s*\(código.*/i, ''))) {
    const [arquivo] = await queryDB(tipo, filename);
    if (!arquivo) await downloadFile(url, filename);

    const [result] = await queryDB("materia", [curso, disciplina, conteudo, aula]);
    if (!result) await addToDB({ curso, disciplina, conteudo, aula, [tipo]: filename, [`${tipo}URL`]: url });
    else if (result[tipo] === filename) console.log(`Already downloaded: ${filename}`);
    else await putToDB({ id: result.id, [tipo]: filename, [`${tipo}URL`]: url });
}

async function downloadFile(url, filename) {
    console.log("Downloading", filename);

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(blobUrl);
}

async function baixarMaterial(label, tipo = "slide") {
    const material = document.querySelector(`a[href^="/aluno/espaco/${label}"]`);

    if (!material?.href) throw new Error("Material not found: " + { label, tipo });

    const urlRes = await fetch(material.href);
    const filename = urlRes.url.split(/\/|\?/).at(-2);

    if (!filename) throw new Error("Filename extraction error: " + urlRes.url);

    await updateDatabase(tipo, filename, urlRes.url);
}

async function baixarVideo() {
    const url = document.querySelector("video").src.trim();
    const filename = url.match(/[^\/]+\.mp4/)[0];
    await updateDatabase("video", filename, url);
}

async function baixarAula() {
    baixarMaterial("download-apostila");
    baixarMaterial("download-resumo", "resumo");
    await baixarVideo();
}

async function salvarProgresso(filename, contentType) { // parei aqui: não está salvando o progresso
    console.log("Saving progress");
}

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
        if (!database) database = await loadDatabase();

        if (request.fn == 'salvarProgresso') salvarProgresso('grancursos.csv', { 'text/csv': ['.csv'] });
        else if (request.fn == 'baixarAula') await baixarAula();

        sendResponse({ success: "TRUE" });
        return true;
    });