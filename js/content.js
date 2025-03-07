let database, curso, disciplina, conteudo, aula, duracao;
const DB_STORE = "aula";

// Open Database and create necessary object store and indexes
function openDatabase(name, version) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);

        request.onerror = event => reject(new Error(event.target.error?.message));
        request.onsuccess = event => resolve(event.target.result);
        request.onupgradeneeded = event => setupDatabase(event.target.result);
    });
}

// Set up the database with object stores and indexes
function setupDatabase(db) {
    const store = db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
    store.createIndex('materia', ['curso', 'disciplina', 'conteudo', 'aula']);
    store.createIndex("slide", "slide");
    store.createIndex("resumo", "resumo");
    store.createIndex("video", "video");
}

// Helper function to find elements by matching text content
function getElementByContent(search, ignoreRegex = false) {
    const divs = document.querySelectorAll('div');
    return Array.from(divs).findLast(div => ignoreRegex ?
        div.textContent.includes(search) :
        div.textContent.match(search)
    );
}

// Sanitize text by replacing non-alphanumeric characters with hyphens
function sanitizeText(text) {
    return text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').replace(/^-+|-+$/g, '').trim();
}

// Sanitize and extract relevant data from the DOM
async function loadDatabase() {
    curso = sanitizeText(document.querySelector('h1').textContent);
    disciplina = sanitizeText(getElementByContent(/^disciplina$/).nextElementSibling.textContent);
    conteudo = sanitizeText(getElementByContent(/^conteúdo$/).nextElementSibling.textContent);
    aula = sanitizeText(document.querySelector('h2').textContent.replace(/\s*\(código.*/i, ''));
    duracao = getElementByContent(document.querySelector('h2').textContent.replace(/\s*\(código.*/i, ''), true).querySelector('time').textContent.trim();

    if (!curso || !disciplina || !conteudo || !aula || !duracao) {
        throw new Error("Missing data: " + { curso, disciplina, conteudo, aula, duracao });
    }

    return openDatabase("grancursos", 1);
}

// Generalized function for interacting with the object store
function withObjectStore(mode, callback) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([DB_STORE], mode);
        const store = transaction.objectStore(DB_STORE);

        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Query the database with a specific key and value
function queryDB(key, value) {
    console.log("Querying", key, value);
    return withObjectStore("readonly", store => store.index(key).getAll(value));
}

// Add new data to the database
function addToDB(data) {
    console.log("Adding", data);
    return withObjectStore("readwrite", store => store.add(data));
}

// Update data in the database
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

// Update the database with file information
async function updateDatabase(tipo, filename, url, aulaAtual = aula, duracaoAtual = duracao) {
    const [arquivo] = await queryDB(tipo, filename);
    if (!arquivo) await downloadFile(url, filename);

    const [result] = await queryDB("materia", [curso, disciplina, conteudo, aulaAtual]);
    if (!result) {
        await addToDB({ curso, disciplina, conteudo, aula: aulaAtual, duracao: duracaoAtual, [tipo]: filename, [`${tipo}URL`]: url });
    } else if (result[tipo] === filename) {
        console.log(`Already downloaded: ${filename}`);
    } else {
        await putToDB({ id: result.id, [tipo]: filename, [`${tipo}URL`]: url });
    }
}

// Download a file and trigger the browser's download behavior
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

// Download material (e.g., slides or summaries)
async function baixarMaterial(label, tipo = "slide") {
    const material = document.querySelector(`a[href^="/aluno/espaco/${label}"]`);

    if (!material?.href) throw new Error("Material not found: " + { label, tipo });

    const urlRes = await fetch(material.href);
    const filename = urlRes.url.split(/\/|\?/).at(-2);

    if (!filename) throw new Error("Filename extraction error: " + urlRes.url);

    await updateDatabase(tipo, filename, urlRes.url);
}

// Download a video file
async function baixarVideo() {
    const url = document.querySelector("video").src.trim();
    const filename = url.match(/[^\/]+\.mp4/)[0];
    await updateDatabase("video", filename, url);
}

// Download all relevant materials for a class
async function baixarAula() {
    baixarMaterial("download-apostila");
    baixarMaterial("download-resumo", "resumo");
    baixarVideo();
}

// Save the progress to a file (CSV format)
async function exportar(filename, contentType) {
    const data = await withObjectStore("readonly", store => store.getAll());
    const csv =
        "curso\tdisciplina\tconteudo\taula\tduracao\tresumo\tresumoURL\tid\tslide\tslideURL\tvideo\tvideoURL\n" +
        data.map(row => Object.values(row).join('\t')).join('\n');

    const blob = new Blob([csv], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Load progress from a file (CSV format)
async function importar(filename, contentType) {
    console.log('falta testar');
    // const file = await fetch(filename);
    // const text = await file.text();
    // const rows = text.split('\n').slice(1);

    // for (const row of rows) {
    //     const [curso, disciplina, conteudo, aula, duracao, resumo, resumoURL, id, slide, slideURL, video, videoURL] = row.split('\t');
    //     await addToDB({ curso, disciplina, conteudo, aula, duracao, resumo, resumoURL, id, slide, slideURL, video, videoURL });
    // }
}

// Event listener for message handling
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (!database) database = await loadDatabase();

    if (request.fn === 'exportar') exportar('grancursos.csv', 'text/csv');
    else if (request.fn === 'importar') importar('grancursos.csv', 'text/csv');
    else if (request.fn === 'baixarAula') baixarAula();

    sendResponse({ success: "TRUE" });
    return true;
});